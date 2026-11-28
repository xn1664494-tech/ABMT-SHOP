const Order = require('../model/Order');
const User = require('../model/User');
const { escapeRegex, buildPagination } = require('../utils/productFilter');
const orderPresentation = require('../utils/orderPresentation');
const orderStatus = require('../utils/orderStatus');

const PAGE_SIZE = 15;

const toText = (value) => {
  if (value === undefined || value === null || Array.isArray(value)) return '';
  return String(value).trim().slice(0, 100);
};

const listOrders = async (query = {}) => {
  const { page, limit, skip } = buildPagination({
    page: query.page,
    limit: String(PAGE_SIZE),
  });

  const status = toText(query.status);
  const filter = {};
  if (status && status !== 'all' && orderStatus.ORDER_STATUSES.includes(status)) {
    filter.status = status;
  }

  const keyword = toText(query.q);
  if (keyword) {
    const pattern = new RegExp(escapeRegex(keyword), 'i');
    let userIds = [];
    try {
      userIds = (await User.find({ name: pattern }).select('_id').lean()).map((u) => u._id);
    } catch (error) {
      userIds = [];
    }
    const clauses = [
      { code: pattern },
      { 'shippingAddress.fullName': pattern },
      { 'shippingAddress.phone': pattern },
    ];
    if (userIds.length) clauses.push({ user: { $in: userIds } });
    filter.$or = clauses;
  }

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'name')
      .lean(),
    Order.countDocuments(filter),
  ]);

  const items = orders.map((order) => {
    const recipient =
      (order.shippingAddress && order.shippingAddress.fullName) ||
      (order.user && order.user.name) ||
      'Khách hàng';
    const phone = (order.shippingAddress && order.shippingAddress.phone) || '';
    const currentStatus = order.status || 'pending';

    return {
      id: String(order._id),
      code: order.code || '-',
      createdAtLabel: orderPresentation.formatDate(order.createdAt),
      totalLabel: orderPresentation.formatCurrency(order.total),
      status: currentStatus,
      statusLabel: orderStatus.getStatusLabel(currentStatus),
      statusClass: orderStatus.getStatusClass(currentStatus),
      recipient,
      phone,
      paymentMethodLabel: orderPresentation.getPaymentMethodLabel(order.paymentMethod),
      paymentStatusLabel: orderPresentation.getPaymentStatusLabel(order.paymentStatus),
      itemsCount: (order.items || []).reduce(
        (sum, item) => sum + (Number(item.qty) || 0),
        0,
      ),
    };
  });

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      itemCount: items.length,
    },
  };
};

const getOrderByCode = async (code) => {
  const key = toText(code);
  if (!key) return null;

  let order = null;
  try {
    order = await Order.findOne({ code: key.toUpperCase() }).populate('user', 'name email').lean();
  } catch (error) {
    order = null;
  }
  if (!order) return null;

  const address = order.shippingAddress || {};
  const addressLines = [
    address.detail,
    address.ward,
    address.district,
    address.province,
  ].filter(Boolean);
  const currentStatus = order.status || 'pending';

  return {
    id: String(order._id),
    code: order.code || '-',
    createdAtLabel: orderPresentation.formatDate(order.createdAt),
    updatedAtLabel: orderPresentation.formatDate(order.updatedAt),
    status: currentStatus,
    statusLabel: orderStatus.getStatusLabel(currentStatus),
    statusClass: orderStatus.getStatusClass(currentStatus),
    customer: {
      name: (order.user && order.user.name) || address.fullName || 'Khách hàng',
      email: (order.user && order.user.email) || '',
      phone: address.phone || '-',
    },
    shipping: {
      fullName: address.fullName || '-',
      phone: address.phone || '-',
      address: addressLines.join(', ') || '-',
    },
    items: (order.items || []).map((item) => ({
      name: item.name || 'Sản phẩm',
      image: item.image || '',
      sku: item.sku || '-',
      size: item.size || '-',
      color: item.color || '-',
      qty: Number(item.qty) || 0,
      unitPriceLabel: orderPresentation.formatCurrency(item.unitPrice),
      lineTotalLabel: orderPresentation.formatCurrency(item.lineTotal),
    })),
    subtotalLabel: orderPresentation.formatCurrency(order.subtotal),
    shippingFeeLabel: orderPresentation.formatCurrency(order.shippingFee),
    discountLabel: orderPresentation.formatCurrency(order.discount),
    totalLabel: orderPresentation.formatCurrency(order.total),
    paymentMethod: order.paymentMethod || 'cod',
    paymentMethodLabel: orderPresentation.getPaymentMethodLabel(order.paymentMethod),
    paymentStatus: order.paymentStatus || 'unpaid',
    paymentStatusLabel: orderPresentation.getPaymentStatusLabel(order.paymentStatus),
    note: order.note || '',
    shipment: {
      carrier: (order.shipment && order.shipment.carrier) || '',
      trackingCode: (order.shipment && order.shipment.trackingCode) || '',
      shippedAtLabel: orderPresentation.formatDate(
        order.shipment && order.shipment.shippedAt,
      ),
      deliveredAtLabel: orderPresentation.formatDate(
        order.shipment && order.shipment.deliveredAt,
      ),
    },
    cancel: order.cancel
      ? {
          reason: order.cancel.reason || '',
          atLabel: orderPresentation.formatDate(order.cancel.at),
        }
      : null,
    statusHistory: (order.statusHistory || []).map((entry) => ({
      status: entry.status || 'pending',
      statusLabel: orderStatus.getStatusLabel(entry.status),
      atLabel: orderPresentation.formatDate(entry.at),
      note: entry.note || '',
      actor: entry.actor || entry.actorRole || 'system',
      actorLabel: orderStatus.getActorLabel(entry.actor || entry.actorRole || 'system'),
    })),
    actions: {
      confirm: currentStatus === 'pending',
      ship: currentStatus === 'confirmed',
      cancel: currentStatus === 'pending' || currentStatus === 'confirmed',
      markPaid:
        order.paymentMethod === 'bank_transfer' &&
        order.paymentStatus !== 'paid' &&
        currentStatus !== 'cancelled',
      simulateDelivery:
        currentStatus === 'shipping' &&
        (process.env.NODE_ENV !== 'production' ||
          process.env.ALLOW_CARRIER_SIMULATION === 'true'),
    },
  };
};

const pendingCount = async () => {
  try {
    return await Order.countDocuments({ status: 'pending' });
  } catch (error) {
    return 0;
  }
};

module.exports = { listOrders, getOrderByCode, pendingCount };
