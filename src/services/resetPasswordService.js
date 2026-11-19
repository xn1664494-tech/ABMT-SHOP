const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../model/User');
const ErrorResponse = require('../utils/appError');
const { BCRYPT_ROUNDS } = require('./authService');

const DEFAULT_TTL_MS = 15 * 60 * 1000;
const TOKEN_BYTES = 32;

const resetTtlMs = () => {
  const value = Number(process.env.RESET_PASSWORD_TTL_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TTL_MS;
};

const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

/**
 * Yêu cầu đặt lại mật khẩu.
 * Luôn trả về cùng một kết quả cho email hợp lệ để tránh dò tài khoản.
 * Trả token thô cho controller (chỉ để dev/test; production bỏ qua).
 */
const requestPasswordReset = async ({ email }) => {
  const normalizedEmail = String(email).trim().toLowerCase();

  const user = await User.findOne({
    email: normalizedEmail,
    isDeleted: false,
    status: 'active',
  });

  if (!user) {
    return null;
  }

  const resetToken = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  const expiresAt = new Date(Date.now() + resetTtlMs());

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        resetPasswordTokenHash: hashToken(resetToken),
        resetPasswordExpires: expiresAt,
      },
    },
  );

  // Không log token/hash/email.
  console.info('[forgot-password] reset token issued');
  return { resetToken, expiresAt };
};

/**
 * Đặt lại mật khẩu bằng token một lần.
 * Cập nhật nguyên tử: token đúng + chưa hết hạn + user active thì mới đổi.
 * Tăng tokenVersion để thu hồi mọi access/refresh token cũ.
 */
const resetPassword = async ({ token, newPassword }) => {
  const tokenHash = hashToken(token);
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  const user = await User.findOneAndUpdate(
    {
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpires: { $gt: new Date() },
      isDeleted: false,
      status: 'active',
    },
    {
      $set: { password: passwordHash },
      $unset: { resetPasswordTokenHash: 1, resetPasswordExpires: 1 },
      $inc: { tokenVersion: 1 },
    },
    { returnDocument: 'after' },
  );

  if (!user) {
    throw new ErrorResponse('Token dat lai mat khau khong hop le hoac da het han', 400);
  }

  console.info('[reset-password] password changed');
  return true;
};

module.exports = { requestPasswordReset, resetPassword, hashToken, resetTtlMs };
