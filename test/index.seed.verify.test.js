/**
 * T2-2-2 — Test tự động verify index + số lượng dữ liệu seed.
 *
 * Chạy trên MongoDB thật (Atlas hoặc local). Tự skip nếu:
 * - Không kết nối được MongoDB, hoặc
 * - Tên database không chứa "test" (bảo vệ tránh xóa nhầm production).
 *
 * Chạy sau script seed:
 *   $env:SEED_CONFIRM="1"; npm run seed
 *   npm run test:seed-verify
 */
const path = require('node:path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env.test'), quiet: true });
dotenv.config({ quiet: true });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';

const User = require('../src/model/User');
const Category = require('../src/model/Category');
const Product = require('../src/model/Products');
const Order = require('../src/model/Order');
const PhoneVerification = require('../src/model/PhoneVerification');

const TEST_URI =
  process.env.MONGODB_URI_TEST ||
  process.env.TEST_MONGODB_URI ||
  process.env.MONGODB_URI ||
  'mongodb://127.0.0.1:27017/abmt_shop_test';

let available = false;
let skipReason = '';

test.before(async () => {
  const dbName = (() => {
    try {
      const m = /^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/.exec(TEST_URI || '');
      return m ? decodeURIComponent(m[1]) : '';
    } catch {
      return '';
    }
  })();

  if (!dbName || !/test/i.test(dbName)) {
    skipReason =
      'MONGODB_URI_TEST / TEST_MONGODB_URI / MONGODB_URI phai tro toi database co ten chua "test"';
    return;
  }

  try {
    await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 10000 });
    await User.init();
    await Category.init();
    await Product.init();
    await Order.init();
    await PhoneVerification.init();
    available = true;
  } catch (error) {
    skipReason = `Khong ket noi duoc MongoDB test (${error.name})`;
  }
});

test.after(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

const skipIfUnavailable = (t) => {
  if (!available) {
    t.skip(skipReason);
    return true;
  }
  return false;
};

test('VERIFY-INDEX: User co index email unique + status', async (t) => {
  if (skipIfUnavailable(t)) return;
  const idx = await User.collection.indexes();
  assert.ok(
    idx.some((i) => i.key.email === 1 && i.unique === true),
    'thieu unique index email',
  );
  assert.ok(idx.some((i) => i.key.status === 1), 'thieu index status');
  assert.ok(
    idx.some(
      (i) => i.key.isDeleted === 1 && i.key.createdAt === -1 && i.key._id === -1,
    ),
    'thieu compound index (isDeleted, createdAt, _id)',
  );
});

test('VERIFY-INDEX: Category co index slug unique + (parentId, order)', async (t) => {
  if (skipIfUnavailable(t)) return;
  const idx = await Category.collection.indexes();
  assert.ok(
    idx.some((i) => i.key.slug === 1 && i.unique === true),
    'thieu unique index slug',
  );
  assert.ok(
    idx.some((i) => i.key.parentId === 1 && i.key.order === 1),
    'thieu compound index (parentId, order)',
  );
});

test('VERIFY-INDEX: Product co index slug unique, (category, basePrice), variants.sku unique sparse, multikey size/color, (isActive, isDeleted), category list', async (t) => {
  if (skipIfUnavailable(t)) return;
  const idx = await Product.collection.indexes();
  assert.ok(
    idx.some((i) => i.key.slug === 1 && i.unique === true),
    'thieu unique index slug',
  );
  assert.ok(
    idx.some((i) => i.key.category === 1 && i.key.basePrice === 1),
    'thieu compound index (category, basePrice)',
  );
  const skuIdx = idx.find((i) => i.key['variants.sku'] === 1);
  assert.ok(skuIdx, 'thieu index variants.sku');
  assert.equal(skuIdx.unique, true, 'variants.sku phai unique');
  assert.equal(skuIdx.sparse, true, 'variants.sku phai sparse');
  assert.ok(
    idx.some((i) => i.key['variants.size'] === 1 && i.key['variants.color'] === 1),
    'thieu multikey index (variants.size, variants.color)',
  );
  assert.ok(
    idx.some((i) => i.key.isActive === 1 && i.key.isDeleted === 1),
    'thieu compound index (isActive, isDeleted)',
  );
  assert.ok(
    idx.some(
      (i) =>
        i.key.category === 1 &&
        i.key.isActive === 1 &&
        i.key.isDeleted === 1 &&
        i.key.createdAt === -1 &&
        i.key._id === -1,
    ),
    'thieu compound index category list',
  );
});

test('VERIFY-INDEX: Order co index list va status count', async (t) => {
  if (skipIfUnavailable(t)) return;
  const idx = await Order.collection.indexes();
  assert.ok(
    idx.some((i) => i.key.createdAt === -1 && i.key._id === -1),
    'thieu compound index (createdAt, _id)',
  );
  assert.ok(
    idx.some((i) => i.key.user === 1 && i.key.status === 1),
    'thieu compound index (user, status)',
  );
});

test('VERIFY-INDEX: PhoneVerification co index (user, createdAt)', async (t) => {
  if (skipIfUnavailable(t)) return;
  const idx = await PhoneVerification.collection.indexes();
  assert.ok(
    idx.some((i) => i.key.user === 1 && i.key.createdAt === -1),
    'thieu compound index (user, createdAt)',
  );
});

test('VERIFY-SEED: so luong du lieu seed (chay sau script seed)', async (t) => {
  if (skipIfUnavailable(t)) return;
  const adminCount = await User.countDocuments({ role: 'admin' });
  assert.ok(adminCount >= 1, 'phai co it nhat 1 admin');
  // Seed tao 2 root + 6 con = 8 danh muc, va 7 san pham.
  // DB test cung co the chua du lieu cua seedCategories/evidence khac.
  const catCount = await Category.countDocuments();
  assert.ok(catCount >= 8, 'phai co it nhat 8 danh muc (2 root + 6 con)');
  const prodCount = await Product.countDocuments();
  assert.ok(prodCount >= 7, 'phai co it nhat 7 san pham');
});
