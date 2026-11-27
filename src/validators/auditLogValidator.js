const { z } = require('zod');

/**
 * Query GET /api/admin/audit-logs.
 * page/limit de dang chuoi de buildPagination kiem tra va ep limit.
 * Cac filter la so sanh chinh xac, khong nhan regex tu client.
 */
const auditLogsQuerySchema = z
  .object({
    page: z.string().optional(),
    limit: z.string().optional(),
    actorId: z.string().trim().max(100).optional(),
    action: z.string().trim().max(100).optional(),
    targetType: z.string().trim().max(100).optional(),
    targetId: z.string().trim().max(100).optional(),
  })
  .strict('Tham so truy van khong hop le');

module.exports = { auditLogsQuerySchema };
