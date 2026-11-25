const Category = require('../model/Category');
const Product = require('../model/Products');

const PLACEHOLDER = '/images/placeholder/product.svg';

const buildCard = (product) => {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const totalStock = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
  return {
    name: product.name,
    slug: product.slug,
    image: (Array.isArray(product.images) && product.images[0]) || PLACEHOLDER,
    price: Number(product.basePrice) || 0,
    salePrice: null,
    outOfStock: totalStock <= 0,
  };
};

const getRootChildren = async (rootSlug) => {
  const root = await Category.findOne({ slug: rootSlug, isDeleted: false }).select('_id name slug').lean();
  if (!root) return { root: null, categoryIds: [] };
  const children = await Category.find({ parentId: root._id, isDeleted: false })
    .select('_id name slug order')
    .sort({ order: 1, name: 1 })
    .limit(6)
    .lean();
  return { root, children, categoryIds: [root._id, ...children.map((c) => c._id)] };
};

const getNewProducts = async (categoryIds, limit = 4) => {
  if (!categoryIds.length) return [];
  const products = await Product.find({ isDeleted: false, isActive: true, category: { $in: categoryIds } })
    .select('name slug images basePrice variants')
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean();
  return products.map(buildCard);
};

const getFallback = () => ({
  vouchers: [
    { code: 'GIAM30K', desc: 'Giảm 30.000đ', note: 'Áp dụng cho đơn phù hợp' },
    { code: 'GIAM10', desc: 'Giảm 10%', note: 'Áp dụng cho đơn phù hợp' },
    { code: 'KHACHMOI', desc: 'Giảm 50.000đ', note: 'Dành cho khách mới' }
  ],
  categories: [],
  productsNewMen: [],
  productsNewWomen: [],
  productsSale: [],
  productsBestSeller: [],
});

const HomeController = {
  async index(req, res, next) {
    try {
      const fallback = getFallback();
      const [men, women, latest] = await Promise.all([
        getRootChildren('nam'),
        getRootChildren('nu'),
        Product.find({ isDeleted: false, isActive: true })
          .select('name slug images basePrice variants createdAt')
          .sort({ createdAt: -1, _id: -1 })
          .limit(8)
          .lean(),
      ]);

      const [productsNewMen, productsNewWomen] = await Promise.all([
        getNewProducts(men.categoryIds, 4),
        getNewProducts(women.categoryIds, 4),
      ]);

      const categories = [];
      if (men.root) {
        categories.push({
          slug: men.root.slug,
          name: men.root.name,
          note: 'Xem tất cả đồ nam',
          url: '/catalog?category=nam',
          children: (men.children || []).map((c) => ({ name: c.name, slug: c.slug, url: `/catalog?category=${encodeURIComponent(c.slug)}` })),
        });
      }
      if (women.root) {
        categories.push({
          slug: women.root.slug,
          name: women.root.name,
          note: 'Xem tất cả đồ nữ',
          url: '/catalog?category=nu',
          children: (women.children || []).map((c) => ({ name: c.name, slug: c.slug, url: `/catalog?category=${encodeURIComponent(c.slug)}` })),
        });
      }

      const bestCards = latest.map(buildCard);
      res.render('pages/home', {
        title: 'ABMT SHOP - Trang chủ',
        vouchers: fallback.vouchers,
        categories,
        productsNewMen,
        productsNewWomen,
        productsSale: [],
        productsBestSeller: bestCards,
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = HomeController;
