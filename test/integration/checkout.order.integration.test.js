const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';

const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/model/User');
const Category = require('../../src/model/Category');
const Product = require('../../src/model/Products');
const Order = require('../../src/model/Order');
const Cart = require('../../src/model/Cart');
const { signAccessToken } = require('../../src/services/tokenService');
const { MongoMemoryServer } = require('mongodb-memory-server');

const TEST_URI =
  process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/abmt_shop_test';
const RUN_ID = `co3-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const OLD_IMAGE = 'https://example.com/checkout-order-old.jpg';
const NEW_IMAGE = 'https://example.com/checkout-order-new.jpg';

let available = false;
let skipReason = '';
let memoryServer = null;
let seq = 0;
let skuSeq = 0;
const created = { users: [], categories: [], products: [], carts: [] };

const skipIfUnavailable = (t) => {
  if (!available) {
    t.skip(skipReason);
    return true;
  }
  return false;
};

const skuFor = (size, color) => {
  skuSeq += 1;
  return `SP-AO-${String((skuSeq % 900) + 100)}-${size}-${color}`;
};

const address = () => ({
  fullName: 'Nguyen Van A',
  phone: '0912345678',
  province: 'Ha Noi',
  district: 'Cau Giay',
  ward: 'Dich Vong',
  detail: '1 Nguyen Trai',
});

const seedUser = async (role = 'customer') => {
  seq += 1;
  const user = await User.create({
    name: `Checkout Order ${RUN_ID} ${role} ${seq}`,
    email: `checkout-order-${RUN_ID}-${role}-${seq}@example.com`,
    password: 'hashed-password-not-used',
    role,
    status: 'active',
  });
  created.users.push(user);
  return user;
};

const seedProduct = async (label, variants, basePrice = 199000) => {
  seq += 1;
  const name = `${RUN_ID} ${label} ${seq}`;
  const category = await Category.create({ name: `${name} category` });
  created.categories.push(category);

  const product = await Product.create({
    name,
    category: category._id,
    basePrice,
    images: [OLD_IMAGE],
    variants,
  });
  created.products.push(product);
  return product;
};

const seedCart = async (userId, product, sku, qty) => {
  const cart = await Cart.create({
    user: userId,
    items: [
      {
        product: product._id,
        sku,
        size: 'M',
        color: 'DEN',
        qty,
        unitPrice: 1,
      },
    ],
  });
  created.carts.push(cart);
  return cart;
};

const cookieFor = (user) => [
  `accessToken=${signAccessToken({
    _id: user._id,
    role: user.role,
    tokenVersion: user.tokenVersion,
  })}`,
];

const placeOrder = (user, body = {}) =>
  request(app)
    .post('/api/orders')
    .set('Cookie', cookieFor(user))
    .send({ address: address(), paymentMethod: 'cod', ...body });

const getOrder = (user, id) =>
  request(app).get(`/api/orders/${id}`).set('Cookie', cookieFor(user));

const listOrders = (user) =>
  request(app).get('/api/orders').set('Cookie', cookieFor(user));

const cancelOrder = (user, id) =>
  request(app)
    .post(`/api/orders/${id}/cancel`)
    .set('Cookie', cookieFor(user))
    .send({ note: 'T6-4-3' });

test.before(async () => {
  const dbName = (() => {
    try {
      const withoutParams = TEST_URI.split('?')[0];
      const afterScheme = withoutParams.replace(/^mongodb(\+srv)?:\/\//, '');
      const afterAt = afterScheme.includes('@')
        ? afterScheme.slice(afterScheme.lastIndexOf('@') + 1)
        : afterScheme;
      const slash = afterAt.indexOf('/');
      return slash >= 0 ? afterAt.slice(slash + 1) : '';
    } catch (error) {
      return '';
    }
  })();

  if (!dbName || !dbName.toLowerCase().includes('test')) {
    skipReason = 'TEST_MONGODB_URI phai tro toi database co ten chua "test"';
    return;
  }

  try {
    try {
      await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 3000 });
    } catch (error) {
      if (process.env.TEST_MONGODB_URI) {
        throw error;
      }
      memoryServer = await MongoMemoryServer.create();
      await mongoose.connect(memoryServer.getUri('abmt_shop_test'), {
        serverSelectionTimeoutMS: 3000,
      });
    }

    await Promise.all([
      User.init(),
      Category.init(),
      Product.init(),
      Order.init(),
      Cart.init(),
    ]);
    available = true;
  } catch (error) {
    skipReason = `Khong ket noi duoc MongoDB test (${error.name})`;
  }
});

test.after(async () => {
  if (available) {
    const userIds = created.users.map((user) => user._id);
    await Order.deleteMany({ user: { $in: userIds } });
    await Cart.deleteMany({ _id: { $in: created.carts.map((cart) => cart._id) } });
    await Product.deleteMany({
      _id: { $in: created.products.map((product) => product._id) },
    });
    await Category.deleteMany({
      _id: { $in: created.categories.map((category) => category._id) },
    });
    await User.deleteMany({ _id: { $in: userIds } });
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (memoryServer) {
    await memoryServer.stop();
  }
});

test('T6-4-3: POST /api/orders snapshot gia tu DB, bo qua gia va qty tu client', async (t) => {
  if (skipIfUnavailable(t)) return;

  const user = await seedUser();
  const sku = skuFor('M', 'DEN');
  const product = await seedProduct('snapshot', [
    { sku, size: 'M', color: 'DEN', stock: 5, price: 249000 },
  ]);
  const originalName = product.name;
  await seedCart(user._id, product, sku, 2);

  const res = await placeOrder(user, {
    items: [{ unitPrice: 1, qty: 99 }],
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));

  const detail = await getOrder(user, res.body.data.id);
  assert.equal(detail.status, 200);
  const order = detail.body.data;
  assert.equal(order.items[0].unitPrice, 249000);
  assert.equal(order.items[0].qty, 2);
  assert.equal(order.items[0].lineTotal, 498000);
  assert.equal(order.subtotal, 498000);
  assert.equal(order.total, 528000);
  assert.equal(order.items[0].name, originalName);
  assert.equal(order.items[0].image, OLD_IMAGE);

  product.name = `${RUN_ID} da doi`;
  product.images = [NEW_IMAGE];
  product.basePrice = 1;
  await product.save();

  const afterMutation = await getOrder(user, order.id);
  assert.equal(afterMutation.status, 200);
  assert.equal(afterMutation.body.data.items[0].name, originalName);
  assert.equal(afterMutation.body.data.items[0].image, OLD_IMAGE);

  const fallbackSku = skuFor('M', 'DEN');
  const fallbackProduct = await seedProduct('fallback', [
    { sku: fallbackSku, size: 'M', color: 'DEN', stock: 3, price: null },
  ]);
  await seedCart(user._id, fallbackProduct, fallbackSku, 1);

  const fallbackRes = await placeOrder(user);
  assert.equal(fallbackRes.status, 201, JSON.stringify(fallbackRes.body));
  const fallbackDetail = await getOrder(user, fallbackRes.body.data.id);
  assert.equal(fallbackDetail.status, 200);
  assert.equal(fallbackDetail.body.data.items[0].unitPrice, 199000);
  assert.equal(fallbackDetail.body.data.total, 229000);
});

test('T6-4-3: hủy đơn hoàn kho đúng 1 lần, ghi stockRestoredAt và lịch sử', async (t) => {
  if (skipIfUnavailable(t)) return;

  const user = await seedUser();
  const sku = skuFor('M', 'DEN');
  const product = await seedProduct('cancel-once', [
    { sku, size: 'M', color: 'DEN', stock: 3, price: 199000 },
  ]);
  await seedCart(user._id, product, sku, 2);

  const placed = await placeOrder(user);
  assert.equal(placed.status, 201, JSON.stringify(placed.body));
  const afterPlace = await Product.findById(product._id);
  assert.equal(afterPlace.variants[0].stock, 1);

  const cancelled = await cancelOrder(user, placed.body.data.id);
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));
  assert.equal(cancelled.body.data.status, 'cancelled');
  assert.ok(cancelled.body.data.stockRestoredAt);

  const afterCancel = await Product.findById(product._id);
  assert.equal(afterCancel.variants[0].stock, 3);

  const detail = await getOrder(user, placed.body.data.id);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.status, 'cancelled');
  assert.equal(detail.body.data.statusHistory.at(-1).status, 'cancelled');

  const repeated = await cancelOrder(user, placed.body.data.id);
  assert.equal(repeated.status, 409);
  const afterRepeat = await Product.findById(product._id);
  assert.equal(afterRepeat.variants[0].stock, 3);
});

test('T6-4-3: IDOR đơn người khác bị chặn, admin vẫn xem/hủy được', async (t) => {
  if (skipIfUnavailable(t)) return;

  const owner = await seedUser();
  const other = await seedUser();
  const admin = await seedUser('admin');
  const sku = skuFor('M', 'DEN');
  const product = await seedProduct('idor', [
    { sku, size: 'M', color: 'DEN', stock: 4, price: 199000 },
  ]);
  await seedCart(owner._id, product, sku, 2);

  const placed = await placeOrder(owner);
  assert.equal(placed.status, 201, JSON.stringify(placed.body));
  const orderId = placed.body.data.id;

  const foreignDetail = await getOrder(other, orderId);
  assert.equal(foreignDetail.status, 403);
  const foreignCancel = await cancelOrder(other, orderId);
  assert.equal(foreignCancel.status, 403);
  const foreignList = await listOrders(other);
  assert.equal(foreignList.status, 200);
  assert.ok(!foreignList.body.data.items.some((item) => item.id === orderId));

  const stillPending = await getOrder(owner, orderId);
  assert.equal(stillPending.status, 200);
  assert.equal(stillPending.body.data.status, 'pending');
  const afterDenied = await Product.findById(product._id);
  assert.equal(afterDenied.variants[0].stock, 2);

  const adminDetail = await getOrder(admin, orderId);
  assert.equal(adminDetail.status, 200);
  assert.equal(adminDetail.body.data.id, orderId);
  const adminCancel = await cancelOrder(admin, orderId);
  assert.equal(adminCancel.status, 200, JSON.stringify(adminCancel.body));
  const afterAdmin = await Product.findById(product._id);
  assert.equal(afterAdmin.variants[0].stock, 4);

  const invalidId = await getOrder(owner, 'not-an-object-id');
  assert.equal(invalidId.status, 400);
  const missing = await getOrder(owner, new mongoose.Types.ObjectId().toString());
  assert.equal(missing.status, 404);
});
