/**
 * PR-5 / T6-1-3 — chạy job hủy đơn pending/quá hạn.
 *
 *   node scripts/run-overdue-orders.js --dry-run     # chỉ đếm, không ghi
 *   node scripts/run-overdue-orders.js               # chạy thật
 *   node scripts/run-overdue-orders.js --batch=500
 *
 * Cron đề xuất: 5 phút/lần — xem docs/reports/PR5_T6-1-3_OVERDUE_ORDERS.md.
 * Không dùng setInterval trong app.js, không tự chạy migration.
 */
const { cancelOverdueOrders, findOverdueOrders } = require('../src/jobs/cancelOverdueOrders');

const parseArgs = (argv = []) => {
  let dryRun = false;
  let batchSize = 100;

  for (const arg of argv) {
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (arg.startsWith('--batch=')) {
      const value = arg.slice('--batch='.length);
      batchSize = Number(value);
      if (!Number.isInteger(batchSize) || batchSize <= 0) {
        throw new Error('--batch phải là số nguyên dương');
      }
      continue;
    }

    throw new Error(`Tham số không hợp lệ: ${arg}`);
  }

  return { dryRun, batchSize };
};

const runCli = async ({
  argv = process.argv.slice(2),
  execute = cancelOverdueOrders,
  find = findOverdueOrders,
  now = new Date(),
  log = console.log,
} = {}) => {
  const { dryRun, batchSize } = parseArgs(argv);

  if (dryRun) {
    const orders = await find({ now, batchSize });
    const summary = {
      found: Array.isArray(orders) ? orders.length : 0,
      cancelled: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };
    log(
      `[overdue] che do=DRY-RUN batch=${batchSize} timThay=${summary.found} daHuy=0 boQua=0 loi=0`
    );
    return summary;
  }

  const summary = await execute({ now, batchSize });
  log(
    `[overdue] che do=APPLY batch=${batchSize} timThay=${summary.found} daHuy=${summary.cancelled} boQua=${summary.skipped} loi=${summary.failed}`
  );
  for (const item of summary.errors || []) {
    log(`[overdue] loi don=${item.orderId} code=${item.code}`);
  }
  return summary;
};

const main = async () => {
  // Chỉ nạp cấu hình DB khi chạy CLI thật; test gọi runCli với dependency inject.
  const { connectDB, disconnectDB } = require('../src/config/db');
  await connectDB();
  try {
    await runCli();
  } finally {
    await disconnectDB();
  }
};

if (require.main === module) {
  main().catch(() => {
    console.error('[overdue] khoi dong that bai; kiem tra cau hinh DB');
    process.exitCode = 1;
  });
}

module.exports = { parseArgs, runCli, main };
