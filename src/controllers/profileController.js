const asyncHandler = require('../utils/asyncHandler');
const { getProfileById } = require('../services/profileService');
const { toPublicUser } = require('../services/authService');

/**
 * GET /api/auth/me
 * Trả về user hiện tại được xác thực từ token.
 */
const me = asyncHandler(async (req, res) =>
  res.status(200).json({
    success: true,
    data: { user: toPublicUser(req.user) },
  }),
);

/**
 * GET /api/profile/:userId
 * Chỉ chủ sở hữu hoặc admin được xem (IDOR guard ở middleware).
 */
const getProfile = asyncHandler(async (req, res) => {
  const profile = await getProfileById(req.params.userId);

  return res.status(200).json({
    success: true,
    data: { user: profile },
  });
});

module.exports = { me, getProfile };
