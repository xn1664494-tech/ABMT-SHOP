const bcrypt = require('bcryptjs');
const User = require('../model/User');
const ErrorResponse = require('../utils/appError');
const { toPublicUser } = require('./authService');

const BCRYPT_ROUNDS = 10;

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
    const existing = await User.findOne({ email: updates.email }).setOptions({
      includeDeleted: true,
    });
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

/**
 * Doi mat khau cua chinh user dang dang nhap.
 * - Xac minh mat khau hien tai bang bcrypt truoc khi doi.
 * - Hash mat khau moi, khong luu plaintext.
 * - Tang `tokenVersion` de vo hieu hoa toan bo access/refresh token cu.
 * - Thong bao sai mat khau hien tai la chung, khong tiet lo them thong tin.
 */
const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await User.findById(userId).select('+password');

  if (!user || user.isDeleted) {
    throw new ErrorResponse('Khong tim thay nguoi dung', 404);
  }

  if (!user.password) {
    throw new ErrorResponse('Mat khau hien tai khong chinh xac', 401);
  }

  const passwordMatches = await bcrypt.compare(currentPassword, user.password);
  if (!passwordMatches) {
    throw new ErrorResponse('Mat khau hien tai khong chinh xac', 401);
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  // Cap nhat co dieu kien: neu user bi xoa mem trong luc xu ly thi khong ghi.
  const updated = await User.findOneAndUpdate(
    { _id: userId, isDeleted: false },
    { $set: { password: passwordHash }, $inc: { tokenVersion: 1 } },
    { returnDocument: 'after', runValidators: true },
  );

  if (!updated) {
    throw new ErrorResponse('Khong the cap nhat mat khau', 500);
  }

  return {
    id: String(updated._id || updated.id),
    tokenVersion: updated.tokenVersion,
  };
};

module.exports = { getProfileById, updateProfile, changePassword };
