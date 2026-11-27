const mongoose = require('mongoose');
const Order = require('../model/Order');
const ErrorResponse = require('../utils/appError');

// Dùng lại flow có sẵn trên model; service này không định nghĩa lại sơ đồ trạng thái.
const ORDER_STATUS_FLOW = Order.ORDER_STATUS_FLOW;

const orderError = (code, message, statusCode) => {
  const error = new ErrorResponse(message, statusCode);
  error.code = code;
  return error;
};

/**
 * Quyền của từng vai trò, tính trên cặp (trạng thái hiện tại, trạng thái đích).
 * Flow hợp lệ vẫn được lấy từ Order.canTransition / ORDER_STATUS_FLOW.
 */
const isRoleAllowed = ({ actorRole, from, to }) => {
  if (actorRole === 'admin') {
    return (
      (from === 'pending' && (to === 'confirmed' || to === 'cancelled')) ||
      (from === 'confirmed' && (to === 'shipping' || to === 'cancelled')) ||
      (from === 'shipping' && to === 'delivered')
    );
  }

  if (actorRole === 'customer' || actorRole === 'system') {
    return from === 'pending' && to === 'cancelled';
  }

  return false;
};

/**
 * Chuyển trạng thái đơn hàng có kiểm tra quyền và CAS theo trạng thái hiện tại.
 *
 * @param {object} params
 * @param {import('mongoose').Types.ObjectId|string} params.orderId
 * @param {string} params.to Trạng thái đích.
 * @param {string} params.actorRole 'admin' | 'customer' | 'system'.
 * @param {import('mongoose').Types.ObjectId|string} [params.actorId]
 * @param {string} [params.note]
 * @returns {Promise<{order: object, from: string}>} Document sau CAS và status cũ trước chuyển.
 */
async function transitionOrderStatus({ orderId, to, actorRole, actorId, note } = {}) {
  const order = await Order.findById(orderId);
  if (!order) {
    throw orderError('ORDER_NOT_FOUND', 'Đơn hàng không tồn tại', 404);
  }

  const from = order.status;
  const flowTargets = ORDER_STATUS_FLOW[from] || [];
  const isFlowTransition = flowTargets.includes(to);

  // Sai flow (skip/backward/unknown) là 409, kể cả khi vai trò cũng không được phép.
  if (!isFlowTransition || !Order.canTransition(from, to)) {
    throw orderError(
      'ORDER_INVALID_TRANSITION',
      `Không thể chuyển đơn từ ${from} sang ${to}`,
      409
    );
  }

  // Chặn quyền trước CAS: vai trò sai thì không đụng DB ở bước ghi.
  if (!isRoleAllowed({ actorRole, from, to })) {
    throw orderError(
      'ORDER_FORBIDDEN_ROLE',
      `Vai trò ${actorRole} không được chuyển đơn từ ${from} sang ${to}`,
      403
    );
  }

  const at = new Date();
  const by = mongoose.Types.ObjectId.isValid(actorId) ? actorId : null;
  const roleMarker = `[role:${actorRole}]`;
  const userNote = typeof note === 'string' ? note : '';
  const historyNote = `${roleMarker}${userNote ? ` ${userNote}` : ''}`;

  // actorRole da co trong statusHistorySchema (PR-5); van prefix note bang marker
  // de tuong thich voi statusHistory/log cu.
  const historyEntry = {
    status: to,
    at,
    by,
    note: historyNote,
    actorRole,
  };

  const updated = await Order.findOneAndUpdate(
    { _id: orderId, status: from },
    {
      $set: { status: to },
      $push: { statusHistory: historyEntry },
    },
    { new: true, runValidators: true }
  );

  if (!updated) {
    throw orderError(
      'ORDER_STATUS_CONFLICT',
      'Đơn hàng đã thay đổi trạng thái, thử lại',
      409
    );
  }

  // from + order.status duoc controller dung de build audit event before/after.
  return { order: updated, from };
}

module.exports = { transitionOrderStatus };
