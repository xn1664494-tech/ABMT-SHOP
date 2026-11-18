const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Cart = require('../src/model/Cart');

const objectId = () => new mongoose.Types.ObjectId();

const cartItem = (overrides = {}) => ({
  product: objectId(),
  sku: 'SP-AO-001-M-DEN',
  size: 'M',
  color: 'Den',
  qty: 1,
  unitPrice: 199000,
  ...overrides,
});

const base = (overrides = {}) =>
  new Cart({ sessionId: 'session-abc', items: [cartItem()], ...overrides });

const errorsOf = async (doc) => {
  const error = await doc.validate().catch((err) => err);
  assert.ok(error, 'du lieu phai bi tu choi');
  return error.errors;
};

test('T2-2-1: Cart khai bao day du field va default', () => {
  assert.equal(Cart.modelName, 'Cart');

  for (const field of [
    'user',
    'sessionId',
    'items',
    'expiresAt',
    'createdAt',
    'updatedAt',
  ]) {
    assert.ok(Cart.schema.path(field), `thieu field ${field}`);
  }

  assert.equal(Cart.schema.path('user').defaultValue, null);
  assert.equal(Cart.schema.path('sessionId').defaultValue, null);
  assert.equal(Cart.schema.path('expiresAt').defaultValue, null);
  assert.equal(Cart.schema.path('isDeleted'), undefined);
});

test('T2-2-1: CartItem khai bao day du field', () => {
  const itemsPath = Cart.schema.path('items');

  for (const field of [
    'product',
    'sku',
    'size',
    'color',
    'qty',
    'unitPrice',
  ]) {
    assert.ok(itemsPath.schema.path(field), `thieu field items.${field}`);
  }
});

test('T2-2-1: gio hang phai co dung mot trong user hoac sessionId', async () => {
  const neither = await errorsOf(new Cart({ items: [] }));
  assert.ok(neither.user);

  const both = await errorsOf(
    base({ user: objectId(), sessionId: 'session-abc' }),
  );
  assert.ok(both.user);
});

test('T2-2-1: gio khach tu set expiresAt sau 30 ngay', async () => {
  const before = Date.now();
  const doc = base();
  await doc.validate();

  assert.ok(doc.expiresAt);
  assert.ok(doc.expiresAt.getTime() >= before + Cart.GUEST_CART_TTL_MS - 60000);
  assert.ok(doc.expiresAt.getTime() <= Date.now() + Cart.GUEST_CART_TTL_MS + 60000);
});

test('T2-2-1: gio cua user khong co expiresAt', async () => {
  const doc = new Cart({ user: objectId(), items: [] });
  await doc.validate();

  assert.equal(doc.expiresAt, null);
});

test('T2-2-1: CartItem thieu field bat buoc bi tu choi', async () => {
  const errors = await errorsOf(
    base({
      items: [
        cartItem({
          product: undefined,
          sku: undefined,
          qty: undefined,
          unitPrice: undefined,
        }),
      ],
    }),
  );

  assert.ok(errors['items.0.product']);
  assert.ok(errors['items.0.sku']);
  assert.ok(errors['items.0.qty']);
  assert.ok(errors['items.0.unitPrice']);
});

test('T2-2-1: qty va unitPrice phai la so nguyen hop le', async () => {
  const qtyErrors = await errorsOf(base({ items: [cartItem({ qty: 0 })] }));
  assert.ok(qtyErrors['items.0.qty']);

  const priceErrors = await errorsOf(
    base({ items: [cartItem({ unitPrice: -1 })] }),
  );
  assert.ok(priceErrors['items.0.unitPrice']);
});

test('T2-2-1: chan SKU trung trong cung gio hang', async () => {
  const errors = await errorsOf(
    base({
      items: [
        cartItem({ sku: 'SP-AO-001-M-DEN' }),
        cartItem({ sku: 'SP-AO-001-M-DEN' }),
      ],
    }),
  );

  assert.ok(errors.items);
  assert.match(errors.items.message, /trùng/i);
});

test('T2-2-1: Cart co index unique partial va TTL 30 ngay', () => {
  const indexes = Cart.schema.indexes();

  assert.ok(
    indexes.some(
      ([fields, options]) =>
        fields.user === 1 &&
        options.unique &&
        options.partialFilterExpression?.user?.$type === 'objectId',
    ),
    'thieu unique partial index cho user',
  );
  assert.ok(
    indexes.some(
      ([fields, options]) =>
        fields.sessionId === 1 &&
        options.unique &&
        options.partialFilterExpression?.sessionId?.$type === 'string',
    ),
    'thieu unique partial index cho sessionId',
  );
  assert.ok(
    indexes.some(
      ([fields, options]) =>
        fields.expiresAt === 1 &&
        options.expireAfterSeconds === Cart.GUEST_CART_TTL_SECONDS,
    ),
    'thieu TTL index cho expiresAt',
  );
});

test('T2-2-1: toJSON an _id, __v va giu du lieu gio hang', async () => {
  const doc = base();
  await doc.validate();
  const json = doc.toJSON();

  assert.equal(json._id, undefined);
  assert.equal(json.__v, undefined);
  assert.ok(json.id);
  assert.equal(json.sessionId, 'session-abc');
  assert.equal(json.items.length, 1);
});

test.after(() => {
  mongoose.deleteModel(/Cart/);
});
