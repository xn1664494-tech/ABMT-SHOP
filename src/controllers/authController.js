const asyncHandler = require('../utils/asyncHandler');
const { registerUser, loginUser, refreshSession, logoutSession } = require('../services/authService');
const {
  setAuthCookies,
  clearAuthCookies,
  REFRESH_COOKIE,
} = require('../services/tokenService');
const {
  requestPasswordReset,
  resetPassword: resetPasswordWithToken,
} = require('../services/resetPasswordService');

/**
 * POST /api/auth/register
 * Body: { name, email, password }
 */
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const user = await registerUser({ name, email, password });

  return res.status(201).json({
    success: true,
    message: 'Dang ky tai khoan thanh cong',
    data: { user },
  });
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Token được gắn vào cookie HttpOnly, không trả trong body.
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { user, accessToken, refreshToken } = await loginUser({ email, password });

  setAuthCookies(res, accessToken, refreshToken);

  return res.status(200).json({
    success: true,
    message: 'Dang nhap thanh cong',
    data: { user },
  });
});

/**
 * POST /api/auth/refresh
 * Dùng refresh token trong cookie để cấp cặp token mới (rotation).
 */
const refresh = asyncHandler(async (req, res) => {
  const currentRefreshToken = req.cookies ? req.cookies[REFRESH_COOKIE] : undefined;
  const { user, accessToken, refreshToken } = await refreshSession(currentRefreshToken);

  setAuthCookies(res, accessToken, refreshToken);

  return res.status(200).json({
    success: true,
    message: 'Lam moi phien dang nhap thanh cong',
    data: { user },
  });
});

/**
 * POST /api/auth/logout
 * Thu hồi refresh token hiện tại và xóa toàn bộ cookie xác thực.
 */
const logout = asyncHandler(async (req, res) => {
  const currentRefreshToken = req.cookies ? req.cookies[REFRESH_COOKIE] : undefined;
  await logoutSession(currentRefreshToken);

  clearAuthCookies(res);

  return res.status(200).json({
    success: true,
    message: 'Dang xuat thanh cong',
  });
});

/**
 * POST /api/auth/forgot-password
 * Luôn trả 202 + message chung cho mọi email hợp lệ (chống enumeration).
 * Ở môi trường không phải production, trả thêm token để dev/test không cần email.
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const result = await requestPasswordReset({ email: req.body.email });
  const payload = {
    success: true,
    message: 'Neu email ton tai, huong dan dat lai mat khau da duoc gui',
  };

  if (result && process.env.NODE_ENV !== 'production') {
    payload.data = {
      resetToken: result.resetToken,
      expiresAt: result.expiresAt,
    };
  }

  return res.status(202).json(payload);
});

/**
 * POST /api/auth/reset-password
 * Body: { token, newPassword }. Token dùng một lần; tokenVersion tăng để
 * thu hồi access/refresh token cũ. Cookie auth cũng bị xóa.
 */
const resetPassword = asyncHandler(async (req, res) => {
  await resetPasswordWithToken({
    token: req.body.token,
    newPassword: req.body.newPassword,
  });

  clearAuthCookies(res);

  return res.status(200).json({
    success: true,
    message: 'Dat lai mat khau thanh cong',
  });
});

module.exports = { register, login, refresh, logout, forgotPassword, resetPassword };
