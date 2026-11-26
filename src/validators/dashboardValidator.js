const { z } = require('zod');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const POSITIVE_INT_PATTERN = /^\d+$/;

const dashboardQuerySchema = z
  .object({
    from: z
      .string({ error: 'from phai la chuoi' })
      .regex(DATE_PATTERN, 'from phai co dinh dang YYYY-MM-DD')
      .optional(),
    to: z
      .string({ error: 'to phai la chuoi' })
      .regex(DATE_PATTERN, 'to phai co dinh dang YYYY-MM-DD')
      .optional(),
    granularity: z
      .enum(['day', 'week', 'month'], { error: 'granularity khong hop le' })
      .optional(),
    limit: z
      .string({ error: 'limit phai la chuoi' })
      .regex(POSITIVE_INT_PATTERN, 'limit phai la so nguyen khong am')
      .optional(),
    threshold: z
      .string({ error: 'threshold phai la chuoi' })
      .regex(POSITIVE_INT_PATTERN, 'threshold phai la so nguyen khong am')
      .optional(),
  })
  .strict('Chi duoc truyen from, to, granularity, limit, threshold');

module.exports = { dashboardQuerySchema };
