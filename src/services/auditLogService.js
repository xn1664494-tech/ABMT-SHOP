const AuditLog = require('../model/AuditLog');
const { setAuditPublisher } = require('./auditEvent');
const { buildPagination } = require('../utils/productFilter');

// key nha cam: loai bo ca gia tri truoc khi luu (khong chi screenshot cap 1).
const SENSITIVE_KEY_PATTERN =
  /password|token|secret|cookie|authorization|reset/i;

const FILTER_FIELDS = ['actorId', 'action', 'targetType', 'targetId'];

const isPlainObject = (value) => {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/**
 * Sanitize de theo key (case-insensitive), ap dung cho ca array/object long nhau.
 * Date va cac kieu khac (vd ObjectId) giu nguyen; vong lap bi cat bang null.
 */
const sanitizeAuditValue = (value, seen = new WeakSet()) => {
  if (Array.isArray(value)) {
    if (seen.has(value)) return null;
    seen.add(value);
    const result = value.map((item) => sanitizeAuditValue(item, seen));
    seen.delete(value);
    return result;
  }

  if (isPlainObject(value)) {
    if (seen.has(value)) return null;
    seen.add(value);

    const result = {};
    for (const [key, child] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) continue;
      result[key] = sanitizeAuditValue(child, seen);
    }

    seen.delete(value);
    return result;
  }

  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  return value;
};

/** Ghi mot ban ghi audit append-only; timestamp luon do he thong gan. */
const writeAuditLog = async (event = {}) => {
  const snapshot = sanitizeAuditValue(event);

  return AuditLog.create({
    ...(isPlainObject(snapshot) ? snapshot : {}),
    before: snapshot?.before || {},
    after: snapshot?.after || {},
    timestamp: new Date(),
  });
};

/** Cai dat diem cam cua auditEvent de ghi thang vao AuditLog. */
const installAuditLogPublisher = () => setAuditPublisher(writeAuditLog);

const toAuditLogItem = (log) => ({
  id: String(log._id || log.id),
  actorId: log.actorId,
  actorRole: log.actorRole,
  action: log.action,
  targetType: log.targetType,
  targetId: log.targetId,
  before: log.before || {},
  after: log.after || {},
  timestamp: log.timestamp,
});

/** Danh sach audit log: phan trang, loc chinh xac, moi nhat truoc. */
const listAuditLogs = async (query = {}) => {
  const source = query || {};
  const { page, limit, skip } = buildPagination(source);

  const filter = {};
  for (const field of FILTER_FIELDS) {
    const raw = source[field];
    if (typeof raw === 'string' && raw.trim()) {
      filter[field] = raw.trim();
    }
  }

  const [total, logs] = await Promise.all([
    AuditLog.countDocuments(filter),
    AuditLog.find(filter)
      .sort({ timestamp: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const items = (logs || []).map(toAuditLogItem);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      itemCount: items.length,
    },
  };
};

module.exports = {
  SENSITIVE_KEY_PATTERN,
  sanitizeAuditValue,
  writeAuditLog,
  installAuditLogPublisher,
  listAuditLogs,
};
