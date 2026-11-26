const express = require('express');
const HomeController = require('../controllers/HomeController');
const Cart = require('../model/Cart');
const Product = require('../model/Products');
const User = require('../model/User');
const Order = require('../model/Order');
const { ACCESS_COOKIE, verifyToken } = require('../services/tokenService');
const CartService = require('../services/CartService');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/appError');
const { getFlash } = require('../utils/flash');
const { ensureCartItemIds } = require('../utils/cartItems');
const presentation = require('../utils/productPresentation');
const orderPresentation = require('../utils/orderPresentation');
const { canCancelOrder } = require('../services/OrderCancellationService');

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

const buildOrderSummary = (order, role, isOwner = true) => {
  const status = order.status || 'pending';
  return {
    id: String(order._id),
    code: order.code || '-',
    createdAtLabel: orderPresentation.formatDate(order.createdAt),
    totalLabel: orderPresentation.formatCurrency(order.total),
    status,
    statusLabel: orderPresentation.getStatusLabel(status),
    statusClass: orderPresentation.getStatusClass(status),
    canCancel: canCancelOrder({ actorRole: role, isOwner, from: status }),
  };
};

const buildOrderDetail = (order, role, isOwner) => {
  const status = order.status || 'pending';
  const address = order.shippingAddress || {};
  const addressLines = [address.detail, address.ward, address.district, address.province]
    .filter(Boolean)
    .join(', ');

  return {
    id: String(order._id),
    code: order.code || '-',
    createdAtLabel: orderPresentation.formatDate(order.createdAt),
    updatedAtLabel: orderPresentation.formatDate(order.updatedAt),
    status,
    statusLabel: orderPresentation.getStatusLabel(status),
    statusClass: orderPresentation.getStatusClass(status),
    paymentStatusLabel: orderPresentation.getPaymentStatusLabel(order.paymentStatus),
    paymentMethodLabel: orderPresentation.getPaymentMethodLabel(order.paymentMethod),
    items: (order.items || []).map((item) => ({
      name: item.name || 'Sản phẩm',
      image: item.image || '',
      sku: item.sku || '-',
      size: item.size || '-',
      color: item.color || '-',
      qty: Number(item.qty) || 0,
      unitPriceLabel: orderPresentation.formatCurrency(item.unitPrice),
      lineTotalLabel: orderPresentation.formatCurrency(item.lineTotal),
    })),
    shipping: {
      fullName: address.fullName || '-',
      phone: address.phone || '-',
      address: addressLines || '-',
    },
    note: order.note || '',
    subtotalLabel: orderPresentation.formatCurrency(order.subtotal),
    shippingFeeLabel: orderPresentation.formatCurrency(order.shippingFee),
    discountLabel: orderPresentation.formatCurrency(order.discount),
    totalLabel: orderPresentation.formatCurrency(order.total),
    statusHistory: (order.statusHistory || []).map((entry) => ({
      status: entry.status || 'pending',
      statusLabel: orderPresentation.getStatusLabel(entry.status),
      atLabel: orderPresentation.formatDate(entry.at),
      note: entry.note || '',
    })),
    canCancel: canCancelOrder({ actorRole: role, isOwner, from: status }),
  };
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
  res.set('Cache-Control', 'no-store');
  const currentUser = res.locals.currentUser;
  const cartId = req.cookies ? req.cookies.cartId : undefined;

  // Xác định giỏ: ưu tiên user, chuyển/gộp giỏ guest nếu cần.
  const cart = await CartService.resolveCartForRequest({
    userId: currentUser ? currentUser.id : null,
    cartId,
    createIfMissing: true,
    res,
    mergeOnConflict: 'clamp',
  });

  const viewCart = cart
    ? await Cart.findOne({ _id: cart._id }).populate('items.product', 'name slug images variants')
    : null;
  const items = viewCart ? viewCart.items : [];
  const { subtotal, shippingFee, total, count } = CartService.buildSummary(items);

  const flash = getFlash(req);
  if (cart && cart.mergeAdjusted) {
    flash.push({
      type: 'info',
      message: 'Một số sản phẩm đã được điều chỉnh số lượng',
    });
  }

  res.render('pages/cart', {
    title: 'Giỏ hàng',
    flash,
    locals: {
      empty: items.length === 0,
      items,
      subtotal,
      shippingFee,
      total,
      count,
      flash,
    },
    cartCount: count,
  });
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

  const cartId = req.cookies ? req.cookies.cartId : undefined;

  // Xác định giỏ: ưu tiên user, chuyển/gộp giỏ guest nếu cần.
  const cart = await CartService.resolveCartForRequest({
    userId: res.locals.currentUser.id,
    cartId,
    createIfMissing: false,
    res,
    mergeOnConflict: 'clamp',
  });

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

  const { subtotal, shippingFee, total, count } = CartService.buildSummary(items);

  // Lấy địa chỉ đã lưu của user
  const user = await User.findById(res.locals.currentUser.id).select('addresses').lean();
  const savedAddresses = (user && user.addresses) || [];

  const lines = items.map((item) => ({
    productName: item.sku || 'Sản phẩm',
    quantity: item.qty,
    unitPrice: item.unitPrice,
  }));

  const paymentMethods = ['cod', 'bank_transfer'];

  const flash = getFlash(req);
  if (cart && cart.mergeAdjusted) {
    flash.push({
      type: 'info',
      message: 'Một số sản phẩm đã được điều chỉnh số lượng',
    });
  }

  res.set('Cache-Control', 'no-store');
  res.render('pages/checkout', {
    title: 'Thanh toán',
    flash,
    locals: {
      lines,
      subtotal,
      shippingFee,
      total,
      savedAddresses,
      paymentMethods,
      itemId: selectedItemId || '',
      flash,
    },
    cartCount: count,
  });
}));

router.get('/orders', asyncHandler(async (req, res, next) => {
  const currentUser = res.locals.currentUser;
  if (!currentUser) {
    return res.redirect(302, '/login?next=/orders');
  }

  const orders = await Order.find({ user: currentUser.id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const flash = getFlash(req);
  res.set('Cache-Control', 'no-store');
  return res.render('pages/orders', {
    title: 'Đơn hàng của tôi',
    flash,
    locals: {
      orders: orders.map((order) => buildOrderSummary(order, currentUser.role)),
      flash,
    },
  });
}));

router.get('/orders/:id', asyncHandler(async (req, res, next) => {
  const currentUser = res.locals.currentUser;
  if (!currentUser) {
    return res.redirect(302, `/login?next=/orders/${encodeURIComponent(req.params.id)}`);
  }

  if (!isValidObjectId(req.params.id)) {
    return res.status(404).render('error', {
      title: 'Không tìm thấy đơn hàng',
      statusCode: 404,
      message: 'Đơn hàng không tồn tại.',
    });
  }

  const order = await Order.findById(req.params.id).lean();
  if (!order) {
    return res.status(404).render('error', {
      title: 'Không tìm thấy đơn hàng',
      statusCode: 404,
      message: 'Đơn hàng không tồn tại.',
    });
  }

  const isOwner = String(order.user) === String(currentUser.id);
  const isAdmin = currentUser.role === 'admin';
  if (!isOwner && !isAdmin) {
    return res.status(403).render('error', {
      title: 'Lỗi 403',
      statusCode: 403,
      message: 'Bạn không có quyền xem đơn hàng này.',
    });
  }

  const flash = getFlash(req);
  res.set('Cache-Control', 'no-store');
  return res.render('pages/order-detail', {
    title: 'Chi tiết đơn hàng',
    flash,
    locals: {
      order: buildOrderDetail(order, currentUser.role, isOwner),
      isOwner,
      isAdmin,
      flash,
    },
  });
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
      active: 'dashboard',
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
      active: 'products',
      categories,
      colors: ['Đen', 'Trắng', 'Xanh', 'Đỏ', 'Xanh dương', 'Hồng', 'Tím', 'Nâu'],
    },
  });
}));

router.get('/admin/categories', asyncHandler(async (req, res, next) => {
  if (!res.locals.currentUser) {
    return res.redirect(302, '/login?next=/admin/categories');
  }
  if (res.locals.currentUser.role !== 'admin') {
    return res.status(403).render('error', {
      title: 'Lỗi 403',
      statusCode: 403,
      message: 'Bạn không có quyền truy cập trang này.',
    });
  }

  const categories = await require('../services/categoryService').list();
  const flash = getFlash(req);
  res.set('Cache-Control', 'no-store');
  return res.render('pages/admin-categories', {
    title: 'Quản lý danh mục',
    flash,
    locals: {
      active: 'categories',
      categories,
      flash,
    },
  });
}));

router.get('/admin/orders', asyncHandler(async (req, res, next) => {
  if (!res.locals.currentUser) {
    return res.redirect(302, '/login?next=/admin/orders');
  }
  if (res.locals.currentUser.role !== 'admin') {
    return res.status(403).render('error', {
      title: 'Lỗi 403',
      statusCode: 403,
      message: 'Bạn không có quyền truy cập trang này.',
    });
  }

  const statusValues = Object.keys(orderPresentation.ORDER_STATUS_LABELS);
  const requestedStatus = typeof req.query.status === 'string' ? req.query.status : 'all';
  const activeStatus =
    requestedStatus === 'all' || statusValues.includes(requestedStatus)
      ? requestedStatus
      : 'all';
  const filter = activeStatus === 'all' ? {} : { status: activeStatus };

  const [orders, counts] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).limit(100).lean(),
    Promise.all(statusValues.map((status) => Order.countDocuments({ status }))),
  ]);

  const statusTabs = [
    {
      value: 'all',
      label: 'Tất cả',
      count: counts.reduce((sum, count) => sum + (Number(count) || 0), 0),
      isActive: activeStatus === 'all',
    },
    ...statusValues.map((status, index) => ({
      value: status,
      label: orderPresentation.getStatusLabel(status),
      count: Number(counts[index]) || 0,
      isActive: activeStatus === status,
    })),
  ];

  const flash = getFlash(req);
  res.set('Cache-Control', 'no-store');
  return res.render('pages/admin-orders', {
    title: 'Quản lý đơn hàng',
    flash,
    locals: {
      active: 'orders',
      orders: orders.map((order) =>
        buildOrderSummary(order, res.locals.currentUser.role, String(order.user) === String(res.locals.currentUser.id))
      ),
      statusTabs,
      activeStatus,
      flash,
    },
  });
}));

router.get('/admin/users', asyncHandler(async (req, res, next) => {
  if (!res.locals.currentUser) {
    return res.redirect(302, '/login?next=/admin/users');
  }
  if (res.locals.currentUser.role !== 'admin') {
    return res.status(403).render('error', {
      title: 'Lỗi 403',
      statusCode: 403,
      message: 'Bạn không có quyền truy cập trang này.',
    });
  }

  const parsePositive = (value, fallback) => {
    const parsed = parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  };
  const page = parsePositive(req.query.page, 1);
  const limit = Math.min(100, parsePositive(req.query.limit, 20));
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';

  const data = await require('../services/adminUserService').listUsers({
    page: String(page),
    limit: String(limit),
    q,
  });

  const flash = getFlash(req);
  res.set('Cache-Control', 'no-store');
  return res.render('pages/admin-users', {
    title: 'Quản lý người dùng',
    flash,
    locals: {
      active: 'users',
      users: data.items,
      pagination: data.pagination,
      q,
      currentUserId: res.locals.currentUser.id,
      flash,
    },
  });
}));

module.exports = router;
