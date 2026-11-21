const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Category = require('../src/model/Category');
const Product = require('../src/model/Products');
const productService = require('../src/services/ProductsServices');
const {
  PRODUCT_LIST_FIELDS,
  buildSort,
} = require('../src/utils/productFilter');
const { toPublicProductListItem } = require('../src/utils/productSerializer');

const MARKER = 't423opt';
const SEED_COUNT = 500;
const DEFAULT_SORT = { createdAt: -1, _id: -1 };

let mongod;
let category;

const sku = (sequence, size = 'M', color = 'DEN') =>
  `SP-AO-${String(sequence).padStart(3, '0')}-${size}-${color}`;

// Duyệt đệ quy cây execution plan: cấu trúc khác nhau giữa các phiên bản
// MongoDB nên không đọc cứng một đường dẫn.
const collectStages = (node, acc = []) => {
  if (!node) return acc;
  if (Array.isArray(node)) {
    for (const item of node) collectStages(item, acc);
    return acc;
  }
  if (typeof node !== 'object') return acc;

  if (node.stage) acc.push(node);

  for (const key of [
    'inputStage',
    'inputStages',
    'queryPlan',
    'winningPlan',
    'executionStages',
    'shards',
  ]) {
    if (node[key]) collectStages(node[key], acc);
  }

  return acc;
};

const explainStages = (explain) =>
  collectStages(explain.executionStats.executionStages);

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Category.init();
  await Product.init();

  category = await Category.create({ name: `${MARKER} Category` });

  const docs = Array.from({ length: SEED_COUNT }, (_, index) => ({
    name: `${MARKER} Product ${index}`,
    description: `Mo ta san pham ${index} `.padEnd(1000, 'x'),
    category: category._id,
    images: ['https://cdn.example.com/product.jpg'],
    basePrice: 100000 + index,
    variants: [
      {
        size: 'M',
        color: 'Đen',
        sku: sku(index + 1),
        stock: index % 3,
        price: 100000 + index,
      },
    ],
    isActive: index % 20 !== 0,
    isDeleted: index % 25 === 0,
    deletedAt: index % 25 === 0 ? new Date() : null,
  }));

  await Product.insertMany(docs);
});

test.after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

test('T4-2-3: sort mac dinh newest khop index compound', () => {
  assert.deepEqual(buildSort(undefined), DEFAULT_SORT);
  assert.deepEqual(buildSort(''), DEFAULT_SORT);
  assert.deepEqual(buildSort('newest'), DEFAULT_SORT);
});

test('T4-2-3: danh sach tra plain object dung shape, khong co description', async () => {
  const { items } = await productService.list({ limit: '5' }, {});

  assert.ok(items.length > 0);
  const item = items[0];

  assert.ok(item.id);
  assert.equal(item._id, undefined);
  assert.equal(item.__v, undefined);
  assert.equal(item.description, undefined);
  assert.equal(item.isDeleted, undefined);
  assert.equal(item.deletedAt, undefined);
  assert.ok(Array.isArray(item.variants));
  assert.equal(typeof item.totalStock, 'number');
  assert.equal(typeof item.inStock, 'boolean');
  assert.equal(item.totalStock, item.variants.reduce((sum, variant) => sum + (Number(variant.stock) || 0), 0));
  assert.equal(item.inStock, item.variants.some((variant) => Number(variant.stock) > 0));
});

test('T4-2-3: serializer tinh totalStock/inStock khi variants rong hoac thieu', () => {
  const empty = toPublicProductListItem({ _id: 'abc', variants: [] });
  assert.equal(empty.totalStock, 0);
  assert.equal(empty.inStock, false);

  const missing = toPublicProductListItem({ _id: 'abc' });
  assert.equal(missing.totalStock, 0);
  assert.equal(missing.inStock, false);
  assert.equal(missing.id, 'abc');
  assert.ok(Array.isArray(missing.variants));
});

test('T4-2-3: bo loc size + color van chinh xac khi dung lean', async () => {
  const secondCategory = await Category.create({
    name: `${MARKER} Filter Category`,
  });

  const makeProduct = (name, sequence, variants) =>
    Product.create({
      name: `${MARKER} ${name}`,
      category: secondCategory._id,
      basePrice: 200000,
      variants,
    });

  const match = await makeProduct('Filter Match M Do', 801, [
    { size: 'M', color: 'Đỏ', sku: sku(801, 'M', 'DO'), stock: 5 },
    { size: 'L', color: 'Xanh', sku: sku(801, 'L', 'XANH'), stock: 5 },
  ]);
  const split = await makeProduct('Filter Split M Xanh S Do', 802, [
    { size: 'M', color: 'Xanh', sku: sku(802, 'M', 'XANH'), stock: 5 },
    { size: 'S', color: 'Đỏ', sku: sku(802, 'S', 'DO'), stock: 5 },
  ]);
  const outOfStock = await makeProduct('Filter Out M Do', 803, [
    { size: 'M', color: 'Đỏ', sku: sku(803, 'M', 'DO'), stock: 0 },
  ]);

  const { items } = await productService.list(
    { category: secondCategory.slug, size: 'M', color: 'Đỏ' },
    {},
  );
  const ids = items.map((item) => item.id);

  assert.ok(ids.includes(String(match._id)));
  assert.ok(!ids.includes(String(split._id)));
  assert.ok(!ids.includes(String(outOfStock._id)));
});

test('T4-2-3: explain dung index compound cho danh sach mac dinh', async () => {
  const filter = { isActive: true, isDeleted: false };
  const sort = buildSort('newest');

  const autoExplain = await Product.find(filter)
    .sort(sort)
    .limit(20)
    .select(PRODUCT_LIST_FIELDS)
    .explain('executionStats');

  const autoStages = explainStages(autoExplain);
  const autoNames = autoStages.map((stage) => stage.stage);

  assert.ok(autoNames.includes('IXSCAN'), 'phai dung IXSCAN');
  assert.ok(!autoNames.includes('COLLSCAN'), 'khong duoc COLLSCAN');
  assert.ok(!autoNames.includes('SORT'), 'khong duoc SORT trong bo nho');

  const usedIndex = autoStages
    .filter((stage) => stage.stage === 'IXSCAN')
    .map((stage) => stage.indexName)
    .find((name) => name && name.includes('createdAt'));
  assert.ok(usedIndex, 'phai dung index co createdAt');
});

test('T4-2-3: hint index cu cho thay SORT (so sanh truoc/sau)', async () => {
  const filter = { isActive: true, isDeleted: false };
  const sort = buildSort('newest');

  const oldExplain = await Product.find(filter)
    .sort(sort)
    .limit(20)
    .select(PRODUCT_LIST_FIELDS)
    .hint({ isActive: 1, isDeleted: 1 })
    .explain('executionStats');

  const oldStages = explainStages(oldExplain);
  const oldNames = oldStages.map((stage) => stage.stage);

  assert.ok(oldNames.includes('IXSCAN'), 'index cu van duoc dung de loc');
  assert.ok(oldNames.includes('SORT'), 'index cu phai sort trong bo nho');
});
