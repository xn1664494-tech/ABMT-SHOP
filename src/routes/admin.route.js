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
const AdminOrderController = require('../controllers/adminOrderController');
const {
  listUsersQuerySchema,
  updateUserRoleSchema,
} = require('../validators/adminUserValidator');
const {
  updateOrderStatusSchema,
  confirmOrderSchema,
  shipOrderSchema,
  cancelOrderSchema,
  simulateDeliverySchema,
} = require('../validators/adminOrderValidator');
const ErrorResponse = require('../utils/appError');
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

/**
 * PATCH /api/admin/orders/:orderId/status - Cap nhat trang thai don hang.
 * Chi admin + CSRF; body duoc validate truoc khi vao state machine.
 */
router.patch(
  '/orders/:orderId/status',
  authenticate,
  authorize('admin'),
  csrfProtection,
  validate(updateOrderStatusSchema),
  AdminOrderController.updateStatus,
);

const setOrderAction = (action) => (req, res, next) => {
  req.action = action;
  return next();
};

/**
 * POST /api/admin/orders/:code/confirm - Xac nhan don (pending -> confirmed).
 */
router.post(
  '/orders/:code/confirm',
  authenticate,
  authorize('admin'),
  csrfProtection,
  validate(confirmOrderSchema),
  setOrderAction({
    to: 'confirmed',
    actor: 'admin',
    message: 'Xác nhận đơn hàng thành công',
  }),
  AdminOrderController.transitionAction,
);

/**
 * POST /api/admin/orders/:code/ship - Ban giao van chuyen (confirmed -> shipping).
 */
router.post(
  '/orders/:code/ship',
  authenticate,
  authorize('admin'),
  csrfProtection,
  validate(shipOrderSchema),
  setOrderAction({
    to: 'shipping',
    actor: 'admin',
    message: 'Bàn giao vận chuyển thành công',
  }),
  AdminOrderController.transitionAction,
);

/**
 * POST /api/admin/orders/:code/cancel - Huy don (pending/confirmed -> cancelled).
 */
router.post(
  '/orders/:code/cancel',
  authenticate,
  authorize('admin'),
  csrfProtection,
  validate(cancelOrderSchema),
  setOrderAction({
    to: 'cancelled',
    actor: 'admin',
    message: 'Hủy đơn hàng thành công',
  }),
  AdminOrderController.transitionAction,
);

/**
 * POST /api/admin/orders/:code/mark-paid - Xac nhan da nhan tien (bank_transfer).
 */
router.post(
  '/orders/:code/mark-paid',
  authenticate,
  authorize('admin'),
  csrfProtection,
  validate(confirmOrderSchema),
  AdminOrderController.markPaid,
);

/**
 * POST /api/admin/orders/:code/simulate-delivery
 * Gia lap carrier webhook chi khi khong phai production hoac co flag cho phep.
 */
router.post(
  '/orders/:code/simulate-delivery',
  authenticate,
  authorize('admin'),
  csrfProtection,
  validate(simulateDeliverySchema),
  (req, res, next) => {
    const allowed =
      process.env.NODE_ENV !== 'production' ||
      process.env.ALLOW_CARRIER_SIMULATION === 'true';
    if (!allowed) {
      return next(
        new ErrorResponse('Giả lập giao hàng không được phép trong môi trường prod', 403),
      );
    }
    return next();
  },
  AdminOrderController.simulateDelivery,
);

module.exports = router;
