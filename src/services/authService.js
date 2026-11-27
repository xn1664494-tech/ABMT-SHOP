const bcrypt = require('bcryptjs');
const User = require('../model/User');
const ErrorResponse = require('../utils/appError');
const { signAccessToken, signRefreshToken, verifyToken } = require('./tokenService');
const { maskPhone } = require('../utils/maskPhone');

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
  phoneMasked: maskPhone(user.phone || null),
  phoneVerified: Boolean(user.phoneVerified),
  createdAt: user.createdAt,
});

/**
 * Đăng ký tài khoản mới.
 * - Luôn gán role customer, bỏ qua mọi giá trị role khác do client gửi.
 * - Hash mật khẩu bằng bcrypt trước khi lưu.
 */
const registerUser = async ({ name, email, password }) => {
  const normalizedEmail = String(email).trim().toLowerCase();

  const existing = await User.findOne({ email: normalizedEmail, isDeleted: false });
  if (existing) {
    throw new ErrorResponse('Email da duoc su dung', 409);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user = await User.create({
    name,
    email: normalizedEmail,
    password: passwordHash,
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

  const user = await User.findOne({
    email: normalizedEmail,
    isDeleted: false,
  }).select('+password');

  if (!user) {
    throw new ErrorResponse('Email hoac mat khau khong chinh xac', 401);
  }

  const passwordMatches = await bcrypt.compare(password, user.password);
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

/**
 * Xoay vòng refresh token.
 * Token chỉ dùng được một lần: tokenVersion tăng nguyên tử, token cũ lập tức
 * không còn khớp và không thể dùng lại (chống replay).
 */
const refreshSession = async (refreshToken) => {
  if (!refreshToken) {
    throw new ErrorResponse('Thieu refresh token', 401);
  }

  let payload;
  try {
    payload = verifyToken(refreshToken);
  } catch (error) {
    throw new ErrorResponse('Refresh token khong hop le hoac da het han', 401);
  }

  if (payload.type !== 'refresh') {
    throw new ErrorResponse('Refresh token khong hop le', 401);
  }

  const user = await User.findOneAndUpdate(
    {
      _id: payload.sub,
      tokenVersion: payload.ver,
      status: 'active',
      isDeleted: false,
    },
    { $inc: { tokenVersion: 1 } },
    { returnDocument: 'after' },
  );

  if (!user) {
    throw new ErrorResponse('Refresh token da bi thu hoi', 401);
  }

  return {
    user: toPublicUser(user),
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user, user.tokenVersion),
  };
};

/**
 * Thu hồi refresh token hiện tại bằng cách tăng tokenVersion.
 * Idempotent: token thiếu/không hợp lệ không gây lỗi, controller vẫn xóa cookie.
 */
const logoutSession = async (refreshToken) => {
  if (!refreshToken) {
    return;
  }

  let payload;
  try {
    payload = verifyToken(refreshToken);
  } catch (error) {
    return;
  }

  if (payload.type !== 'refresh') {
    return;
  }

  await User.updateOne(
    { _id: payload.sub, tokenVersion: payload.ver, isDeleted: false },
    { $inc: { tokenVersion: 1 } },
  );
};

module.exports = {
  registerUser,
  loginUser,
  refreshSession,
  logoutSession,
  toPublicUser,
  BCRYPT_ROUNDS,
};
