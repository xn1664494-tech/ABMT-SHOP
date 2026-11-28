'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.CATEGORY_CACHE_TTL_MS = '10000';

const { installFakeModel } = require('./support/fakeCartModels');

let findCalls = 0;
let failNext = false;
let saveCalls = 0;
let docs = [];

const thenable = (value) => ({
  sort() { return this; },
  select() { return this; },
  lean() {
    if (failNext) {
      failNext = false;
      return Promise.reject(new Error('db down'));
    }
    return Promise.resolve(value);
  },
});

installFakeModel('../../src/model/Category', {
  find(filter) {
    findCalls += 1;
    assert.deepEqual(filter, { isDeleted: false });
    return thenable(docs);
  },
  findById(id) {
    return Promise.resolve({
      _id: id,
      name: 'Old Name',
      slug: 'old-name',
      order: 1,
      isDeleted: false,
      async save() {
        saveCalls += 1;
        return this;
      },
      toJSON() {
        return { id: String(this._id), name: this.name, slug: this.slug };
      },
    });
  },
});

const cacheService = require('../src/services/categoryCacheService');
const categoryService = require('../src/services/categoryService');
const { buildNavCategories } = require('../src/middleware/navCategories');

const rootNam = {
  _id: new mongoose.Types.ObjectId(),
  name: 'Nam',
  slug: 'nam',
  parentId: null,
  order: 1,
  isVisible: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

const rootNu = {
  ...rootNam,
  _id: new mongoose.Types.ObjectId(),
  name: 'Nu',
  slug: 'nu',
  order: 2,
};

const rootHidden = {
  ...rootNam,
  _id: new mongoose.Types.ObjectId(),
  name: 'Hidden Root',
  slug: 'hidden-root',
  order: 3,
  isVisible: false,
};

const childNam = {
  ...rootNam,
  _id: new mongoose.Types.ObjectId(),
  name: 'Ao Nam',
  slug: 'ao-nam',
  parentId: rootNam._id,
  order: 1,
};

const childHidden = {
  ...rootNam,
  _id: new mongoose.Types.ObjectId(),
  name: 'Hidden Child',
  slug: 'hidden-child',
  parentId: rootNam._id,
  order: 2,
  isVisible: false,
};

docs = [rootNam, rootNu, rootHidden, childNam, childHidden];

test.beforeEach(() => {
  cacheService.invalidateCategoryCache();
  findCalls = 0;
  failNext = false;
  saveCalls = 0;
});

test('T7-2-3: tree dung 1 query cho lan doc dau va cache cho lan sau', async () => {
  const first = await categoryService.tree();
  const second = await categoryService.tree();

  assert.equal(findCalls, 1);
  assert.equal(first.length, second.length);
  assert.notEqual(first, second);
});

test('T7-2-3: API tree van chua danh muc isVisible=false nhu truoc cache', async () => {
  const tree = await categoryService.tree();
  const ids = tree.map((node) => node.id);

  assert.ok(ids.includes(String(rootHidden._id)));
  const nam = tree.find((node) => node.id === String(rootNam._id));
  assert.ok(nam.children.some((child) => child.id === String(childHidden._id)));

  for (const node of [...tree, ...nam.children]) {
    assert.ok(!('isVisible' in node));
    assert.ok(!('_id' in node));
    assert.ok(!('isDeleted' in node));
  }
});

test('T7-2-3: Mega Menu loai danh muc isVisible=false nhu truoc cache', () => {
  const nav = buildNavCategories(docs);

  assert.deepEqual(nav.map((root) => root.slug), ['nam', 'nu']);
  const nam = nav.find((root) => root.slug === 'nam');
  assert.deepEqual(nam.children.map((child) => child.slug), ['ao-nam']);
  assert.ok(!nav.some((root) => root.slug === 'hidden-root'));
});

test('T7-2-3: invalidate lam tree query lai', async () => {
  await categoryService.tree();
  assert.equal(findCalls, 1);

  cacheService.invalidateCategoryCache();
  await categoryService.tree();
  assert.equal(findCalls, 2);
});

test('T7-2-3: update danh muc goi invalidate cache', async () => {
  const generationBefore = cacheService.getCategoryCacheStats().generation;

  await categoryService.update(String(rootNam._id), { name: 'Renamed' });

  assert.equal(saveCalls, 1);
  assert.equal(cacheService.getCategoryCacheStats().generation, generationBefore + 1);
});

test('T7-2-3: cac goi dong thoi chi load 1 snapshot', async () => {
  const [first, second] = await Promise.all([
    cacheService.getCategorySnapshot(),
    cacheService.getCategorySnapshot(),
  ]);

  assert.equal(findCalls, 1);
  assert.equal(first, second);
});

test('T7-2-3: query loi khong bi cache', async () => {
  failNext = true;
  await assert.rejects(() => cacheService.getCategorySnapshot(), /db down/);
  assert.equal(findCalls, 1);

  await cacheService.getCategorySnapshot();
  assert.equal(findCalls, 2);
});
