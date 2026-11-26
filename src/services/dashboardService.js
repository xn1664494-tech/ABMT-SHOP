const Order = require('../model/Order');
const Product = require('../model/Products');
const ErrorResponse = require('../utils/appError');

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_BUCKETS = 400;
const GRANULARITIES = ['day', 'week', 'month'];

const pad = (n) => String(n).padStart(2, '0');

const clampInt = (value, min, max, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
};

function startOfUtcDay(date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function startOfUtcWeek(date) {
  const d = startOfUtcDay(date);
  const mondayOffset = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - mondayOffset);
  return d;
}

function startOfUtcMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function floorDate(date, granularity) {
  if (granularity === 'week') return startOfUtcWeek(date);
  if (granularity === 'month') return startOfUtcMonth(date);
  return startOfUtcDay(date);
}

function addPeriod(date, granularity) {
  const d = new Date(date.getTime());
  if (granularity === 'week') d.setUTCDate(d.getUTCDate() + 7);
  else if (granularity === 'month') d.setUTCMonth(d.getUTCMonth() + 1);
  else d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function formatBucket(date, granularity) {
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());

  if (granularity === 'month') return `${year}-${month}`;
  if (granularity === 'week') {
    const thursday = new Date(date.getTime());
    const mondayOffset = (thursday.getUTCDay() + 6) % 7;
    thursday.setUTCDate(thursday.getUTCDate() + 4 - mondayOffset);

    const isoYear = thursday.getUTCFullYear();
    const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
    const firstMondayOffset = (firstThursday.getUTCDay() + 6) % 7;
    firstThursday.setUTCDate(
      firstThursday.getUTCDate() + 4 - firstMondayOffset,
    );

    const week = 1 + Math.round((thursday - firstThursday) / (7 * DAY_MS));
    return `${isoYear}-W${pad(week)}`;
  }
  return `${year}-${month}-${day}`;
}

function parseDate(value, fallback) {
  if (!value) return new Date(fallback);
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new ErrorResponse('Ngay khong hop le', 400);
  }
  return d;
}

function normalizeRange({ from, to, granularity }) {
  const now = Date.now();
  const start = parseDate(from, now - 29 * DAY_MS);
  const end = parseDate(to, now);

  if (start > end) {
    throw new ErrorResponse('from phai nho hon hoac bang to', 400);
  }

  return {
    start: floorDate(start, granularity),
    endExclusive: addPeriod(floorDate(end, granularity), granularity),
  };
}

function buildLabels(start, endExclusive, granularity) {
  const labels = [];
  let cursor = new Date(start.getTime());

  while (cursor < endExclusive && labels.length < MAX_BUCKETS) {
    labels.push(formatBucket(cursor, granularity));
    cursor = addPeriod(cursor, granularity);
  }

  return labels;
}

/**
 * Doanh thu theo ngày/tuán/tháng, trả labels + datasets cho chart.
 */
async function getRevenueSeries({ from, to, granularity = 'day' } = {}) {
  const g = GRANULARITIES.includes(granularity) ? granularity : 'day';
  const { start, endExclusive } = normalizeRange({ from, to, granularity: g });
  const labels = buildLabels(start, endExclusive, g);

  const rows = await Order.aggregate([
    {
      $match: {
        status: 'delivered',
        createdAt: { $gte: start, $lt: endExclusive },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$createdAt',
            timezone: 'UTC',
          },
        },
        revenue: { $sum: '$total' },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const buckets = new Map(
    labels.map((label) => [label, { revenue: 0, orders: 0 }]),
  );

  for (const row of rows) {
    const key = formatBucket(new Date(`${row._id}T00:00:00.000Z`), g);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.revenue += row.revenue || 0;
      bucket.orders += row.orders || 0;
    }
  }

  const series = labels.map((date) => ({ date, ...buckets.get(date) }));

  return {
    labels,
    datasets: [
      { label: 'Doanh thu (VND)', data: series.map((s) => s.revenue) },
    ],
    series,
  };
}

/**
 * Top danh mục bán chạy theo doanh thu của đơn delivered.
 */
async function getTopCategories({ from, to, limit = 5 } = {}) {
  const n = clampInt(limit, 1, 20, 5);
  const { start, endExclusive } = normalizeRange({
    from,
    to,
    granularity: 'day',
  });

  const rows = await Order.aggregate([
    {
      $match: {
        status: 'delivered',
        createdAt: { $gte: start, $lt: endExclusive },
      },
    },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        revenue: { $sum: '$items.lineTotal' },
        qty: { $sum: '$items.qty' },
      },
    },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: '$product.category',
        revenue: { $sum: '$revenue' },
        qty: { $sum: '$qty' },
      },
    },
    {
      $lookup: {
        from: 'categories',
        localField: '_id',
        foreignField: '_id',
        as: 'category',
      },
    },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        name: { $ifNull: ['$category.name', 'Khác'] },
        revenue: 1,
        qty: 1,
      },
    },
    { $sort: { revenue: -1, qty: -1 } },
    { $limit: n },
  ]);

  const items = rows.map((row) => ({
    categoryId: row._id ? String(row._id) : null,
    name: row.name || 'Khác',
    revenue: row.revenue || 0,
    qty: row.qty || 0,
  }));

  return {
    labels: items.map((item) => item.name),
    datasets: [
      {
        label: 'Doanh thu theo danh mục (VND)',
        data: items.map((item) => item.revenue),
      },
    ],
    items,
  };
}

/**
 * Biến thể chạm ngưỡng tồn kho, sắp xếp theo stock tăng dần.
 */
async function getLowStockVariants({ threshold = 5, limit = 20 } = {}) {
  const t = clampInt(threshold, 0, 100, 5);
  const n = clampInt(limit, 1, 20, 20);

  const rows = await Product.aggregate([
    { $match: { isDeleted: false, isActive: true } },
    { $unwind: '$variants' },
    { $match: { 'variants.stock': { $lte: t } } },
    {
      $project: {
        productId: '$_id',
        name: '$name',
        sku: '$variants.sku',
        size: '$variants.size',
        color: '$variants.color',
        stock: '$variants.stock',
      },
    },
    { $sort: { stock: 1, name: 1 } },
    { $limit: n },
  ]);

  const items = rows.map((row) => ({
    productId: String(row.productId),
    name: row.name || '',
    sku: row.sku || '',
    size: row.size || '',
    color: row.color || '',
    stock: row.stock || 0,
  }));

  return {
    labels: items.map((item) => `${item.name} · ${item.sku}`),
    datasets: [
      { label: `Tồn kho ≤ ${t}`, data: items.map((item) => item.stock) },
    ],
    items,
  };
}

/**
 * Gộp 3 aggregation trên thành một payload JSON cho dashboard.
 */
async function getDashboard(query = {}) {
  const [revenue, topCategories, lowStock] = await Promise.all([
    getRevenueSeries(query),
    getTopCategories(query),
    getLowStockVariants(query),
  ]);

  return {
    revenue,
    topCategories,
    lowStock,
    meta: {
      from: query.from || null,
      to: query.to || null,
      granularity: query.granularity || 'day',
      threshold: clampInt(query.threshold, 0, 100, 5),
      limit: clampInt(query.limit, 1, 20, 5),
    },
  };
}

module.exports = {
  getDashboard,
  getRevenueSeries,
  getTopCategories,
  getLowStockVariants,
};
