const jwt = require('jsonwebtoken');
const AppError = require('../utils/appError');

const authenticate = (req, res, next) => {
  let token = null;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.auth_token) {
    token = req.cookies.auth_token;
  }

  if (!token) {
    return next(new AppError('Bạn chưa đăng nhập, vui lòng đăng nhập để truy cập', 401));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-me');
    req.user = decoded;
    return next();
  } catch (error) {
    return next(new AppError('Token không hợp lệ hoặc đã hết hạn', 401));
  }
};

module.exports = authenticate;
