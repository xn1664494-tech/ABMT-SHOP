const asyncHandler = require('../utils/asyncHandler');
const sendResponse = require('../utils/sendResponse');
const { listAuditLogs } = require('../services/auditLogService');

const AuditLogController = {
  /** GET /api/admin/audit-logs */
  list: asyncHandler(async (req, res) => {
    const data = await listAuditLogs(req.validatedQuery || req.query);
    return sendResponse(
      res,
      200,
      true,
      'Lay nhat ky kiem toan thanh cong',
      data,
    );
  }),
};

module.exports = AuditLogController;
