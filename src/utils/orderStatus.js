const ORDER_STATUSES = Object.freeze([
  'pending',
  'confirmed',
  'shipping',
  'delivered',
  'completed',
  'cancelled',
]);

const ORDER_STATUS_LABELS = Object.freeze({
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao',
  delivered: 'Đã giao - chờ bạn xác nhận',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
});

const ORDER_STATUS_CLASSES = Object.freeze({
  pending: 'badge-soft',
  confirmed: 'badge-outline',
  shipping: 'badge-outline',
  delivered: 'badge-soft',
  completed: 'badge-soft',
  cancelled: 'badge-danger',
});

const ORDER_ACTORS = Object.freeze(['customer', 'admin', 'carrier', 'system']);

const ACTOR_LABELS = Object.freeze({
  customer: 'Khách hàng',
  admin: 'Quản trị viên',
  carrier: 'Đơn vị vận chuyển',
  system: 'Hệ thống',
});

const getStatusLabel = (status) =>
  ORDER_STATUS_LABELS[status] || status || 'Không xác định';

const getStatusClass = (status) =>
  ORDER_STATUS_CLASSES[status] || 'badge-soft';

const getActorLabel = (actor) => ACTOR_LABELS[actor] || actor || '';

module.exports = {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_CLASSES,
  ORDER_STATUS_BADGES: ORDER_STATUS_CLASSES,
  ORDER_ACTORS,
  ACTOR_LABELS,
  getStatusLabel,
  getStatusClass,
  getActorLabel,
};
