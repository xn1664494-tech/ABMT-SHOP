const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.APP_ORIGIN = 'http://localhost:3000';
process.env.AUTH_RATE_LIMIT_MAX = '10000';

const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/model/User');
const Category = require('../../src/model/Category');
const Product = require('../../src/model/Products');
const Order = require('../../src/model/Order');
const Cart = require('../../src/model/Cart');
const { MongoMemoryServer } = require('mongodb-memory-server');

const RUN_ID = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const PASSWORD = 'E2ePass123';
const TEST_URI =
  process.env.MONGODB_URI_TEST ||
  process.env.TEST_MONGODB_URI ||
  'mongodb://127.0.0.1:27017/abmt_shop_test';
const explicitUri = Boolean(process.env.MONGODB_URI_TEST || process.env.TEST_MONGODB_URI);

let memoryServer = null;
let available = false;
let skipReason = '';
const created = { users: [], categories: [], products: [] };

const skipIfUnavailable = (t) => {
  if (!available) {
    t.skip(skipReason);
    return true;
  }
  return false;
};

const emailFor = (role) => `${RUN_ID}-${role}@example.com`;

const skuFor = (size, color) =>
  `SP-AO-${Math.floor(Math.random() * 900) + 100}-${size}-${color}`;

const getCsrfToken = async (agent) => {
  const res = await agent.get('/api/auth/csrf');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const token = res.body && res.body.data && res.body.data.csrfToken;
  assert.ok(token, 'CSRF token phai duoc cap');
  return token;
};

const login = async (agent, email) => {
  const csrfToken = await getCsrfToken(agent);
  const res = await agent
    .post('/api/auth/login')
    .set('X-CSRF-Token', csrfToken)
    .send({ email, password: PASSWORD });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return csrfToken;
};

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
    skipReason = 'MongoDB URI phai tro toi database co ten chua "test"';
    return;
  }

  try {
    try {
      await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 3000 });
    } catch (error) {
      if (explicitUri) {
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
    await Order.deleteMany({ user: { $in: created.users } });
    await Cart.deleteMany({ user: { $in: created.users } });
    await Product.deleteMany({ _id: { $in: created.products } });
    await Category.deleteMany({ _id: { $in: created.categories } });
    await User.deleteMany({ _id: { $in: created.users } });
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (memoryServer) {
    await memoryServer.stop();
  }
});

test('T7-4-1 E2E: dang ky khach -> loc/mua -> admin xac nhan -> kiem tra ton kho va trang thai', async (t) => {
  if (skipIfUnavailable(t)) return;

  const customerEmail = emailFor('customer');
  const customerAgent = request.agent(app);
  const customerCsrf = await getCsrfToken(customerAgent);

  const registered = await customerAgent
    .post('/api/auth/register')
    .set('X-CSRF-Token', customerCsrf)
    .send({ name: 'E2E Customer', email: customerEmail, password: PASSWORD });
  assert.equal(registered.status, 201, JSON.stringify(registered.body));
  assert.equal(registered.body.data.user.role, 'customer');
  assert.ok(registered.body.data.user.id);
  assert.equal(registered.body.data.user.passwordHash, undefined);
  created.users.push(registered.body.data.user.id);

  await User.updateOne(
    { email: customerEmail },
    { phoneVerified: true, phoneVerifiedAt: new Date() },
  );

  await login(customerAgent, customerEmail);

  const category = await Category.create({
    name: `E2E ${RUN_ID}`,
    slug: `e2e-${RUN_ID}`,
  });
  created.categories.push(category._id);

  const sku = skuFor('M', 'DEN');
  const otherSku = skuFor('S', 'XANH');
  const product = await Product.create({
    name: `E2E Ao ${RUN_ID}`,
    category: category._id,
    basePrice: 199000,
    images: ['https://example.com/e2e.jpg'],
    variants: [
      { sku, size: 'M', color: 'DEN', stock: 5, price: 199000 },
      { sku: otherSku, size: 'S', color: 'XANH', stock: 0, price: 199000 },
    ],
  });
  created.products.push(product._id);

  const query = new URLSearchParams({
    category: category.slug,
    keyword: RUN_ID,
    size: 'M',
    color: 'DEN',
    inStock: 'true',
    minPrice: '100000',
    maxPrice: '300000',
    page: '1',
    limit: '20',
    sort: 'newest',
  });
  const filtered = await customerAgent.get(`/api/products?${query.toString()}`);
  assert.equal(filtered.status, 200, JSON.stringify(filtered.body));
  assert.equal(filtered.body.data.pagination.total, 1);
  assert.equal(filtered.body.data.items[0].id, String(product._id));
  assert.equal(filtered.body.data.items[0].totalStock, 5);

  const added = await customerAgent
    .post('/api/cart/items')
    .set('X-CSRF-Token', customerCsrf)
    .send({ product: String(product._id), size: 'M', color: 'DEN', qty: 2 });
  assert.equal(added.status, 200, JSON.stringify(added.body));
  assert.equal(added.body.data.items.length, 1);
  assert.equal(added.body.data.items[0].sku, sku);
  assert.equal(added.body.data.items[0].qty, 2);

  const placed = await customerAgent
    .post('/api/orders')
    .set('X-CSRF-Token', customerCsrf)
    .send({
      address: {
        fullName: 'Nguyen Van E2E',
        phone: '0912345678',
        province: 'Ha Noi',
        district: 'Cau Giay',
        ward: 'Dich Vong',
        detail: '1 Nguyen Trai',
      },
      paymentMethod: 'cod',
      note: RUN_ID,
    });
  assert.equal(placed.status, 201, JSON.stringify(placed.body));
  assert.equal(placed.body.data.status, 'pending');

  const orderId = placed.body.data.id;
  const dbOrder = await Order.findById(orderId).lean();
  assert.equal(String(dbOrder.user), String(registered.body.data.user.id));
  assert.equal(dbOrder.status, 'pending');
  assert.equal(dbOrder.items[0].sku, sku);
  assert.equal(dbOrder.items[0].qty, 2);
  assert.equal(dbOrder.items[0].unitPrice, 199000);
  assert.equal(dbOrder.shippingAddress.detail, '1 Nguyen Trai');

  const afterCheckout = await Product.findById(product._id).lean();
  const variantAfterCheckout = afterCheckout.variants.find((v) => v.sku === sku);
  assert.equal(variantAfterCheckout.stock, 3);

  const cartAfterCheckout = await customerAgent.get('/api/cart');
  assert.equal(cartAfterCheckout.status, 200);
  assert.equal(cartAfterCheckout.body.data.empty, true);

  const adminEmail = emailFor('admin');
  const admin = await User.create({
    name: 'E2E Admin',
    email: adminEmail,
    password: await bcrypt.hash(PASSWORD, 10),
    role: 'admin',
    status: 'active',
  });
  created.users.push(admin._id);

  const adminAgent = request.agent(app);
  await login(adminAgent, adminEmail);
  const adminCsrf = await getCsrfToken(adminAgent);

  const confirmed = await adminAgent
    .patch(`/api/admin/orders/${orderId}/status`)
    .set('X-CSRF-Token', adminCsrf)
    .send({ status: 'confirmed', note: `${RUN_ID} confirm` });
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
  assert.equal(confirmed.body.data.order.status, 'confirmed');

  const detail = await customerAgent.get(`/api/orders/${orderId}`);
  assert.equal(detail.status, 200, JSON.stringify(detail.body));
  assert.equal(detail.body.data.status, 'confirmed');
  const historyEntry = detail.body.data.statusHistory.at(-1);
  assert.equal(historyEntry.status, 'confirmed');
  assert.equal(historyEntry.actorRole, 'admin');
  assert.match(historyEntry.note, /^\[role:admin\]/);

  const list = await customerAgent.get('/api/orders');
  const listedOrder = list.body.data.items.find((item) => item.id === orderId);
  assert.equal(listedOrder.status, 'confirmed');

  const afterConfirm = await Product.findById(product._id).lean();
  const variantAfterConfirm = afterConfirm.variants.find((v) => v.sku === sku);
  assert.equal(variantAfterConfirm.stock, 3);
});
