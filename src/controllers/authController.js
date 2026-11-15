const asyncHandler = require('../utils/asyncHandler');
const { registerUser, loginUser, refreshSession, logoutSession } = require('../services/authService');
const {
  setAuthCookies,
  clearAuthCookies,
  REFRESH_COOKIE,
} = require('../services/tokenService');

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

module.exports = { register, login, refresh, logout };
