const ErrorResponse = require('../utils/appError');

/**
 * Middleware xử lý lỗi tập trung.
 * Phải được đăng ký SAU tất cả routes: app.use(errorHandler)
 * (không gọi errorHandler()).
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
        error = new ErrorResponse(message, 400);
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

    // Chỉ log chi tiết ở môi trường development.
    if (process.env.NODE_ENV !== 'production') {
        console.error(`[ERROR ${statusCode}] ${req.method} ${req.originalUrl} - ${message}`);
        if (statusCode >= 500) {
            console.error(err.stack);
        }
    }

    return res.status(statusCode).json({
        success: false,
        error: message
    });
};

module.exports = errorHandler;
