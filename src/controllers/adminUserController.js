const asyncHandler = require('../utils/asyncHandler');
const sendResponse = require('../utils/sendResponse');
const adminUserService = require('../services/adminUserService');

const AdminUserController = {
  /**
   * GET /api/admin/users
   */
  list: asyncHandler(async (req, res) => {
    const data = await adminUserService.listUsers(
      req.validatedQuery || req.query,
    );
    return sendResponse(
      res,
      200,
      true,
      'Lay danh sach nguoi dung thanh cong',
      data,
    );
  }),

  /**
   * PATCH /api/admin/users/:userId/role
   */
  updateRole: asyncHandler(async (req, res) => {
    const data = await adminUserService.updateUserRole({
      targetUserId: req.params.userId,
      role: req.body.role,
      actor: req.user,
    });

    return sendResponse(
      res,
      200,
      true,
      'Cap nhat vai tro nguoi dung thanh cong',
      data,
    );
  }),
};

module.exports = AdminUserController;
