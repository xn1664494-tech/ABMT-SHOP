const fs = require('fs');
const path = require('path');
const Product = require('../model/Products');
const {
  getSalesWindowStartDay,
} = require('../utils/salesDate');

const PLACEHOLDER_IMAGE = '/images/placeholder/product.svg';
const MEN_ROOT_SLUG = 'nam';
const WOMEN_ROOT_SLUG = 'nu';
const MAX_NAV_CHILDREN = 6;

const BEST_SELLER_DEFAULT_WINDOW_DAYS = 90;
const BEST_SELLER_DEFAULT_MIN_UNITS = 5;
const BEST_SELLER_RECENT_DAYS = 30;
const BEST_SELLER_CACHE_TTL_MS = 10 * 60 * 1000;
const bestSellerCache = new Map();

// Chuẩn hóa URL ảnh thẻ sản phẩm: luôn trả về đường dẫn dùng được.
const normalizeImageUrl = (value) => {
  if (typeof value !== 'string') return PLACEHOLDER_IMAGE;

  const trimmed = value.trim();
  if (!trimmed) return PLACEHOLDER_IMAGE;

  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.charAt(0) === '/') return trimmed;

  // Có scheme khác (data:, javascript:, ftp:...) -> không dùng.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return PLACEHOLDER_IMAGE;

  // Đường dẫn tương đối (images/a.jpg, ./uploads/a.jpg) -> thêm '/' ở đầu.
  return '/' + trimmed.replace(/^\.\//, '');
};

// Nạp model tùy chọn: dự án hiện chỉ có Product, các model khác sẽ tự dùng khi được bổ sung.
const loadModel = (...fileNames) => {
  for (const fileName of fileNames) {
    const filePath = path.join(__dirname, '..', 'model', `${fileName}.js`);
    if (fs.existsSync(filePath)) return require(filePath);
  }
  return null;
};

const Category = loadModel('Category', 'Categories');
const ProductSalesDaily = loadModel('ProductSalesDaily');
const Voucher = loadModel('Voucher', 'Vouchers');

// Đọc biến môi trường dạng số nguyên không âm, sai/thiếu thì dùng mặc định.
const readNonNegativeInt = (name, fallback, { min = 0 } = {}) => {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value) || value < min) return fallback;
  return Math.trunc(value);
};

// Chỉ thêm điều kiện xóa mềm/ngừng bán khi model Product thật sự có trường tương ứng.
const productActiveFilter = () => {
  const filter = {};
  if (Product.schema.path('isDeleted')) filter.isDeleted = { $ne: true };
  if (Product.schema.path('deletedAt')) filter.deletedAt = null;
  if (Product.schema.path('isActive')) filter.isActive = { $ne: false };
  if (Product.schema.path('status')) filter.status = 'active';
  return filter;
};

// Chuyển sản phẩm sang đúng dạng thẻ sản phẩm mà view đang dùng; giá giữ kiểu số.
// Product thật dùng name/basePrice, không phải title/price.
const toCard = (product, salePrice = null) => ({
  name: product.name,
  slug: product.slug,
  image: normalizeImageUrl(product.images && product.images[0]),
  price: product.basePrice,
  salePrice,
});

// Danh mục gốc đang hiển thị, kèm tối đa 6 danh mục con đang hiển thị.
const getNavCategories = async () => {
  if (!Category) return [];

  const roots = await Category.find({
    $or: [{ parentId: null }, { parentId: { $exists: false } }],
  })
    .select('name slug')
    .sort({ order: 1 })
    .limit(20)
    .lean();

  if (!roots.length) return [];

  const children = await Category.find({
    parentId: { $in: roots.map((root) => root._id) },
  })
    .select('name slug parentId')
    .sort({ order: 1 })
    .limit(120)
    .lean();

  const childrenByParent = new Map();
  for (const child of children) {
    const key = String(child.parentId);
    const list = childrenByParent.get(key) || [];
    if (list.length < MAX_NAV_CHILDREN) {
      list.push({ name: child.name, slug: child.slug });
    }
    childrenByParent.set(key, list);
  }

  return roots.map((root) => ({
    name: root.name,
    slug: root.slug,
    children: childrenByParent.get(String(root._id)) || [],
  }));
};

// Sản phẩm mới nhất thuộc danh mục gốc và toàn bộ danh mục con của nó.
const getNewProductsByRoot = async (rootSlug, limit = 4) => {
  if (!Category) return [];

  const root = await Category.findOne({ slug: rootSlug }).select('_id').lean();
  if (!root) return [];

  const children = await Category.find({ parentId: root._id })
    .select('_id')
    .limit(100)
    .lean();

  const categoryIds = [root._id, ...children.map((child) => child._id)];

  const products = await Product.find({
    ...productActiveFilter(),
    category: { $in: categoryIds },
  })
    .select('name slug images basePrice')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return products.map((product) => toCard(product));
};

const getSaleProducts = async (limit = 8) => {
  // TODO: chờ chốt trường giá gốc — model Product hiện chưa có originalPrice/salePrice.
  return [];
};

// Xếp hạng bán chạy từ ProductSalesDaily trong cửa sổ ngày cấu hình được.
// Chỉ lấy sản phẩm đang active, chưa xóa; cache trong bộ nhớ 10 phút.
const getBestSellers = async (limit = 8) => {
  if (!ProductSalesDaily) return [];

  const safeLimit = Math.max(1, Math.trunc(Number(limit) || 8));
  const windowDays = readNonNegativeInt(
    'BEST_SELLER_WINDOW_DAYS',
    BEST_SELLER_DEFAULT_WINDOW_DAYS,
    { min: 1 },
  );
  const minUnits = readNonNegativeInt(
    'BEST_SELLER_MIN_UNITS',
    BEST_SELLER_DEFAULT_MIN_UNITS,
  );

  const cacheKey = `${windowDays}:${minUnits}:${safeLimit}`;
  const now = Date.now();
  const cached = bestSellerCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.data;

  const windowStart = getSalesWindowStartDay(windowDays);
  const recentStart = getSalesWindowStartDay(BEST_SELLER_RECENT_DAYS);

  const ranking = await ProductSalesDaily.aggregate([
    { $match: { day: { $gte: windowStart } } },
    {
      $group: {
        _id: '$product',
        units: { $sum: '$units' },
        revenue: { $sum: '$revenue' },
        recentUnits: {
          $sum: {
            $cond: [{ $gte: ['$day', recentStart] }, '$units', 0],
          },
        },
      },
    },
    { $match: { units: { $gte: minUnits } } },
    { $sort: { units: -1, recentUnits: -1, revenue: -1, _id: 1 } },
    { $limit: safeLimit },
  ]);

  if (!ranking || ranking.length === 0) {
    bestSellerCache.set(cacheKey, {
      data: [],
      expiresAt: now + BEST_SELLER_CACHE_TTL_MS,
    });
    return [];
  }

  const products = await Product.find({
    ...productActiveFilter(),
    _id: { $in: ranking.map((row) => row._id) },
  })
    .select('name slug images basePrice')
    .lean();

  const productMap = new Map(
    products.map((product) => [String(product._id), product]),
  );

  const cards = ranking
    .map((row) => productMap.get(String(row._id)))
    .filter(Boolean)
    .map((product) => toCard(product));

  bestSellerCache.set(cacheKey, {
    data: cards,
    expiresAt: now + BEST_SELLER_CACHE_TTL_MS,
  });

  return cards;
};

const clearBestSellerCache = () => {
  bestSellerCache.clear();
};

const formatDate = (value) => {
  const date = new Date(value);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
};

// Voucher đang bật, còn hạn và còn lượt sử dụng.
const getVouchers = async (limit = 3) => {
  if (!Voucher) return [];

  const now = new Date();

  const vouchers = await Voucher.find({
    isActive: true,
    startAt: { $lte: now },
    expireAt: { $gte: now },
    $or: [
      { usageLimit: null },
      { $expr: { $lt: ['$usedCount', '$usageLimit'] } },
    ],
  })
    .select('code discountType discountValue minOrderValue expireAt')
    .sort({ expireAt: 1 })
    .limit(limit)
    .lean();

  return vouchers.map((voucher) => {
    const discount =
      voucher.discountType === 'percent'
        ? `Giảm ${voucher.discountValue}%`
        : `Giảm ${Number(voucher.discountValue || 0).toLocaleString('vi-VN')}₫`;

    const minOrder = voucher.minOrderValue
      ? `Đơn từ ${Number(voucher.minOrderValue).toLocaleString('vi-VN')}₫`
      : 'Không yêu cầu đơn tối thiểu';

    return {
      code: voucher.code,
      desc: discount,
      note: `${minOrder} · HSD ${formatDate(voucher.expireAt)}`,
    };
  });
};

// Gom dữ liệu trang chủ, trả đúng tên biến mà view home đang dùng.
const getHomeData = async () => {
  const [
    categories,
    vouchers,
    productsNewMen,
    productsNewWomen,
    productsSale,
    productsBestSeller,
  ] = await Promise.all([
    getNavCategories(),
    getVouchers(),
    getNewProductsByRoot(MEN_ROOT_SLUG),
    getNewProductsByRoot(WOMEN_ROOT_SLUG),
    getSaleProducts(),
    getBestSellers(),
  ]);

  return {
    categories,
    vouchers,
    productsNewMen,
    productsNewWomen,
    productsSale,
    productsBestSeller,
  };
};

module.exports = {
  normalizeImageUrl,
  getNavCategories,
  getNewProductsByRoot,
  getSaleProducts,
  getBestSellers,
  clearBestSellerCache,
  getVouchers,
  getHomeData,
};
