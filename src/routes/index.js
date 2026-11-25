const express = require('express');
const crypto = require('crypto');
const HomeController = require('../controllers/HomeController');
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
    cartId = require('crypto').randomBytes(16).toString('hex');
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
  if (res.locals.currentUser) {
    const next = isSafeNext(req.query.next) ? req.query.next : '/account';
    return res.redirect(302, next);
  }
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
router.get('/account', asyncHandler(async (req, res, next) => {
  if (!res.locals.currentUser) {
    return res.redirect(302, '/login?next=/account');
  }

  const user = await User.findById(res.locals.currentUser.id)
    .select('-password -resetPasswordTokenHash -resetPasswordExpires')
    .lean();

  if (!user || user.isDeleted || user.status !== 'active') {
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

router.get('/profile', (req, res) => {
  if (!res.locals.currentUser) {
    return res.redirect(302, '/login?next=/profile');
  }

  res.set('Cache-Control', 'no-store');
  res.render('pages/profile', {
    title: 'Hồ sơ của tôi',
    locals: {
      user: {
        id: res.locals.currentUser.id,
        name: res.locals.currentUser.name,
        role: res.locals.currentUser.role,
      },
    },
  });
});

// Trang giỏ hàng (HTML)
router.get('/cart', asyncHandler(async (req, res, next) => {
  const cartId = getCartId(req);
  let cart = await Cart.findOne({ sessionId: cartId });

  // Nếu đã đăng nhập, ưu tiên giỏ theo user, gộp giỏ sessionId vào nếu có
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
        // Gộp items từ guest cart vào user cart
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

// Trang catalog (HTML)
router.get('/catalog', asyncHandler(async (req, res, next) => {
  const productService = require('../services/ProductsServices');
  const Category = require('../model/Category');

  const q = (name) => {
    const value = req.query[name];
    return Array.isArray(value) ? String(value[0] || '') : String(value || '');
  };

  const filters = {
    category: q('category'),
    minPrice: q('minPrice'),
    maxPrice: q('maxPrice'),
    keyword: q('keyword'),
    size: q('size'),
    color: q('color'),
    inStock: q('inStock'),
    material: q('material'),
    page: q('page'),
    limit: q('limit'),
    sort: q('sort'),
  };

  const data = await productService.list(filters, {});
  const categories = await Category.find({ isDeleted: false }).sort({ order: 1, name: 1 }).lean();
  const allProducts = await Product.find({ isDeleted: false, isActive: true }).select('variants basePrice').lean();
  const sizes = [...new Set(allProducts.flatMap((p) => (p.variants || []).map((v) => v.size)).filter(Boolean))].sort();
  const colors = [...new Set(allProducts.flatMap((p) => (p.variants || []).map((v) => v.color)).filter(Boolean))].sort();

  let cartCount = 0;
  if (res.locals.currentUser) {
    const cart = await Cart.findOne({ user: res.locals.currentUser.id }).select('items.qty').lean();
    cartCount = cart ? (cart.items || []).reduce((sum, i) => sum + (Number(i.qty) || 0), 0) : 0;
  } else {
    const cartId = req.cookies ? req.cookies.cartId : null;
    if (cartId) {
      const cart = await Cart.findOne({ sessionId: cartId }).select('items.qty').lean();
      cartCount = cart ? (cart.items || []).reduce((sum, i) => sum + (Number(i.qty) || 0), 0) : 0;
    }
  }

  const flash = getFlash(req);
  res.render('pages/catalog', {
    title: 'Danh sách sản phẩm',
    categories,
    sizes,
    colors,
    products: data.items,
    pagination: data.pagination,
    currentPage: data.pagination.page,
    totalPages: data.pagination.totalPages,
    flash,
    locals: {
      category: filters.category,
      size: filters.size,
      color: filters.color,
      material: filters.material,
      inStock: filters.inStock,
      keyword: filters.keyword,
      q: filters.keyword,
      price_min: filters.minPrice,
      price_max: filters.maxPrice,
      flash,
    },
    sortBy: filters.sort || 'newest',
    cartCount,
  });
}));

// Trang chi tiết sản phẩm (HTML)
router.get('/products/:slug', asyncHandler(async (req, res, next) => {
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
    stock: Number(v.stock) || 0,
    price: Number(v.price || product.basePrice) || 0,
    price_formatted: (Number(v.price || product.basePrice) || 0).toLocaleString('vi-VN'),
  }));

  let cartCount = 0;
  if (res.locals.currentUser) {
    const cart = await Cart.findOne({ user: res.locals.currentUser.id }).select('items.qty').lean();
    cartCount = cart ? (cart.items || []).reduce((sum, i) => sum + (Number(i.qty) || 0), 0) : 0;
  } else {
    const cartId = req.cookies ? req.cookies.cartId : null;
    if (cartId) {
      const cart = await Cart.findOne({ sessionId: cartId }).select('items.qty').lean();
      cartCount = cart ? (cart.items || []).reduce((sum, i) => sum + (Number(i.qty) || 0), 0) : 0;
    }
  }

  const flash = getFlash(req);
  res.render('pages/product-detail', {
    title: product.name,
    flash,
    locals: { flash },
    product: {
      ...product,
      price: Number(product.basePrice) || 0,
      basePrice: Number(product.basePrice) || 0,
    },
    variants,
    productsRelated: related,
    cartCount,
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

  // Lấy địa chỉ đã lưu của user
  const user = await User.findById(res.locals.currentUser.id).select('addresses').lean();
  const savedAddresses = (user && user.addresses) || [];

  const lines = items.map((item) => ({
    productName: item.sku || 'Sản phẩm',
    quantity: item.qty,
    unitPrice: item.unitPrice,
  }));

  const paymentMethods = ['cod', 'bank_transfer'];

  // Danh sách tỉnh/thành (đọc từ file tĩnh nếu có)
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

module.exports = router;
