const ErrorResponse = require('../utils/appError');

/**
 * Bắt mọi route không khớp và chuyển thành lỗi 404
 * để errorHandler trả về JSON thống nhất.
 * Phải đăng ký SAU tất cả routes và TRƯỚC errorHandler.
 */
const notFound = (req, res, next) => {
    next(new ErrorResponse(`Route not found: ${req.originalUrl}`, 404));
};

module.exports = notFound;
