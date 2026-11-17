const AppError = require('../utils/appError');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  if (err.name === 'CastError') {
    const message = 'Id không hợp lệ';
    error = new AppError(message, 400);
  }

  if (err.code === 11000) {
    const message = 'Giá trị đã tồn tại (trùng lặp)';
    error = new AppError(message, 409);
  }

  const statusCode = error.statusCode || 500;
  const message = error.message || 'Lỗi hệ thống';

  const response = {
    success: false,
    message,
  };

  if (error.details) {
    response.details = error.details;
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
