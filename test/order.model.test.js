const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Order = require('../src/model/Order');
const { ORDER_CODE_REGEX } = require('../src/utils/orderCode');

const objectId = () => new mongoose.Types.ObjectId();

const address = (overrides = {}) => ({
  fullName: 'Nguyen Van A',
  phone: '0912345678',
  province: 'Ha Noi',
  district: 'Cau Giay',
  ward: 'Dich Vong',
  detail: '1 Nguyen Trai',
  ...overrides,
});

const item = (overrides = {}) => ({
  product: objectId(),
  name: 'Ao Thun Basic',
  image: 'https://cdn.example.com/a.jpg',
  sku: 'SP-AO-001-M-DEN',
  size: 'M',
  color: 'Den',
  unitPrice: 199000,
  qty: 1,
  ...overrides,
});

const base = (overrides = {}) =>
  new Order({
    user: objectId(),
    items: [item()],
    shippingAddress: address(),
    ...overrides,
  });

const errorsOf = async (doc) => {
  const error = await doc.validate().catch((err) => err);
  assert.ok(error, 'du lieu phai bi tu choi');
  return error.errors;
};

test('T2-2-1: Order khai bao day du field va default', () => {
  assert.equal(Order.modelName, 'Order');

  for (const field of [
    'code',
    'user',
    'items',
    'shippingAddress',
    'paymentMethod',
    'paymentStatus',
    'status',
    'statusHistory',
    'subtotal',
    'shippingFee',
    'discount',
    'total',
    'note',
    'createdAt',
    'updatedAt',
  ]) {
    assert.ok(Order.schema.path(field), `thieu field ${field}`);
  }

  assert.equal(Order.schema.path('paymentMethod').defaultValue, 'cod');
  assert.equal(Order.schema.path('paymentStatus').defaultValue, 'unpaid');
  assert.equal(Order.schema.path('status').defaultValue, 'pending');
  assert.equal(Order.schema.path('discount').defaultValue, 0);
  assert.equal(Order.schema.path('isDeleted'), undefined);
});

test('T2-2-1: OrderItem la snapshot day du field', () => {
  const itemsPath = Order.schema.path('items');

  for (const field of [
    'product',
    'name',
    'image',
    'sku',
    'size',
    'color',
    'unitPrice',
    'qty',
    'lineTotal',
  ]) {
    assert.ok(itemsPath.schema.path(field), `thieu field items.${field}`);
  }
});

test('T2-2-1: code duoc sinh dung format ORD-YYYYMMDD-XXXXXX', async () => {
  const doc = base({
    _id: new mongoose.Types.ObjectId('64b7f0c2a1b2c3d4e5f6a7b8'),
  });
  await doc.validate();

  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(
    2,
    '0',
  )}${String(now.getDate()).padStart(2, '0')}`;

  assert.match(doc.code, ORDER_CODE_REGEX);
  assert.equal(doc.code.slice(-6), 'F6A7B8');
  assert.equal(doc.code.slice(4, 12), datePart);
});

test('T2-2-1: code sai format bi tu choi', async () => {
  const errors = await errorsOf(base({ code: 'INVALID-CODE' }));
  assert.ok(errors.code);
});

test('T2-2-1: don hang phai co it nhat mot san pham', async () => {
  const missing = await errorsOf(base({ items: [] }));
  assert.ok(missing.items);
});

test('T2-2-1: OrderItem thieu field bat buoc bi tu choi', async () => {
  const errors = await errorsOf(
    base({
      items: [
        item({
          product: undefined,
          name: undefined,
          sku: undefined,
          unitPrice: undefined,
          qty: undefined,
        }),
      ],
    }),
  );

  assert.ok(errors['items.0.product']);
  assert.ok(errors['items.0.name']);
  assert.ok(errors['items.0.sku']);
  assert.ok(errors['items.0.unitPrice']);
  assert.ok(errors['items.0.qty']);
});

test('T2-2-1: tu tinh lineTotal, subtotal, shippingFee va total', async () => {
  const doc = base({
    items: [
      item({ unitPrice: 199000, qty: 1 }),
      item({ sku: 'SP-AO-002-L-DEN', unitPrice: 250000, qty: 2 }),
    ],
  });

  await doc.validate();

  assert.equal(doc.items[0].lineTotal, 199000);
  assert.equal(doc.items[1].lineTotal, 500000);
  assert.equal(doc.subtotal, 699000);
  assert.equal(doc.shippingFee, 0);
  assert.equal(doc.total, 699000);
});

test('T2-2-1: phi ship 30.000 khi duoi 500.000 va ap dung discount', async () => {
  const doc = base({
    items: [item({ unitPrice: 100000, qty: 1 })],
    discount: 10000,
  });

  await doc.validate();

  assert.equal(doc.subtotal, 100000);
  assert.equal(doc.shippingFee, 30000);
  assert.equal(doc.total, 120000);
});

test('T2-2-1: shippingFee truyen vao duoc giu nguyen (snapshot)', async () => {
  const doc = base({ shippingFee: 15000 });
  await doc.validate();

  assert.equal(doc.shippingFee, 15000);
  assert.equal(doc.total, 214000);
});

test('T2-2-1: enum status, paymentMethod, paymentStatus', async () => {
  const statusErrors = await errorsOf(base({ status: 'done' }));
  assert.ok(statusErrors.status);

  const methodErrors = await errorsOf(base({ paymentMethod: 'vnpay' }));
  assert.ok(methodErrors.paymentMethod);

  const paymentErrors = await errorsOf(base({ paymentStatus: 'pending' }));
  assert.ok(paymentErrors.paymentStatus);
});

test('T2-2-1: statusHistory co entry dau tien khi tao don', async () => {
  const userId = objectId();
  const doc = base({ user: userId });
  await doc.validate();

  assert.equal(doc.statusHistory.length, 1);
  assert.equal(doc.statusHistory[0].status, 'pending');
  assert.equal(String(doc.statusHistory[0].by), String(userId));
  assert.ok(doc.statusHistory[0].at);
});

test('T2-2-1: static canTransition chi cho phep chuyen tien', () => {
  assert.equal(Order.canTransition('pending', 'confirmed'), true);
  assert.equal(Order.canTransition('pending', 'cancelled'), true);
  assert.equal(Order.canTransition('confirmed', 'shipping'), true);
  assert.equal(Order.canTransition('shipping', 'delivered'), true);
  assert.equal(Order.canTransition('pending', 'shipping'), false);
  assert.equal(Order.canTransition('delivered', 'cancelled'), false);
  assert.equal(Order.canTransition('cancelled', 'pending'), false);
});

test('T2-2-1: calculateShippingFee theo nguong 500.000', () => {
  assert.equal(Order.calculateShippingFee(499999), 30000);
  assert.equal(Order.calculateShippingFee(500000), 0);
});

test('T2-2-1: Order co day du index theo data dictionary', () => {
  const indexes = Order.schema.indexes();

  assert.ok(
    indexes.some(([fields, options]) => fields.code === 1 && options.unique),
    'thieu index unique cho code',
  );
  assert.ok(
    indexes.some(([fields]) => fields.user === 1 && fields.createdAt === 1),
    'thieu index (user, createdAt)',
  );
  assert.ok(
    indexes.some(([fields]) => fields.status === 1 && fields.createdAt === 1),
    'thieu index (status, createdAt)',
  );
});

test('T2-2-1: toJSON an _id, __v va giu du lieu audit', async () => {
  const doc = base();
  await doc.validate();
  const json = doc.toJSON();

  assert.equal(json._id, undefined);
  assert.equal(json.__v, undefined);
  assert.ok(json.id);
  assert.equal(json.status, 'pending');
  assert.ok(json.code);
  assert.equal(json.statusHistory.length, 1);
});

test.after(() => {
  mongoose.deleteModel(/Order/);
});
