const express = require('express');
const crypto = require('crypto');
const HomeController = require('../controllers/HomeController');
const CartRouter = require('../routes/cart.route');
const Cart = require('../model/Cart');
const Product = require('../model/Products');
const User = require('../model/User');
const Order = require('../model/Order');
const { ACCESS_COOKIE, verifyToken } = require('../services/tokenService');
const { calculateShippingFee } = require('../model/Order');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/appError');

const router = express.Router();

const extractAccessToken = (req) => {
  const cookieToken = req.cookies ? req.cookies[ACCESS_COOKIE] : undefined;
  if (cookieToken) {
    return cookieToken;
  }
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim();
  }
  return null;
};

const getCartId = (req) => {
  let cartId = req.cookies ? req.cookies.cartId : undefined;
  if (!cartId) {
    cartId = crypto.randomBytes(16).toString('hex');
  }
  return cartId;
};

const setCartCookie = (res, cartId) => {
  res.cookie('cartId', cartId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 ngày
  });
};

const isSafeNext = (next) => {
  if (typeof next !== 'string' || next === '') {
    return false;
  }
  if (!next.startsWith('/') || next.startsWith('//')) {
    return false;
  }
  if (next.includes('\\') || next.includes('://')) {
    return false;
  }
  return true;
};

// Helper: tính toán tóm tắt giỏ hàng từ items
const calcCartSummary = (items) => {
  const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
  const shippingFee = calculateShippingFee(subtotal);
  const total = subtotal + shippingFee;
  const count = items.reduce((sum, item) => sum + item.qty, 0);
  return { subtotal, shippingFee, total, count };
};

// Trang chủ (UI)
router.get('/', HomeController.index);

// Trang login
router.get('/login', (req, res) => {
  const error = req.query.error || '';
  const next = isSafeNext(req.query.next) ? req.query.next : '';
  res.render('pages/login', {
    title: 'Đăng nhập',
    locals: { error, next },
  });
});

// Trang đăng ký
router.get('/register', (req, res) => {
  res.render('pages/register', {
    title: 'Đăng ký'
  });
});

// Trang tài khoản của tôi (đích mặc định sau khi đăng nhập)
// Xác thực qua extractAccessToken + verifyToken (giữ nguyên cơ chế từ feature/dev3-account-route)
router.get('/account', asyncHandler(async (req, res, next) => {
  const token = extractAccessToken(req);
  if (!token) {
    return res.redirect(302, '/login?next=/account');
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch (error) {
    return res.redirect(302, '/login?next=/account');
  }

  if (payload.type === 'refresh') {
    return res.redirect(302, '/login?next=/account');
  }

  const user = await User.findById(payload.sub)
    .select('-password -resetPasswordTokenHash -resetPasswordExpires')
    .lean();

  if (!user || user.isDeleted || user.status !== 'active') {
    return res.redirect(302, '/login?next=/account');
  }

  if (Number(payload.ver || 0) !== Number(user.tokenVersion || 0)) {
    return res.redirect(302, '/login?next=/account');
  }

  const orders = await Order.find({ user: user._id })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  res.set('Cache-Control', 'no-store');
  res.render('pages/account', {
    title: 'Tài khoản của tôi',
    user,
    orders
  });
}));

// Trang giỏ hàng (HTML) — GET /cart trả HTML; các method khác (POST/PUT/DELETE/GET merge)
// được CartRouter xử lý vì được mount sau (Express matching theo thứ tự).
router.get('/cart', asyncHandler(async (req, res, next) => {
  const cartId = getCartId(req);
  let cart = await Cart.findOne({ sessionId: cartId });

  // Nếu đã đăng nhập (qua currentUser middleware), ưu tiên giỏ theo user, gộp giỏ sessionId vào nếu có
  if (res.locals.currentUser) {
    const userCart = await Cart.findOne({ user: res.locals.currentUser.id });
    if (cart && cart.items && cart.items.length > 0) {
      if (!userCart) {
        await Cart.updateOne(
          { sessionId: cartId },
          { $set: { user: res.locals.currentUser.id, sessionId: null, expiresAt: null } }
        );
        cart = await Cart.findOne({ sessionId: cartId });
      } else {
        const existingSkus = new Set((userCart.items || []).map((i) => i.sku));
        (cart.items || []).forEach((item) => {
          if (!existingSkus.has(item.sku)) {
            userCart.items.push(item);
          }
        });
        await userCart.save();
        await Cart.deleteOne({ sessionId: cartId });
        res.clearCookie('cartId');
      }
    }
    cart = userCart || cart;
  }

  const items = cart ? cart.items : [];
  const { subtotal, shippingFee, total, count } = calcCartSummary(items);

  res.render('pages/cart', {
    title: 'Giỏ hàng',
    locals: {
      empty: items.length === 0,
      items,
      subtotal,
      shippingFee,
      total,
      count,
    },
    cartCount: count,
  });
  setCartCookie(res, cartId);
}));

// Mount CartRouter cho API giỏ hàng (POST /cart/items, PUT /cart/items/:id, DELETE /cart/items/:id, GET /cart/merge).
// GET /cart đã được xử lý ở trên (đánh giá trước), nên CartRouter.get('/') không bị chồng lắp cho HTML.
router.use('/cart', CartRouter);

// Trang catalog (HTML)
router.get('/catalog', asyncHandler(async (req, res, next) => {
  const productService = require('../services/ProductsServices');
  const Category = require('../model/Category');

  const filters = {
    category: req.query.category,
    minPrice: req.query.minPrice,
    maxPrice: req.query.maxPrice,
    keyword: req.query.keyword,
    size: req.query.size,
    color: req.query.color,
    inStock: req.query.inStock,
    page: req.query.page,
    limit: req.query.limit,
    sort: req.query.sort,
  };

  const data = await productService.list(filters, {});
  const categories = await Category.find({ isDeleted: false }).sort({ order: 1, name: 1 }).lean();

  const allProducts = await Product.find({ isDeleted: false, isActive: true }).select('variants basePrice').lean();
  const sizes = [...new Set(allProducts.flatMap((p) => (p.variants || []).map((v) => v.size)).filter(Boolean))].sort();
  const colors = [...new Set(allProducts.flatMap((p) => (p.variants || []).map((v) => v.color)).filter(Boolean))].sort();

  res.render('pages/catalog', {
    title: 'Danh sách sản phẩm',
    categories,
    sizes,
    colors,
    products: data.items,
    pagination: data.pagination,
    currentPage: data.pagination.page,
    totalPages: data.pagination.totalPages,
    locals: {
      category: req.query.category || '',
      size: req.query.size || '',
      price_min: req.query.minPrice || '',
      price_max: req.query.maxPrice || '',
    },
    sortBy: req.query.sort || 'newest',
    cartCount: 0,
  });
}));

// Trang chi tiết sản phẩm (HTML)
router.get('/products/:slug', asyncHandler(async (req, res, next) => {
  const productService = require('../services/ProductsServices');

  const product = await Product.findOne({ slug: req.params.slug, isDeleted: false, isActive: true }).lean();
  if (!product) {
    throw new ErrorResponse('Sản phẩm không tồn tại', 404);
  }

  const related = await Product.find({
    category: product.category,
    _id: { $ne: product._id },
    isDeleted: false,
    isActive: true,
  })
    .select('name slug images basePrice variants')
    .limit(4)
    .lean();

  const variants = (product.variants || []).map((v) => ({
    id: String(v._id),
    size: v.size,
    color: v.color,
    colorCode: v.colorCode,
    sku: v.sku,
    stock: v.stock,
    price: v.price || product.basePrice,
    price_formatted: (v.price || product.basePrice).toLocaleString('vi-VN'),
  }));

  res.render('pages/product-detail', {
    title: product.name,
    product: {
      ...product,
      price: product.basePrice,
      basePrice: product.basePrice,
    },
    variants,
    productsRelated: related,
    cartCount: 0,
  });
}));

// Trang thanh toán (HTML) - yêu cầu đăng nhập
router.get('/checkout', asyncHandler(async (req, res, next) => {
  if (!res.locals.currentUser) {
    return res.redirect(302, '/login?next=/checkout');
  }

  const cartId = getCartId(req);
  let cart = await Cart.findOne({ sessionId: cartId });

  if (res.locals.currentUser) {
    const userCart = await Cart.findOne({ user: res.locals.currentUser.id });
    if (cart && cart.items && cart.items.length > 0) {
      if (!userCart) {
        await Cart.updateOne(
          { sessionId: cartId },
          { $set: { user: res.locals.currentUser.id, sessionId: null, expiresAt: null } }
        );
        cart = await Cart.findOne({ sessionId: cartId });
      } else {
        const existingSkus = new Set((userCart.items || []).map((i) => i.sku));
        (cart.items || []).forEach((item) => {
          if (!existingSkus.has(item.sku)) {
            userCart.items.push(item);
          }
        });
        await userCart.save();
        await Cart.deleteOne({ sessionId: cartId });
        res.clearCookie('cartId');
      }
    }
    cart = userCart || cart;
  }

  const items = cart ? cart.items : [];
  if (items.length === 0) {
    return res.redirect(302, '/cart');
  }

  const { subtotal, shippingFee, total, count } = calcCartSummary(items);

  const user = await User.findById(res.locals.currentUser.id).select('addresses').lean();
  const savedAddresses = (user && user.addresses) || [];

  const lines = items.map((item) => ({
    productName: item.sku || 'Sản phẩm',
    quantity: item.qty,
    unitPrice: item.unitPrice,
  }));

  const paymentMethods = ['cod', 'bank_transfer'];

  let provinces = [];
  try {
    const addressData = require('../public/data/vietnam-address.json');
    provinces = addressData.provinces || [];
  } catch (e) {
    provinces = [];
  }

  res.set('Cache-Control', 'no-store');
  res.render('pages/checkout', {
    title: 'Thanh toán',
    locals: {
      lines,
      subtotal,
      shippingFee,
      total,
      savedAddresses,
      paymentMethods,
      provinces,
    },
    cartCount: count,
  });
  setCartCookie(res, cartId);
}));

// Trang thêm địa chỉ mới (HTML) - yêu cầu đăng nhập
router.get('/address/new', asyncHandler(async (req, res, next) => {
  if (!res.locals.currentUser) {
    return res.redirect(302, '/login?next=/address/new');
  }

  let provinces = [];
  try {
    const addressData = require('../public/data/vietnam-address.json');
    provinces = addressData.provinces || [];
  } catch (e) {
    provinces = [];
  }

  res.render('pages/address-new', {
    title: 'Thêm địa chỉ mới',
    locals: { provinces },
  });
}));

// Trang admin dashboard (HTML) - yêu cầu đăng nhập + admin
router.get('/admin', asyncHandler(async (req, res, next) => {
  if (!res.locals.currentUser) {
    return res.redirect(302, '/login?next=/admin');
  }
  if (res.locals.currentUser.role !== 'admin') {
    return res.status(403).render('error', {
      title: 'Lỗi 403',
      statusCode: 403,
      message: 'Bạn không có quyền truy cập trang này.',
    });
  }

  const stats = await require('../services/adminService').getStats();
  res.set('Cache-Control', 'no-store');
  res.render('pages/admin-dashboard', {
    title: 'Trang quản trị',
    locals: {
      stats: stats.stats,
      recentOrders: stats.recentOrders,
      lowStockProducts: stats.lowStockProducts,
    },
  });
}));

// Trang thêm/sửa sản phẩm admin (HTML) - yêu cầu đăng nhập + admin
router.get('/admin/products/new', asyncHandler(async (req, res, next) => {
  if (!res.locals.currentUser) {
    return res.redirect(302, '/login?next=/admin/products/new');
  }
  if (res.locals.currentUser.role !== 'admin') {
    return res.status(403).render('error', {
      title: 'Lỗi 403',
      statusCode: 403,
      message: 'Bạn không có quyền truy cập trang này.',
    });
  }

  const Category = require('../model/Category');
  const categories = await Category.find({ isDeleted: false }).sort({ name: 1 }).lean();

  res.render('pages/admin-product-form', {
    title: 'Thêm sản phẩm',
    locals: {
      categories,
      colors: ['Đen', 'Trắng', 'Xanh', 'Đỏ', 'Xanh dương', 'Hồng', 'Tím', 'Nâu'],
    },
  });
}));

// API routes (giữ nguyên từ cả hai nhánh, mount trực tiếp trong router trang)
router.use('/auth', require('./auth.route'));
router.use('/profile', require('./profile.route'));
router.use('/admin', require('./admin.route'));
router.use('/categories', require('./category.route'));
router.use('/products', require('./products.route'));

module.exports = router;
