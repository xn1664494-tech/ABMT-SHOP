const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { toPublicCategory } = require('../src/utils/categorySerializer');

test('toPublicCategory: doi _id thanh id va an truong noi bo', () => {
  const doc = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Ao Thun',
    slug: 'ao-thun',
    parentId: null,
    order: 2,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    isDeleted: false,
    deletedAt: null,
    __v: 0,
  };

  const result = toPublicCategory(doc);

  assert.equal(result.id, String(doc._id));
  assert.equal(result.name, 'Ao Thun');
  assert.equal(result.slug, 'ao-thun');
  assert.equal(result.parentId, null);
  assert.equal(result.order, 2);
  assert.ok(!('_id' in result));
  assert.ok(!('isDeleted' in result));
  assert.ok(!('deletedAt' in result));
  assert.ok(!('__v' in result));
});

test('toPublicCategory: parentId ObjectId thanh chuoi', () => {
  const parentId = new mongoose.Types.ObjectId();
  const result = toPublicCategory({ _id: new mongoose.Types.ObjectId(), parentId });

  assert.equal(result.parentId, String(parentId));
});

test('toPublicCategory: ho tro object da co id, order mac dinh 0', () => {
  const result = toPublicCategory({ id: 'abc', name: 'X', slug: 'x' });

  assert.equal(result.id, 'abc');
  assert.equal(result.order, 0);
  assert.equal(result.parentId, null);
});
