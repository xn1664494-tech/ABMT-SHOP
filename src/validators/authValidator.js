const { z } = require('zod');

const passwordSchema = z
  .string({ error: 'Mat khau khong duoc de trong' })
  .min(8, 'Mat khau phai co it nhat 8 ky tu')
  .max(72, 'Mat khau toi da 72 ky tu')
  .regex(/[A-Za-z]/, 'Mat khau phai co it nhat 1 chu cai')
  .regex(/[0-9]/, 'Mat khau phai co it nhat 1 chu so');

const registerSchema = z.object({
  name: z
    .string({ error: 'Ten khong duoc de trong' })
    .trim()
    .min(2, 'Ten phai co it nhat 2 ky tu')
    .max(100, 'Ten toi da 100 ky tu'),
  email: z
    .string({ error: 'Email khong duoc de trong' })
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: 'Email khong hop le' }))
    .pipe(z.string().max(254, 'Email toi da 254 ky tu')),
  password: passwordSchema,
  // Người dùng chỉ được tự đăng ký với vai trò customer.
  role: z.literal('customer', {
    error: 'Khong duoc phep tu dang ky voi vai tro khac customer',
  }).optional(),
});

const loginSchema = z.object({
  email: z
    .string({ error: 'Email khong duoc de trong' })
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: 'Email khong hop le' })),
  password: z
    .string({ error: 'Mat khau khong duoc de trong' })
    .min(1, 'Mat khau khong duoc de trong'),
});

const forgotPasswordSchema = z
  .object({
    email: z
      .string({ error: 'Email khong duoc de trong' })
      .trim()
      .toLowerCase()
      .pipe(z.email({ error: 'Email khong hop le' }))
      .pipe(z.string().max(254, 'Email toi da 254 ky tu')),
  })
  .strict('Chi duoc gui email');

const resetPasswordSchema = z
  .object({
    token: z
      .string({ error: 'Token dat lai mat khau khong duoc de trong' })
      .regex(/^[a-f0-9]{64}$/, 'Token dat lai mat khau khong hop le'),
    newPassword: passwordSchema,
  })
  .strict('Chi duoc gui token va mat khau moi');

const updateProfileSchema = z
  .object({
    name: z
      .string({ error: 'Ten khong hop le' })
      .trim()
      .min(2, 'Ten phai co it nhat 2 ky tu')
      .max(100, 'Ten toi da 100 ky tu')
      .optional(),
    email: z
      .string({ error: 'Email khong hop le' })
      .trim()
      .toLowerCase()
      .pipe(z.email({ error: 'Email khong hop le' }))
      .pipe(z.string().max(254, 'Email toi da 254 ky tu'))
      .optional(),
  })
  .strict('Chi duoc cap nhat name va email')
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Can cung cap it nhat mot truong de cap nhat',
  });

/**
 * Doi mat khau: bat buoc xac minh mat khau hien tai.
 * - Khong nhan `passwordHash`/`role`/`status`.
 * - Mat khau moi phai khac mat khau hien tai.
 */
const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ error: 'Mat khau hien tai khong duoc de trong' })
      .min(1, 'Mat khau hien tai khong duoc de trong'),
    newPassword: passwordSchema,
  })
  .strict('Chi duoc cap nhat mat khau')
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'Mat khau moi phai khac mat khau hien tai',
    path: ['newPassword'],
  });

const phoneUpdateSchema = z.object({
  phone: z
    .string({ error: 'So dien thoai khong duoc de trong' })
    .trim()
    .regex(/^(?:\+?84|0)(3|5|7|8|9)[0-9]{8}$/, "So dien thoai khong hop le"),
}).strict('Chi duoc gui so dien thoai');

const phoneVerifyCodeSchema = z.object({
  code: z
    .string({ error: 'Ma xac minh khong duoc de trong' })
    .regex(/^[0-9]{6}$/, "Ma xac minh phai gom 6 so"),
}).strict('Chi duoc gui ma xac minh');

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  changePasswordSchema,
  passwordSchema,
  phoneUpdateSchema,
  phoneVerifyCodeSchema,
};
