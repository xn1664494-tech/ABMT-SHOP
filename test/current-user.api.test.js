/**
 * T2-1-1 / T4-1-1 (Dev 1): middleware currentUser phải chạy trước /api
 * để /api/cart (Dev 2) resolve đúng giỏ của user đã đăng nhập.
 * Test này không kết nối MongoDB: fake User + fake Cart.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.NODE_ENV = 'test';
process.env.APP_ORIGIN = 'http://localhost:3000';

const { createFakeUserModel, installFakeUserModel } = require('./support/fakeUserModel');

// currentUser gọi findById(...).select(...).lean(): bổ sung lean() ở lớp fake
// ngay trong file test này, không sửa helper dùng chung của các task khác.
const baseUserModel = createFakeUserModel();
const fakeUserModel = {
  ...baseUserModel,
  findById(id) {
    const user = baseUserModel.users.find((item) => String(item._id) === String(id)) || null;
    return {
      select() {
        return this;
      },
      setOptions() {
        return this;
      },
      lean() {
        return Promise.resolve(user);
      },
      then(resolve, reject) {
        return Promise.resolve(user).then(resolve, reject);
      },
      catch(reject) {
        return Promise.resolve(user).catch(reject);
      },
    };
  },
};
installFakeUserModel(fakeUserModel);

// Fake Cart: ghi nhận filter findOne để kiểm tra resolveCart ưu tiên user.
const carts = [];
const fakeCartModel = {
  findOne(filter = {}) {
    return Promise.resolve(
      carts.find((cart) =>
        Object.entries(filter).every(([key, value]) => String(cart[key]) === String(value)),
      ) || null,
    );
  },
  async create(doc) {
    const cart = {
      _id: String(carts.length + 1),
      items: [],
      ...doc,
      save() {
        return Promise.resolve(this);
      },
    };
    carts.push(cart);
    return cart;
  },
};
const cartModelPath = require.resolve('../src/model/Cart');
require.cache[cartModelPath] = {
  id: cartModelPath,
  filename: cartModelPath,
  loaded: true,
  exports: fakeCartModel,
};

const request = require('supertest');
const app = require('../src/app');
const { signAccessToken, signRefreshToken } = require('../src/services/tokenService');

const USER_ID = 'user-1';
const GUEST_SESSION = 'guest-session-1';

const seed = () => {
  carts.length = 0;
  baseUserModel.users.length = 0;
  baseUserModel.users.push({
    _id: USER_ID,
    name: 'Customer',
    email: 'customer@example.com',
    role: 'customer',
    status: 'active',
    isDeleted: false,
    tokenVersion: 0,
  });

  carts.push({
    user: USER_ID,
    sessionId: null,
    items: [
      { product: 'p1', sku: 'P1-M-DEN', size: 'M', color: 'Den', qty: 2, unitPrice: 100000 },
    ],
  });
  carts.push({
    user: null,
    sessionId: GUEST_SESSION,
    items: [
      { product: 'p2', sku: 'P2-S-TRANG', size: 'S', color: 'Trang', qty: 1, unitPrice: 50000 },
    ],
  });
};

test('T2-1-1: /api/cart uu tien gio user khi co accessToken', async () => {
  seed();
  const token = signAccessToken({ _id: USER_ID, role: 'customer', tokenVersion: 0 });

  const res = await request(app)
    .get('/api/cart')
    .set('Cookie', [`accessToken=${token}`, `cartId=${GUEST_SESSION}`]);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.items.length, 1);
  assert.equal(res.body.data.items[0].qty, 2);
  assert.equal(res.body.data.count, 2);
});

test('T2-1-1: /api/cart van dung gio guest khi khong co accessToken', async () => {
  seed();

  const res = await request(app).get('/api/cart').set('Cookie', [`cartId=${GUEST_SESSION}`]);

  assert.equal(res.status, 200);
  assert.equal(res.body.data.items[0].qty, 1);
  assert.equal(res.body.data.count, 1);
});

test('T2-1-1: refresh token khong duoc coi la da dang nhap', async () => {
  seed();
  const token = signRefreshToken({ _id: USER_ID, tokenVersion: 0 });

  const res = await request(app)
    .get('/api/cart')
    .set('Cookie', [`accessToken=${token}`, `cartId=${GUEST_SESSION}`]);

  assert.equal(res.status, 200);
  assert.equal(res.body.data.items[0].qty, 1);
});
