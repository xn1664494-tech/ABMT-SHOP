const ORDER_SUMMARY_FIELDS = 'code status total createdAt user paymentStatus items';
const ORDER_RECENT_FIELDS = 'code createdAt total user';
const ADMIN_ORDER_LIST_FIELDS =
  'code status total createdAt user paymentMethod paymentStatus shippingAddress items';

module.exports = {
  ORDER_SUMMARY_FIELDS,
  ORDER_RECENT_FIELDS,
  ADMIN_ORDER_LIST_FIELDS,
};
