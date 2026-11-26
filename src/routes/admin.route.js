const express = require('express');
const { authenticate, authorize } = require('../middleware/authenticate');
const { csrfProtection } = require('../middleware/csrf');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { getStats } = require('../services/adminService');
const AdminUserController = require('../controllers/adminUserController');
const {
  listUsersQuerySchema,
  updateUserRoleSchema,
} = require('../validators/adminUserValidator');

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

module.exports = router;
