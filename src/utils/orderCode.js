/**
 * Mã đơn theo quy tắc đã chốt: ORD-YYYYMMDD-XXXXXX.
 * XXXXXX là 6 ký tự cuối ObjectId (hex, in hoa) → unique, không cần counter.
 */
const ORDER_CODE_REGEX = /^ORD-\d{8}-[0-9A-F]{6}$/;

const pad = (value, length = 2) => String(value).padStart(length, '0');

const formatDatePart = (date) =>
  `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;

const buildOrderCode = ({ id, date = new Date() } = {}) => {
  if (!id) {
    throw new Error('Thiếu ObjectId để sinh mã đơn');
  }

  const suffix = String(id).slice(-6).toUpperCase();

  if (!/^[0-9A-F]{6}$/.test(suffix)) {
    throw new Error('ObjectId không hợp lệ để sinh mã đơn');
  }

  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error('Ngày tạo mã đơn không hợp lệ');
  }

  return `ORD-${formatDatePart(date)}-${suffix}`;
};

module.exports = {
  ORDER_CODE_REGEX,
  buildOrderCode,
};
