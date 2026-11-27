/**
 * PR-5 / T6-1-3 — backfill expiresAt cho đơn pending/unpaid đời cũ.
 *
 *   node scripts/migrate-order-expires-at.js            # DRY-RUN mặc định
 *   node scripts/migrate-order-expires-at.js --apply    # ghi DB thật
 *
 * Không tự chạy lúc khởi động server. Mặc định chỉ đọc và in thống kê.
 */
const Order = require('../src/model/Order');

const legacyFilter = () => ({
  status: 'pending',
  paymentStatus: 'unpaid',
  $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }],
});

const parseArgs = (argv = []) => {
  let apply = false;

  for (const arg of argv) {
    if (arg === '--apply') {
      apply = true;
      continue;
    }
    throw new Error(`Tham số không hợp lệ: ${arg}`);
  }

  return { apply };
};

const migrateOrderExpiresAt = async ({
  apply = false,
  OrderModel = Order,
  log = console.log,
} = {}) => {
  const docs = await OrderModel.find(legacyFilter()).lean();
  const found = Array.isArray(docs) ? docs.length : 0;
  const ttlMs = OrderModel.PENDING_TTL_MINUTES * 60 * 1000;

  let planned = 0;
  let updated = 0;
  let skipped = 0;

  for (const doc of docs || []) {
    const createdAt = doc.createdAt ? new Date(doc.createdAt) : null;
    if (!createdAt || Number.isNaN(createdAt.getTime())) {
      skipped += 1;
      continue;
    }

    const expiresAt = new Date(createdAt.getTime() + ttlMs);
    planned += 1;

    if (!apply) continue;

    const result = await OrderModel.updateOne(
      { _id: doc._id, ...legacyFilter() },
      { $set: { expiresAt } }
    );

    if (result && (result.modifiedCount || result.matchedCount)) {
      updated += 1;
    } else {
      skipped += 1;
    }
  }

  log(
    `[migrate-order-expires-at] che do=${apply ? 'APPLY' : 'DRY-RUN'} timThay=${found} duKienCapNhat=${planned} daCapNhat=${updated} boQua=${skipped}`
  );

  return { found, planned, updated, skipped };
};

const main = async () => {
  const { apply } = parseArgs();
  const { connectDB, disconnectDB } = require('../src/config/db');
  await connectDB();
  try {
    await migrateOrderExpiresAt({ apply });
  } finally {
    await disconnectDB();
  }
};

if (require.main === module) {
  main().catch(() => {
    console.error('[migrate-order-expires-at] that bai; kiem tra cau hinh DB');
    process.exitCode = 1;
  });
}

module.exports = { parseArgs, migrateOrderExpiresAt, main };
