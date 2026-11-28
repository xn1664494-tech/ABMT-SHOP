const orderStatus = require('./orderStatus');

const ORDER_STATUS_LABELS = orderStatus.ORDER_STATUS_LABELS;
const ORDER_STATUS_CLASSES = orderStatus.ORDER_STATUS_CLASSES;

const PAYMENT_STATUS_LABELS = Object.freeze({
  unpaid: 'Chưa thanh toán',
  paid: 'Đã thanh toán',
  refunded: 'Đã hoàn tiền',
});

const PAYMENT_METHOD_LABELS = Object.freeze({
  cod: 'Thanh toán khi nhận hàng',
  bank_transfer: 'Chuyển khoản ngân hàng',
});

const formatCurrency = (value) => `${(Number(value) || 0).toLocaleString('vi-VN')}₫`;

const formatDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleString('vi-VN')
    : '-';
};

const getStatusLabel = orderStatus.getStatusLabel;
const getStatusClass = orderStatus.getStatusClass;

const getPaymentStatusLabel = (status) =>
  PAYMENT_STATUS_LABELS[status] || status || 'Không xác định';

const getPaymentMethodLabel = (method) =>
  PAYMENT_METHOD_LABELS[method] || method || 'Không xác định';

module.exports = {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_CLASSES,
  PAYMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  formatCurrency,
  formatDate,
  getStatusLabel,
  getStatusClass,
  getPaymentStatusLabel,
  getPaymentMethodLabel,
};
