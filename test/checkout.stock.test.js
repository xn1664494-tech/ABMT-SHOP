const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';

const Product = require('../src/model/Products');
const Order = require('../src/model/Order');
const Cart = require('../src/model/Cart');
const ErrorResponse = require('../src/utils/appError');
const { createOrder } = require('../src/services/CheckoutService');
const { decrementStock } = require('../src/services/ProductsServices');

const productId = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();
const orderId = new mongoose.Types.ObjectId();

const withPatches = async (patches, fn) => {
  const saved = patches.map(([target, key]) => [target, key, target[key]]);
  for (const [target, key, impl] of patches) {
    target[key] = impl;
  }

  try {
    return await fn();
  } finally {
    for (const [target, key, original] of saved) {
      target[key] = original;
    }
  }
};

const makePayload = ({ qty = 1, sku = 'SP-AO-001-M-DEN' } = {}) => {
  const unitPrice = 199000;
  return {
    items: [
      {
        product: productId,
        name: 'Ao Thun Basic',
        image: '',
        sku,
        size: 'M',
        color: 'Den',
        unitPrice,
        qty,
        lineTotal: unitPrice * qty,
      },
    ],
    shippingAddress: {
      fullName: 'Nguyen Van A',
      phone: '0912345678',
      province: 'Ha Noi',
      ward: 'Dich Vong',
      detail: '1 Nguyen Trai',
    },
    paymentMethod: 'cod',
    subtotal: unitPrice * qty,
    shippingFee: 30000,
    discount: 0,
    total: unitPrice * qty + 30000,
    note: '',
  };
};

test('checkout: CAS đúng variant, chỉ hoàn dòng đã trừ khi dòng sau lỗi', async () => {
  const calls = [];

  await withPatches(
    [
      [
        Product,
        'updateOne',
        async (filter, update) => {
          calls.push({ filter, update });
          return {
            modifiedCount:
              filter['variants.sku'] === 'SP-AO-002-S-XANH' ? 0 : 1,
          };
        },
      ],
    ],
    async () => {
      const error = await decrementStock([
        { productId, variantSku: 'SP-AO-001-M-DEN', qty: 1 },
        { productId, variantSku: 'SP-AO-002-S-XANH', qty: 1 },
        { productId, variantSku: 'SP-AO-003-L-DEN', qty: 1 },
      ]).catch((err) => err);

      assert.equal(error.statusCode, 409);
      assert.match(error.message, /SP-AO-002-S-XANH/);
    }
  );

  assert.equal(calls.length, 3);
  assert.deepEqual(calls[0].filter['variants.stock'], { $gte: 1 });
  assert.equal(calls[0].filter.isDeleted, false);
  assert.equal(calls[0].update.$inc['variants.$.stock'], -1);
  assert.equal(calls[1].filter['variants.sku'], 'SP-AO-002-S-XANH');
  assert.equal(calls[2].filter['variants.sku'], 'SP-AO-001-M-DEN');
  assert.equal(calls[2].update.$inc['variants.$.stock'], 1);
  assert.equal(
    calls.some((call) => call.filter['variants.sku'] === 'SP-AO-003-L-DEN'),
    false
  );
});

test('checkout: thành công thì trừ kho, tạo đơn và xóa giỏ', async () => {
  const calls = [];

  await withPatches(
    [
      [
        Product,
        'updateOne',
        async (filter, update) => {
          calls.push(['stock', filter, update]);
          return { modifiedCount: 1 };
        },
      ],
      [
        Order,
        'create',
        async (data) => {
          calls.push(['order', data]);
          return { _id: orderId, code: 'ORD-TEST' };
        },
      ],
      [
        Cart,
        'deleteOne',
        async (filter) => {
          calls.push(['cart', filter]);
          return { deletedCount: 1 };
        },
      ],
    ],
    async () => {
      const order = await createOrder({ userId, orderPayload: makePayload() });
      assert.equal(order._id, orderId);
    }
  );

  assert.equal(calls.filter((call) => call[0] === 'stock').length, 1);
  assert.equal(calls.filter((call) => call[0] === 'stock')[0][2].$inc['variants.$.stock'], -1);
  assert.equal(calls.filter((call) => call[0] === 'order').length, 1);
  assert.deepEqual(calls.find((call) => call[0] === 'cart')[1], { user: userId });
});

test('checkout: Order.create lỗi thì hoàn kho, không xóa giỏ', async () => {
  const calls = [];

  await withPatches(
    [
      [
        Product,
        'updateOne',
        async (filter, update) => {
          calls.push(['stock', filter, update]);
          return { modifiedCount: 1 };
        },
      ],
      [
        Order,
        'create',
        async () => {
          throw new ErrorResponse('order fail', 500);
        },
      ],
      [
        Cart,
        'deleteOne',
        async () => {
          calls.push(['cart']);
          return { deletedCount: 1 };
        },
      ],
    ],
    async () => {
      const error = await createOrder({
        userId,
        orderPayload: makePayload(),
      }).catch((err) => err);

      assert.match(error.message, /order fail/);
    }
  );

  const stockCalls = calls.filter((call) => call[0] === 'stock');
  assert.equal(stockCalls.length, 2);
  assert.equal(stockCalls[0][2].$inc['variants.$.stock'], -1);
  assert.equal(stockCalls[1][2].$inc['variants.$.stock'], 1);
  assert.equal(calls.some((call) => call[0] === 'cart'), false);
});

test('checkout: xóa giỏ thất bại thì xóa đơn pending và hoàn kho', async () => {
  const calls = [];

  await withPatches(
    [
      [
        Product,
        'updateOne',
        async (filter, update) => {
          calls.push(['stock', filter, update]);
          return { modifiedCount: 1 };
        },
      ],
      [
        Order,
        'create',
        async () => ({ _id: orderId }),
      ],
      [
        Cart,
        'deleteOne',
        async () => ({ deletedCount: 0 }),
      ],
      [
        Order,
        'deleteOne',
        async (filter) => {
          calls.push(['deleteOrder', filter]);
          return { deletedCount: 1 };
        },
      ],
    ],
    async () => {
      const error = await createOrder({
        userId,
        orderPayload: makePayload(),
      }).catch((err) => err);

      assert.equal(error.statusCode, 409);
      assert.match(error.message, /Giỏ hàng đã thay đổi/);
    }
  );

  const deleteCall = calls.find((call) => call[0] === 'deleteOrder');
  assert.ok(deleteCall);
  assert.equal(String(deleteCall[1]._id), String(orderId));
  assert.equal(deleteCall[1].status, 'pending');
  assert.equal(calls.filter((call) => call[0] === 'stock').length, 2);
});

test('checkout: CAS lỗi thì không tạo đơn và không hoàn thừa', async () => {
  let stockCalls = 0;
  let orderCreated = false;

  await withPatches(
    [
      [
        Product,
        'updateOne',
        async () => {
          stockCalls += 1;
          return { modifiedCount: 0 };
        },
      ],
      [
        Order,
        'create',
        async () => {
          orderCreated = true;
          return { _id: orderId };
        },
      ],
    ],
    async () => {
      const error = await createOrder({
        userId,
        orderPayload: makePayload(),
      }).catch((err) => err);

      assert.equal(error.statusCode, 409);
    }
  );

  assert.equal(stockCalls, 1);
  assert.equal(orderCreated, false);
});

test('checkout: qty không hợp lệ bị chặn trước khi trừ kho', async () => {
  const error = await createOrder({
    userId,
    orderPayload: makePayload({ qty: 0 }),
  }).catch((err) => err);

  assert.equal(error.statusCode, 400);
});
