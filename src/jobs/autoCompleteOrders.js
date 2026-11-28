const Order = require('../model/Order');
const { transition } = require('../services/orderStatusService');

const DEFAULT_AUTO_COMPLETE_DAYS = 7;
const TEN_MINUTES_MS = 10 * 60 * 1000;

const parseDays = (value) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return DEFAULT_AUTO_COMPLETE_DAYS;
  }
  const days = Number(value);
  return Number.isFinite(days) && days >= 0 ? days : DEFAULT_AUTO_COMPLETE_DAYS;
};

const getAutoCompleteDays = () => parseDays(process.env.AUTO_COMPLETE_DAYS);

const findCompletableOrders = ({ now = new Date(), days = getAutoCompleteDays(), batchSize = 100 } = {}) => {
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return Order.find({
    status: 'delivered',
    'shipment.deliveredAt': { $lte: cutoff },
  }).limit(batchSize);
};

/**
 * Tu dong hoan tat don delivered sau N ngay.
 */
async function autoCompleteOrders({ now = new Date(), days = getAutoCompleteDays(), batchSize = 100 } = {}) {
  const summary = { found: 0, completed: 0, skipped: 0, failed: 0 };
  const orders = await findCompletableOrders({ now, days, batchSize });
  summary.found = Array.isArray(orders) ? orders.length : 0;

  for (const order of orders || []) {
    try {
      await transition(order._id, 'completed', {
        actor: 'system',
        userId: null,
        note: `Tự động hoàn tất sau ${days} ngày`,
      });
      summary.completed += 1;
    } catch (error) {
      const code = error && error.code ? String(error.code) : 'UNKNOWN';
      if (code === 'ORDER_STATUS_CONFLICT' || code === 'ORDER_INVALID_TRANSITION' || code === 'ORDER_NOT_FOUND') {
        summary.skipped += 1;
        continue;
      }
      summary.failed += 1;
      console.error(`[auto-complete] don=${String(order._id)} code=${code} ${error.message || ''}`);
    }
  }

  return summary;
}

/**
 * Khoi chay job khi server start; chay moi 10 phut.
 */
function startAutoCompleteOrders({ intervalMs = TEN_MINUTES_MS } = {}) {
  const run = () => {
    autoCompleteOrders().catch((error) => {
      console.error(`[auto-complete] job that bai: ${error.message}`);
    });
  };

  const timer = setInterval(run, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();
  return timer;
}

module.exports = {
  autoCompleteOrders,
  startAutoCompleteOrders,
  findCompletableOrders,
  getAutoCompleteDays,
  DEFAULT_AUTO_COMPLETE_DAYS,
};
