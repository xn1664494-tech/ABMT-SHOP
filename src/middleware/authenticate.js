const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/appError');
const User = require('../model/User');
const { ACCESS_COOKIE, verifyToken } = require('../services/tokenService');

const extractAccessToken = (req) => {
  const cookieToken = req.cookies ? req.cookies[ACCESS_COOKIE] : undefined;
  if (cookieToken) {
    return cookieToken;
  }

  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim();
  }

  return null;
};

/**
 * Xác thực người dùng từ access token (cookie HttpOnly hoặc Bearer).
 * - Không tin role/id do client gửi: luôn đọc lại user từ DB.
 * - Kiểm tra tokenVersion để thu hồi token ngay sau logout/refresh.
 */
const authenticate = asyncHandler(async (req, res, next) => {
  const token = extractAccessToken(req);

  if (!token) {
    throw new ErrorResponse('Chua dang nhap', 401);
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch (error) {
    const message =
      error.name === 'TokenExpiredError'
        ? 'Phien dang nhap da het han'
        : 'Token khong hop le';
    throw new ErrorResponse(message, 401);
  }

  if (payload.type === 'refresh') {
    throw new ErrorResponse('Token khong hop le', 401);
  }

  const user = await User.findById(payload.sub);

  if (!user || user.isDeleted || user.status !== 'active') {
    throw new ErrorResponse('Tai khoan khong ton tai hoac da bi khoa', 401);
  }

  if (Number(payload.ver || 0) !== Number(user.tokenVersion || 0)) {
    throw new ErrorResponse('Phien dang nhap da bi thu hoi', 401);
  }

  req.user = user;
  req.auth = payload;
  return next();
});

/**
 * Xác thực tùy chọn cho endpoint công khai.
 * - Có token hợp lệ: gắn req.user để mở rộng quyền đọc (ví dụ admin xem ẩn).
 * - Không có token / token sai / tài khoản bị khóa: bỏ qua, KHÔNG trả 401.
 */
const optionalAuthenticate = asyncHandler(async (req, res, next) => {
  const token = extractAccessToken(req);
  if (!token) return next();

  let payload;
  try {
    payload = verifyToken(token);
  } catch (error) {
    return next();
  }

  if (payload.type === 'refresh') return next();

  let user;
  try {
    user = await User.findById(payload.sub);
  } catch (error) {
    return next();
  }

  if (!user || user.isDeleted || user.status !== 'active') return next();

  if (Number(payload.ver || 0) !== Number(user.tokenVersion || 0)) return next();

  req.user = user;
  req.auth = payload;
  return next();
});

/**
 * Phân quyền theo role lấy từ DB (req.user.role).
 * Dùng sau authenticate: router.get('/admin', authenticate, authorize('admin'), ...)
 */
const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) {
      return next(new ErrorResponse('Chua dang nhap', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ErrorResponse('Khong co quyen truy cap', 403));
    }

    return next();
  };

/**
 * Chống IDOR: chỉ chủ sở hữu tài nguyên hoặc admin được truy cập.
 * ID lấy từ URL, so sánh với user đã xác thực ở server.
 */
const requireSelfOrAdmin =
  (paramName = 'userId') =>
  (req, res, next) => {
    if (!req.user) {
      return next(new ErrorResponse('Chua dang nhap', 401));
    }

    if (req.user.role === 'admin') {
      return next();
    }

    if (String(req.user._id || req.user.id) === String(req.params[paramName])) {
      return next();
    }

    return next(new ErrorResponse('Khong co quyen truy cap tai nguyen nay', 403));
  };

module.exports = {
  authenticate,
  optionalAuthenticate,
  authorize,
  requireSelfOrAdmin,
};
