/**
 * Contract su kien audit cho T6-1-2.
 * T5-1-3 CHI chuan hoa payload va de mot diem cam (no-op). Khong ghi DB,
 * khong co AuditLog model/service/route o task nay.
 */
const AUDIT_ACTIONS = Object.freeze({
  ADMIN_ROLE_CHANGED: 'admin.user.role.changed',
});

const TARGET_TYPES = Object.freeze({
  USER: 'User',
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

// No-op mac dinh. T6-1-2 se thay the bang emitter ghi AuditLog (append-only,
// snapshot da sanitize). Khong doi hanh vi T5-1-3.
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
