const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const Order = require('../model/Order');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/appError');
const { transition } = require('../services/orderStatusService');

const router = express.Router();

const ALREADY_DELIVERED = new Set(['delivered', 'completed']);

// Rate limit rieng cho webhook van chuyen.
const shippingWebhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.SHIPPING_WEBHOOK_RATE_LIMIT_MAX) || 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({
      success: false,
      error: 'Qua nhieu webhook, vui long thu lai sau',
    }),
});

const safeEqual = (left, right) => {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  if (left.length === 0 || right.length === 0) return false;

  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const carrierKeyFromRequest = (req) => {
  const header = req.headers['x-carrier-key'];
  return Array.isArray(header) ? header[0] : header;
};

/**
 * POST /api/shipping/webhook
 * Bo CSRF cho route webhook nay; bat buoc secret x-carrier-key + rate limit.
 * Body: { orderCode, event: 'delivered', trackingCode }
 */
router.post(
  '/webhook',
  shippingWebhookLimiter,
  asyncHandler(async (req, res, next) => {
    const secret = process.env.CARRIER_WEBHOOK_SECRET;
    const providedKey = carrierKeyFromRequest(req);

    if (!secret || !safeEqual(String(providedKey || ''), String(secret))) {
      return next(new ErrorResponse('Khoa webhook khong hop le', 401));
    }

    const body = req.body || {};
    const orderCode = body.orderCode != null ? String(body.orderCode).trim() : '';
    const event = body.event != null ? String(body.event).trim() : '';
    const trackingCode = body.trackingCode != null ? String(body.trackingCode).trim() : '';

    if (!orderCode || !trackingCode || event !== 'delivered') {
      return next(new ErrorResponse('Payload webhook khong hop le', 400));
    }

    const order = await Order.findOne({ code: orderCode.toUpperCase() });
    if (!order) {
      return next(new ErrorResponse('Don hang khong ton tai', 404));
    }

    // Idempotent: da giao truoc do thi tra 200.
    if (ALREADY_DELIVERED.has(order.status)) {
      return res.status(200).json({ success: true, data: { code: order.code, status: order.status } });
    }

    const currentTracking = order.shipment && order.shipment.trackingCode
      ? String(order.shipment.trackingCode).trim()
      : '';

    if (!currentTracking || currentTracking !== trackingCode) {
      return next(new ErrorResponse('trackingCode khong khop', 400));
    }

    if (order.status !== 'shipping') {
      return next(new ErrorResponse('Don hang khong o trang thai shipping', 409));
    }

    try {
      const delivered = await transition(order._id, 'delivered', {
        actor: 'carrier',
        userId: null,
        note: 'Đơn vị vận chuyển xác nhận giao thành công',
        extra: { trackingCode },
      });

      return res.status(200).json({
        success: true,
        data: { code: delivered.code, status: delivered.status },
      });
    } catch (error) {
      // Race/duplicate: neu da delivered/completed thi idempotent 200.
      const latest = await Order.findById(order._id).select('status code').lean().catch(() => null);
      if (latest && ALREADY_DELIVERED.has(latest.status)) {
        return res.status(200).json({ success: true, data: { code: latest.code, status: latest.status } });
      }
      return next(error);
    }
  }),
);

module.exports = router;
