const express = require('express');
const { authenticate, authorize } = require('../middleware/authenticate');
const { csrfProtection } = require('../middleware/csrf');
const asyncHandler = require('../utils/asyncHandler');
const { getStats } = require('../services/adminService');

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

module.exports = router;
