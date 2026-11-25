const crypto = require('crypto');
const ErrorResponse = require('../utils/appError');

const CSRF_COOKIE = 'csrfToken';
const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const csrfCookieOptions = () => ({
  httpOnly: false, // Frontend phải đọc được để gửi lại qua header.
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
});

const generateCsrfToken = () => crypto.randomBytes(32).toString('hex');

const allowedOrigins = () =>
  (process.env.APP_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const isOriginAllowed = (req) => {
  const origin = req.headers.origin || req.headers.referer;
  if (!origin) {
    return true; // Không có Origin (CLI, test) → dựa vào double-submit token.
  }

  try {
    const originUrl = new URL(origin);
    return allowedOrigins().some((allowed) => {
      const allowedUrl = new URL(allowed);
      return allowedUrl.origin === originUrl.origin;
    });
  } catch (error) {
    return false;
  }
};

const safeCompare = (left, right) => {
  if (typeof left !== 'string' || typeof right !== 'string') {
    return false;
  }

  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

/**
 * CSRF double-submit cookie + kiểm tra Origin/Referer.
 * Chỉ áp dụng cho request thay đổi dữ liệu có sử dụng cookie auth.
 */
const csrfProtection = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  if (!isOriginAllowed(req)) {
    return next(new ErrorResponse('Origin khong duoc phep', 403));
  }

  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  const cookieToken = req.cookies ? req.cookies[CSRF_COOKIE] : undefined;
  const headerToken = req.headers[CSRF_HEADER];

  if (!cookieToken || !headerToken || !safeCompare(cookieToken, headerToken)) {
    return next(new ErrorResponse('CSRF token khong hop le', 403));
  }

  return next();
};

/**
 * Cấp CSRF token mới: set cookie đọc được bởi JS và trả token trong body.
 */
const issueCsrfToken = (req, res) => {
  const token = generateCsrfToken();
  res.cookie(CSRF_COOKIE, token, csrfCookieOptions());

  return res.status(200).json({
    success: true,
    data: { csrfToken: token },
  });
};

module.exports = {
  CSRF_COOKIE,
  CSRF_HEADER,
  csrfProtection,
  issueCsrfToken,
};
