const Order = require('../model/Order');
const Product = require('../model/Products');
const ProductSalesDaily = require('../model/ProductSalesDaily');
const User = require('../model/User');
const { ORDER_RECENT_FIELDS } = require('../utils/orderFields');
const {
  SALES_TIME_ZONE,
  toSalesDay,
  shiftSalesDay,
  getSalesWindowStartDay,
  startOfSalesDayUtc,
} = require('../utils/salesDate');

const REVENUE_CHART_DAYS = 7;
const TOP_SELLERS_DAYS = 30;
const TOP_SELLERS_LIMIT = 5;

const buildRecentDayLabels = (days) => {
  const today = toSalesDay(new Date());
  const labels = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    labels.push(shiftSalesDay(today, -offset));
  }
  return labels;
};

/**
 * Lấy thống kê cho trang quản trị admin dashboard.
 */
const getStats = async () => {
  const revenueChartLabels = buildRecentDayLabels(REVENUE_CHART_DAYS);
  const revenueChartStart = startOfSalesDayUtc(revenueChartLabels[0]);
  const topSellersStartDay = getSalesWindowStartDay(TOP_SELLERS_DAYS);

  const [
    totalOrders,
    totalRevenueResult,
    totalProducts,
    totalUsers,
    recentOrders,
    lowStockResult,
    revenueChart,
    topSellers30dRows,
  ] = await Promise.all([
    Order.countDocuments({}),
    Order.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]),
    Product.countDocuments({ isDeleted: false, isActive: true }),
    User.countDocuments({ role: 'customer', isDeleted: false }),
    Order.find({})
      .select(ORDER_RECENT_FIELDS)
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('user', 'name')
      .lean(),
    Product.aggregate([
      { $match: { isDeleted: false, isActive: true } },
      { $unwind: '$variants' },
      { $match: { 'variants.stock': { $lte: 5, $gt: 0 } } },
      {
        $group: {
          _id: '$_id',
          name: { $first: '$name' },
          stock: { $first: '$variants.stock' },
        },
      },
      { $limit: 20 },
    ]),
    Order.aggregate([
      {
        $match: {
          status: 'completed',
          completedAt: { $gte: revenueChartStart },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$completedAt',
              timezone: SALES_TIME_ZONE,
            },
          },
          revenue: { $sum: '$total' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    ProductSalesDaily.aggregate([
      { $match: { day: { $gte: topSellersStartDay } } },
      {
        $group: {
          _id: '$product',
          units: { $sum: '$units' },
          revenue: { $sum: '$revenue' },
          orders: { $sum: '$orders' },
        },
      },
      { $sort: { units: -1, revenue: -1, _id: 1 } },
      { $limit: TOP_SELLERS_LIMIT },
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
        $project: {
          _id: 0,
          productId: '$_id',
          name: '$product.name',
          slug: '$product.slug',
          units: 1,
          revenue: 1,
          orders: 1,
        },
      },
    ]),
  ]);

  const totalRevenue =
    totalRevenueResult.length > 0 ? totalRevenueResult[0].total : 0;

  const recentOrdersFormatted = (recentOrders || []).map((o) => ({
    code: o.code,
    customerName: (o.user && o.user.name) || 'Khách hàng',
    createdAt: o.createdAt,
    total: o.total,
  }));

  const lowStockProducts = (lowStockResult || []).map((p) => ({
    name: p.name,
    stock: p.stock || 0,
  }));

  const revenueByDay = new Map(
    (revenueChart || []).map((row) => [row._id, row.revenue || 0]),
  );

  const chartData = {
    revenue: {
      labels: revenueChartLabels,
      datasets: [
        {
          label: 'Doanh thu (VND)',
          data: revenueChartLabels.map((day) => revenueByDay.get(day) || 0),
        },
      ],
    },
    structure: {
      labels: ['Sắp hết hàng', 'Còn hàng'],
      datasets: [
        {
          data: [
            lowStockProducts.length,
            Math.max(0, totalProducts - lowStockProducts.length),
          ],
          backgroundColor: ['#C0564B', '#4E7F6D'],
        },
      ],
    },
  };

  const topSellers30d = (topSellers30dRows || []).map((row) => ({
    productId: row.productId ? String(row.productId) : null,
    name: row.name || 'Sản phẩm',
    slug: row.slug || '',
    units: row.units || 0,
    revenue: row.revenue || 0,
    orders: row.orders || 0,
  }));

  return {
    stats: {
      totalProducts,
      totalOrders,
      totalRevenue,
      activeUsers: totalUsers,
    },
    recentOrders: recentOrdersFormatted,
    lowStockProducts,
    chart: chartData,
    topSellers30d,
  };
};

module.exports = {
  getStats,
};
