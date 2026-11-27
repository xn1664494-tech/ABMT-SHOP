/**
 * Contract su kien audit. buildAuditEvent giu nguyen 7 field; publisher duoc
 * bao boi fail-open co log de loi ghi audit khong lam business mutation fail.
 */
const AUDIT_ACTIONS = Object.freeze({
  ADMIN_ROLE_CHANGED: 'admin.user.role.changed',
  ADMIN_ORDER_STATUS_CHANGED: 'admin.order.status.changed',
  SYSTEM_ORDER_EXPIRED: 'system.order.expired',
});

const TARGET_TYPES = Object.freeze({
  USER: 'User',
  ORDER: 'Order',
});

/**
 * @param {{
 *   actorId: string,
 *   actorRole: string,
 *   action: string,
 *   targetType: string,
 *   targetId: string,
 *   before: object,
 *   after: object,
 * }} input
 */
const buildAuditEvent = ({
  actorId,
  actorRole,
  action,
  targetType,
  targetId,
  before,
  after,
}) => ({
  actorId: String(actorId),
  actorRole,
  action,
  targetType,
  targetId: String(targetId),
  before,
  after,
});

// No-op mac dinh. App wiring (khong chay trong env test) thay the bang
// AuditLog publisher; khong doi hanh vi buildAuditEvent cua T5-1-3.
const noopPublisher = async () => {};
let publisher = noopPublisher;

const setAuditPublisher = (fn) => {
  publisher = typeof fn === 'function' ? fn : noopPublisher;
};

// Fail-open co log: audit khong duoc lam business operation fail sau khi DB da ghi.
// Chi log metadata + message; khong log before/after vi co the chua du lieu nhay cam.
const logAuditFailure = (event, error) => {
  const message =
    error && typeof error.message === 'string'
      ? error.message.slice(0, 200)
      : String(error);
  console.error(
    JSON.stringify({
      level: 'error',
      scope: 'audit',
      action: event && event.action,
      targetType: event && event.targetType,
      targetId: event && event.targetId,
      actorId: event && event.actorId,
      actorRole: event && event.actorRole,
      message,
    })
  );
};

const publishAuditEvent = async (event) => {
  try {
    return await publisher(event);
  } catch (error) {
    logAuditFailure(event, error);
    return undefined;
  }
};

module.exports = {
  AUDIT_ACTIONS,
  TARGET_TYPES,
  buildAuditEvent,
  publishAuditEvent,
  setAuditPublisher,
};
