const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'n-plus-one-jwt-secret-at-least-32-characters';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.APP_ORIGIN = 'http://localhost:3000';

const User = require('../src/model/User');
const Category = require('../src/model/Category');
const Product = require('../src/model/Products');
const Order = require('../src/model/Order');
const Cart = require('../src/model/Cart');
const CartService = require('../src/services/CartService');
const productService = require('../src/services/ProductsServices');
const orderStats = require('../src/services/orderStatsService');
const { signAccessToken } = require('../src/services/tokenService');
const app = require('../src/app');

const SKUS = Array.from(
  { length: 5 },
  (_, index) => `SP-AO-${String(701 + index).padStart(3, '0')}-M-DEN`,
);
const MARKER = 't722n1';

let mongod;
let user;
let rootCategory;
let products;
let queryCounts = {};
let counting = false;

mongoose.set('debug', (collection, method) => {
  if (!counting) return;
  const key = `${collection}.${method}`;
  queryCounts[key] = (queryCounts[key] || 0) + 1;
});

const withQueryCount = async (fn) => {
  queryCounts = {};
  counting = true;
  try {
    return await fn();
  } finally {
    counting = false;
  }
};

const countOf = (key) => queryCounts[key] || 0;

const itemsFor = (overrides = {}) =>
  products.map((product, index) => ({
    product: product._id,
    sku: SKUS[index],
    size: 'M',
    color: 'Den',
    qty: 1,
    unitPrice: 100000 + index,
    ...overrides,
  }));

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all([
    User.init(),
    Category.init(),
    Product.init(),
    Order.init(),
    Cart.init(),
  ]);

  user = await User.create({
    name: `${MARKER} User`,
    email: `${MARKER}@example.test`,
    password: 'hashed-password-not-used',
    role: 'customer',
    status: 'active',
    phone: '0912345678',
    phoneVerified: true,
    phoneVerifiedAt: new Date(),
  });

  rootCategory = await Category.create({ name: `${MARKER} Root` });
  const childA = await Category.create({
    name: `${MARKER} Child A`,
    parentId: rootCategory._id,
  });
  await Category.create({
    name: `${MARKER} Child B`,
    parentId: childA._id,
  });

  products = await Product.create(
    SKUS.map((sku, index) => ({
      name: `${MARKER} Product ${index}`,
      slug: `${MARKER}-product-${index}`,
      category: index % 2 === 0 ? childA._id : rootCategory._id,
      basePrice: 100000 + index,
      images: ['https://cdn.example.com/t722.jpg'],
      variants: [
        {
          size: 'M',
          color: 'Den',
          sku,
          stock: 50,
          price: 100000 + index,
        },
      ],
    })),
  );

  const statuses = ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'];
  await Order.create(
    statuses.map((status, index) => ({
      user: user._id,
      status,
      statusHistory: [{ status, at: new Date(), by: user._id }],
      items: [
        {
          product: products[0]._id,
          name: products[0].name,
          image: products[0].images[0],
          sku: SKUS[0],
          size: 'M',
          color: 'Den',
          unitPrice: 100000,
          qty: 1,
          lineTotal: 100000,
        },
      ],
      shippingAddress: {
        fullName: 'N Plus One',
        phone: '0912345678',
        province: 'Ha Noi',
        district: 'Cau Giay',
        ward: 'Dich Vong',
        detail: '1 Nguyen Trai',
      },
      paymentMethod: 'cod',
      subtotal: 100000,
      shippingFee: 0,
      discount: 0,
      total: 100000,
      createdAt: new Date(Date.now() - index * 3600000),
    })),
  );
});

test.after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

test('T7-2-2: refreshItemPrices doc 5 san pham bang 1 query', async () => {
  const items = itemsFor();

  await withQueryCount(() => CartService.refreshItemPrices(items));

  assert.equal(countOf('products.find'), 1);
  assert.equal(countOf('products.findOne'), 0);
  assert.equal(items.length, 5);
});

test('T7-2-2: mergeGuestIntoUser doc 5 san pham bang 1 query', async () => {
  const userCart = await Cart.create({ user: user._id, items: itemsFor() });
  const guestCart = await Cart.create({
    sessionId: `${MARKER}-guest`,
    items: itemsFor(),
    expiresAt: new Date(Date.now() + 86400000),
  });

  await withQueryCount(() => CartService.mergeGuestIntoUser(userCart, guestCart, null));

  assert.equal(countOf('products.find'), 1);
  assert.equal(countOf('products.findOne'), 0);
  assert.equal(userCart.items.length, 5);
  assert.equal(userCart.items[0].qty, 2);
});

test('T7-2-2: resolve category descendants bang 1 query', async () => {
  await withQueryCount(() =>
    productService.list({ category: String(rootCategory._id), limit: '20' }, {}),
  );

  assert.equal(countOf('categories.find'), 1);
  assert.equal(countOf('categories.findOne'), 0);
  assert.equal(countOf('products.find'), 1);
});

test('T7-2-2: countOrdersByStatus dung 1 aggregate, khong countDocuments', async () => {
  const counts = await withQueryCount(() => orderStats.countOrdersByStatus(user._id));

  assert.equal(countOf('orders.aggregate'), 1);
  assert.equal(countOf('orders.countDocuments'), 0);
  assert.deepEqual(counts, {
    pending: 1,
    confirmed: 1,
    shipping: 1,
    delivered: 1,
    completed: 0,
    cancelled: 1,
  });
});

test('T7-2-2: POST /api/orders khong goi Product.findById cho tung item', async () => {
  await Cart.deleteMany({ user: user._id });
  await Cart.create({ user: user._id, items: itemsFor() });
  const cookie = `accessToken=${signAccessToken({
    _id: user._id,
    role: user.role,
    tokenVersion: user.tokenVersion,
  })}`;

  const response = await withQueryCount(() =>
    request(app)
      .post('/api/orders')
      .set('Cookie', cookie)
      .send({
        address: {
          fullName: 'N Plus One',
          phone: '0912345678',
          province: 'Ha Noi',
          district: 'Cau Giay',
          ward: 'Dich Vong',
          detail: '1 Nguyen Trai',
        },
        paymentMethod: 'cod',
      })
      .expect(201),
  );

  assert.equal(countOf('products.find'), 1);
  assert.equal(countOf('products.findOne'), 0);
  assert.ok(response.body.data.id);
});
