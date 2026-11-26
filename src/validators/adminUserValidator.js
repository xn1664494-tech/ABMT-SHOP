const { z } = require('zod');

// Danh sách role hợp lệ phải khớp enum thực tế của User schema
// (src/model/User.js: role enum ['customer', 'admin']).
const USER_ROLES = ['customer', 'admin'];

/**
 * Query danh sách người dùng.
 * - page/limit để dạng chuỗi; buildPagination sẽ kiểm tra số nguyên dương
 *   và ép limit về MAX_PAGE_SIZE.
 * - q là từ khóa tìm theo name/email, tối đa 100 ký tự.
 */
const listUsersQuerySchema = z.object({
  page: z.string({ error: 'page phai la chuoi' }).optional(),
  limit: z.string({ error: 'limit phai la chuoi' }).optional(),
  q: z
    .string({ error: 'q phai la chuoi' })
    .trim()
    .max(100, 'Tu khoa tim kiem toi da 100 ky tu')
    .optional(),
});

/**
 * Cập nhật role: chỉ nhận đúng field `role`, không nhận password/email/status...
 */
const updateUserRoleSchema = z
  .object({
    role: z.enum(USER_ROLES, {
      error: 'Role khong hop le',
    }),
  })
  .strict('Chi duoc cap nhat role');

module.exports = {
  USER_ROLES,
  listUsersQuerySchema,
  updateUserRoleSchema,
};
