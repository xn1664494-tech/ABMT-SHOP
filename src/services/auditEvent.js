/**
 * Contract su kien audit. buildAuditEvent van giu nguyen 7 field; T6-1-2 chi
 * bo sung constant va thay the publisher no-op bang AuditLog publisher.
 */
const AUDIT_ACTIONS = Object.freeze({
  ADMIN_ROLE_CHANGED: 'admin.user.role.changed',
  ADMIN_ORDER_STATUS_CHANGED: 'admin.order.status.changed',
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

const publishAuditEvent = async (event) => publisher(event);

module.exports = {
  AUDIT_ACTIONS,
  TARGET_TYPES,
  buildAuditEvent,
  publishAuditEvent,
  setAuditPublisher,
};
