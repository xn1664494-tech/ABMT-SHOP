'use strict';

/**
 * API địa chỉ 2 cấp: danh sách tỉnh/thành và gợi ý phường/xã.
 * Chỉ GET nên không cần CSRF.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const addressService = require('../services/addressService');

const router = express.Router();

// Giới hạn nhẹ cho API tra cứu công khai.
const addressLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({
      success: false,
      error: 'Qua nhieu yeu cau, vui long thu lai sau',
    }),
});

router.use(addressLimiter);

/** GET /api/address/provinces */
router.get('/provinces', (req, res) => {
  return res.status(200).json({
    success: true,
    data: { provinces: addressService.getProvinces() },
  });
});

/** GET /api/address/suggest?q=&provinceCode=&limit= */
router.get('/suggest', (req, res) => {
  let q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length > 80) q = q.slice(0, 80);

  const provinceCode =
    typeof req.query.provinceCode === 'string' ? req.query.provinceCode.trim() : '';

  const suggestions =
    q.length >= 2
      ? addressService.suggest(q, { provinceCode, limit: req.query.limit })
      : [];

  res.set('Cache-Control', 'public, max-age=300');
  return res.status(200).json({
    success: true,
    data: { suggestions },
  });
});

module.exports = router;
