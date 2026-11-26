const ORDER_STATUS_LABELS = Object.freeze({
  pending: 'Chờ xử lý',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy',
});

const ORDER_STATUS_CLASSES = Object.freeze({
  pending: 'badge-soft',
  confirmed: 'badge-outline',
  shipping: 'badge-outline',
  delivered: 'badge-soft',
  cancelled: 'badge-danger',
});

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

const getStatusLabel = (status) => ORDER_STATUS_LABELS[status] || status || 'Không xác định';

const getStatusClass = (status) => ORDER_STATUS_CLASSES[status] || 'badge-soft';

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
