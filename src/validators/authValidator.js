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

module.exports = { registerSchema, loginSchema, updateProfileSchema, passwordSchema };
