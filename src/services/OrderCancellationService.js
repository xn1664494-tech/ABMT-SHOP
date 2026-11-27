const mongoose = require('mongoose');
const Order = require('../model/Order');
const ErrorResponse = require('../utils/appError');
const { restoreStock } = require('./ProductsServices');

const orderError = (code, message, statusCode) => {
  const error = new ErrorResponse(message, statusCode);
  error.code = code;
  return error;
};

const canActorCancel = ({ actorRole, isOwner, from }) => {
  if (actorRole === 'customer') {
    if (!isOwner) {
      throw orderError('ORDER_NOT_OWNER', 'Không có quyền hủy đơn hàng này', 403);
    }
    return from === 'pending';
  }

  if (actorRole === 'admin') {
    return ['pending', 'confirmed'].includes(from);
  }

  if (actorRole === 'system') {
    return from === 'pending';
  }

  return false;
};

const canCancelOrder = ({ actorRole, isOwner, from }) => {
  if (!Order.canTransition(from, 'cancelled')) {
    return false;
  }

  try {
    return canActorCancel({ actorRole, isOwner, from });
  } catch (error) {
    return false;
  }
};

async function cancelOrder({
  orderId,
  actorRole,
  actorId,
  isOwner,
  note,
  expectedPaymentStatus = null,
}) {
  const order = await Order.findById(orderId);
  if (!order) {
    throw orderError('ORDER_NOT_FOUND', 'Đơn hàng không tồn tại', 404);
  }

  // Chỉ hệ thống (job quá hạn) mới khóa paymentStatus. Customer/admin giữ
  // nguyên rule cũ: check sớm sai thì báo conflict, CAS cũng lặp điều kiện đó
  // để chặn race thanh toán giữa lúc đọc và lúc ghi.
  const guardPaymentStatus =
    actorRole === 'system' && expectedPaymentStatus != null;

  // Hệ thống không hủy đơn đã thanh toán, kể cả caller quên truyền expected.
  if (actorRole === 'system' && order.paymentStatus !== 'unpaid') {
    throw orderError(
      'ORDER_PAYMENT_CONFLICT',
      'Trạng thái thanh toán đã thay đổi, không thể hủy đơn',
      409
    );
  }

  if (guardPaymentStatus && order.paymentStatus !== expectedPaymentStatus) {
    throw orderError(
      'ORDER_PAYMENT_CONFLICT',
      'Trạng thái thanh toán đã thay đổi, không thể hủy đơn',
      409
    );
  }

  const from = order.status;
  if (!Order.canTransition(from, 'cancelled')) {
    throw orderError(
      'ORDER_INVALID_TRANSITION',
      `Không thể hủy đơn ở trạng thái ${from}`,
      409
    );
  }

  if (!canActorCancel({ actorRole, isOwner, from })) {
    throw orderError(
      'ORDER_FORBIDDEN_ROLE',
      'Vai trò này không được phép hủy đơn ở trạng thái hiện tại',
      403
    );
  }

  const at = new Date();
  const historyBy = mongoose.Types.ObjectId.isValid(actorId) ? actorId : null;
  const historyNote =
    note ||
    (actorRole === 'system'
      ? 'Hủy đơn bởi hệ thống'
      : `Hủy đơn bởi ${actorRole}`);

  const casFilter = {
    _id: orderId,
    status: from,
    stockRestoredAt: null,
    ...(guardPaymentStatus ? { paymentStatus: expectedPaymentStatus } : {}),
  };

  const cancelled = await Order.findOneAndUpdate(
    casFilter,
    {
      $set: { status: 'cancelled', stockRestoredAt: at },
      $push: {
        statusHistory: {
          status: 'cancelled',
          at,
          by: historyBy,
          note: historyNote,
          actorRole: actorRole || '',
        },
      },
    },
    { returnDocument: 'after', runValidators: true }
  );

  if (!cancelled) {
    throw orderError(
      'ORDER_STATUS_CONFLICT',
      'Đơn hàng đã thay đổi trạng thái',
      409
    );
  }

  const items = (order.items || []).map((item) => ({
    productId: item.product,
    variantSku: item.sku,
    qty: item.qty,
  }));

  try {
    await restoreStock(items);
  } catch (error) {
    console.error(
      `[cancel-order] hoan kho that bai cho don ${String(orderId)}: ${error.message}`
    );
    throw orderError(
      'ORDER_RESTOCK_FAILED',
      'Đơn đã hủy nhưng hoàn kho thất bại, cần xử lý thủ công',
      500
    );
  }

  return cancelled;
}

module.exports = { cancelOrder, canActorCancel, canCancelOrder };
