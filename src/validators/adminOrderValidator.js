const { z } = require('zod');

// Chi cac trang thai dich duoc phep tu API admin (pending khong phai dich hop le).
const ADMIN_ORDER_TARGET_STATUSES = [
  'confirmed',
  'shipping',
  'delivered',
  'cancelled',
];

/**
 * PATCH /api/admin/orders/:orderId/status
 * - Chi nhan status/note + tuy chon carrier/trackingCode/reason cho shipping/cancelled.
 * - Quyen chuyen doi va flow van do orderStatusService quyet dinh.
 */
const updateOrderStatusSchema = z
  .object({
    status: z.enum(ADMIN_ORDER_TARGET_STATUSES, {
      error: 'Trang thai khong hop le',
    }),
    note: z
      .string({ error: 'note phai la chuoi' })
      .max(500, 'Ghi chu toi da 500 ky tu')
      .optional(),
    carrier: z
      .string({ error: 'carrier phai la chuoi' })
      .max(120, 'carrier toi da 120 ky tu')
      .optional(),
    trackingCode: z
      .string({ error: 'trackingCode phai la chuoi' })
      .max(120, 'trackingCode toi da 120 ky tu')
      .optional(),
    reason: z
      .string({ error: 'reason phai la chuoi' })
      .max(500, 'Ly do toi da 500 ky tu')
      .optional(),
  })
  .strict('Chi duoc cap nhat status, note, carrier, trackingCode, reason');

const confirmOrderSchema = z
  .object({
    note: z.string().max(500, 'Ghi chú tối đa 500 ký tự').optional(),
  })
  .strict('Chỉ được gửi note');

const shipOrderSchema = z
  .object({
    carrier: z.string({ error: 'carrier là bắt buộc' }).min(1, 'carrier là bắt buộc').max(120),
    trackingCode: z
      .string({ error: 'trackingCode là bắt buộc' })
      .min(1, 'trackingCode là bắt buộc')
      .max(120),
    note: z.string().max(500, 'Ghi chú tối đa 500 ký tự').optional(),
  })
  .strict('Chỉ được gửi carrier, trackingCode, note');

const cancelOrderSchema = z
  .object({
    reason: z.string({ error: 'Lý do là bắt buộc' }).min(1, 'Lý do là bắt buộc').max(500),
  })
  .strict('Chỉ được gửi reason');

const simulateDeliverySchema = z
  .object({
    trackingCode: z.string().max(120).optional(),
  })
  .strict('Chỉ được gửi trackingCode');

module.exports = {
  ADMIN_ORDER_TARGET_STATUSES,
  updateOrderStatusSchema,
  confirmOrderSchema,
  shipOrderSchema,
  cancelOrderSchema,
  simulateDeliverySchema,
};
