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
 * - Chi nhan status va note; cac field khac bi tu choi (strict).
 * - Quyen chuyen doi va flow van do orderStateMachine quyet dinh.
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
  })
  .strict('Chi duoc cap nhat status va note');

module.exports = {
  ADMIN_ORDER_TARGET_STATUSES,
  updateOrderStatusSchema,
};
