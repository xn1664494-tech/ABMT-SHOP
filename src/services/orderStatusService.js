const mongoose = require('mongoose');
const Order = require('../model/Order');
const ErrorResponse = require('../utils/appError');
const { restoreStock } = require('./ProductsServices');

const ACTORS = new Set(['customer', 'admin', 'carrier', 'system']);

const CONFLICT_MESSAGE = 'Trạng thái đơn đã thay đổi';

// Quyền chuyển trạng thái (bước 1). Flow hợp lệ vẫn dùng Order.canTransition.
const ACTOR_PERMISSIONS = Object.freeze({
  customer: Object.freeze({
    pending: Object.freeze(['cancelled']),
    delivered: Object.freeze(['completed']),
  }),
  admin: Object.freeze({
    pending: Object.freeze(['confirmed', 'cancelled']),
    confirmed: Object.freeze(['shipping', 'cancelled']),
  }),
  carrier: Object.freeze({
    shipping: Object.freeze(['delivered']),
  }),
  system: Object.freeze({
    delivered: Object.freeze(['completed']),
  }),
});

const orderError = (code, message, statusCode) => {
  const error = new ErrorResponse(message, statusCode);
  error.code = code;
  return error;
};

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const isActorAllowed = ({ actor, from, to }) => {
  const allowed = (ACTOR_PERMISSIONS[actor] || {})[from] || [];
  return allowed.includes(to);
};

const resolveHistoryActor = ({ actor, userId }) => ({
  actor,
  actorRole: actor,
  by: isValidObjectId(userId) ? userId : null,
});

const findOrder = async (orderIdOrCode) => {
  const key = String(orderIdOrCode || '').trim();
  if (!key) return null;

  if (isValidObjectId(key)) {
    return Order.findById(key);
  }

  return Order.findOne({ code: key.toUpperCase() });
};

const restoreStockForOrder = async (order) => {
  const items = (order.items || []).map((item) => ({
    productId: item.product,
    variantSku: item.sku,
    qty: item.qty,
  }));

  try {
    await restoreStock(items);
  } catch (error) {
    console.error(
      `[order-status] hoan kho that bai cho don ${String(order._id)}: ${error.message}`,
    );
    throw orderError(
      'ORDER_RESTOCK_FAILED',
      'Đơn đã hủy nhưng hoàn kho thất bại, cần xử lý thủ công',
      500,
    );
  }
};

/**
 * Chuyển trạng thái đơn hàng bằng một CAS findOneAndUpdate, không transaction.
 *
 * @param {string|import('mongoose').Types.ObjectId} orderIdOrCode _id hoặc order.code
 * @param {string} to trạng thái đích
 * @param {{ actor?: string, userId?: string, note?: string, extra?: object }} options
 */
async function transition(orderIdOrCode, to, { actor = 'system', userId = null, note = '', extra = {} } = {}) {
  const order = await findOrder(orderIdOrCode);
  if (!order) {
    throw orderError('ORDER_NOT_FOUND', 'Đơn hàng không tồn tại', 404);
  }

  const targetStatus = String(to || '').trim();
  const from = order.status;

  if (!Order.canTransition(from, targetStatus)) {
    throw orderError(
      'ORDER_INVALID_TRANSITION',
      `Không thể chuyển đơn từ ${from} sang ${targetStatus}`,
      409,
    );
  }

  const actorName = String(actor || 'system').trim();
  if (!ACTORS.has(actorName)) {
    throw orderError('ORDER_FORBIDDEN_ROLE', `Actor ${actorName} không hợp lệ`, 403);
  }

  if (!isActorAllowed({ actor: actorName, from, to: targetStatus })) {
    throw orderError(
      'ORDER_FORBIDDEN_ROLE',
      `Vai trò ${actorName} không được chuyển đơn từ ${from} sang ${targetStatus}`,
      403,
    );
  }

  const extraInfo = extra && typeof extra === 'object' ? extra : {};
  const rawNote = note == null ? '' : String(note).trim();
  const at = new Date();
  const identity = resolveHistoryActor({ actor: actorName, userId });

  const $set = { status: targetStatus };
  const historyEntries = [];

  if (targetStatus === 'cancelled') {
    const reason =
      extraInfo.reason != null
        ? String(extraInfo.reason).trim()
        : rawNote;

    if (actorName === 'admin' && !reason) {
      throw orderError('ORDER_CANCEL_REASON_REQUIRED', 'Admin hủy đơn phải có lý do', 400);
    }

    $set.cancel = {
      reason,
      by: isValidObjectId(userId) ? userId : null,
      at,
    };
    $set.stockRestoredAt = at;

    const cancelNote = reason || rawNote;
    const historyNote =
      actorName === 'admin' && cancelNote
        ? `[role:admin] ${cancelNote}`
        : cancelNote;

    historyEntries.push({
      status: targetStatus,
      at,
      note: historyNote,
      ...identity,
    });
  } else if (targetStatus === 'shipping') {
    const carrier = extraInfo.carrier != null ? String(extraInfo.carrier).trim() : '';
    const trackingCode =
      extraInfo.trackingCode != null ? String(extraInfo.trackingCode).trim() : '';

    if (!carrier || !trackingCode) {
      throw orderError(
        'ORDER_SHIPPING_INFO_REQUIRED',
        'Bàn giao vận chuyển phải có carrier và trackingCode',
        400,
      );
    }

    $set['shipment.carrier'] = carrier;
    $set['shipment.trackingCode'] = trackingCode;
    $set['shipment.shippedAt'] = at;

    const historyNote = rawNote;
    historyEntries.push({
      status: targetStatus,
      at,
      note: actorName === 'admin' && historyNote ? `[role:admin] ${historyNote}` : historyNote,
      ...identity,
    });
  } else if (targetStatus === 'delivered') {
    $set['shipment.deliveredAt'] = at;
    $set.adminConfirmedAt = at;

    if (order.paymentMethod === 'cod') {
      $set.paymentStatus = 'paid';
    }

    historyEntries.push({
      status: 'delivered',
      at,
      note: 'Đơn vị vận chuyển xác nhận giao thành công',
      actor: 'carrier',
      actorRole: 'carrier',
      by: identity.by,
    });
    historyEntries.push({
      status: 'delivered',
      at,
      note: 'Hệ thống tự động xác nhận phía quản trị',
      actor: 'system',
      actorRole: 'system',
      by: null,
    });
  } else if (targetStatus === 'completed') {
    $set.completedAt = at;

    historyEntries.push({
      status: targetStatus,
      at,
      note: rawNote,
      ...identity,
    });
  } else {
    const historyNote =
      actorName === 'admin' && rawNote ? `[role:admin] ${rawNote}` : rawNote;

    historyEntries.push({
      status: targetStatus,
      at,
      note: historyNote,
      ...identity,
    });
  }

  const $push = {
    statusHistory:
      historyEntries.length > 1 ? { $each: historyEntries } : historyEntries[0],
  };

  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: from },
    { $set, $push },
    { new: true, runValidators: true },
  );

  if (!updated) {
    throw orderError('ORDER_STATUS_CONFLICT', CONFLICT_MESSAGE, 409);
  }

  if (targetStatus === 'cancelled') {
    await restoreStockForOrder(order);
  }

  if (targetStatus === 'completed') {
    await require('./salesStatsService').recordCompletedOrder(updated);
  }

  updated.from = from;
  return updated;
}

/**
 * Xac nhan da nhan tien cho don bank_transfer.
 * Khong doi status don; chi cap nhat paymentStatus bang CAS de tranh race.
 */
async function markPaid(orderIdOrCode, { userId = null, note = '' } = {}) {
  const order = await findOrder(orderIdOrCode);
  if (!order) {
    throw orderError('ORDER_NOT_FOUND', 'Đơn hàng không tồn tại', 404);
  }

  if (order.paymentMethod !== 'bank_transfer') {
    throw orderError(
      'ORDER_PAYMENT_METHOD_INVALID',
      'Chỉ đơn chuyển khoản mới được đánh dấu nhận tiền',
      409,
    );
  }

  if (order.paymentStatus === 'paid') {
    return order;
  }

  const at = new Date();
  const rawNote = note == null ? '' : String(note).trim();
  const identity = resolveHistoryActor({ actor: 'admin', userId });

  const updated = await Order.findOneAndUpdate(
    { _id: order._id, paymentStatus: 'unpaid' },
    {
      $set: { paymentStatus: 'paid' },
      $push: {
        statusHistory: {
          status: order.status,
          at,
          note: rawNote
            ? `[role:admin] ${rawNote}`
            : 'Admin xác nhận đã nhận tiền chuyển khoản',
          ...identity,
        },
      },
    },
    { new: true, runValidators: true },
  );

  if (!updated) {
    throw orderError('ORDER_STATUS_CONFLICT', CONFLICT_MESSAGE, 409);
  }

  return updated;
}

module.exports = { transition, markPaid };
