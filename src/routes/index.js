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
const { getFlash } = require('../utils/flash');
const { ensureCartItemIds } = require('../utils/cartItems');
const presentation = require('../utils/productPresentation');
const { maskPhone } = require('../utils/maskPhone');

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

const isValidObjectId = (id) => require('mongoose').Types.ObjectId.isValid(id);

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

// Trạng thái đơn hàng dùng cho trang tài khoản
const ORDER_STATUS_KEYS = ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'];

const queryValue = (req, name) => {
  const value = req.query ? req.query[name] : undefined;
  if (Array.isArray(value)) return String(value[0] || '');
  return String(value == null ? '' : value);
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const countOrdersByStatus = async (userId) => {
  const counts = { pending: 0, confirmed: 0, shipping: 0, delivered: 0, cancelled: 0 };
  await Promise.all(
    ORDER_STATUS_KEYS.map(async (status) => {
      counts[status] = await Order.countDocuments({ user: userId, status });
    })
  );
  return counts;
};

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

  const tabQuery = queryValue(req, 'tab');
  const tab = ['overview', 'orders', 'addresses', 'profile'].includes(tabQuery)
    ? tabQuery
    : 'overview';

  const statusQuery = queryValue(req, 'status');
  const status = ORDER_STATUS_KEYS.includes(statusQuery) ? statusQuery : '';
  const keyword = queryValue(req, 'q').trim();

  let page = parseInt(queryValue(req, 'page'), 10);
  if (!Number.isFinite(page) || page < 1) page = 1;

  const counts = await countOrdersByStatus(user._id);
  const totalOrders = ORDER_STATUS_KEYS.reduce(
    (sum, key) => sum + (Number(counts[key]) || 0),
    0
  );
  const processingCount = (Number(counts.pending) || 0)
    + (Number(counts.confirmed) || 0)
    + (Number(counts.shipping) || 0);

  let orders = [];
  let pagination = null;
  let recentOrders = [];

  if (tab === 'orders') {
    const filter = { user: user._id };
    if (status) filter.status = status;
    if (keyword) {
      const regex = new RegExp(escapeRegex(keyword), 'i');
      filter.$or = [{ code: regex }, { 'items.name': regex }];
    }

    const perPage = 10;
    const total = await Order.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    if (page > totalPages) page = totalPages;

    orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .lean();

    pagination = { page, perPage, total, totalPages };
  } else if (tab === 'overview') {
    recentOrders = await Order.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();
  }

  const addresses = Array.isArray(user.addresses) ? user.addresses : [];
  const defaultAddress = addresses.find((addr) => addr && addr.isDefault) || addresses[0] || null;

  res.set('Cache-Control', 'no-store');
  res.render('pages/account', {
    user: {
      ...user,
      phoneMasked: maskPhone(user.phone || null),
      phoneVerified: Boolean(user.phoneVerified),
    },
    title: 'Tài khoản của tôi',
    orders,
    recentOrders,
    counts,
    totalOrders,
    processingCount,
    addresses,
    defaultAddress,
    tab,
    status,
    q: keyword,
    pagination,
  });
}));

// Chi tiết đơn hàng — chỉ chủ đơn được xem
router.get('/account/orders/:code', asyncHandler(async (req, res, next) => {
  if (!res.locals.currentUser) {
    const nextPath = '/account/orders/' + encodeURIComponent(String(req.params.code || ''));
    return res.redirect(302, '/login?next=' + encodeURIComponent(nextPath));
  }

  const code = String(req.params.code || '').trim().toUpperCase();
  const order = code
    ? await Order.findOne({ code, user: res.locals.currentUser.id }).lean()
    : null;

  if (!order) {
    return res.status(404).render('error', {
      title: 'Không tìm thấy đơn hàng',
      statusCode: 404,
      message: 'Đơn hàng không tồn tại hoặc bạn không có quyền xem.',
    });
  }

  res.set('Cache-Control', 'no-store');
  res.render('pages/order-detail', {
    title: 'Đơn hàng ' + order.code,
    order,
  });
}));

router.get('/profile', asyncHandler(async (req, res, next) => {
  if (!res.locals.currentUser) {
    return res.redirect(302, '/login?next=/profile');
  }

  const current = res.locals.currentUser;
  const fullUser = await User.findById(current.id)
    .select('name email role addresses phone phoneVerified phoneVerifiedAt createdAt')
    .lean();

  const user = {
    id: current.id,
    name: (fullUser && fullUser.name) || current.name || '',
    email: (fullUser && fullUser.email) || '',
    role: (fullUser && fullUser.role) || current.role || 'customer',
    addresses: (fullUser && Array.isArray(fullUser.addresses)) ? fullUser.addresses : [],
    phone: (fullUser && fullUser.phone) || current.phone || '',
    phoneVerified: Boolean((fullUser && fullUser.phoneVerified) || current.phoneVerified),
    phoneMasked: maskPhone((fullUser && fullUser.phone) || current.phone || null),
    createdAt: (fullUser && fullUser.createdAt) || null,
  };

  res.set('Cache-Control', 'no-store');
  res.render('pages/profile', {
    title: 'Hồ sơ của tôi',
    user,
    tab: 'profile',
  });
}));

// Trang giỏ hàng (HTML)
router.get('/cart', asyncHandler(async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
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
        cart = await Cart.findOne({ user: res.locals.currentUser.id });
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

  if (cart && ensureCartItemIds(cart)) {
    await cart.save();
  }

  const viewCart = cart
    ? await Cart.findOne({ _id: cart._id }).populate('items.product', 'name slug images variants')
    : null;
  const items = viewCart ? viewCart.items : [];
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
  const isNewPage = filters.sort === 'newest' || q('new') === '1';

  const catalogProducts = await Product.find({ isDeleted: false, isActive: true })
    .select('variants basePrice createdAt category')
    .lean();
  const sellingPrices = catalogProducts.map((item) => presentation.getSellingPrice(item));
  const rawFloor = sellingPrices.length ? Math.min(...sellingPrices) : 0;
  const rawCeil = sellingPrices.length ? Math.max(...sellingPrices) : 0;
  const roundDown = (value) => Math.floor(value / 10000) * 10000;
  const roundUp = (value) => Math.ceil(value / 10000) * 10000;
  const priceBounds = { min: roundDown(rawFloor), max: roundUp(rawCeil) };

  const parsePriceInput = (value, fallback) => {
    if (value === '' || value === undefined) return fallback;
    const number = Number(String(value).replace(/[^\d]/g, ''));
    return Number.isFinite(number) ? number : fallback;
  };
  let requestedMin = parsePriceInput(filters.minPrice, null);
  let requestedMax = parsePriceInput(filters.maxPrice, null);
  if (requestedMin !== null && requestedMax !== null && requestedMin > requestedMax) {
    const swap = requestedMin;
    requestedMin = requestedMax;
    requestedMax = swap;
  }
  filters.minPrice = requestedMin === null ? '' : String(requestedMin);
  filters.maxPrice = requestedMax === null ? '' : String(requestedMax);

  if (requestedMin !== null || requestedMax !== null) {
    const matchedIds = catalogProducts
      .filter((item) => {
        const price = presentation.getSellingPrice(item);
        return (requestedMin === null || price >= requestedMin)
          && (requestedMax === null || price <= requestedMax);
      })
      .map((item) => item._id);
    filters.priceIds = matchedIds;
  }

  const categories = await Category.find({ isDeleted: false, isVisible: { $ne: false } }).sort({ order: 1, name: 1 }).lean();

  const rootCategories = categories
    .filter(function (c) { return !c.parentId; })
    .map(function (c) {
      return {
        ...c,
        children: categories.filter(function (child) {
          return child.parentId && child.parentId.toString() === c._id.toString();
        }),
      };
    });
  const categoriesById = new Map(categories.map(function (c) { return [c._id.toString(), c]; }));
  const categoryParam = filters.category;
  const currentCategory = categoryParam
    ? (categories.find(function (c) {
        return c.slug === categoryParam || c._id.toString() === categoryParam;
      }) || null)
    : null;

  if (categoryParam && !currentCategory) {
    return res.status(404).render('error', {
      title: 'Danh mục không tồn tại',
      statusCode: 404,
      message: 'Danh mục bạn tìm không tồn tại hoặc đã bị ẩn.',
    });
  }

  const data = await productService.list(filters, {});
  let rootCategory = currentCategory;
  while (rootCategory && rootCategory.parentId && categoriesById.has(rootCategory.parentId.toString())) {
    rootCategory = categoriesById.get(rootCategory.parentId.toString());
  }
  const childCategories = rootCategory
    ? categories
        .filter(function (c) {
          return c.parentId && c.parentId.toString() === rootCategory._id.toString();
        })
        .sort(function (a, b) { return (a.order || 0) - (b.order || 0); })
    : [];
  const catalogTitle = isNewPage
    ? 'Sản phẩm mới'
    : (currentCategory ? 'Thời trang ' + currentCategory.name : 'Danh sách sản phẩm');

  const sizes = [...new Set(catalogProducts.flatMap((p) => (p.variants || []).map((v) => v.size)).filter(Boolean))].sort();
  const colors = [...new Set(catalogProducts.flatMap((p) => (p.variants || []).map((v) => v.color)).filter(Boolean))].sort();
  const categoryNameById = new Map(categories.map((c) => [c._id.toString(), c.slug]));
  const cardProducts = data.items.map((item) => {
    const sellingPrice = presentation.getSellingPrice(item);
    const listPrice = presentation.getListPrice(item);
    const salePrice = sellingPrice < listPrice ? sellingPrice : null;
    return {
      name: item.name,
      slug: item.slug,
      image: (item.images && item.images[0]) || '',
      categorySlug: categoryNameById.get(String(item.category)) || '',
      price: listPrice,
      salePrice,
      isNew: presentation.isNewProduct(item),
      createdAt: item.createdAt,
      outOfStock: item.inStock === false,
    };
  });

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

  const flash = typeof getFlash === 'function' ? getFlash(req) : [];
  res.render('pages/catalog', {
    title: catalogTitle,
    categories,
    rootCategories,
    currentCategory,
    rootCategory,
    childCategories,
    sizes,
    colors,
    products: cardProducts,
    pagination: data.pagination,
    currentPage: data.pagination.page,
    totalPages: data.pagination.totalPages,
    priceBounds,
    isNewPage,
    flash,
    locals: {
      category: filters.category,
      size: filters.size,
      color: filters.color,
      material: filters.material,
      inStock: filters.inStock,
      keyword: filters.keyword,
      q: filters.keyword,
      price_min: requestedMin === null ? '' : String(requestedMin),
      price_max: requestedMax === null ? '' : String(requestedMax),
      new: q('new'),
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

  const flash = typeof getFlash === 'function' ? getFlash(req) : [];
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

  if (cart && ensureCartItemIds(cart)) {
    await cart.save();
  }

  const rawItemId = req.query.item;
  let selectedItemId = null;
  if (rawItemId !== undefined) {
    if (typeof rawItemId !== 'string' || !isValidObjectId(rawItemId)) {
      return res.redirect(302, '/cart?error=' + encodeURIComponent('Mã sản phẩm trong giỏ không hợp lệ'));
    }
    selectedItemId = rawItemId;
  }

  let items = cart ? cart.items : [];
  if (selectedItemId) {
    items = items.filter((item) => String(item._id) === selectedItemId);
    if (items.length === 0) {
      return res.redirect(302, '/cart?error=' + encodeURIComponent('Sản phẩm không tồn tại trong giỏ hàng'));
    }
  }

  if (items.length === 0) {
    return res.redirect(302, '/cart');
  }

  const { subtotal, shippingFee, total, count } = calcCartSummary(items);

  // Lấy địa chỉ đã lưu của user
  const user = await User.findById(res.locals.currentUser.id).select('addresses phone phoneVerified phoneVerifiedAt').lean();
  const savedAddresses = (user && user.addresses) || [];

  const lines = items.map((item) => ({
    productName: item.sku || 'Sản phẩm',
    quantity: item.qty,
    unitPrice: item.unitPrice,
  }));

  const paymentMethods = ['cod', 'bank_transfer'];

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
      itemId: selectedItemId || '',
    },
    phoneVerified: Boolean((user && user.phoneVerified) || false),
    cartCount: count,
  });
  setCartCookie(res, cartId);
}));

// Trang thêm địa chỉ mới (HTML) - yêu cầu đăng nhập
router.get('/address/new', asyncHandler(async (req, res, next) => {
  if (!res.locals.currentUser) {
    return res.redirect(302, '/login?next=/address/new');
  }

  res.render('pages/address-new', {
    title: 'Thêm địa chỉ mới',
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
