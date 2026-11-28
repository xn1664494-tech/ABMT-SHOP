/**
 * Integration test cho Category/Product tren MongoDB that (local test instance).
 *
 * - Chi dung TEST_MONGODB_URI, mac dinh mongodb://127.0.0.1:27017/abmt_shop_test
 * - Bat buoc ten database phai chua "test" truoc khi ket noi/xoa du lieu.
 * - Chi xoa du lieu do lan chay nay tao ra (tien to slug it-<runId>-).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';

const Category = require('../../src/model/Category');
const Product = require('../../src/model/Products');

const LEGACY_TEST_URI = process.env.TEST_MONGODB_URI;
const TEST_URI =
  process.env.MONGODB_URI_TEST ||
  LEGACY_TEST_URI ||
  'mongodb://127.0.0.1:27017/abmt_shop_test';

const RUN_ID = `it-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const PREFIX = `${RUN_ID}-`;

let available = false;
let skipReason = '';

const skipIfUnavailable = (t) => {
  if (!available) {
    t.skip(skipReason);
    return true;
  }
  return false;
};

const variant = (overrides = {}) => ({
  size: 'M',
  color: 'Đen',
  colorCode: '#111111',
  sku: `SP-AO-${Math.floor(Math.random() * 899) + 100}-M-DEN`,
  stock: 5,
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
    await Category.init();
    await Product.init();
    available = true;
  } catch (error) {
    skipReason = `Khong ket noi duoc MongoDB test (${error.name})`;
  }
});

test.after(async () => {
  if (available) {
    await Product.deleteMany({ slug: { $regex: `^${PREFIX}` } });
    await Category.deleteMany({ slug: { $regex: `^${PREFIX}` } });
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

test('IT-CATEGORY: tao cay danh muc that va doc lai tu MongoDB', async (t) => {
  if (skipIfUnavailable(t)) return;

  const parent = await Category.create({ name: `${RUN_ID} Ao` });
  const child = await Category.create({
    name: `${RUN_ID} Ao Thun`,
    parentId: parent._id,
    order: 1,
  });

  const storedParent = await Category.findById(parent._id);
  const storedChild = await Category.findById(child._id);

  assert.equal(storedParent.slug, `${PREFIX}ao`.toLowerCase());
  assert.equal(storedParent.isDeleted, false);
  assert.equal(String(storedChild.parentId), String(parent._id));
  assert.equal(storedChild.order, 1);

  const indexes = await Category.collection.indexes();
  assert.ok(
    indexes.some((index) => index.key.slug === 1 && index.unique),
    'thieu unique index slug',
  );
  assert.ok(
    indexes.some(
      (index) => index.key.parentId === 1 && index.key.order === 1,
    ),
    'thieu compound index (parentId, order)',
  );
});

test('IT-PRODUCT: tao san pham co bien the that va doc lai', async (t) => {
  if (skipIfUnavailable(t)) return;

  const category = await Category.create({ name: `${RUN_ID} Quan` });
  const product = await Product.create({
    name: `${RUN_ID} Quan Jeans`,
    category: category._id,
    basePrice: 399000,
    images: ['https://cdn.example.com/jeans.jpg'],
    variants: [
      variant({ sku: `SP-QU-${Math.floor(Math.random() * 899) + 100}-M-XANH` }),
    ],
  });

  const stored = await Product.findById(product._id);

  assert.equal(stored.slug, `${PREFIX}quan-jeans`.toLowerCase());
  assert.equal(stored.basePrice, 399000);
  assert.equal(stored.isActive, true);
  assert.equal(stored.variants.length, 1);
  assert.equal(stored.variants[0].stock, 5);
  assert.equal(stored.variants[0].price, null);

  const indexes = await Product.collection.indexes();
  assert.ok(
    indexes.some((index) => index.key.slug === 1 && index.unique),
    'thieu unique index slug',
  );
  assert.ok(
    indexes.some(
      (index) =>
        index.key['variants.sku'] === 1 && index.unique && index.sparse,
    ),
    'thieu unique sparse index variants.sku',
  );
  assert.ok(
    indexes.some(
      (index) =>
        index.key.isActive === 1 && index.key.isDeleted === 1,
    ),
    'thieu index (isActive, isDeleted)',
  );
});

test('IT-SKU-UNIQUE: SKU trung toan cuc bi tu choi', async (t) => {
  if (skipIfUnavailable(t)) return;

  const sku = `SP-PK-${Math.floor(Math.random() * 899) + 100}-F-DEN`;
  const category = await Category.create({ name: `${RUN_ID} Phu Kien` });

  await Product.create({
    name: `${RUN_ID} Vi Da 1`,
    category: category._id,
    basePrice: 100000,
    variants: [variant({ size: 'F', sku })],
  });

  const duplicate = await Product.create({
    name: `${RUN_ID} Vi Da 2`,
    category: category._id,
    basePrice: 100000,
    variants: [variant({ size: 'F', sku })],
  }).catch((error) => error);

  assert.equal(duplicate.code, 11000);
  assert.ok(await Product.exists({ slug: `${PREFIX}vi-da-1`.toLowerCase() }));
});
