/**
 * Đọc thông điệp flash cho các trang EJS.
 *
 * Nguồn dữ liệu:
 * - Query: `?flash=...&type=...`, `?success=...`, `?error=...`
 * - Cookie `flash` chứa JSON (một object hoặc mảng object { type, message }).
 *
 * Hàm thuần, không đọc/ghi DB, luôn trả về mảng để view/partial xử lý an toàn.
 */
const normalizeMessage = (item) => {
  if (!item) return null;
  if (typeof item === 'string') return { type: 'info', message: item };
  if (typeof item === 'object' && item.message) {
    return { type: item.type || 'info', message: String(item.message) };
  }
  return null;
};

const parseCookieFlash = (raw) => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list.map(normalizeMessage).filter(Boolean);
  } catch (error) {
    return [];
  }
};

const getFlash = (req = {}) => {
  const messages = [];

  if (req.cookies && req.cookies.flash) {
    messages.push(...parseCookieFlash(req.cookies.flash));
  }

  const query = req.query || {};
  if (query.flash) {
    messages.push({ type: query.type || 'info', message: String(query.flash) });
  }
  if (query.success) {
    messages.push({ type: 'success', message: String(query.success) });
  }
  if (query.error) {
    messages.push({ type: 'error', message: String(query.error) });
  }

  return messages;
};

module.exports = { getFlash };
