const ErrorResponse = require('../utils/appError');

/**
 * Middleware validate dữ liệu bằng Zod.
 *
 * Cách dùng:
 *   router.post('/register', validate(registerSchema), controller)
 *
 * - Chỉ lấy các trường đã khai báo trong schema (strip unknown keys) để tránh
 *   client chèn field ngoài phạm vi (ví dụ role: 'admin').
 * - Trả 400 kèm danh sách lỗi theo field, thống nhất format với errorHandler.
 */
const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);

  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || source,
      message: issue.message,
    }));

    const error = new ErrorResponse('Du lieu dau vao khong hop le', 400);
    error.details = details;
    return next(error);
  }

  req[source] = result.data;
  return next();
};

module.exports = validate;
