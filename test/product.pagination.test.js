const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  buildPagination,
  buildSort,
} = require('../src/utils/productFilter');

const expectError = (fn) => {
  try {
    fn();
  } catch (error) {
    assert.equal(error.statusCode, 400);
    assert.ok(Array.isArray(error.details));
    return error;
  }
  assert.fail('tham so phan trang phai bi tu choi');
};

const errorFields = (error) => error.details.map((detail) => detail.field);

test('T4-2-1: phan trang mac dinh page 1, limit 20', () => {
  assert.deepEqual(buildPagination({}), {
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    skip: 0,
  });
  assert.equal(DEFAULT_PAGE_SIZE, 20);
});

test('T4-2-1: tinh skip dung theo page/limit', () => {
  assert.deepEqual(buildPagination({ page: '3', limit: '10' }), {
    page: 3,
    limit: 10,
    skip: 20,
  });
});

test('T4-2-1: limit vuot toi da bi ep ve MAX_PAGE_SIZE', () => {
  const result = buildPagination({ limit: '999' });
  assert.equal(result.limit, MAX_PAGE_SIZE);
  assert.equal(result.skip, 0);

  const exact = buildPagination({ limit: String(MAX_PAGE_SIZE) });
  assert.equal(exact.limit, MAX_PAGE_SIZE);
});

test('T4-2-1: page/limit khong hop le tra 400', () => {
  const cases = [
    { page: '0' },
    { page: '-1' },
    { page: 'abc' },
    { page: '1.5' },
    { limit: '0' },
    { limit: 'abc' },
    { limit: '2.5' },
  ];

  for (const query of cases) {
    const error = expectError(() => buildPagination(query));
    const field = 'page' in query ? 'page' : 'limit';
    assert.ok(errorFields(error).includes(field), `phai bao loi tai ${field}`);
  }
});

test('T4-2-1: sort mac dinh la moi nhat kem tie-breaker _id', () => {
  assert.deepEqual(buildSort(undefined), { createdAt: -1, _id: -1 });
  assert.deepEqual(buildSort(''), { createdAt: -1, _id: -1 });
  assert.deepEqual(buildSort('newest'), { createdAt: -1, _id: -1 });
});

test('T4-2-1: sort gia tang/giam va khong phan biet hoa thuong', () => {
  assert.deepEqual(buildSort('price_asc'), { basePrice: 1, _id: 1 });
  assert.deepEqual(buildSort('price_desc'), { basePrice: -1, _id: -1 });
  assert.deepEqual(buildSort('PRICE_ASC'), { basePrice: 1, _id: 1 });
});

test('T4-2-1: sort la tra 400 tai field sort', () => {
  const error = expectError(() => buildSort('gia_giam_dan'));
  assert.ok(errorFields(error).includes('sort'));
});

test('T4-2-1: buildSort tra ban sao, khong lam thay doi hang so', () => {
  const sort = buildSort('price_asc');
  sort.basePrice = -1;
  assert.deepEqual(buildSort('price_asc'), { basePrice: 1, _id: 1 });
});
