/**
 * Integration test cho Order/Cart/Review tren MongoDB that (local test instance).
 *
 * - Chi dung TEST_MONGODB_URI, mac dinh mongodb://127.0.0.1:27017/abmt_shop_test
 * - Bat buoc ten database phai chua "test".
 * - Chi xoa du lieu do lan chay nay tao ra (tien to it-<runId>-).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';

const Category = require('../../src/model/Category');
const Product = require('../../src/model/Products');
const Order = require('../../src/model/Order');
const Cart = require('../../src/model/Cart');
const Review = require('../../src/model/Review');
const { ORDER_CODE_REGEX } = require('../../src/utils/orderCode');

const LEGACY_TEST_URI = process.env.TEST_MONGODB_URI;
const TEST_URI =
  process.env.MONGODB_URI_TEST ||
  LEGACY_TEST_URI ||
  'mongodb://127.0.0.1:27017/abmt_shop_test';

const RUN_ID = `it-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const PREFIX = `${RUN_ID}-`;

let available = false;
let skipReason = '';
const createdCartUserIds = [];

const skipIfUnavailable = (t) => {
  if (!available) {
    t.skip(skipReason);
    return true;
  }
  return false;
};

const objectId = () => new mongoose.Types.ObjectId();

const address = (overrides = {}) => ({
  fullName: 'Nguyen Van A',
  phone: '0912345678',
  province: 'Ha Noi',
  district: 'Cau Giay',
  ward: 'Dich Vong',
  detail: '1 Nguyen Trai',
  ...overrides,
});

const orderItem = (overrides = {}) => ({
  product: objectId(),
  name: 'Ao Thun Basic',
  image: 'https://cdn.example.com/a.jpg',
  sku: `SP-AO-${Math.floor(Math.random() * 899) + 100}-M-DEN`,
  size: 'M',
  color: 'Den',
  unitPrice: 199000,
  qty: 1,
  ...overrides,
});

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
    await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 10000 });
    await Promise.all([
      Category.init(),
      Product.init(),
      Order.init(),
      Cart.init(),
      Review.init(),
    ]);
    available = true;
  } catch (error) {
    skipReason = `Khong ket noi duoc MongoDB test (${error.name})`;
  }
});

test.after(async () => {
  if (available) {
    await Order.deleteMany({ note: RUN_ID });
    await Cart.deleteMany({
      $or: [
        { sessionId: { $regex: `^${PREFIX}` } },
        { user: { $in: createdCartUserIds } },
      ],
    });
    await Review.deleteMany({ comment: RUN_ID });
    await Product.deleteMany({ slug: { $regex: `^${PREFIX}` } });
    await Category.deleteMany({ slug: { $regex: `^${PREFIX}` } });
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

test('IT-ORDER: tao don that, snapshot va tu tinh tien', async (t) => {
  if (skipIfUnavailable(t)) return;

  const userId = objectId();
  const order = await Order.create({
    user: userId,
    note: RUN_ID,
    items: [
      orderItem({ unitPrice: 199000, qty: 1 }),
      orderItem({ unitPrice: 250000, qty: 2 }),
    ],
    shippingAddress: address(),
  });

  const stored = await Order.findById(order._id);

  assert.match(stored.code, ORDER_CODE_REGEX);
  assert.equal(stored.items[0].lineTotal, 199000);
  assert.equal(stored.items[1].lineTotal, 500000);
  assert.equal(stored.subtotal, 699000);
  assert.equal(stored.shippingFee, 0);
  assert.equal(stored.total, 699000);
  assert.equal(stored.status, 'pending');
  assert.equal(stored.paymentStatus, 'unpaid');
  assert.equal(stored.statusHistory.length, 1);
  assert.equal(stored.statusHistory[0].status, 'pending');

  const indexes = await Order.collection.indexes();
  assert.ok(
    indexes.some((index) => index.key.code === 1 && index.unique),
    'thieu unique index code',
  );
  assert.ok(
    indexes.some(
      (index) => index.key.user === 1 && index.key.createdAt === 1,
    ),
    'thieu index (user, createdAt)',
  );
  assert.ok(
    indexes.some(
      (index) => index.key.status === 1 && index.key.createdAt === 1,
    ),
    'thieu index (status, createdAt)',
  );
});

test('IT-ORDER-SHIPPING: don duoi 500.000 duoc tinh ship 30.000', async (t) => {
  if (skipIfUnavailable(t)) return;

  const order = await Order.create({
    user: objectId(),
    note: RUN_ID,
    items: [orderItem({ unitPrice: 100000, qty: 1 })],
    shippingAddress: address(),
  });

  const stored = await Order.findById(order._id);
  assert.equal(stored.shippingFee, 30000);
  assert.equal(stored.total, 130000);
});

test('IT-CART-GUEST: TTL index va unique sessionId', async (t) => {
  if (skipIfUnavailable(t)) return;

  const sessionId = `${PREFIX}guest`;
  const cart = await Cart.create({
    sessionId,
    items: [
      {
        product: objectId(),
        sku: `SP-QU-${Math.floor(Math.random() * 899) + 100}-L-XANH`,
        size: 'L',
        color: 'Xanh',
        qty: 1,
        unitPrice: 299000,
      },
    ],
  });

  assert.ok(cart.expiresAt);
  assert.ok(cart.expiresAt.getTime() > Date.now() + 29 * 24 * 60 * 60 * 1000);

  const duplicate = await Cart.create({ sessionId }).catch((error) => error);
  assert.equal(duplicate.code, 11000);

  const indexes = await Cart.collection.indexes();
  assert.ok(
    indexes.some(
      (index) =>
        index.key.expiresAt === 1 &&
        index.expireAfterSeconds === 0,
    ),
    'thieu TTL index expiresAt',
  );
  assert.ok(
    indexes.some(
      (index) =>
        index.key.sessionId === 1 &&
        index.unique &&
        index.partialFilterExpression?.sessionId?.$type === 'string',
    ),
    'thieu unique partial index sessionId',
  );
});

test('IT-CART-USER: moi user chi co mot gio hang', async (t) => {
  if (skipIfUnavailable(t)) return;

  const userId = objectId();
  createdCartUserIds.push(userId);
  await Cart.create({ user: userId, items: [] });

  const duplicate = await Cart.create({ user: userId, items: [] }).catch(
    (error) => error,
  );
  assert.equal(duplicate.code, 11000);

  const both = await Cart.create({
    user: objectId(),
    sessionId: `${PREFIX}both`,
  }).catch((error) => error);
  assert.ok(both.errors?.user);
});

test('IT-REVIEW: unique (user, product) va index hien thi', async (t) => {
  if (skipIfUnavailable(t)) return;

  const user = objectId();
  const product = objectId();
  const order = objectId();

  await Review.create({
    user,
    product,
    order,
    rating: 5,
    comment: RUN_ID,
  });

  const duplicate = await Review.create({
    user,
    product,
    order,
    rating: 4,
    comment: RUN_ID,
  }).catch((error) => error);
  assert.equal(duplicate.code, 11000);

  const indexes = await Review.collection.indexes();
  assert.ok(
    indexes.some(
      (index) =>
        index.key.user === 1 && index.key.product === 1 && index.unique,
    ),
    'thieu unique index (user, product)',
  );
  assert.ok(
    indexes.some(
      (index) =>
        index.key.product === 1 &&
        index.key.isApproved === 1 &&
        index.key.createdAt === 1,
    ),
    'thieu index (product, isApproved, createdAt)',
  );
});
