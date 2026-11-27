const asyncHandler = require('../utils/asyncHandler');
const sendResponse = require('../utils/sendResponse');
const { transitionOrderStatus } = require('../services/orderStateMachine');
const { buildAuditEvent, publishAuditEvent } = require('../services/auditEvent');

const AdminOrderController = {
  /**
   * PATCH /api/admin/orders/:orderId/status
   * Chuyen trang thai qua state machine, sau do moi publish audit event.
   */
  updateStatus: asyncHandler(async (req, res) => {
    const actorId = req.user._id || req.user.id;

    // PR-4 chua co PR-3: action/targetType dung literal string.
    // PR-3 se them AUDIT_ACTIONS.ADMIN_ORDER_STATUS_CHANGED va TARGET_TYPES.ORDER.
    const { order, from } = await transitionOrderStatus({
      orderId: req.params.orderId,
      to: req.body.status,
      actorRole: 'admin',
      actorId,
      note: req.body.note,
    });

    const event = buildAuditEvent({
      actorId,
      actorRole: 'admin',
      action: 'admin.order.status.changed',
      targetType: 'Order',
      targetId: req.params.orderId,
      before: { status: from },
      after: { status: order.status },
    });
    await publishAuditEvent(event);

    return sendResponse(
      res,
      200,
      true,
      'Cap nhat trang thai don hang thanh cong',
      { order },
    );
  }),
};

module.exports = AdminOrderController;
