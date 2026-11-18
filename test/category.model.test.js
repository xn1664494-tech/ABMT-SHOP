const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Category = require('../src/model/Category');

const base = (overrides = {}) => new Category({ name: 'Áo', ...overrides });

test('T2-2-1: Category khai bao day du field va default', () => {
  assert.equal(Category.modelName, 'Category');

  for (const field of [
    'name',
    'slug',
    'parentId',
    'order',
    'isDeleted',
    'deletedAt',
    'createdAt',
    'updatedAt',
  ]) {
    assert.ok(Category.schema.path(field), `thieu field ${field}`);
  }

  assert.equal(Category.schema.path('parentId').defaultValue, null);
  assert.equal(Category.schema.path('order').defaultValue, 0);
  assert.equal(Category.schema.path('isDeleted').defaultValue, false);
  assert.equal(Category.schema.path('deletedAt').defaultValue, null);
});

test('T2-2-1: slug duoc sinh tu name, lowercase va bo dau', async () => {
  const doc = base({ name: 'Phụ Kiện Thời Trang' });

  await doc.validate();
  assert.equal(doc.slug, 'phu-kien-thoi-trang');
});

test('T2-2-1: name la bat buoc', async () => {
  const doc = new Category({});

  const error = await doc.validate().catch((err) => err);
  assert.ok(error.errors.name);
});

test('T2-2-1: name toi da 80 ky tu', async () => {
  const doc = base({ name: 'a'.repeat(81) });

  const error = await doc.validate().catch((err) => err);
  assert.ok(error.errors.name);
});

test('T2-2-1: category khong the la cha cua chinh no', async () => {
  const doc = base();
  doc.parentId = doc._id;

  const error = await doc.validate().catch((err) => err);
  assert.ok(error.errors.parentId);
});

test('T2-2-1: order phai la so nguyen khong am', async () => {
  const negative = await base({ order: -1 })
    .validate()
    .catch((err) => err);
  assert.ok(negative.errors.order);

  const decimal = await base({ order: 1.5 })
    .validate()
    .catch((err) => err);
  assert.ok(decimal.errors.order);
});

test('T2-2-1: Category co index slug unique va (parentId, order)', () => {
  const indexes = Category.schema.indexes();

  assert.ok(
    indexes.some(([fields, options]) => fields.slug === 1 && options.unique),
    'thieu index unique cho slug',
  );
  assert.ok(
    indexes.some(([fields]) => fields.parentId === 1 && fields.order === 1),
    'thieu index (parentId, order)',
  );
});

test('T2-2-1: toJSON an _id, isDeleted, deletedAt va giu id', async () => {
  const doc = base({ name: 'Quần' });
  await doc.validate();
  const json = doc.toJSON();

  assert.equal(json._id, undefined);
  assert.equal(json.isDeleted, undefined);
  assert.equal(json.deletedAt, undefined);
  assert.equal(json.__v, undefined);
  assert.ok(json.id);
  assert.equal(json.slug, 'quan');
});

test.after(() => {
  mongoose.deleteModel(/Category/);
});
