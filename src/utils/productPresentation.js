const NEW_PRODUCT_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const PLACEHOLDER_HOST = 'cdn.example.com';

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

/** Giá bán hiện tại: giá biến thể nhỏ nhất nếu thấp hơn giá niêm yết. */
const getSellingPrice = (product = {}) => {
  const base = toNumber(product.basePrice);
  const prices = (Array.isArray(product.variants) ? product.variants : [])
    .map((variant) => toNumber(variant.price))
    .filter((price) => price > 0);
  if (!prices.length) return base;
  const lowest = Math.min(...prices);
  return lowest > 0 && lowest < base ? lowest : base;
};

const getListPrice = (product = {}) => toNumber(product.basePrice);

const isSaleProduct = (product = {}) => getSellingPrice(product) < getListPrice(product);

/** Quy tắc "Mới" dùng chung trang chủ và catalog: tạo trong 30 ngày gần nhất. */
const isNewProduct = (product = {}, now = Date.now()) => {
  if (!product.createdAt) return false;
  const created = new Date(product.createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  return created <= now && now - created <= NEW_PRODUCT_DAYS * DAY_MS;
};

/** Ưu tiên Giảm giá nếu có cả hai. */
const getProductBadge = (product = {}, now = Date.now()) => {
  if (isSaleProduct(product)) return 'Giảm giá';
  if (isNewProduct(product, now)) return 'Mới';
  return null;
};

const hasRealImage = (image) => {
  if (typeof image !== 'string' || !image.trim()) return false;
  if (image.includes(PLACEHOLDER_HOST)) return false;
  if (image.includes('/images/placeholder/')) return false;
  return /^(\/|https?:\/\/)/i.test(image.trim());
};

const SYMBOLS = {
  'ao-thun': 'i-tee',
  'ao-so-mi': 'a-shirt',
  'ao-khoac': 'a-jacket',
  'quan-dai': 'a-pants',
  'quan-short': 'a-shorts',
  'vay-dam': 'a-dress',
  'chan-vay': 'a-skirt',
};

const KEYWORDS = [
  ['quần short', 'a-shorts'],
  ['short', 'a-shorts'],
  ['chân váy', 'a-skirt'],
  ['váy', 'a-dress'],
  ['đầm', 'a-dress'],
  ['dress', 'a-dress'],
  ['khoác', 'a-jacket'],
  ['áo khoác', 'a-jacket'],
  ['sơ mi', 'a-shirt'],
  ['polo', 'a-shirt'],
  ['quần', 'a-pants'],
  ['áo thun', 'i-tee'],
  ['tee', 'i-tee'],
];

/** Chọn symbol theo slug danh mục, sau đó theo từ khóa tên, mặc định i-tee. */
const resolveArtSymbol = (product = {}) => {
  const slug = String(product.categorySlug || product.category || '');
  for (const key of Object.keys(SYMBOLS)) {
    if (slug.includes(key)) return SYMBOLS[key];
  }
  const name = String(product.name || '').toLowerCase();
  for (const [keyword, symbol] of KEYWORDS) {
    if (name.includes(keyword)) return symbol;
  }
  return 'i-tee';
};

const PASTELS = ['art-sky', 'art-mint', 'art-peach', 'art-lilac'];

const resolveArtClass = (index = 0) => PASTELS[Math.abs(Number(index) || 0) % PASTELS.length];

const formatVND = (value) => `${toNumber(value).toLocaleString('vi-VN')}₫`;

module.exports = {
  NEW_PRODUCT_DAYS,
  getSellingPrice,
  getListPrice,
  isSaleProduct,
  isNewProduct,
  getProductBadge,
  hasRealImage,
  resolveArtSymbol,
  resolveArtClass,
  formatVND,
};
