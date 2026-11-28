const ProductSalesDaily = require('../model/ProductSalesDaily');
const { toSalesDay } = require('../utils/salesDate');

/**
 * Lấy thời điểm hoàn tất của đơn; ưu tiên completedAt, fallback lịch sử trạng thái
 * để các đơn completed cũ (thiếu completedAt) vẫn backfill được.
 */
function resolveCompletedAt(order) {
  if (order && order.completedAt) {
    const completedAt = new Date(order.completedAt);
    if (!Number.isNaN(completedAt.getTime())) return completedAt;
  }

  const history = Array.isArray(order && order.statusHistory)
    ? order.statusHistory
    : [];
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (entry && entry.status === 'completed' && entry.at) {
      const at = new Date(entry.at);
      if (!Number.isNaN(at.getTime())) return at;
    }
  }

  const fallback = order && (order.updatedAt || order.createdAt);
  if (fallback) {
    const at = new Date(fallback);
    if (!Number.isNaN(at.getTime())) return at;
  }

  return null;
}

/**
 * Ghi nhận doanh số của một đơn đã completed vào ProductSalesDaily.
 *
 * Chỉ được gọi từ transition sang completed nên mỗi đơn chỉ ghi một lần.
 * Các item cùng sản phẩm được gộp trước khi $inc để tránh ghi đè lẫn nhau.
 */
async function recordCompletedOrder(order) {
  if (!order || !Array.isArray(order.items) || order.items.length === 0) {
    return;
  }

  const completedAt = resolveCompletedAt(order);
  const day = toSalesDay(completedAt || new Date());
  if (!day) return;

  const byProduct = new Map();

  for (const item of order.items) {
    if (!item || !item.product) continue;

    const key = String(item.product);
    const qty = Number(item.qty) || 0;
    const lineTotal = Number(item.lineTotal);
    const revenue = Number.isFinite(lineTotal)
      ? lineTotal
      : (Number(item.unitPrice) || 0) * qty;

    const current = byProduct.get(key) || {
      product: item.product,
      units: 0,
      revenue: 0,
    };

    current.units += qty;
    current.revenue += revenue;
    byProduct.set(key, current);
  }

  if (byProduct.size === 0) return;

  const operations = Array.from(byProduct.values()).map((entry) => ({
    updateOne: {
      filter: { product: entry.product, day },
      update: {
        $inc: {
          units: entry.units,
          revenue: entry.revenue,
          orders: 1,
        },
      },
      upsert: true,
    },
  }));

  await ProductSalesDaily.bulkWrite(operations, { ordered: false });
}

module.exports = {
  recordCompletedOrder,
  resolveCompletedAt,
};
