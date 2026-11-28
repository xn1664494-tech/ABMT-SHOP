/**
 * Dựng lại ProductSalesDaily từ các đơn đã completed.
 *
 *   node scripts/backfill-sales.js
 *   npm run backfill:sales
 *
 * Xóa toàn bộ ProductSalesDaily rồi ghi lại theo completedAt (múi giờ
 * Asia/Ho_Chi_Minh), nên chạy lại nhiều lần vẫn cho cùng kết quả.
 */
require('dotenv').config();

const Order = require('../src/model/Order');
const ProductSalesDaily = require('../src/model/ProductSalesDaily');
const { recordCompletedOrder } = require('../src/services/salesStatsService');

const ORDER_SELECT =
  '_id items completedAt statusHistory updatedAt createdAt';

async function backfillSales({ log = console.log } = {}) {
  const removed = await ProductSalesDaily.deleteMany({});
  log(
    `[backfill-sales] da xoa ${removed.deletedCount || 0} ban ghi ProductSalesDaily`,
  );

  const cursor = Order.find({ status: 'completed' })
    .select(ORDER_SELECT)
    .lean()
    .cursor();

  let orders = 0;
  let skipped = 0;

  for await (const order of cursor) {
    if (!order || !Array.isArray(order.items) || order.items.length === 0) {
      skipped += 1;
      continue;
    }

    await recordCompletedOrder(order);
    orders += 1;
  }

  const summary = {
    removed: removed.deletedCount || 0,
    orders,
    skipped,
  };

  log(
    `[backfill-sales] da xu ly ${orders} don completed (bo qua ${skipped} don khong co item)`,
  );

  return summary;
}

async function main() {
  const { connectDB, disconnectDB } = require('../src/config/db');
  await connectDB();
  try {
    await backfillSales();
  } finally {
    await disconnectDB();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[backfill-sales] that bai: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { backfillSales, main };
