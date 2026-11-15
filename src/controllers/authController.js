const asyncHandler = require('../utils/asyncHandler');
const { registerUser, loginUser } = require('../services/authService');
const { setAuthCookies } = require('../services/tokenService');

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

module.exports = { register, login };
