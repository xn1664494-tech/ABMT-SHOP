const ErrorResponse = require('../utils/appError');

const GENERIC_SERVER_ERROR = 'Lỗi máy chủ nội bộ';

/**
 * Middleware xử lý lỗi tập trung.
 * Phải được đăng ký SAU tất cả routes: app.use(errorHandler)
 * (không gọi errorHandler()).
 *
 * - Request API (/api/*): luôn trả JSON thống nhất.
 * - Request HTML (non-/api, Accept: text/html): render trang lỗi EJS.
 * - 500 ở production: trả thông báo chung, không lộ message/stack nội bộ.
 * - Không ghi log password, token, cookie, MONGODB_URI hoặc secret.
 */
const errorHandler = (err, req, res, next) => {
  // Nếu response đã bắt đầu gửi thì phải nhường cho Express xử lý.
  if (res.headersSent) {
    return next(err);
  }

  let error = err;

  // Mongoose: sai định dạng ObjectId
  if (err.name === 'CastError') {
    const message = `Resource not found with id of ${err.value}`;
    error = new ErrorResponse(message, 404);
  }

  // Mongoose: trùng khóa unique (ví dụ slug, email)
  if (err.code === 11000) {
    const fields = Object.keys(err.keyValue || {}).join(', ');
    const message = fields
      ? `Duplicate fields value entered: ${fields}`
      : 'Duplicate fields value entered';
    error = new ErrorResponse(message, 409);
  }

  // Mongoose: lỗi validation
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ');
    error = new ErrorResponse(message, 400);
  }

  // JWT: token không hợp lệ / hết hạn
  if (err.name === 'JsonWebTokenError') {
    error = new ErrorResponse('Invalid token. Please log in again', 401);
  }

  if (err.name === 'TokenExpiredError') {
    error = new ErrorResponse('Your token has expired. Please log in again', 401);
  }

  // Body JSON không hợp lệ do express.json() parse
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    error = new ErrorResponse('Invalid JSON payload', 400);
  }

  const statusCode = error.statusCode || 500;
  const message = error.message || 'Server error';

  const isServerError = statusCode >= 500;
  const clientMessage =
    process.env.NODE_ENV === 'production' && isServerError
      ? GENERIC_SERVER_ERROR
      : message;

  // Ghi log server: development có chi tiết debug; production chỉ ghi tối thiểu,
  // không log message/stack có thể chứa thông tin nhạy cảm.
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[ERROR ${statusCode}] ${req.method} ${req.originalUrl} - ${message}`);
    if (isServerError) {
      console.error(err.stack);
    }
  } else {
    console.error(`[ERROR ${statusCode}] ${req.method} ${req.originalUrl}`);
  }

  const isApi = req.originalUrl.startsWith('/api');
  const wantsHtml = !isApi && Boolean(req.accepts('html'));

  if (wantsHtml) {
    return res.status(statusCode).render('error', {
      title: `Lỗi ${statusCode}`,
      statusCode,
      message: clientMessage,
    });
  }

  const body = {
    success: false,
    error: clientMessage,
  };

  // Chỉ đính kèm details cho lỗi không phải 5xx để tránh rò rỉ thông tin nội bộ.
  if (!isServerError && error.details) {
    body.details = error.details;
  }

  return res.status(statusCode).json(body);
};

module.exports = errorHandler;
