const Order = require('../model/Order');
const { ORDER_STATUS_LABELS } = require('../utils/orderPresentation');

const ORDER_STATUS_KEYS = Object.keys(ORDER_STATUS_LABELS);

const countOrdersByStatus = async (userId = null) => {
  const match = userId ? { user: userId } : {};
  const rows = await Order.aggregate([
    { $match: match },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const counts = ORDER_STATUS_KEYS.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});

  for (const row of rows || []) {
    if (!row || !row._id) continue;
    if (!Object.prototype.hasOwnProperty.call(counts, row._id)) continue;
    counts[row._id] = Number(row.count) || 0;
  }

  return counts;
};

module.exports = {
  ORDER_STATUS_KEYS,
  countOrdersByStatus,
};
