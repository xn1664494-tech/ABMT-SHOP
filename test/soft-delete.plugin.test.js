const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Category = require('../src/model/Category');
const Product = require('../src/model/Products');
const User = require('../src/model/User');
const homeService = require('../src/services/homeService');

const MARKER = 'softdeleteplugin';
let mongod;

const names = () => ({ name: { $regex: `^${MARKER}` } });

const createCategory = (overrides = {}) =>
  Category.create({ name: `${MARKER} Category`, ...overrides });

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Category.init();
  await Product.init();
  await User.init();
});

test.beforeEach(async () => {
  await Category.deleteMany(names());
  await Product.deleteMany(names());
  await User.deleteMany({ email: { $regex: `^${MARKER}` } });
});

test.after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

test('mac dinh loai ban ghi da xoa khoi find, findOne, findById va countDocuments', async () => {
  const active = await createCategory({ name: `${MARKER} Active` });
  const deleted = await createCategory({
    name: `${MARKER} Deleted`,
    isDeleted: true,
    deletedAt: new Date(),
  });

  const all = await Category.find(names());
  assert.deepEqual(all.map((doc) => String(doc._id)), [String(active._id)]);

  assert.equal(await Category.findOne({ _id: deleted._id }), null);
  assert.equal(await Category.findById(deleted._id), null);
  assert.equal(await Category.countDocuments(names()), 1);
});

test('truy van isDeleted ro rang duoc giu nguyen', async () => {
  const active = await createCategory({ name: `${MARKER} Active` });
  const deleted = await createCategory({
    name: `${MARKER} Deleted`,
    isDeleted: true,
    deletedAt: new Date(),
  });

  const onlyDeleted = await Category.find({ ...names(), isDeleted: true });
  assert.deepEqual(onlyDeleted.map((doc) => String(doc._id)), [String(deleted._id)]);

  const onlyActive = await Category.find({ ...names(), isDeleted: false });
  assert.deepEqual(onlyActive.map((doc) => String(doc._id)), [String(active._id)]);
});

test('includeDeleted tra ca ban ghi da xoa', async () => {
  const active = await createCategory({ name: `${MARKER} Active` });
  const deleted = await createCategory({
    name: `${MARKER} Deleted`,
    isDeleted: true,
    deletedAt: new Date(),
  });

  const all = await Category.find(names()).setOptions({ includeDeleted: true });
  assert.deepEqual(
    all.map((doc) => String(doc._id)).sort(),
    [String(active._id), String(deleted._id)].sort(),
  );

  const count = await Category.countDocuments(names()).setOptions({
    includeDeleted: true,
  });
  assert.equal(count, 2);
});

test('aggregate mac dinh loai ban ghi da xoa va co the opt-out', async () => {
  await createCategory({ name: `${MARKER} Active` });
  await createCategory({
    name: `${MARKER} Deleted`,
    isDeleted: true,
    deletedAt: new Date(),
  });

  const activeOnly = await Category.aggregate([
    { $match: names() },
    { $count: 'total' },
  ]);
  assert.equal(activeOnly[0].total, 1);

  const all = await Category.aggregate([
    { $match: names() },
    { $count: 'total' },
  ]).option({ includeDeleted: true });
  assert.equal(all[0].total, 2);
});

test('findOneAndUpdate khong sua ban ghi da xoa neu khong opt-out', async () => {
  const deleted = await createCategory({
    name: `${MARKER} Deleted`,
    isDeleted: true,
    deletedAt: new Date(),
  });

  const blocked = await Category.findOneAndUpdate(
    { _id: deleted._id },
    { $set: { name: `${MARKER} Changed` } },
    { returnDocument: 'after' },
  );
  assert.equal(blocked, null);

  const updated = await Category.findOneAndUpdate(
    { _id: deleted._id },
    { $set: { name: `${MARKER} Changed` } },
    { returnDocument: 'after' },
  ).setOptions({ includeDeleted: true });
  assert.equal(updated.name, `${MARKER} Changed`);
});

test('ban ghi cu thieu isDeleted van duoc xem la chua xoa', async () => {
  await Category.collection.insertOne({
    name: `${MARKER} Legacy`,
    slug: `${MARKER}-legacy`,
    parentId: null,
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const found = await Category.findOne({ slug: `${MARKER}-legacy` });
  assert.ok(found);
  assert.notEqual(found.isDeleted, true);
});

test('plugin duoc ap dung cho User va Product', async () => {
  await User.create({
    name: `${MARKER} User Active`,
    email: `${MARKER}.active@test.com`,
    password: 'password123',
  });
  await User.create({
    name: `${MARKER} User Deleted`,
    email: `${MARKER}.deleted@test.com`,
    password: 'password123',
    isDeleted: true,
    deletedAt: new Date(),
  });

  const users = await User.find({ email: { $regex: `^${MARKER}` } });
  assert.equal(users.length, 1);

  const category = await createCategory({ name: `${MARKER} Product Category` });
  const product = await Product.create({
    name: `${MARKER} Product`,
    category: category._id,
    basePrice: 100000,
    variants: [{ size: 'M', color: 'Đen', sku: 'SP-AO-999-M-DEN', stock: 1 }],
    isDeleted: true,
    deletedAt: new Date(),
  });

  assert.equal(await Product.findById(product._id), null);
});

test('homeService chi tra danh muc chua xoa', async () => {
  const root = await createCategory({ name: `${MARKER} Nav Root` });
  const child = await createCategory({
    name: `${MARKER} Nav Child`,
    parentId: root._id,
  });
  const deletedRoot = await createCategory({
    name: `${MARKER} Nav Deleted Root`,
    isDeleted: true,
    deletedAt: new Date(),
  });
  const deletedChild = await createCategory({
    name: `${MARKER} Nav Deleted Child`,
    parentId: root._id,
    isDeleted: true,
    deletedAt: new Date(),
  });

  const navigation = await homeService.getNavCategories();
  const rootIds = navigation.map((item) => item.slug);
  const childSlugs = navigation.flatMap((item) =>
    item.children.map((entry) => entry.slug),
  );

  assert.ok(rootIds.includes(root.slug));
  assert.ok(childSlugs.includes(child.slug));
  assert.ok(!rootIds.includes(deletedRoot.slug));
  assert.ok(!childSlugs.includes(deletedChild.slug));
});

