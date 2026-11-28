const SALES_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const DAY_MS = 24 * 60 * 60 * 1000;

const dayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: SALES_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Chuyển một thời điểm sang ngày 'YYYY-MM-DD' theo múi giờ Asia/Ho_Chi_Minh.
 */
function toSalesDay(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = dayFormatter.formatToParts(date);
  const map = {};
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }

  return `${map.year}-${map.month}-${map.day}`;
}

/**
 * Dịch một ngày 'YYYY-MM-DD' thêm/bớt số ngày (không phụ thuộc múi giờ máy chạy).
 */
function shiftSalesDay(day, days) {
  const date = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Ngày đầu tiên của cửa sổ N ngày gần nhất (tính cả hôm nay).
 */
function getSalesWindowStartDay(days, now = new Date()) {
  const safeDays = Number.isFinite(Number(days)) && Number(days) >= 1
    ? Math.trunc(Number(days))
    : 1;
  const today = toSalesDay(now);
  return shiftSalesDay(today, -(safeDays - 1));
}

/**
 * Mốc UTC tương ứng 00:00 của một ngày theo Asia/Ho_Chi_Minh (UTC+7, không DST).
 */
function startOfSalesDayUtc(day) {
  const date = new Date(`${day}T00:00:00.000+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

module.exports = {
  SALES_TIME_ZONE,
  DAY_MS,
  toSalesDay,
  shiftSalesDay,
  getSalesWindowStartDay,
  startOfSalesDayUtc,
};
