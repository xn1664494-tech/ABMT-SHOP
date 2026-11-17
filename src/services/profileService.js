const User = require('../model/User');
const ErrorResponse = require('../utils/appError');
const { toPublicUser } = require('./authService');

/**
 * Lấy profile công khai của một user theo id.
 */
const getProfileById = async (userId) => {
  const user = await User.findById(userId);

  if (!user || user.isDeleted) {
    throw new ErrorResponse('Khong tim thay nguoi dung', 404);
  }

  return toPublicUser(user);
};

/**
 * Cập nhật profile của chính user đang đăng nhập.
 * Chỉ áp dụng các trường đã được validate (name, email); role/status bị chặn
 * ở validator nên không thể thay đổi qua API này.
 */
const updateProfile = async (userId, updates) => {
  const current = await User.findById(userId);

  if (!current || current.isDeleted) {
    throw new ErrorResponse('Khong tim thay nguoi dung', 404);
  }

  if (updates.email) {
    const existing = await User.findOne({ email: updates.email });
    if (existing && String(existing._id || existing.id) !== String(userId)) {
      throw new ErrorResponse('Email da duoc su dung', 409);
    }
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: updates },
    { new: true, runValidators: true },
  );

  if (!user) {
    throw new ErrorResponse('Khong tim thay nguoi dung', 404);
  }

  return toPublicUser(user);
};

module.exports = { getProfileById, updateProfile };
