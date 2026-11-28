const asyncHandler = require('../utils/asyncHandler');
const sendResponse = require('../utils/sendResponse');
const { transition, markPaid } = require('../services/orderStatusService');
const {
  AUDIT_ACTIONS,
  TARGET_TYPES,
  buildAuditEvent,
  publishAuditEvent,
} = require('../services/auditEvent');

const AdminOrderController = {
  /**
   * PATCH /api/admin/orders/:orderId/status
   * Chuyen trang thai qua orderStatusService, sau do moi publish audit event.
   */
  updateStatus: asyncHandler(async (req, res) => {
    const actorId = req.user._id || req.user.id;
    const body = req.body || {};

    const result = await transition(req.params.orderId, body.status, {
      actor: 'admin',
      userId: actorId,
      note: body.note,
      extra: {
        reason: body.reason,
        carrier: body.carrier,
        trackingCode: body.trackingCode,
      },
    });

    const order = result.order || result;
    const from = result.from || order.from;

    const event = buildAuditEvent({
      actorId,
      actorRole: 'admin',
      action: AUDIT_ACTIONS.ADMIN_ORDER_STATUS_CHANGED,
      targetType: TARGET_TYPES.ORDER,
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

  /**
   * Duoc goi boi cac endpoint POST /orders/:code/*
   */
  transitionAction: asyncHandler(async (req, res) => {
    const actorId = req.user._id || req.user.id;
    const body = req.body || {};
    const action = req.action || {};
    const to = action.to;

    const result = await transition(req.params.code, to, {
      actor: action.actor || 'admin',
      userId: action.actor === 'carrier' ? null : actorId,
      note: body.note || action.note || '',
      extra: {
        reason: body.reason,
        carrier: body.carrier,
        trackingCode: body.trackingCode,
      },
    });

    const order = result.order || result;
    const from = result.from || order.from;
    const event = buildAuditEvent({
      actorId,
      actorRole: action.actor === 'carrier' ? 'carrier' : 'admin',
      action: AUDIT_ACTIONS.ADMIN_ORDER_STATUS_CHANGED,
      targetType: TARGET_TYPES.ORDER,
      targetId: String(order._id || req.params.code),
      before: { status: from },
      after: { status: order.status },
    });
    await publishAuditEvent(event);

    return sendResponse(res, 200, true, action.message || 'Cập nhật đơn hàng thành công', {
      code: order.code,
      status: order.status,
      order,
    });
  }),

  simulateDelivery: asyncHandler(async (req, res) => {
    const actorId = req.user._id || req.user.id;
    const body = req.body || {};

    let result;
    try {
      result = await transition(req.params.code, 'delivered', {
        actor: 'carrier',
        userId: null,
        note: 'Đơn vị vận chuyển xác nhận giao thành công',
        extra: { trackingCode: body.trackingCode },
      });
    } catch (error) {
      if (error.statusCode === 409) {
        const latest = await require('../model/Order')
          .findOne({ code: String(req.params.code).toUpperCase() })
          .select('code status')
          .lean()
          .catch(() => null);
        if (latest && ['delivered', 'completed'].includes(latest.status)) {
          return sendResponse(res, 200, true, 'Đơn đã được giao trước đó', {
            code: latest.code,
            status: latest.status,
          });
        }
      }
      throw error;
    }

    const order = result.order || result;
    const event = buildAuditEvent({
      actorId,
      actorRole: 'admin',
      action: AUDIT_ACTIONS.ADMIN_ORDER_STATUS_CHANGED,
      targetType: TARGET_TYPES.ORDER,
      targetId: String(order._id || req.params.code),
      before: { status: result.from || order.from },
      after: { status: order.status },
    });
    await publishAuditEvent(event);

    return sendResponse(res, 200, true, 'Giả lập giao hàng thành công', {
      code: order.code,
      status: order.status,
      order,
    });
  }),

  markPaid: asyncHandler(async (req, res) => {
    const actorId = req.user._id || req.user.id;
    const order = await markPaid(req.params.code, { userId: actorId, note: req.body.note });

    return sendResponse(res, 200, true, 'Đã xác nhận nhận tiền chuyển khoản', {
      code: order.code,
      paymentStatus: order.paymentStatus,
      order,
    });
  }),
};

module.exports = AdminOrderController;
