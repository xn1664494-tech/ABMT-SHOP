const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { Types } = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';

// Fake model PHẢI được cài trước khi require app.
const {
  createFakeUserModel,
  installFakeUserModel,
} = require('./support/fakeUserModel');
const {
  createFakeCartModel,
  createFakeProductModel,
  installFakeModel,
} = require('./support/fakeCartModels');

const userModel = createFakeUserModel();
installFakeUserModel(userModel);

const cartModel = createFakeCartModel();
installFakeModel('../../src/model/Cart', cartModel);
const baseFindOne = cartModel.findOne;

const productIds = {
  'SKU-USER': new Types.ObjectId(),
  'SKU-GUEST': new Types.ObjectId(),
  'SKU-DELETED': new Types.ObjectId(),
  'SKU-INACTIVE': new Types.ObjectId(),
  'SKU-NO-VARIANT': new Types.ObjectId(),
  // Có _id trong giỏ nhưng không có sản phẩm tương ứng trong DB.
  'SKU-MISSING': new Types.ObjectId(),
};

const variant = (sku, stock = 10) => ({
  sku,
  size: 'M',
  color: 'Den',
  stock,
  price: 199000,
});

const productModel = createFakeProductModel([
  { _id: productIds['SKU-USER'], basePrice: 199000, variants: [variant('SKU-USER')] },
  { _id: productIds['SKU-GUEST'], basePrice: 199000, variants: [variant('SKU-GUEST')] },
  {
    _id: productIds['SKU-DELETED'],
    basePrice: 199000,
    variants: [variant('SKU-DELETED')],
  },
  {
    _id: productIds['SKU-INACTIVE'],
    basePrice: 199000,
    variants: [variant('SKU-INACTIVE')],
  },
  { _id: productIds['SKU-NO-VARIANT'], basePrice: 199000, variants: [] },
]);
installFakeModel('../../src/model/Products', productModel);

const request = require('supertest');
const app = require('../src/app');

const PASSWORD = 'Secret123';
const GUEST_ID = 'guest-cart-login';
let user;

const makeItem = (sku, qty) => ({
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

const seedGuestCart = (items, sessionId = GUEST_ID) => {
  const cart = makeCart({ sessionId, items });
  cartModel.carts.push(cart);
  return cart;
};

const seedUserCart = (items) => {
  const cart = makeCart({ user: user._id, items });
  cartModel.carts.push(cart);
  return cart;
};

const cookiesOf = (res) => res.headers['set-cookie'] || [];
const cartCookieCleared = (res) =>
  cookiesOf(res).some((cookie) => cookie.startsWith('cartId=;'));
const qtyOf = (cart, sku) => {
  const item = cart.items.find((entry) => entry.sku === sku);
  return item ? item.qty : 0;
};

const login = (cartId) => {
  const call = request(app)
    .post('/api/auth/login')
    .send({ email: user.email, password: PASSWORD });
  if (cartId) call.set('Cookie', `cartId=${cartId}`);
  return call;
};

const assertNoTokenLeak = (res) => {
  const body = JSON.stringify(res.body);
  assert.doesNotMatch(
    body,
    /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
    'body khong duoc chua JWT',
  );
  assert.equal(res.body.accessToken, undefined);
  assert.equal(res.body.refreshToken, undefined);
  assert.equal(res.body.data.accessToken, undefined);
  assert.equal(res.body.data.refreshToken, undefined);
};

// Helper merge khong co contract tra cờ cho response login.
const assertNoMergeFlag = (res) => {
  assert.equal(res.body.cartMergeAdjusted, undefined);
  assert.equal(res.body.data.cartMergeAdjusted, undefined);
  assert.equal(JSON.stringify(res.body).includes('mergeAdjusted'), false);
};

test.beforeEach(async () => {
  userModel.users.length = 0;
  cartModel.carts.length = 0;
  cartModel.findOne = baseFindOne;

  productModel.products.forEach((product) => {
    product.isDeleted = false;
    product.isActive = true;
    (product.variants || []).forEach((entry) => {
      entry.stock = 10;
    });
  });

  const password = await bcrypt.hash(PASSWORD, 10);
  user = await userModel.create({
    name: 'Khach ABMT',
    email: 'customer-login@example.com',
    password,
    role: 'customer',
    status: 'active',
  });
});

test('T5-1-1: login co guest cart gop theo SKU, clamp theo stock va clear cookie cartId', async () => {
  seedGuestCart([makeItem('SKU-USER', 9), makeItem('SKU-GUEST', 2)]);
  const userCart = seedUserCart([makeItem('SKU-USER', 5)]);

  const res = await login(GUEST_ID);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.user.email, user.email);
  assertNoTokenLeak(res);
  assertNoMergeFlag(res);

  assert.equal(userCart.items.length, 2);
  assert.equal(qtyOf(userCart, 'SKU-USER'), 10, '5 + 9 clamp ve stock 10');
  assert.equal(qtyOf(userCart, 'SKU-GUEST'), 2);
  assert.equal(
    cartModel.carts.some((cart) => cart.sessionId === GUEST_ID),
    false,
    'guest cart da bi xoa sau merge',
  );
  assert.ok(cartCookieCleared(res), 'helper phu clear cookie cartId');
});

test('T5-1-1: guest cart duoc chuyen thanh user cart neu user chua co gio', async () => {
  seedGuestCart([makeItem('SKU-GUEST', 3)]);

  const res = await login(GUEST_ID);

  assert.equal(res.status, 200);
  assert.equal(cartModel.carts.length, 1);
  assert.equal(String(cartModel.carts[0].user), String(user._id));
  assert.equal(cartModel.carts[0].sessionId, null);
  assert.equal(qtyOf(cartModel.carts[0], 'SKU-GUEST'), 3);
  assert.ok(cartCookieCleared(res));
});

test('T5-1-1: login khong co guest cart van 200 va khong doi user cart', async () => {
  const userCart = seedUserCart([makeItem('SKU-USER', 2)]);
  const before = userCart.items.map((item) => ({ sku: item.sku, qty: item.qty }));

  const res = await login(null);

  assert.equal(res.status, 200);
  assert.equal(res.body.data.user.id, String(user._id));
  assert.deepEqual(
    userCart.items.map((item) => ({ sku: item.sku, qty: item.qty })),
    before,
  );
  assert.equal(cartModel.carts.length, 1);
  assert.equal(
    cookiesOf(res).some((cookie) => cookie.startsWith('cartId=')),
    false,
    'khong co giỏ khách thi khong can clear/set cartId',
  );
  assertNoTokenLeak(res);
  assertNoMergeFlag(res);
});

test('T5-1-1: login khong co guest cart va chua co user cart khong tao giỏ moi', async () => {
  const res = await login(null);

  assert.equal(res.status, 200);
  assert.equal(cartModel.carts.length, 0);
  assertNoMergeFlag(res);
});

test('T5-1-1: merge loi van tra 200, co user, khong lo token va khong bao merge thanh cong', async () => {
  const userCart = seedUserCart([makeItem('SKU-USER', 1)]);
  seedGuestCart([makeItem('SKU-GUEST', 4)], 'boom-session');

  cartModel.findOne = async (filter = {}) => {
    if (filter.sessionId === 'boom-session') {
      throw new Error('merge storage unavailable');
    }
    return baseFindOne(filter);
  };

  const originalWarn = console.warn;
  const logs = [];
  console.warn = (...args) => logs.push(args.map(String).join(' '));

  let res;
  try {
    res = await login('boom-session');
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.user.email, user.email);
  assertNoTokenLeak(res);
  assertNoMergeFlag(res);

  assert.equal(qtyOf(userCart, 'SKU-USER'), 1);
  assert.equal(qtyOf(userCart, 'SKU-GUEST'), 0);
  assert.equal(
    cartModel.carts.some((cart) => cart.sessionId === 'boom-session'),
    true,
    'merge that bai khong xoa guest cart',
  );
  assert.ok(logs.some((line) => /cart merge skipped/i.test(line)));
  assert.doesNotMatch(
    logs.join('\n'),
    /boom-session|accessToken|refreshToken|eyJ|at async/,
    'log chi duoc ghi message, khong log cookie/token/stack',
  );
});

test('T5-1-1: login lai sau khi cookie cartId bi clear khong cong qty lan 2', async () => {
  seedGuestCart([makeItem('SKU-USER', 3)]);
  const userCart = seedUserCart([makeItem('SKU-USER', 2)]);

  const first = await login(GUEST_ID);
  assert.equal(first.status, 200);
  assert.equal(qtyOf(userCart, 'SKU-USER'), 5);
  assert.ok(cartCookieCleared(first));

  const second = await login(null);
  assert.equal(second.status, 200);
  assert.equal(qtyOf(userCart, 'SKU-USER'), 5, 'khong co cartId thi khong merge lai');

  // Ngay ca khi client gui lai cartId cu, guest cart da bi xoa nen khong cong them.
  const replay = await login(GUEST_ID);
  assert.equal(replay.status, 200);
  assert.equal(qtyOf(userCart, 'SKU-USER'), 5);
});

test('T5-1-1: login bo qua variant khong hop le/inactive/deleted', async () => {
  seedGuestCart([
    makeItem('SKU-MISSING', 1),
    makeItem('SKU-DELETED', 1),
    makeItem('SKU-INACTIVE', 1),
    makeItem('SKU-NO-VARIANT', 1),
    makeItem('SKU-GUEST', 2),
  ]);
  const userCart = seedUserCart([makeItem('SKU-USER', 1)]);

  productModel.products
    .find((product) => String(product._id) === String(productIds['SKU-DELETED']))
    .isDeleted = true;
  productModel.products
    .find((product) => String(product._id) === String(productIds['SKU-INACTIVE']))
    .isActive = false;

  const res = await login(GUEST_ID);

  assert.equal(res.status, 200);
  assert.deepEqual(
    userCart.items.map((item) => item.sku).sort(),
    ['SKU-GUEST', 'SKU-USER'],
  );
  assert.equal(qtyOf(userCart, 'SKU-GUEST'), 2);
  assert.ok(cartCookieCleared(res));
});

test('T5-1-1: GET /api/cart sau login doc dung customer cart da merge', async () => {
  seedGuestCart([makeItem('SKU-USER', 4), makeItem('SKU-GUEST', 1)]);
  const userCart = seedUserCart([makeItem('SKU-USER', 3)]);

  const loginRes = await login(GUEST_ID);
  assert.equal(loginRes.status, 200);
  assert.equal(qtyOf(userCart, 'SKU-USER'), 7);

  const accessCookie = cookiesOf(loginRes)
    .find((cookie) => cookie.startsWith('accessToken='))
    .split(';')[0];

  const cartRes = await request(app)
    .get('/api/cart')
    .set('Cookie', accessCookie);

  assert.equal(cartRes.status, 200);
  assert.equal(cartRes.body.success, true);
  assert.deepEqual(
    cartRes.body.data.items.map((item) => item.sku).sort(),
    ['SKU-GUEST', 'SKU-USER'],
  );
  assert.equal(
    cartRes.body.data.items.find((item) => item.sku === 'SKU-USER').qty,
    7,
  );
  assert.equal(cartRes.body.data.count, 8);
});
