const User = require('../model/User');
const ErrorResponse = require('../utils/appError');
const { toPublicUser } = require('./authService');

/**
 * Lấy profile công khai của một user theo id.
 */
const getProfileById = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new ErrorResponse('Khong tim thay nguoi dung', 404);
  }

  return toPublicUser(user);
};

module.exports = { getProfileById };
