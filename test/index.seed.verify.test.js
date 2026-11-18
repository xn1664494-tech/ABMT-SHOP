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
require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';

const User = require('../src/model/User');
const Category = require('../src/model/Category');
const Product = require('../src/model/Products');

const TEST_URI =
  process.env.TEST_MONGODB_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/abmt_shop_test';

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
    skipReason = 'TEST_MONGODB_URI / MONGODB_URI phai tro toi database co ten chua "test"';
    return;
  }

  try {
    await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 10000 });
    await User.init();
    await Category.init();
    await Product.init();
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

test('VERIFY-INDEX: Product co index slug unique, (category, basePrice), variants.sku unique sparse, multikey size/color, (isActive, isDeleted)', async (t) => {
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
});

test('VERIFY-SEED: so luong du lieu seed (chay sau script seed)', async (t) => {
  if (skipIfUnavailable(t)) return;
  const adminCount = await User.countDocuments({ role: 'admin' });
  assert.ok(adminCount >= 1, 'phai co it nhat 1 admin');
  const catCount = await Category.countDocuments();
  assert.equal(catCount, 6, 'phai co 6 danh muc');
  const prodCount = await Product.countDocuments();
  assert.equal(prodCount, 6, 'phai co 6 san pham');
});
