/**
 * Quy tắc SKU biến thể theo tài liệu thiết kế CSDL (mục "Mã SKU biến thể"):
 *   SP-{CAT}-{NNN}-{SIZE}-{COLOR}
 *
 * - {CAT}: một trong các prefix danh mục bên dưới.
 * - {NNN}: 001-999, tăng dần theo danh mục, không tái sử dụng.
 * - {SIZE}/{COLOR}: chữ in hoa, không dấu, không khoảng trắng.
 *
 * Regex bám đúng đặc tả đã chốt (3 chữ số). Quy tắc "vượt 999 mở rộng
 * 4 chữ số" cần team cập nhật lại regex trước khi sử dụng.
 */
const SKU_REGEX =
  /^SP-(AO|QU|VY|DM|PK|GD|TN)-\d{3}-[A-Z0-9]{1,5}-[A-Z0-9]{1,10}$/;

const CATEGORY_PREFIXES = Object.freeze({
  AO: 'Áo',
  QU: 'Quần',
  VY: 'Váy',
  DM: 'Đầm',
  PK: 'Phụ kiện',
  GD: 'Giày dép',
  TN: 'Túi xách',
});

const normalizePart = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'D')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

const buildSku = ({ prefix, sequence, size, color }) => {
  const categoryPrefix = normalizePart(prefix);

  if (!CATEGORY_PREFIXES[categoryPrefix]) {
    throw new Error(
      `Prefix danh mục không hợp lệ: ${prefix}. Cho phép: ${Object.keys(
        CATEGORY_PREFIXES,
      ).join(', ')}`,
    );
  }

  const numericSequence = Number(sequence);

  if (
    !Number.isInteger(numericSequence) ||
    numericSequence < 1 ||
    numericSequence > 999
  ) {
    throw new Error('Số thứ tự SKU phải là số nguyên trong khoảng 001-999');
  }

  const sizePart = normalizePart(size);
  const colorPart = normalizePart(color);

  if (!sizePart || sizePart.length > 5) {
    throw new Error('Size trong SKU phải có 1-5 ký tự chữ/số');
  }

  if (!colorPart || colorPart.length > 10) {
    throw new Error('Màu trong SKU phải có 1-10 ký tự chữ/số');
  }

  const sku = `SP-${categoryPrefix}-${String(numericSequence).padStart(
    3,
    '0',
  )}-${sizePart}-${colorPart}`;

  if (!SKU_REGEX.test(sku)) {
    throw new Error(`SKU không đúng định dạng: ${sku}`);
  }

  return sku;
};

module.exports = {
  SKU_REGEX,
  CATEGORY_PREFIXES,
  normalizePart,
  buildSku,
};
