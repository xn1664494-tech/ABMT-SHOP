const bcrypt = require('bcryptjs');
const User = require('../model/User');
const ErrorResponse = require('../utils/appError');
const { signAccessToken, signRefreshToken } = require('./tokenService');

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

/**
 * Đăng nhập bằng email + password.
 * Trả về user và cặp token (do controller gắn vào cookie HttpOnly).
 * Mọi trường hợp sai email/password đều trả cùng một thông báo để tránh
 * dò tài khoản (user enumeration).
 */
const loginUser = async ({ email, password }) => {
  const normalizedEmail = String(email).trim().toLowerCase();

  const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');

  if (!user) {
    throw new ErrorResponse('Email hoac mat khau khong chinh xac', 401);
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw new ErrorResponse('Email hoac mat khau khong chinh xac', 401);
  }

  if (user.status !== 'active') {
    throw new ErrorResponse('Tai khoan da bi khoa', 403);
  }

  return {
    user: toPublicUser(user),
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user, user.tokenVersion || 0),
  };
};

module.exports = { registerUser, loginUser, toPublicUser };
