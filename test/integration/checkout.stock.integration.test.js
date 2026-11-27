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
let memoryServer = null;
const RUN_ID = `cs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

let available = false;
let skipReason = '';
const created = { users: [], categories: [], products: [], carts: [] };
let userSeq = 0;

const skipIfUnavailable = (t) => {
  if (!available) {
    t.skip(skipReason);
    return true;
  }
  return false;
};

const skuFor = (size, color) =>
  `SP-AO-${Math.floor(Math.random() * 900) + 100}-${size}-${color}`;

const address = () => ({
  fullName: 'Nguyen Van A',
  phone: '0912345678',
  province: 'Ha Noi',
  district: 'Cau Giay',
  ward: 'Dich Vong',
  detail: '1 Nguyen Trai',
});

const seedUser = async () => {
  userSeq += 1;
  const user = await User.create({
    name: `Checkout ${RUN_ID} ${userSeq}`,
    email: `checkout-${RUN_ID}-${userSeq}@example.com`,
    password: 'hashed-password-not-used',
    role: 'customer',
    status: 'active',
  });
  created.users.push(user._id);
  return user;
};

const seedProduct = async (nameSuffix, variants) => {
  const category = await Category.create({ name: `Checkout ${RUN_ID} ${nameSuffix}` });
  created.categories.push(category._id);

  const product = await Product.create({
    name: `Checkout ${RUN_ID} ${nameSuffix}`,
    category: category._id,
    basePrice: 199000,
    images: ['https://example.com/checkout.jpg'],
    variants,
  });
  created.products.push(product._id);
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
        unitPrice: 199000,
      },
    ],
  });
  created.carts.push(cart._id);
  return cart;
};

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
    await Order.deleteMany({ user: { $in: created.users } });
    await Cart.deleteMany({ _id: { $in: created.carts } });
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

test('IT-CHECKOUT-STOCK: 2 request cung variant ton 1 chi 1 thanh cong', async (t) => {
  if (skipIfUnavailable(t)) return;

  const user = await seedUser();
  const sku = skuFor('M', 'DEN');
  const product = await seedProduct('concurrent', [
    { sku, size: 'M', color: 'DEN', stock: 1, price: 199000 },
  ]);
  await seedCart(user._id, product, sku, 1);

  const cookie = cookieFor(user);
  const [first, second] = await Promise.all([
    placeOrder(cookie),
    placeOrder(cookie),
  ]);

  assert.deepEqual([first.status, second.status].sort(), [201, 409]);

  const fresh = await Product.findById(product._id);
  assert.equal(fresh.variants[0].stock, 0);
  assert.equal(await Order.countDocuments({ user: user._id }), 1);
});

test('IT-CHECKOUT-STOCK: vuot kho dung SKU khong lam doi SKU khac', async (t) => {
  if (skipIfUnavailable(t)) return;

  const user = await seedUser();
  const skuAvailable = skuFor('M', 'DEN');
  const skuEmpty = skuFor('S', 'XANH');
  const product = await seedProduct('wrong-variant', [
    { sku: skuAvailable, size: 'M', color: 'DEN', stock: 5, price: 199000 },
    { sku: skuEmpty, size: 'S', color: 'XANH', stock: 0, price: 199000 },
  ]);
  await seedCart(user._id, product, skuEmpty, 1);

  const res = await placeOrder(cookieFor(user));
  assert.equal(res.status, 409);
  assert.match(res.body.error, new RegExp(skuEmpty));

  const fresh = await Product.findById(product._id);
  const stockBySku = Object.fromEntries(
    fresh.variants.map((variant) => [variant.sku, variant.stock])
  );
  assert.equal(stockBySku[skuAvailable], 5);
  assert.equal(stockBySku[skuEmpty], 0);
  assert.equal(await Order.countDocuments({ user: user._id }), 0);
});

test('IT-CHECKOUT-STOCK: loi tao don thi hoan kho va giu nguyen gio', async (t) => {
  if (skipIfUnavailable(t)) return;

  const user = await seedUser();
  const sku = skuFor('M', 'DEN');
  const product = await seedProduct('order-fail', [
    { sku, size: 'M', color: 'DEN', stock: 1, price: 199000 },
  ]);
  await seedCart(user._id, product, sku, 1);

  const originalCreate = Order.create;
  Order.create = async () => {
    throw new Error('forced order failure');
  };

  try {
    const res = await placeOrder(cookieFor(user));
    assert.equal(res.status, 500);
  } finally {
    Order.create = originalCreate;
  }

  const fresh = await Product.findById(product._id);
  assert.equal(fresh.variants[0].stock, 1);
  assert.equal(await Order.countDocuments({ user: user._id }), 0);
  assert.ok(await Cart.exists({ user: user._id }));
});
