const User = require('../model/User');
const { verifyToken } = require('../services/tokenService');

/**
 * Middleware nhẹ: gán res.locals.currentUser cho các view trang (không chặn, không lỗi).
 * - Có accessToken hợp lệ: res.locals.currentUser = { id, name, role }
 * - Không có / token sai / hết hạn: res.locals.currentUser = null
 */
function currentUser(req, res, next) {
  try {
    const token = req.cookies ? req.cookies.accessToken : undefined;
    if (!token) {
      res.locals.currentUser = null;
      return next();
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch (error) {
      res.locals.currentUser = null;
      return next();
    }

    if (!payload || payload.type === 'refresh') {
      res.locals.currentUser = null;
      return next();
    }

    // Lấy tên từ DB (như authenticate làm) nhưng không ném lỗi nếu thất bại
    User.findById(payload.sub)
      .select('name role isDeleted status')
      .lean()
      .then((user) => {
        if (!user || user.isDeleted || user.status !== 'active') {
          res.locals.currentUser = null;
        } else {
          res.locals.currentUser = {
            id: String(user._id || user.id),
            name: user.name || '',
            role: user.role,
          };
        }
        next();
      })
      .catch(() => {
        res.locals.currentUser = null;
        next();
      });
  } catch (error) {
    res.locals.currentUser = null;
    next();
  }
}

module.exports = { currentUser };
