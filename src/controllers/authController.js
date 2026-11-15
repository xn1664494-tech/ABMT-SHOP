const asyncHandler = require('../utils/asyncHandler');
const { registerUser } = require('../services/authService');

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

module.exports = { register };
