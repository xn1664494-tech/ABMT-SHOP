const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), quiet: true });

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'integration-test-jwt-secret-at-least-32-chars';
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
const { signAccessToken } = require('../../src/services/tokenService');

const LEGACY_TEST_URI = process.env.TEST_MONGODB_URI;
const TEST_URI = process.env.MONGODB_URI_TEST || LEGACY_TEST_URI;

if (!TEST_URI) {
  throw new Error(
    'Thiếu MONGODB_URI_TEST. Tạo file .env.test từ .env.test.example rồi chạy lại.',
  );
}

if (!process.env.MONGODB_URI_TEST && LEGACY_TEST_URI) {
  console.warn(
    '[deprecated] TEST_MONGODB_URI đã được thay bằng MONGODB_URI_TEST; tên cũ sẽ bị bỏ sau 1 sprint.',
  );
}

const REQUEST_COUNT = (() => {
  const value = parseInt(process.env.CONCURRENCY_REQUESTS, 10);
  return Number.isInteger(value) && value > 0 ? value : 10;
})();

const ROUNDS = (() => {
  const value = parseInt(process.env.CONCURRENCY_ROUNDS, 10);
  return Number.isInteger(value) && value > 0 ? value : 3;
})();

const RUN_ID = `cc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const created = { users: [], categories: [], products: [], carts: [] };

let available = false;
let skipReason = '';

const databaseNameOf = (uri) => {
  try {
    const withoutParams = uri.split('?')[0];
    const afterScheme = withoutParams.replace(/^mongodb(\+srv)?:\/\//, '');
    const afterAt = afterScheme.includes('@')
      ? afterScheme.slice(afterScheme.lastIndexOf('@') + 1)
      : afterScheme;
    const slash = afterAt.indexOf('/');
    return slash >= 0 ? afterAt.slice(slash + 1) : '';
  } catch (error) {
    return '';
  }
};

const skipIfUnavailable = (t) => {
  if (!available) {
    t.skip(skipReason);
    return true;
  }
  return false;
};

const address = () => ({
  fullName: 'Nguyen Van A',
  phone: '0912345678',
  province: 'Ha Noi',
  district: 'Cau Giay',
  ward: 'Dich Vong',
  detail: '1 Nguyen Trai',
});

const cookieFor = (user) => [
  `accessToken=${signAccessToken({
    _id: user._id,
    role: user.role,
    tokenVersion: user.tokenVersion,
  })}`,
];

const placeOrder = (cookie) =>
  request(app)
    .post('/api/orders')
    .set('Cookie', cookie)
    .send({ address: address(), paymentMethod: 'cod' });

const seedUsers = async (count, label) => {
  const docs = await User.create(
    Array.from({ length: count }, (_, index) => ({
      name: `Concurrency ${label} ${index + 1} ${RUN_ID}`,
      email: `concurrency-${RUN_ID}-${label}-${index + 1}@example.com`,
      password: 'hashed-password-not-used',
      phone: '0912345678',
      phoneVerified: true,
      role: 'customer',
      status: 'active',
    })),
  );
  created.users.push(...docs.map((doc) => doc._id));
  return docs;
};

const seedProduct = async (suffix, stock) => {
  const category = await Category.create({
    name: `Concurrency ${RUN_ID} ${suffix}`,
  });
  created.categories.push(category._id);

  const sku = `SP-AO-${Math.floor(Math.random() * 900) + 100}-M-DEN`;
  const product = await Product.create({
    name: `Concurrency ${RUN_ID} ${suffix}`,
    category: category._id,
    basePrice: 199000,
    images: ['https://example.com/concurrency.jpg'],
    variants: [{ sku, size: 'M', color: 'DEN', stock, price: 199000 }],
  });
  created.products.push(product._id);
  return { product, sku };
};

const seedCarts = async (users, product, sku) => {
  const carts = await Cart.insertMany(
    users.map((user) => ({
      user: user._id,
      items: [
        {
          product: product._id,
          sku,
          size: 'M',
          color: 'DEN',
          qty: 1,
          unitPrice: 199000,
        },
      ],
    })),
  );
  created.carts.push(...carts.map((cart) => cart._id));
  return carts;
};

const timed = async (fn) => {
  const start = Date.now();
  try {
    const response = await fn();
    return { response, ms: Date.now() - start };
  } catch (error) {
    return { error, ms: Date.now() - start };
  }
};

const summarize = (results) => {
  const samples = results.map((entry, index) => ({
    index,
    status: entry.response ? entry.response.status : 'ERR',
    ms: entry.ms,
  }));
  const statuses = samples.map((sample) => sample.status);
  const times = samples.map((sample) => sample.ms);
  return {
    samples,
    successCount: statuses.filter((status) => status === 201).length,
    conflictCount: statuses.filter((status) => status === 409).length,
    statuses,
    minMs: Math.min(...times),
    maxMs: Math.max(...times),
    avgMs: Math.round(times.reduce((sum, value) => sum + value, 0) / times.length),
  };
};

test.before(async () => {
  const dbName = databaseNameOf(TEST_URI);
  if (!dbName || !dbName.toLowerCase().includes('test')) {
    skipReason = 'MONGODB_URI_TEST phai tro toi database co ten chua "test"';
    return;
  }

  try {
    await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 10000 });
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
    await Cart.deleteMany({ _id: { $in: created.carts } });
    await Product.deleteMany({ _id: { $in: created.products } });
    await Category.deleteMany({ _id: { $in: created.categories } });
    await User.deleteMany({ _id: { $in: created.users } });
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

test('IT-T7-2-1: nhieu user tranh 1 san pham, chi 1 don thanh cong', async (t) => {
  if (skipIfUnavailable(t)) return;

  for (let round = 0; round < ROUNDS; round += 1) {
    const { product, sku } = await seedProduct(`multi-user-${round + 1}`, 1);
    const users = await seedUsers(REQUEST_COUNT, `multi-${round + 1}`);
    await seedCarts(users, product, sku);

    const results = await Promise.all(
      users.map((user) => timed(() => placeOrder(cookieFor(user)))),
    );
    const summary = summarize(results);

    t.diagnostic(
      `round=${round + 1} N=${REQUEST_COUNT} 201=${summary.successCount} 409=${summary.conflictCount} ` +
        `avgMs=${summary.avgMs} maxMs=${summary.maxMs}`,
    );
    summary.samples
      .slice(0, 5)
      .forEach((sample) =>
        t.diagnostic(
          `round=${round + 1} sample#${sample.index} status=${sample.status} ms=${sample.ms}`,
        ),
      );

    assert.equal(
      summary.successCount,
      1,
      `round ${round + 1}: phai co dung 1 don thanh cong`,
    );
    assert.equal(
      summary.conflictCount,
      REQUEST_COUNT - 1,
      `round ${round + 1}: cac request con lai phai bi 409`,
    );

    const fresh = await Product.findById(product._id);
    assert.equal(fresh.variants[0].stock, 0, `round ${round + 1}: ton kho phai bang 0`);
    assert.ok(
      fresh.variants[0].stock >= 0,
      `round ${round + 1}: ton kho khong duoc am`,
    );

    const orderCount = await Order.countDocuments({
      user: { $in: users.map((user) => user._id) },
    });
    assert.equal(orderCount, 1, `round ${round + 1}: phai co dung 1 don trong DB`);
  }
});

test('IT-T7-2-1: cung user, nhieu request dong thoi, chi 1 don thanh cong', async (t) => {
  if (skipIfUnavailable(t)) return;

  for (let round = 0; round < ROUNDS; round += 1) {
    const { product, sku } = await seedProduct(`single-user-${round + 1}`, 1);
    const [user] = await seedUsers(1, `single-${round + 1}`);
    await seedCarts([user], product, sku);

    const cookie = cookieFor(user);
    const results = await Promise.all(
      Array.from({ length: REQUEST_COUNT }, () => timed(() => placeOrder(cookie))),
    );
    const summary = summarize(results);

    t.diagnostic(
      `single round=${round + 1} N=${REQUEST_COUNT} statuses=${summary.statuses.join(',')} ` +
        `avgMs=${summary.avgMs} maxMs=${summary.maxMs}`,
    );

    assert.equal(
      summary.successCount,
      1,
      `round ${round + 1}: phai co dung 1 don thanh cong`,
    );
    const unexpected = summary.statuses.filter(
      (status) => status !== 201 && status !== 400 && status !== 409,
    );
    assert.deepEqual(
      unexpected,
      [],
      `round ${round + 1}: request loi phai la 400/409`,
    );

    const fresh = await Product.findById(product._id);
    assert.equal(fresh.variants[0].stock, 0, `round ${round + 1}: ton kho phai bang 0`);

    const orderCount = await Order.countDocuments({ user: user._id });
    assert.equal(orderCount, 1, `round ${round + 1}: phai co dung 1 don trong DB`);

    const remaining = await Cart.findOne({ user: user._id }).lean();
    assert.equal(remaining, null, `round ${round + 1}: gio hang phai duoc xoa`);
  }
});
