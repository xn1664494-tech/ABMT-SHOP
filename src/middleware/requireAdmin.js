const ErrorResponse = require('../utils/appError');

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return next(new ErrorResponse('Bạn không có quyền thực hiện hành động này', 403));
  }
  return next();
};

module.exports = requireAdmin;
