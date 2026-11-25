const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFilter, escapeRegex } = require('../src/utils/productFilter');

const CATEGORY_ID = '507f1f77bcf86cd799439011';

const expectError = (fn) => {
  try {
    fn();
  } catch (error) {
    assert.equal(error.statusCode, 400);
    assert.ok(Array.isArray(error.details));
    return error;
  }
  assert.fail('tham so loc phai bi tu choi');
};

const hasField = (error, field) =>
  error.details.some((detail) => detail.field === field);

test('T4-2-1: escapeRegex thoat ky tu dieu khien regex', () => {
  assert.equal(escapeRegex('a.*b'), 'a\\.\\*b');
  assert.equal(escapeRegex('(x)[y]'), '\\(x\\)\\[y\\]');
  assert.equal(escapeRegex('$ ^ + ? { } | \\'), '\\$ \\^ \\+ \\? \\{ \\} \\| \\\\');
});

test('T4-2-1: query rong tra filter rong, khong dung toi isActive/isDeleted', () => {
  assert.deepEqual(buildFilter({}), {});
  assert.deepEqual(buildFilter(undefined), {});
});

test('T4-2-1: loc theo category ObjectId', () => {
  const filter = buildFilter({ category: CATEGORY_ID });
  assert.equal(String(filter.category), CATEGORY_ID);
  assert.equal(filter.isActive, undefined);
  assert.equal(filter.isDeleted, undefined);
});

test('T4-2-1: category do service resolve (categoryId) duoc uu tien', () => {
  const resolved = '64b7f0c2a1b2c3d4e5f60718';
  const filter = buildFilter({ category: 'ao-thun' }, { categoryId: resolved });
  assert.equal(String(filter.category), resolved);
});

test('T4-2-1: category sai dinh dang bao 400', () => {
  const error = expectError(() => buildFilter({ category: 'khong-phai-id' }));
  assert.ok(hasField(error, 'category'));
});

test('T4-2-1: khoang gia hop le tao $gte/$lte tren basePrice', () => {
  const filter = buildFilter({ minPrice: '100000', maxPrice: '250000' });
  assert.deepEqual(filter.basePrice, { $gte: 100000, $lte: 250000 });

  const onlyMin = buildFilter({ minPrice: '100000' });
  assert.deepEqual(onlyMin.basePrice, { $gte: 100000 });

  const onlyMax = buildFilter({ maxPrice: '250000' });
  assert.deepEqual(onlyMax.basePrice, { $lte: 250000 });
});

test('T4-2-1: khoang gia sai bao 400', () => {
  const cases = [
    { minPrice: '-1' },
    { maxPrice: 'abc' },
    { minPrice: '1.5' },
    { minPrice: '300000', maxPrice: '100000' },
  ];

  for (const query of cases) {
    const error = expectError(() => buildFilter(query));
    const field = 'minPrice' in query ? 'minPrice' : 'maxPrice';
    assert.ok(hasField(error, field), `phai bao loi tai ${field}`);
  }
});

test('T4-2-1: keyword duoc escape, tim tren name va description', () => {
  const filter = buildFilter({ keyword: 'a.*b' });

  assert.equal(filter.$or.length, 2);
  assert.deepEqual(filter.$or[0].name, { $regex: 'a\\.\\*b', $options: 'i' });
  assert.deepEqual(filter.$or[1].description, {
    $regex: 'a\\.\\*b',
    $options: 'i',
  });
});

test('T4-2-1: keyword rong bi bo qua, qua dai bao 400', () => {
  assert.deepEqual(buildFilter({ keyword: '   ' }), {});
  const error = expectError(() => buildFilter({ keyword: 'a'.repeat(101) }));
  assert.ok(hasField(error, 'keyword'));
});

test('T4-2-1: size + color dung mot $elemMatch kem stock > 0', () => {
  const filter = buildFilter({ size: 'M', color: 'Đỏ' });

  assert.deepEqual(Object.keys(filter), ['variants']);
  assert.deepEqual(filter.variants, {
    $elemMatch: {
      stock: { $gt: 0 },
      size: { $regex: '^M$', $options: 'i' },
      color: { $regex: '^Đỏ$', $options: 'i' },
    },
  });
});

test('T4-2-1: chi color hoac chi inStock van yeu cau ton kho > 0', () => {
  const byColor = buildFilter({ color: 'Đỏ' });
  assert.deepEqual(byColor.variants, {
    $elemMatch: {
      stock: { $gt: 0 },
      color: { $regex: '^Đỏ$', $options: 'i' },
    },
  });

  const inStock = buildFilter({ inStock: 'true' });
  assert.deepEqual(inStock.variants, { $elemMatch: { stock: { $gt: 0 } } });
});

test('T4-2-1: nhieu size/color dung $in trong cung $elemMatch', () => {
  const filter = buildFilter({ size: ['M', 'L'], color: ['Đỏ', 'Xanh'] });
  const elem = filter.variants.$elemMatch;

  assert.equal(elem.stock.$gt, 0);
  assert.ok(Array.isArray(elem.size.$in));
  assert.ok(elem.size.$in.every((regex) => regex instanceof RegExp));
  assert.ok(elem.color.$in.every((regex) => regex instanceof RegExp));
});

test('T4-2-1: ghep nhieu bo loc', () => {
  const filter = buildFilter({
    category: CATEGORY_ID,
    minPrice: '100000',
    maxPrice: '500000',
    keyword: 'áo',
    size: 'm',
    color: 'đỏ',
  });

  assert.equal(String(filter.category), CATEGORY_ID);
  assert.deepEqual(filter.basePrice, { $gte: 100000, $lte: 500000 });
  assert.ok(filter.$or);
  assert.equal(filter.variants.$elemMatch.stock.$gt, 0);
});

test('T4-4-3: chi size cung tao mot $elemMatch kem stock > 0', () => {
  const filter = buildFilter({ size: 'M' });

  assert.deepEqual(filter.variants, {
    $elemMatch: {
      stock: { $gt: 0 },
      size: { $regex: '^M$', $options: 'i' },
    },
  });
});

test('T4-4-3: inStock=false khong tao dieu kien variants', () => {
  assert.deepEqual(buildFilter({ inStock: 'false' }), {});
  assert.deepEqual(buildFilter({ inStock: '0' }), {});
});

test('T4-4-3: gia tri mang chi dung phan tu dau tien', () => {
  const filter = buildFilter({
    category: [CATEGORY_ID, 'khong-phai-id'],
    keyword: ['áo', 'Giày'],
  });

  assert.equal(String(filter.category), CATEGORY_ID);
  assert.deepEqual(filter.$or[0].name, { $regex: 'áo', $options: 'i' });
});

test('T4-4-3: nhieu tham so sai tra 400 kem day du details', () => {
  const error = expectError(() =>
    buildFilter({
      category: 'khong-phai-id',
      minPrice: '-1',
      keyword: 'a'.repeat(101),
    }),
  );

  assert.ok(hasField(error, 'category'));
  assert.ok(hasField(error, 'minPrice'));
  assert.ok(hasField(error, 'keyword'));
});
