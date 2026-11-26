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
const { signAccessToken } = require('../../src/services/tokenService');
const { MongoMemoryServer } = require('mongodb-memory-server');

const TEST_URI =
  process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/abmt_shop_test';
const RUN_ID = `dash-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const PERIOD = 'from=2026-11-23&to=2026-11-26';

let memoryServer = null;
let available = false;
let skipReason = '';
const created = { users: [], categories: [], products: [], orders: [] };
let admin = null;
let customer = null;
let productA = null;
let productB = null;

const skipIfUnavailable = (t) => {
  if (!available) {
    t.skip(skipReason);
    return true;
  }
  return false;
};

const cookieFor = (user) => [
  `accessToken=${signAccessToken({
    _id: user._id,
    role: user.role,
    tokenVersion: user.tokenVersion,
  })}`,
];

const address = () => ({
  fullName: 'Nguyen Van A',
  phone: '0912345678',
  province: 'Ha Noi',
  district: 'Cau Giay',
  ward: 'Dich Vong',
  detail: '1 Nguyen Trai',
});

const seedUser = async (role) => {
  const user = await User.create({
    name: `Dashboard ${RUN_ID} ${role}`,
    email: `dashboard-${RUN_ID}-${role}@example.com`,
    password: 'hashed-password-not-used',
    role,
    status: 'active',
  });
  created.users.push(user._id);
  return user;
};

const seedCategory = async (name) => {
  const category = await Category.create({
    name: `${RUN_ID} ${name}`,
  });
  created.categories.push(category._id);
  return category;
};

const seedProduct = async (category, name, variants) => {
  const product = await Product.create({
    name: `${RUN_ID} ${name}`,
    category: category._id,
    basePrice: 199000,
    images: ['https://example.com/dashboard.jpg'],
    variants,
    isActive: true,
  });
  created.products.push(product._id);
  return product;
};

const itemOf = (product, sku, qty, price) => ({
  product: product._id,
  name: product.name,
  image: product.images[0],
  sku,
  size: 'M',
  color: 'DEN',
  unitPrice: price,
  qty,
  lineTotal: price * qty,
});

const seedOrder = async ({ items, createdAt, status = 'delivered' }) => {
  const order = await Order.create({
    user: customer._id,
    items,
    shippingAddress: address(),
    paymentMethod: 'cod',
    status,
  });
  await Order.collection.updateOne(
    { _id: order._id },
    { $set: { createdAt: new Date(createdAt) } },
  );
  created.orders.push(order._id);
  return order;
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
    skipReason = 'TEST_MONGODB_URI phai tro toi database co ten chua "test"';
    return;
  }

  try {
    try {
      await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 3000 });
    } catch (error) {
      if (process.env.TEST_MONGODB_URI) throw error;
      memoryServer = await MongoMemoryServer.create();
      await mongoose.connect(memoryServer.getUri('abmt_shop_test'), {
        serverSelectionTimeoutMS: 3000,
      });
    }

    await Promise.all([User.init(), Category.init(), Product.init(), Order.init()]);

    admin = await seedUser('admin');
    customer = await seedUser('customer');

    const categoryA = await seedCategory('Ao');
    const categoryB = await seedCategory('Quan');

    productA = await seedProduct(categoryA, 'Ao da', [
      {
        size: 'M',
        color: 'DEN',
        sku: 'SP-AO-001-M-DEN',
        stock: 2,
        price: 199000,
      },
      {
        size: 'L',
        color: 'DEN',
        sku: 'SP-AO-002-L-DEN',
        stock: 50,
        price: 199000,
      },
    ]);
    productB = await seedProduct(categoryB, 'Quan jean', [
      {
        size: 'M',
        color: 'XAM',
        sku: 'SP-QU-003-M-XAM',
        stock: 0,
        price: 250000,
      },
    ]);

    await seedOrder({
      items: [itemOf(productA, 'SP-AO-001-M-DEN', 2, 199000)],
      createdAt: '2026-11-23T10:00:00.000Z',
    });
    await seedOrder({
      items: [itemOf(productA, 'SP-AO-001-M-DEN', 1, 199000)],
      createdAt: '2026-11-24T09:00:00.000Z',
    });
    await seedOrder({
      items: [itemOf(productB, 'SP-QU-003-M-XAM', 1, 250000)],
      createdAt: '2026-11-24T11:00:00.000Z',
    });
    await seedOrder({
      items: [itemOf(productA, 'SP-AO-001-M-DEN', 9, 199000)],
      createdAt: '2026-11-24T12:00:00.000Z',
      status: 'pending',
    });
    await seedOrder({
      items: [itemOf(productA, 'SP-AO-001-M-DEN', 9, 199000)],
      createdAt: '2026-11-20T12:00:00.000Z',
    });

    available = true;
  } catch (error) {
    skipReason = `Khong ket noi duoc MongoDB test (${error.name}: ${error.message})`;
  }
});

test.after(async () => {
  if (mongoose.connection.readyState !== 0) {
    await Order.deleteMany({ _id: { $in: created.orders } });
    await Product.deleteMany({ _id: { $in: created.products } });
    await Category.deleteMany({ _id: { $in: created.categories } });
    await User.deleteMany({ _id: { $in: created.users } });
    await mongoose.disconnect();
  }
  if (memoryServer) await memoryServer.stop();
});

test('IT-T6-2-2: GET /api/admin/dashboard tra 3 chart JSON cho admin', async (t) => {
  if (skipIfUnavailable(t)) return;

  const res = await request(app)
    .get(`/api/admin/dashboard?${PERIOD}&granularity=day&threshold=5`)
    .set('Cookie', cookieFor(admin))
    .expect(200);

  assert.equal(res.body.success, true);
  assert.deepEqual(res.body.data.revenue.labels, [
    '2026-11-23',
    '2026-11-24',
    '2026-11-25',
    '2026-11-26',
  ]);
  assert.deepEqual(res.body.data.revenue.datasets[0].data, [
    398000 + 30000,
    199000 + 250000 + 30000 + 30000,
    0,
    0,
  ]);
  assert.equal(res.body.data.revenue.series.length, 4);
  assert.equal(res.body.data.topCategories.items[0].name.includes('Ao'), true);
  assert.deepEqual(
    res.body.data.lowStock.items.map((item) => item.stock).sort((a, b) => a - b),
    [0, 2],
  );
});

test('IT-T6-2-2: top-categories chi dem don delivered va sap xep theo doanh thu', async (t) => {
  if (skipIfUnavailable(t)) return;

  const res = await request(app)
    .get(`/api/admin/dashboard/top-categories?${PERIOD}&limit=2`)
    .set('Cookie', cookieFor(admin))
    .expect(200);

  assert.equal(res.body.success, true);
  assert.equal(res.body.data.items.length, 2);
  assert.equal(res.body.data.items[0].qty, 3);
  assert.equal(res.body.data.items[1].qty, 1);
  assert.ok(res.body.data.items[0].revenue > res.body.data.items[1].revenue);
});

test('IT-T6-2-2: low-stock tra bien the stock = 0, bo qua bien the con nhieu', async (t) => {
  if (skipIfUnavailable(t)) return;

  const res = await request(app)
    .get('/api/admin/dashboard/low-stock?threshold=5&limit=10')
    .set('Cookie', cookieFor(admin))
    .expect(200);

  const skus = res.body.data.items.map((item) => item.sku);
  assert.ok(skus.includes('SP-AO-001-M-DEN'));
  assert.ok(skus.includes('SP-QU-003-M-XAM'));
  assert.equal(skus.includes('SP-AO-002-L-DEN'), false);
  assert.deepEqual(res.body.data.datasets[0].label, 'Tồn kho ≤ 5');
});

test('IT-T6-2-2: customer khong duoc goi dashboard', async (t) => {
  if (skipIfUnavailable(t)) return;

  await request(app)
    .get(`/api/admin/dashboard?${PERIOD}`)
    .set('Cookie', cookieFor(customer))
    .expect(403);
});

test('IT-T6-2-2: thieu token tra 401', async (t) => {
  if (skipIfUnavailable(t)) return;

  await request(app).get(`/api/admin/dashboard?${PERIOD}`).expect(401);
});
