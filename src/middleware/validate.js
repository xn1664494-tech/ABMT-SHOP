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

  // Express 5: req.query là getter chỉ đọc nên không thể gán đè trực tiếp.
  // Với query, đưa dữ liệu đã validate (strip unknown keys, trim, lowercase)
  // sang req.validatedQuery để controller dùng thay vì req.query thô.
  if (source === 'query') {
    req.validatedQuery = result.data;
  } else {
    req[source] = result.data;
  }
  return next();
};

module.exports = validate;
