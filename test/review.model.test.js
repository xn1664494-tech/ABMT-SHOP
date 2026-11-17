const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Review = require('../src/model/Review');

const objectId = () => new mongoose.Types.ObjectId();

const base = (overrides = {}) =>
  new Review({
    user: objectId(),
    product: objectId(),
    order: objectId(),
    rating: 5,
    comment: 'San pham tot',
    ...overrides,
  });

const errorsOf = async (doc) => {
  const error = await doc.validate().catch((err) => err);
  assert.ok(error, 'du lieu phai bi tu choi');
  return error.errors;
};

test('T2-2-1: Review khai bao day du field va default', () => {
  assert.equal(Review.modelName, 'Review');

  for (const field of [
    'user',
    'product',
    'order',
    'rating',
    'comment',
    'isApproved',
    'createdAt',
    'updatedAt',
  ]) {
    assert.ok(Review.schema.path(field), `thieu field ${field}`);
  }

  assert.equal(Review.schema.path('isApproved').defaultValue, false);
  assert.equal(Review.schema.path('isDeleted'), undefined);
});

test('T2-2-1: user, product, order, rating la bat buoc', async () => {
  const errors = await errorsOf(
    new Review({
      user: undefined,
      product: undefined,
      order: undefined,
      rating: undefined,
    }),
  );

  assert.ok(errors.user);
  assert.ok(errors.product);
  assert.ok(errors.order);
  assert.ok(errors.rating);
});

test('T2-2-1: rating phai la so nguyen tu 1 den 5', async () => {
  for (const rating of [0, 6, 2.5]) {
    const errors = await errorsOf(base({ rating }));
    assert.ok(errors.rating, `rating ${rating} phai bi tu choi`);
  }
});

test('T2-2-1: rating hop le 1-5 duoc chap nhan', async () => {
  for (const rating of [1, 3, 5]) {
    const doc = base({ rating });
    await doc.validate();
    assert.equal(doc.rating, rating);
  }
});

test('T2-2-1: comment toi da 1000 ky tu', async () => {
  const errors = await errorsOf(base({ comment: 'a'.repeat(1001) }));
  assert.ok(errors.comment);
});

test('T2-2-1: Review co index unique (user, product) va index hien thi', () => {
  const indexes = Review.schema.indexes();

  assert.ok(
    indexes.some(
      ([fields, options]) =>
        fields.user === 1 && fields.product === 1 && options.unique,
    ),
    'thieu unique index (user, product)',
  );
  assert.ok(
    indexes.some(
      ([fields]) =>
        fields.product === 1 &&
        fields.isApproved === 1 &&
        fields.createdAt === 1,
    ),
    'thieu index (product, isApproved, createdAt)',
  );
});

test('T2-2-1: toJSON an _id, __v va giu du lieu danh gia', async () => {
  const doc = base();
  await doc.validate();
  const json = doc.toJSON();

  assert.equal(json._id, undefined);
  assert.equal(json.__v, undefined);
  assert.ok(json.id);
  assert.equal(json.rating, 5);
  assert.equal(json.isApproved, false);
  assert.ok(json.order);
});

test.after(() => {
  mongoose.deleteModel(/Review/);
});
