const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';

const Order = require('../src/model/Order');
const Product = require('../src/model/Products');
const { cancelOrder } = require('../src/services/OrderCancellationService');

const orderId = new mongoose.Types.ObjectId();
const productId = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();
const adminId = new mongoose.Types.ObjectId();

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

const fakeOrder = (status = 'pending') => ({
  _id: orderId,
  user: userId,
  code: 'ORD-20261126-000001',
  status,
  items: [
    {
      product: productId,
      sku: 'SP-AO-001-M-DEN',
      qty: 2,
      unitPrice: 199000,
      lineTotal: 398000,
    },
  ],
});

const cancel = (overrides = {}) =>
  cancelOrder({
    orderId,
    actorRole: 'customer',
    actorId: userId,
    isOwner: true,
    note: '',
    ...overrides,
  });

test('T6-2-1: owner huy pending - CAS gan marker va hoan kho', async () => {
  const calls = [];

  await withPatches(
    [
      [Order, 'findById', async () => fakeOrder()],
      [
        Order,
        'findOneAndUpdate',
        async (filter, update, options) => {
          calls.push(['cas', filter, update, options]);
          return { _id: orderId, code: 'ORD-20261126-000001', status: 'cancelled', stockRestoredAt: update.$set.stockRestoredAt };
        },
      ],
      [
        Product,
        'updateOne',
        async (filter, update) => {
          calls.push(['restore', filter, update]);
          return { modifiedCount: 1 };
        },
      ],
    ],
    async () => {
      const result = await cancel();
      assert.equal(result.status, 'cancelled');
      assert.ok(result.stockRestoredAt);
    }
  );

  const cas = calls.find((call) => call[0] === 'cas');
  assert.deepEqual(cas[1], { _id: orderId, status: 'pending', stockRestoredAt: null });
  assert.equal(cas[2].$set.status, 'cancelled');
  assert.ok(cas[2].$set.stockRestoredAt instanceof Date);
  assert.equal(cas[2].$push.statusHistory.status, 'cancelled');
  assert.equal(String(cas[2].$push.statusHistory.by), String(userId));
  assert.equal(cas[3].returnDocument, 'after');

  const restore = calls.find((call) => call[0] === 'restore');
  assert.equal(String(restore[1]._id), String(productId));
  assert.equal(restore[1]['variants.sku'], 'SP-AO-001-M-DEN');
  assert.equal(restore[2].$inc['variants.$.stock'], 2);
});

test('T6-2-1: customer khong phai owner bi tu choi, khong ghi DB', async () => {
  let casCalls = 0;

  await withPatches(
    [
      [Order, 'findById', async () => fakeOrder()],
      [
        Order,
        'findOneAndUpdate',
        async () => {
          casCalls += 1;
          return null;
        },
      ],
    ],
    async () => {
      const error = await cancel({ isOwner: false }).catch((err) => err);
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, 'ORDER_NOT_OWNER');
    }
  );

  assert.equal(casCalls, 0);
});

test('T6-2-1: customer khong duoc huy confirmed, admin duoc', async () => {
  await withPatches([[Order, 'findById', async () => fakeOrder('confirmed')]], async () => {
    const error = await cancel().catch((err) => err);
    assert.equal(error.statusCode, 403);
    assert.equal(error.code, 'ORDER_FORBIDDEN_ROLE');
  });

  await withPatches(
    [
      [Order, 'findById', async () => fakeOrder('confirmed')],
      [
        Order,
        'findOneAndUpdate',
        async (filter) => ({ _id: orderId, status: 'cancelled', filter }),
      ],
      [Product, 'updateOne', async () => ({ modifiedCount: 1 })],
    ],
    async () => {
      const result = await cancel({
        actorRole: 'admin',
        actorId: adminId,
        isOwner: false,
      });
      assert.equal(result.status, 'cancelled');
      assert.equal(result.filter.status, 'confirmed');
    }
  );
});

test('T6-2-1: trang thai terminal bi tu choi, khong hoan kho', async () => {
  let casCalls = 0;

  await withPatches(
    [
      [Order, 'findById', async () => fakeOrder('delivered')],
      [
        Order,
        'findOneAndUpdate',
        async () => {
          casCalls += 1;
          return null;
        },
      ],
    ],
    async () => {
      const error = await cancel({ actorRole: 'admin', isOwner: false }).catch(
        (err) => err
      );
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, 'ORDER_INVALID_TRANSITION');
    }
  );

  assert.equal(casCalls, 0);
});

test('T6-2-1: CAS that bai tra 409 va khong hoan kho', async () => {
  let restoreCalls = 0;

  await withPatches(
    [
      [Order, 'findById', async () => fakeOrder()],
      [Order, 'findOneAndUpdate', async () => null],
      [
        Product,
        'updateOne',
        async () => {
          restoreCalls += 1;
          return { modifiedCount: 1 };
        },
      ],
    ],
    async () => {
      const error = await cancel().catch((err) => err);
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, 'ORDER_STATUS_CONFLICT');
    }
  );

  assert.equal(restoreCalls, 0);
});

test('T6-2-1: hoan kho that bai van giu marker va bao loi', async () => {
  let markerSet = false;

  await withPatches(
    [
      [Order, 'findById', async () => fakeOrder()],
      [
        Order,
        'findOneAndUpdate',
        async (filter, update) => {
          markerSet = Boolean(update.$set.stockRestoredAt);
          return { _id: orderId, status: 'cancelled' };
        },
      ],
      [
        Product,
        'updateOne',
        async () => {
          throw new Error('restore down');
        },
      ],
      [console, 'error', () => {}],
    ],
    async () => {
      const error = await cancel().catch((err) => err);
      assert.equal(error.statusCode, 500);
      assert.equal(error.code, 'ORDER_RESTOCK_FAILED');
    }
  );

  assert.equal(markerSet, true);
});
