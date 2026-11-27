const mongoose = require('mongoose');

/**
 * Nhat ky kiem toan append-only (T6-1-2).
 * - Khong soft-delete, khong truong isDeleted/deletedAt.
 * - Khong co API update/delete; cac truong deu immutable sau khi tao.
 * - before/after la snapshot da sanitize, khong chua secret/token/cookie.
 */
const auditLogSchema = new mongoose.Schema(
  {
    actorId: { type: String, required: true, trim: true, immutable: true },
    actorRole: { type: String, required: true, trim: true, immutable: true },
    action: { type: String, required: true, trim: true, immutable: true },
    targetType: { type: String, required: true, trim: true, immutable: true },
    targetId: { type: String, required: true, trim: true, immutable: true },
    before: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      immutable: true,
    },
    after: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      immutable: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
      immutable: true,
    },
  },
  {
    // Chi co timestamp tuong minh; khong them createdAt/updatedAt de tranh
    // hai moc thoi gian khac nhau trong cung mot ban ghi audit.
    timestamps: false,
    toJSON: {
      transform(doc, ret) {
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Truy van theo hanh dong/nguoi thuc hien/doi tuong, va duyet theo thoi gian.
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ actorId: 1, timestamp: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 });

module.exports =
  mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
