const rateLimit = require('express-rate-limit');

const windowMs = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const limit = Number(process.env.AUTH_RATE_LIMIT_MAX) || 20;

/**
 * Giới hạn request cho các endpoint xác thực nhạy cảm.
 * Trả 429 với format thống nhất khi vượt ngưỡng.
 */
const authLimiter = rateLimit({
  windowMs,
  limit,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({
      success: false,
      error: 'Qua nhieu yeu cau, vui long thu lai sau',
    }),
});

module.exports = { authLimiter };
