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
const RUN_ID = `co-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const OLD_IMAGE = 'https://example.com/old.jpg';

let available = false;
let skipReason = '';
let memoryServer = null;
let seq = 0;
const created = { users: [], categories: [], products: [], carts: [] };

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

const seedUser = async (role = 'customer') => {
  seq += 1;
  const user = await User.create({
    name: `Checkout ${RUN_ID} ${role} ${seq}`,
    email: `checkout-${RUN_ID}-${role}-${seq}@example.com`,
    password: 'hashed-password-not-used',
    role,
    status: 'active',
    phone: '0912345678',
    phoneVerified: true,
    phoneVerifiedAt: new Date(),
  });
  created.users.push(user);
  return user;
};

const seedProduct = async (label, variants, image = OLD_IMAGE) => {
  seq += 1;
  const name = `${RUN_ID} ${label} ${seq}`;
  const category = await Category.create({ name: `${name} category` });
  created.categories.push(category);

  const product = await Product.create({
    name,
    category: category._id,
    basePrice: 199000,
    images: [image],
    variants,
  });
  created.products.push(product);
  return product;
};

const seedCart = async (userId, items) => {
  const cart = await Cart.create({ user: userId, items });
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

const cancelOrder = (user, id) =>
  request(app)
    .post(`/api/orders/${id}/cancel`)
    .set('Cookie', cookieFor(user))
    .send({});

const adminCancelOrder = (user, id) =>
  request(app)
    .post(`/api/admin/orders/${id}/cancel`)
    .set('Cookie', cookieFor(user))
    .send({ reason: 'IT-T6-2-1' });

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

test('IT-T6-2-1: order snapshot ten/anh/gia, xoa toan bo gio', async (t) => {
  if (skipIfUnavailable(t)) return;

  const user = await seedUser();
  const sku = skuFor('M', 'DEN');
  const oldName = `Ao cu ${RUN_ID}`;
  const product = await seedProduct('snapshot', [
    { sku, size: 'M', color: 'DEN', stock: 2, price: 199000 },
  ]);
  product.name = oldName;
  await product.save();
  await seedCart(user._id, [
    { product: product._id, sku, size: 'M', color: 'DEN', qty: 1, unitPrice: 199000 },
  ]);

  const createdOrder = await placeOrder(user);
  assert.equal(createdOrder.status, 201);

  product.name = `Ao moi ${RUN_ID}`;
  product.basePrice = 999000;
  product.images = ['https://example.com/new.jpg'];
  product.variants[0].price = 999000;
  product.variants[0].stock = 50;
  await product.save();

  const detail = await getOrder(user, createdOrder.body.data.id);
  assert.equal(detail.status, 200);
  const item = detail.body.data.items[0];
  assert.equal(item.name, oldName);
  assert.equal(item.image, OLD_IMAGE);
  assert.equal(item.unitPrice, 199000);
  assert.equal(item.lineTotal, 199000);
  assert.equal(item.qty, 1);

  const currentProduct = await Product.findById(product._id);
  assert.equal(currentProduct.name, `Ao moi ${RUN_ID}`);
  assert.equal(currentProduct.variants[0].price, 999000);
  assert.equal(await Cart.exists({ user: user._id }), null);
});

test('IT-T6-2-1: dat mot item thi chi pull dong do khoi gio', async (t) => {
  if (skipIfUnavailable(t)) return;

  const user = await seedUser();
  const firstSku = skuFor('M', 'DEN');
  const secondSku = skuFor('S', 'XANH');
  const product = await seedProduct('partial', [
    { sku: firstSku, size: 'M', color: 'DEN', stock: 3, price: 199000 },
    { sku: secondSku, size: 'S', color: 'XANH', stock: 3, price: 199000 },
  ]);
  const cart = await seedCart(user._id, [
    { product: product._id, sku: firstSku, size: 'M', color: 'DEN', qty: 1, unitPrice: 199000 },
    { product: product._id, sku: secondSku, size: 'S', color: 'XANH', qty: 1, unitPrice: 199000 },
  ]);

  const res = await placeOrder(user, {
    item: String(cart.items[0]._id),
  });
  assert.equal(res.status, 201);

  const detail = await getOrder(user, res.body.data.id);
  assert.equal(detail.body.data.items.length, 1);
  assert.equal(detail.body.data.items[0].sku, firstSku);

  const remainingCart = await Cart.findOne({ user: user._id });
  assert.ok(remainingCart);
  assert.equal(remainingCart.items.length, 1);
  assert.equal(remainingCart.items[0].sku, secondSku);

  const fresh = await Product.findById(product._id);
  const stocks = Object.fromEntries(
    fresh.variants.map((variant) => [variant.sku, variant.stock])
  );
  assert.equal(stocks[firstSku], 2);
  assert.equal(stocks[secondSku], 3);
});

test('IT-T6-2-1: owner huy pending - hoan kho mot lan, huy lai 409', async (t) => {
  if (skipIfUnavailable(t)) return;

  const user = await seedUser();
  const sku = skuFor('M', 'DEN');
  const product = await seedProduct('cancel', [
    { sku, size: 'M', color: 'DEN', stock: 1, price: 199000 },
  ]);
  await seedCart(user._id, [
    { product: product._id, sku, size: 'M', color: 'DEN', qty: 1, unitPrice: 199000 },
  ]);

  const createdOrder = await placeOrder(user);
  assert.equal(createdOrder.status, 201);

  const cancelled = await cancelOrder(user, createdOrder.body.data.id);
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.data.status, 'cancelled');
  assert.ok(cancelled.body.data.stockRestoredAt);

  const fresh = await Product.findById(product._id);
  assert.equal(fresh.variants[0].stock, 1);

  const detail = await getOrder(user, createdOrder.body.data.id);
  assert.equal(detail.body.data.status, 'cancelled');
  assert.equal(detail.body.data.statusHistory.length, 2);

  const again = await cancelOrder(user, createdOrder.body.data.id);
  assert.equal(again.status, 409);
  assert.equal((await Product.findById(product._id)).variants[0].stock, 1);
});

test('IT-T6-2-1: admin huy confirmed cua user khac, customer bi 403', async (t) => {
  if (skipIfUnavailable(t)) return;

  const user = await seedUser();
  const admin = await seedUser('admin');
  const sku = skuFor('M', 'DEN');
  const product = await seedProduct('admin-cancel', [
    { sku, size: 'M', color: 'DEN', stock: 1, price: 199000 },
  ]);
  await seedCart(user._id, [
    { product: product._id, sku, size: 'M', color: 'DEN', qty: 1, unitPrice: 199000 },
  ]);

  const createdOrder = await placeOrder(user);
  assert.equal(createdOrder.status, 201);
  await Order.updateOne(
    { _id: createdOrder.body.data.id },
    { $set: { status: 'confirmed' } }
  );

  const denied = await cancelOrder(user, createdOrder.body.data.id);
  assert.equal(denied.status, 403);

  const cancelled = await adminCancelOrder(admin, createdOrder.body.data.id);
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.data.status, 'cancelled');
  assert.equal((await Product.findById(product._id)).variants[0].stock, 1);
});
