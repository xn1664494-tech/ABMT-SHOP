const Category = require('../model/Category');
const Product = require('../model/Products');

const presentation = require('../utils/productPresentation');

const buildCard = (product, categorySlug = '') => {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const totalStock = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
  const sellingPrice = presentation.getSellingPrice(product);
  const listPrice = presentation.getListPrice(product);
  return {
    name: product.name,
    slug: product.slug,
    image: (Array.isArray(product.images) && product.images[0]) || '',
    categorySlug,
    price: listPrice,
    salePrice: sellingPrice < listPrice ? sellingPrice : null,
    isNew: presentation.isNewProduct(product),
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
    .select('name slug images basePrice variants createdAt category')
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean();
  return products.map((product) => buildCard(product, String(product.category || '')));
};

const getFallback = () => ({
  vouchers: [
    { code: 'GIAM30K', desc: 'Giảm 30.000đ', note: 'Cho đơn từ 300.000đ · HSD 30/11/2026' },
    { code: 'GIAM10', desc: 'Giảm 10%, tối đa 50.000đ', note: 'Cho đơn từ 400.000đ · HSD 31/12/2026' },
    { code: 'KHACHMOI', desc: 'Giảm 50.000đ', note: 'Đơn đầu tiên từ 250.000đ · HSD 31/12/2026' }
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
          .select('name slug images basePrice variants createdAt category')
          .sort({ createdAt: -1, _id: -1 })
          .limit(8)
          .lean(),
      ]);
      const saleProducts = await Product.find({ isDeleted: false, isActive: true })
        .select('name slug images basePrice variants createdAt category')
        .lean();
      const saleCards = saleProducts
        .filter((product) => presentation.isSaleProduct(product))
        .slice(0, 8)
        .map((product) => buildCard(product, String(product.category || '')));

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

      const bestCards = latest.map((product) => buildCard(product, String(product.category || '')));
      res.render('pages/home', {
        title: 'ABMT SHOP - Trang chủ',
        vouchers: fallback.vouchers,
        categories,
        productsNewMen,
        productsNewWomen,
        productsSale: saleCards,
        productsBestSeller: bestCards,
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = HomeController;
