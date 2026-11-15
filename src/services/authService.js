const bcrypt = require('bcryptjs');
const User = require('../model/User');
const ErrorResponse = require('../utils/appError');

const BCRYPT_ROUNDS = 10;

/**
 * Chuẩn hóa dữ liệu user trả về client: tuyệt đối không lộ passwordHash.
 */
const toPublicUser = (user) => ({
  id: String(user._id || user.id),
  name: user.name,
  email: user.email,
  role: user.role,
  status: user.status,
  createdAt: user.createdAt,
});

/**
 * Đăng ký tài khoản mới.
 * - Luôn gán role customer, bỏ qua mọi giá trị role khác do client gửi.
 * - Hash mật khẩu bằng bcrypt trước khi lưu.
 */
const registerUser = async ({ name, email, password }) => {
  const normalizedEmail = String(email).trim().toLowerCase();

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    throw new ErrorResponse('Email da duoc su dung', 409);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user = await User.create({
    name,
    email: normalizedEmail,
    passwordHash,
    role: 'customer',
    status: 'active',
  });

  return toPublicUser(user);
};

module.exports = { registerUser, toPublicUser };
