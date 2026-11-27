const Order = require('../model/Order');
const { cancelOrder } = require('../services/OrderCancellationService');
const {
  AUDIT_ACTIONS,
  TARGET_TYPES,
  buildAuditEvent,
  publishAuditEvent,
} = require('../services/auditEvent');

const SYSTEM_ACTOR_ID = 'system';

// Conflict là kết quả bình thường khi 2 worker/chạy lại job cùng gặp một đơn:
// đơn đã đổi status/payment hoặc đã có marker hoàn kho -> bỏ qua, không retry mù quáng.
const SKIPPABLE_CODES = new Set([
  'ORDER_NOT_FOUND',
  'ORDER_INVALID_TRANSITION',
  'ORDER_PAYMENT_CONFLICT',
  'ORDER_STATUS_CONFLICT',
]);

const overdueFilter = (now) => ({
  status: 'pending',
  paymentStatus: 'unpaid',
  expiresAt: { $lte: now },
  $or: [{ stockRestoredAt: null }, { stockRestoredAt: { $exists: false } }],
});

const findOverdueOrders = ({ now = new Date(), batchSize = 100 } = {}) =>
  Order.find(overdueFilter(now)).limit(batchSize);

const safeLog = (orderId, error) => {
  const code = error && error.code ? String(error.code) : 'UNKNOWN';
  const message = typeof error.message === 'string' ? error.message.slice(0, 200) : '';
  return `[overdue] don=${String(orderId)} code=${code}${message ? ` reason=${message}` : ''}`;
};

async function cancelOverdueOrders({ now = new Date(), batchSize = 100 } = {}) {
  const summary = { found: 0, cancelled: 0, skipped: 0, failed: 0, errors: [] };

  const orders = await findOverdueOrders({ now, batchSize });
  summary.found = Array.isArray(orders) ? orders.length : 0;

  for (const order of orders || []) {
    try {
      const cancelled = await cancelOrder({
        orderId: order._id,
        actorRole: 'system',
        actorId: SYSTEM_ACTOR_ID,
        expectedPaymentStatus: 'unpaid',
        note: 'Huy don qua han',
      });

      // Chi ghi audit sau CAS cancel + hoan kho thanh cong. Publisher fail-open
      // nen loi AuditLog khong lam summary.failed tang.
      await publishAuditEvent(
        buildAuditEvent({
          actorId: SYSTEM_ACTOR_ID,
          actorRole: 'system',
          action: AUDIT_ACTIONS.SYSTEM_ORDER_EXPIRED,
          targetType: TARGET_TYPES.ORDER,
          targetId: order._id,
          before: { status: 'pending', paymentStatus: 'unpaid' },
          after: { status: 'cancelled', stockRestoredAt: cancelled.stockRestoredAt },
        })
      );
      summary.cancelled += 1;
    } catch (error) {
      const code = error && error.code ? String(error.code) : 'UNKNOWN';

      if (SKIPPABLE_CODES.has(code)) {
        summary.skipped += 1;
        console.warn(safeLog(order._id, error));
        continue;
      }

      summary.failed += 1;
      summary.errors.push({
        orderId: String(order._id),
        code,
        message: typeof error.message === 'string' ? error.message.slice(0, 200) : '',
      });
      console.error(safeLog(order._id, error));
    }
  }

  return summary;
}

module.exports = { cancelOverdueOrders, findOverdueOrders, overdueFilter };
