const asyncHandler = require('../utils/asyncHandler');
const { getProfileById, updateProfile } = require('../services/profileService');
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

/**
 * GET /api/profile/me
 * Profile của chính user đang đăng nhập (id lấy từ token, không từ client).
 */
const getMyProfile = asyncHandler(async (req, res) =>
  res.status(200).json({
    success: true,
    data: { user: toPublicUser(req.user) },
  }),
);

/**
 * PATCH /api/profile/me
 * Chỉ cập nhật các trường được whitelist (name, email).
 */
const updateMyProfile = asyncHandler(async (req, res) => {
  const user = await updateProfile(req.user._id || req.user.id, req.body);

  return res.status(200).json({
    success: true,
    message: 'Cap nhat profile thanh cong',
    data: { user },
  });
});

module.exports = { me, getProfile, getMyProfile, updateMyProfile };
