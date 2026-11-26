const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { Types } = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.APP_ORIGIN = 'http://localhost:3000';

const { createFakeUserModel, installFakeUserModel } = require('./support/fakeUserModel');
const {
  createFakeCartModel,
  createFakeProductModel,
  installFakeModel,
} = require('./support/fakeCartModels');

const userModel = createFakeUserModel();
installFakeUserModel(userModel);

const cartModel = createFakeCartModel();
installFakeModel('../../src/model/Cart', cartModel);

const productIds = {
  'SKU-GUEST': new Types.ObjectId(),
  'SKU-USER': new Types.ObjectId(),
};
const productModel = createFakeProductModel(
  Object.entries(productIds).map(([sku, _id]) => ({
    _id,
    name: `Áo ${sku}`,
    basePrice: 199000,
    variants: [{ sku, size: 'M', color: 'Den', stock: 10, price: 199000 }],
  }))
);
installFakeModel('../../src/model/Products', productModel);

const request = require('supertest');
const app = require('../src/app');

let user;
let token;

const signToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
    issuer: 'abmt-shop',
    audience: 'abmt-shop-client',
  });

const makeItem = (sku, qty = 1) => ({
  _id: new Types.ObjectId(),
  product: productIds[sku],
  sku,
  size: 'M',
  color: 'Den',
  qty,
  unitPrice: 199000,
});

const makeCart = (fields = {}) => ({
  _id: new Types.ObjectId(),
  items: [],
  expiresAt: null,
  async save() {
    return this;
  },
  ...fields,
});

const seedGuestCart = (items) => {
  const cart = makeCart({ sessionId: 'guest-session', items });
  cartModel.carts.push(cart);
  return cart;
};

const seedUserCart = (items) => {
  const cart = makeCart({ user: user._id, items });
  cartModel.carts.push(cart);
  return cart;
};

const cookiesFor = () => `accessToken=${token}; cartId=guest-session`;

test.beforeEach(async () => {
  userModel.users.length = 0;
  cartModel.carts.length = 0;
  productModel.products.forEach((product) => {
    product.isDeleted = false;
    product.isActive = true;
    (product.variants || []).forEach((variant) => {
      variant.stock = 10;
    });
  });
  user = await userModel.create({
    name: 'Khach ABMT',
    email: 'cart-merge@example.com',
    password: 'hash',
    role: 'customer',
  });
  token = signToken({
    sub: String(user._id),
    role: user.role,
    ver: user.tokenVersion || 0,
  });
});

test('T5-4-3: gop gio khi dang nhap khong nhan trung SKU va xoa gio guest', async () => {
  seedGuestCart([makeItem('SKU-GUEST', 1), makeItem('SKU-USER', 3)]);
  const userCart = seedUserCart([makeItem('SKU-USER', 2)]);

  const res = await request(app)
    .post('/api/cart/merge')
    .set('Cookie', cookiesFor());

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.deepEqual(
    res.body.data.items.map((item) => item.sku).sort(),
    ['SKU-GUEST', 'SKU-USER']
  );
  assert.equal(userCart.items.length, 2);
  assert.equal(
    userCart.items.find((item) => item.sku === 'SKU-USER').qty,
    5
  );
  assert.equal(userCart.items.find((item) => item.sku === 'SKU-GUEST').qty, 1);
  assert.equal(
    cartModel.carts.some((cart) => cart.sessionId === 'guest-session'),
    false
  );
  assert.ok(
    (res.headers['set-cookie'] || []).some((cookie) =>
      cookie.startsWith('cartId=;')
    )
  );
});

test('T5-2-1: merge vuot kho - API 409, trang /cart clamp va hien flash', async () => {
  seedGuestCart([makeItem('SKU-USER', 9)]);
  const userCart = seedUserCart([makeItem('SKU-USER', 5)]);

  const apiRes = await request(app)
    .post('/api/cart/merge')
    .set('Cookie', cookiesFor());

  assert.equal(apiRes.status, 409);
  assert.equal(apiRes.body.success, false);
  assert.equal(userCart.items[0].qty, 5);

  const pageRes = await request(app)
    .get('/cart')
    .set('Cookie', cookiesFor());

  assert.equal(pageRes.status, 200);
  assert.equal(userCart.items[0].qty, 10);
  assert.match(
    pageRes.text,
    /Một số sản phẩm đã được điều chỉnh số lượng/
  );
});

test('T5-2-1: merge item moi vuot kho - API 409 bao dung SKU', async () => {
  seedGuestCart([makeItem('SKU-GUEST', 11)]);
  const userCart = seedUserCart([makeItem('SKU-USER', 1)]);

  const res = await request(app)
    .post('/api/cart/merge')
    .set('Cookie', cookiesFor());

  assert.equal(res.status, 409);
  assert.equal(res.body.success, false);
  assert.match(res.body.error, /SKU-GUEST/);
  assert.equal(userCart.items.length, 1);
  assert.equal(userCart.items[0].sku, 'SKU-USER');
  assert.ok(
    cartModel.carts.some((cart) => cart.sessionId === 'guest-session')
  );
});

test('T5-2-1: merge item moi trong kho - giu nguyen so luong', async () => {
  seedGuestCart([makeItem('SKU-GUEST', 7)]);
  const userCart = seedUserCart([makeItem('SKU-USER', 1)]);

  const res = await request(app)
    .post('/api/cart/merge')
    .set('Cookie', cookiesFor());

  assert.equal(res.status, 200);
  assert.equal(
    userCart.items.find((item) => item.sku === 'SKU-GUEST').qty,
    7
  );
});

test('T5-2-1: /cart clamp item moi vuot kho va hien flash', async () => {
  seedGuestCart([makeItem('SKU-GUEST', 14)]);
  const userCart = seedUserCart([makeItem('SKU-USER', 1)]);

  const res = await request(app)
    .get('/cart')
    .set('Cookie', cookiesFor());

  assert.equal(res.status, 200);
  assert.equal(
    userCart.items.find((item) => item.sku === 'SKU-GUEST').qty,
    10
  );
  assert.match(res.text, /Một số sản phẩm đã được điều chỉnh số lượng/);
});

test('T5-2-1: merge bo qua bien the da xoa', async () => {
  seedGuestCart([makeItem('SKU-GUEST', 1)]);
  const userCart = seedUserCart([makeItem('SKU-USER', 1)]);
  const guestProduct = productModel.products.find(
    (product) => String(product._id) === String(productIds['SKU-GUEST'])
  );
  guestProduct.isDeleted = true;

  const res = await request(app)
    .post('/api/cart/merge')
    .set('Cookie', cookiesFor());

  assert.equal(res.status, 200);
  assert.equal(
    userCart.items.some((item) => item.sku === 'SKU-GUEST'),
    false
  );
  assert.equal(userCart.items.length, 1);
});

test('T5-2-1: merge bo qua bien the ngung ban', async () => {
  seedGuestCart([makeItem('SKU-GUEST', 1)]);
  const userCart = seedUserCart([makeItem('SKU-USER', 1)]);
  const guestProduct = productModel.products.find(
    (product) => String(product._id) === String(productIds['SKU-GUEST'])
  );
  guestProduct.isActive = false;

  const res = await request(app)
    .post('/api/cart/merge')
    .set('Cookie', cookiesFor());

  assert.equal(res.status, 200);
  assert.equal(
    userCart.items.some((item) => item.sku === 'SKU-GUEST'),
    false
  );
  assert.equal(userCart.items.length, 1);
});

test('T5-4-3: gop gio tao user cart neu chua co', async () => {
  seedGuestCart([makeItem('SKU-GUEST', 2)]);

  const res = await request(app)
    .post('/api/cart/merge')
    .set('Cookie', cookiesFor());

  assert.equal(res.status, 200);
  assert.deepEqual(
    res.body.data.items.map((item) => item.sku),
    ['SKU-GUEST']
  );
  assert.equal(cartModel.carts.length, 1);
  assert.equal(String(cartModel.carts[0].user), String(user._id));
  assert.equal(cartModel.carts[0].items.length, 1);
  assert.equal(res.body.data.count, 2);
});

test('T5-2-3: guest cart tu chuyen thanh user cart qua GET /api/cart', async () => {
  seedGuestCart([makeItem('SKU-GUEST', 3)]);

  const res = await request(app)
    .get('/api/cart')
    .set('Cookie', cookiesFor());

  assert.equal(res.status, 200);
  assert.equal(res.body.data.items.length, 1);
  assert.equal(res.body.data.items[0].sku, 'SKU-GUEST');
  assert.equal(res.body.data.count, 3);
  assert.equal(cartModel.carts.length, 1);
  assert.equal(String(cartModel.carts[0].user), String(user._id));
  assert.equal(cartModel.carts[0].sessionId, null);
  assert.ok(
    (res.headers['set-cookie'] || []).some((cookie) =>
      cookie.startsWith('cartId=;')
    )
  );
});

test('T5-4-3: gop gio chua dang nhap bi tu choi', async () => {
  seedGuestCart([makeItem('SKU-GUEST', 1)]);

  const res = await request(app)
    .post('/api/cart/merge')
    .set('Cookie', 'cartId=guest-session');

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
  assert.equal(cartModel.carts.length, 1);
});

test('T5-4-3: trang /cart gop gio guest vao user khi da dang nhap', async () => {
  seedGuestCart([makeItem('SKU-GUEST', 1)]);
  const userCart = seedUserCart([makeItem('SKU-USER', 2)]);

  const res = await request(app)
    .get('/cart')
    .set('Cookie', cookiesFor());

  assert.equal(res.status, 200);
  assert.match(res.text, /SKU-GUEST/);
  assert.match(res.text, /SKU-USER/);
  assert.equal(userCart.items.length, 2);
  assert.equal(
    cartModel.carts.some((cart) => cart.sessionId === 'guest-session'),
    false
  );
});
