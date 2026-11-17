const express = require('express');
const { authenticate, authorize } = require('../middleware/authenticate');

const router = express.Router();

/**
 * GET /api/admin/access-check
 *
 * Endpoint kiểm tra quyền tối thiểu dành cho Admin.
 * Mục đích: chứng minh `authorize(...roles)` được gắn vào route thật của
 * ứng dụng (không chỉ trong mini-app của test), đồng thời là nơi để các
 * route Admin CRUD (T5-1-3, ngoài scope Phase 2) kế thừa cùng guard.
 *
 * Quyền được quyết định bởi `req.user.role` đọc từ DB trong `authenticate`,
 * KHÔNG dựa vào role do client gửi lên hay role tự khai trong JWT.
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

module.exports = router;
