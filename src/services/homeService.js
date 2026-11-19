const fs = require('fs');
const path = require('path');
const Product = require('../model/Products');

const PLACEHOLDER_IMAGE = '/images/placeholder/product.svg';
const MEN_ROOT_SLUG = 'nam';
const WOMEN_ROOT_SLUG = 'nu';
const DELIVERED_STATUS = 'delivered';
const BEST_SELLER_RANGE_DAYS = 30;
const MAX_NAV_CHILDREN = 6;

// Nạp model tùy chọn: dự án hiện chỉ có Product, các model khác sẽ tự dùng khi được bổ sung.
const loadModel = (...fileNames) => {
  for (const fileName of fileNames) {
    const filePath = path.join(__dirname, '..', 'model', `${fileName}.js`);
    if (fs.existsSync(filePath)) return require(filePath);
  }
  return null;
};

const Category = loadModel('Category', 'Categories');
const Order = loadModel('Order', 'Orders');
const Voucher = loadModel('Voucher', 'Vouchers');

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
const toCard = (product, salePrice = null) => ({
  name: product.title,
  slug: product.slug,
  image: (product.images && product.images[0]) || PLACEHOLDER_IMAGE,
  price: product.price,
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
    .select('title slug images price')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return products.map((product) => toCard(product));
};

const getSaleProducts = async (limit = 8) => {
  // TODO: chờ chốt trường giá gốc — model Product hiện chưa có originalPrice/salePrice.
  return [];
};

// Đơn đã giao trong 30 ngày gần nhất, cộng dồn số lượng bán theo từng sản phẩm.
const getBestSellers = async (limit = 8) => {
  if (!Order) return [];

  const since = new Date(Date.now() - BEST_SELLER_RANGE_DAYS * 24 * 60 * 60 * 1000);

  const ranking = await Order.aggregate([
    { $match: { status: DELIVERED_STATUS, createdAt: { $gte: since } } },
    { $unwind: '$items' },
    { $group: { _id: '$items.product', totalSold: { $sum: '$items.quantity' } } },
    { $sort: { totalSold: -1 } },
    { $limit: limit },
  ]);

  if (!ranking.length) return [];

  const products = await Product.find({
    ...productActiveFilter(),
    _id: { $in: ranking.map((item) => item._id) },
  })
    .select('title slug images price')
    .lean();

  const productMap = new Map(products.map((product) => [String(product._id), product]));

  return ranking
    .map((item) => productMap.get(String(item._id)))
    .filter(Boolean)
    .map((product) => toCard(product));
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
  getNavCategories,
  getNewProductsByRoot,
  getSaleProducts,
  getBestSellers,
  getVouchers,
  getHomeData,
};
