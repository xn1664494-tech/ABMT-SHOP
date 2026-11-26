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
    basePrice: 150000,
    variants: [{ sku: 'SP-AO-001-M-DEN', size: 'M', color: 'Den', stock: 5, price: 199000 }],
  },
]);

installFakeModel('../../src/model/Cart', cartModel);
installFakeModel('../../src/model/Products', productModel);

const request = require('supertest');
const app = require('../src/app');

const makeCart = (items) => ({
  _id: new mongoose.Types.ObjectId(),
  sessionId: 'session-abc',
  items,
  async save() {
    return this;
  },
});

const seedCart = (qty = 1) => {
  cartModel.carts.length = 0;
  cartModel.carts.push(
    makeCart([
      {
        _id: itemId,
        product: productId,
        sku: 'SP-AO-001-M-DEN',
        size: 'M',
        color: 'Den',
        qty,
        unitPrice: 199000,
      },
    ])
  );
};

const seedEmptyCart = () => {
  cartModel.carts.length = 0;
  cartModel.carts.push(makeCart([]));
};

test.beforeEach(() => {
  const product = productModel.products[0];
  product.basePrice = 150000;
  product.isActive = true;
  product.variants[0].price = 199000;
  product.variants[0].stock = 5;
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

test('T5-4-3: them san pham lay gia tu DB, bo qua gia client', async () => {
  seedEmptyCart();

  const res = await request(app)
    .post('/api/cart/items')
    .set('Cookie', 'cartId=session-abc')
    .send({
      product: productId.toString(),
      size: 'M',
      color: 'Den',
      qty: 2,
      unitPrice: 1,
    });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.items.length, 1);
  assert.equal(res.body.data.items[0].unitPrice, 199000);
  assert.equal(cartModel.carts[0].items[0].unitPrice, 199000);
  assert.equal(cartModel.carts[0].items[0].qty, 2);
  assert.equal(res.body.data.subtotal, 398000);
});

test('T5-4-3: them san pham vuot ton kho bi tu choi', async () => {
  seedEmptyCart();

  const res = await request(app)
    .post('/api/cart/items')
    .set('Cookie', 'cartId=session-abc')
    .send({ product: productId.toString(), size: 'M', color: 'Den', qty: 9 });

  assert.equal(res.status, 409);
  assert.equal(res.body.success, false);
  assert.equal(cartModel.carts[0].items.length, 0);
});

test('T5-4-3: cong don so luong vuot ton kho bi tu choi', async () => {
  seedCart(4);

  const res = await request(app)
    .post('/api/cart/items')
    .set('Cookie', 'cartId=session-abc')
    .send({ product: productId.toString(), size: 'M', color: 'Den', qty: 2 });

  assert.equal(res.status, 409);
  assert.equal(res.body.success, false);
  assert.equal(cartModel.carts[0].items[0].qty, 4);
});

test('T5-4-1: qty khong phai so nguyen duong bi tu choi 400', async () => {
  for (const bad of [1.5, 0, -1, 'abc']) {
    const res = await request(app)
      .put(`/api/cart/items/${itemId}`)
      .set('Cookie', 'cartId=session-abc')
      .send({ qty: bad });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  }
});

test('T5-4-3: GET/PUT lam moi gia tu DB khi gia bien the thay doi', async () => {
  productModel.products[0].variants[0].price = 250000;

  const getRes = await request(app)
    .get('/api/cart')
    .set('Cookie', 'cartId=session-abc');

  assert.equal(getRes.status, 200);
  assert.equal(getRes.body.data.items[0].unitPrice, 250000);
  assert.equal(getRes.body.data.subtotal, 250000);

  const putRes = await request(app)
    .put(`/api/cart/items/${itemId}`)
    .set('Cookie', 'cartId=session-abc')
    .send({ qty: 2 });

  assert.equal(putRes.status, 200);
  assert.equal(putRes.body.data.items[0].unitPrice, 250000);
  assert.equal(putRes.body.data.subtotal, 500000);
});

test('T5-4-3: khong cho them san pham isActive=false', async () => {
  seedEmptyCart();
  productModel.products[0].isActive = false;

  const res = await request(app)
    .post('/api/cart/items')
    .set('Cookie', 'cartId=session-abc')
    .send({ product: productId.toString(), size: 'M', color: 'den', qty: 1 });

  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
  assert.equal(cartModel.carts[0].items.length, 0);
});
