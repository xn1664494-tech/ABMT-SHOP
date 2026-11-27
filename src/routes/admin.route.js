const express = require('express');
const { authenticate, authorize } = require('../middleware/authenticate');
const { csrfProtection } = require('../middleware/csrf');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { getStats } = require('../services/adminService');
const {
  getDashboard,
  getRevenueSeries,
  getTopCategories,
  getLowStockVariants,
} = require('../services/dashboardService');
const { dashboardQuerySchema } = require('../validators/dashboardValidator');
const AdminUserController = require('../controllers/adminUserController');
const {
  listUsersQuerySchema,
  updateUserRoleSchema,
} = require('../validators/adminUserValidator');
const AuditLogController = require('../controllers/auditLogController');
const { auditLogsQuerySchema } = require('../validators/auditLogValidator');

const router = express.Router();

/**
 * GET /api/admin/access-check
 */
router.get('/access-check', authenticate, authorize('admin'), (req, res) =>
  res.status(200).json({
    success: true,
    data: {
      authorized: true,
      role: req.user.role,
      user: {
        id: String(req.user._id || req.user.id),
        role: req.user.role,
      },
    },
  }),
);

/**
 * GET /api/admin/stats - Thống kê dashboard admin
 */
router.get(
  '/stats',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const stats = await getStats();
    return res.status(200).json({
      success: true,
      data: stats,
    });
  })
);

/**
 * GET /api/admin/dashboard - JSON aggregation cho bieu do dashboard.
 */
router.get(
  '/dashboard',
  authenticate,
  authorize('admin'),
  validate(dashboardQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const data = await getDashboard(req.validatedQuery);
    return res.status(200).json({ success: true, data });
  }),
);

router.get(
  '/dashboard/revenue',
  authenticate,
  authorize('admin'),
  validate(dashboardQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const data = await getRevenueSeries(req.validatedQuery);
    return res.status(200).json({ success: true, data });
  }),
);

router.get(
  '/dashboard/top-categories',
  authenticate,
  authorize('admin'),
  validate(dashboardQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const data = await getTopCategories(req.validatedQuery);
    return res.status(200).json({ success: true, data });
  }),
);

router.get(
  '/dashboard/low-stock',
  authenticate,
  authorize('admin'),
  validate(dashboardQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const data = await getLowStockVariants(req.validatedQuery);
    return res.status(200).json({ success: true, data });
  }),
);

/**
 * GET /api/admin/users - Danh sach nguoi dung (phan trang + tim kiem)
 * Chi admin. Khong tra password/token/field noi bo.
 */
router.get(
  '/users',
  authenticate,
  authorize('admin'),
  validate(listUsersQuerySchema, 'query'),
  AdminUserController.list,
);

/**
 * PATCH /api/admin/users/:userId/role - Doi vai tro nguoi dung
 * Chi admin + CSRF. Chan admin tu ha quyen chinh minh.
 */
router.patch(
  '/users/:userId/role',
  authenticate,
  authorize('admin'),
  csrfProtection,
  validate(updateUserRoleSchema),
  AdminUserController.updateRole,
);

/**
 * GET /api/admin/audit-logs - Nhat ky kiem toan (doc-only, khong can CSRF).
 * Chi admin; khong co route update/delete log.
 */
router.get(
  '/audit-logs',
  authenticate,
  authorize('admin'),
  validate(auditLogsQuerySchema, 'query'),
  AuditLogController.list,
);

module.exports = router;
