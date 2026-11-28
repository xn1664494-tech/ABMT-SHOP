const mongoose = require('mongoose');
const Order = require('../model/Order');
const Product = require('../model/Products');
const User = require('../model/User');
const { ORDER_RECENT_FIELDS } = require('../utils/orderFields');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Lấy thống kê cho trang quản trị admin dashboard.
 */
const getStats = async () => {
  const [
    totalOrders,
    totalRevenueResult,
    totalProducts,
    totalUsers,
    recentOrders,
    lowStockResult,
    revenueChart,
  ] = await Promise.all([
    Order.countDocuments({}),
    Order.aggregate([
      { $match: { status: 'delivered' } },
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
          status: 'delivered',
          createdAt: {
            $gte: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          revenue: { $sum: '$total' },
        },
      },
      { $sort: { _id: 1 } },
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

  const chartData = {
    revenue: {
      labels: (revenueChart || []).map((d) => d._id),
      datasets: [
        {
          label: 'Doanh thu (VND)',
          data: (revenueChart || []).map((d) => d.revenue),
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
  };
};

module.exports = {
  getStats,
};
