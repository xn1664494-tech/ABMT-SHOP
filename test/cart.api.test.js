const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';

const {
  createFakeCartModel,
  createFakeProductModel,
  installFakeModel,
} = require('./support/fakeCartModels');

const productId = new mongoose.Types.ObjectId();
const itemId = new mongoose.Types.ObjectId();

const cartModel = createFakeCartModel();
const productModel = createFakeProductModel([
  {
    _id: productId,
    variants: [{ sku: 'SP-AO-001-M-DEN', stock: 5, price: 199000 }],
  },
]);

installFakeModel('../../src/model/Cart', cartModel);
installFakeModel('../../src/model/Products', productModel);

const request = require('supertest');
const app = require('../src/app');

const seedCart = () => {
  cartModel.carts.length = 0;
  cartModel.carts.push({
    _id: new mongoose.Types.ObjectId(),
    sessionId: 'session-abc',
    items: [
      {
        _id: itemId,
        product: productId,
        sku: 'SP-AO-001-M-DEN',
        size: 'M',
        color: 'Den',
        qty: 1,
        unitPrice: 199000,
      },
    ],
    async save() {
      return this;
    },
  });
};

test.beforeEach(() => {
  seedCart();
});

test('T5-4-1: cap nhat so luong bang PUT/qty', async () => {
  const res = await request(app)
    .put(`/api/cart/items/${itemId}`)
    .set('Cookie', 'cartId=session-abc')
    .send({ qty: 3 });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.items[0].qty, 3);
  assert.equal(res.body.data.count, 3);
});

test('T5-4-1: cap nhat vuot ton kho bi tu choi', async () => {
  const res = await request(app)
    .put(`/api/cart/items/${itemId}`)
    .set('Cookie', 'cartId=session-abc')
    .send({ qty: 9 });

  assert.equal(res.status, 409);
  assert.equal(res.body.success, false);
});

test('T5-4-1: xoa dong gio hang bang item _id', async () => {
  const res = await request(app)
    .delete(`/api/cart/items/${itemId}`)
    .set('Cookie', 'cartId=session-abc');

  assert.equal(res.status, 200);
  assert.equal(res.body.data.items.length, 0);
  assert.equal(res.body.data.count, 0);
});
