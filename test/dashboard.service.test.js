const test = require('node:test');
const assert = require('node:assert/strict');

const Order = require('../src/model/Order');
const Product = require('../src/model/Products');
const {
  getRevenueSeries,
  getTopCategories,
  getLowStockVariants,
  getDashboard,
} = require('../src/services/dashboardService');

const originalOrderAggregate = Order.aggregate;
const originalProductAggregate = Product.aggregate;

test.afterEach(() => {
  Order.aggregate = originalOrderAggregate;
  Product.aggregate = originalProductAggregate;
});

const stubOrder = (rows) => {
  const calls = [];
  Order.aggregate = async (pipeline) => {
    calls.push(pipeline);
    return rows;
  };
  return calls;
};

const stubProduct = (rows) => {
  const calls = [];
  Product.aggregate = async (pipeline) => {
    calls.push(pipeline);
    return rows;
  };
  return calls;
};

test('doanh thu theo tuan: gom nhom day vao bucket ISO va dien 0', async () => {
  const calls = stubOrder([
    { _id: '2026-11-23', revenue: 100000, orders: 1 },
    { _id: '2026-11-24', revenue: 50000, orders: 2 },
  ]);

  const result = await getRevenueSeries({
    from: '2026-11-23',
    to: '2026-11-29',
    granularity: 'week',
  });

  assert.deepEqual(result.labels, ['2026-W48']);
  assert.deepEqual(result.datasets[0].data, [150000]);
  assert.deepEqual(result.series[0], {
    date: '2026-W48',
    revenue: 150000,
    orders: 3,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0].$match.status, 'delivered');
});

test('doanh thu theo thang: cac bucket khong co don van tra 0', async () => {
  stubOrder([{ _id: '2026-11-05', revenue: 250000, orders: 1 }]);

  const result = await getRevenueSeries({
    from: '2026-10-01',
    to: '2026-12-31',
    granularity: 'month',
  });

  assert.deepEqual(result.labels, ['2026-10', '2026-11', '2026-12']);
  assert.deepEqual(result.datasets[0].data, [0, 250000, 0]);
});

test('top danh mục: group theo category, sort doanh thu, gioi han limit', async () => {
  const calls = stubOrder([
    { _id: 'a', name: 'Ao', revenue: 900000, qty: 9 },
    { _id: 'b', name: 'Quan', revenue: 400000, qty: 4 },
  ]);

  const result = await getTopCategories({
    from: '2026-11-01',
    to: '2026-11-30',
    limit: 2,
  });

  assert.deepEqual(result.labels, ['Ao', 'Quan']);
  assert.deepEqual(result.datasets[0].data, [900000, 400000]);
  assert.deepEqual(result.items[0], {
    categoryId: 'a',
    name: 'Ao',
    revenue: 900000,
    qty: 9,
  });
  assert.equal(calls[0].some((stage) => stage.$limit === 2), true);
});

test('ton kho: lay ca bien the stock = 0 va map day du thong tin', async () => {
  const calls = stubProduct([
    {
      productId: '64b000000000000000000001',
      name: 'Ao da',
      sku: 'AO-M-DEN',
      size: 'M',
      color: 'DEN',
      stock: 0,
    },
    {
      productId: '64b000000000000000000002',
      name: 'Ao da',
      sku: 'AO-L-TRANG',
      size: 'L',
      color: 'TRANG',
      stock: 3,
    },
  ]);

  const result = await getLowStockVariants({ threshold: 5, limit: 10 });

  assert.deepEqual(result.datasets[0].data, [0, 3]);
  assert.deepEqual(result.items[0], {
    productId: '64b000000000000000000001',
    name: 'Ao da',
    sku: 'AO-M-DEN',
    size: 'M',
    color: 'DEN',
    stock: 0,
  });
  assert.deepEqual(calls[0][2].$match['variants.stock'], { $lte: 5 });
});

test('getDashboard gom ca 3 payload va meta clamped', async () => {
  stubOrder([]);
  stubProduct([]);

  const result = await getDashboard({
    from: '2026-11-23',
    to: '2026-11-26',
    granularity: 'week',
    limit: '999',
    threshold: '999',
  });

  assert.ok(result.revenue.labels.length > 0);
  assert.deepEqual(result.topCategories.items, []);
  assert.deepEqual(result.lowStock.items, []);
  assert.equal(result.meta.granularity, 'week');
  assert.equal(result.meta.limit, 20);
  assert.equal(result.meta.threshold, 100);
});

test('from lon hon to tra 400', async () => {
  await assert.rejects(
    () =>
      getRevenueSeries({
        from: '2026-11-30',
        to: '2026-11-01',
      }),
    (error) => error.statusCode === 400,
  );
});
