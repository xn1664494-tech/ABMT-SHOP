const express = require('express');
const router = express.Router();
const Cart = require('../model/Cart');
const Product = require('../model/Products');
const CartService = require('../services/CartService');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/appError');
const { authenticate } = require('../middleware/authenticate');
const { csrfProtection } = require('../middleware/csrf');

const { buildSummary, normalizeColor, findItemIndexById } = CartService;

/**
 * Phân tích qty: trả null nếu bỏ trống, NaN nếu không phải số nguyên >= 1.
 */
const parseQty = (raw) => {
  if (raw === undefined || raw === null || raw === '') return null;
  const num = Number(raw);
  return Number.isInteger(num) && num >= 1 ? num : NaN;
};

/**
 * Lấy giỏ hàng hiện tại: ưu tiên user (nếu đăng nhập), còn không thì theo sessionId (cookie cartId)
 */
const resolveCart = async (req, res, currentUser, createIfMissing = false) => {
  const cookieCartId = req.cookies ? req.cookies.cartId : undefined;
  return CartService.resolveCartForRequest({
    userId: currentUser ? currentUser.id || currentUser._id : null,
    cartId: cookieCartId,
    createIfMissing,
    res,
  });
};

/**
 * GET /api/cart - Trả về giỏ hàng dạng JSON
 */
router.get(
  '/',
  asyncHandler(async (req, res, next) => {
    const cart = await resolveCart(req, res, res.locals.currentUser, true);
    const items = cart ? cart.items : [];
    await CartService.refreshItemPrices(items);
    const summary = buildSummary(items);

    return res.status(200).json({
      success: true,
      data: {
        empty: items.length === 0,
        items,
        ...summary,
      },
    });
  })
);

/**
 * POST /api/cart/items - Thêm sản phẩm vào giỏ
 * Body: { product, size, color, qty }
 */
router.post(
  '/items',
  csrfProtection,
  asyncHandler(async (req, res, next) => {
    const { product, size, color, qty } = req.body;

    if (!product || !size || !color) {
      return next(new ErrorResponse('Thiếu thông tin sản phẩm', 400));
    }

    const productObj = await Product.findById(product);
    if (!productObj || productObj.isDeleted || productObj.isActive === false) {
      return next(new ErrorResponse('Sản phẩm không tồn tại', 404));
    }

    const variant = (productObj.variants || []).find(
      (v) =>
        v.size === String(size).toUpperCase() &&
        normalizeColor(v.color) === normalizeColor(color)
    );
    if (!variant) {
      return next(new ErrorResponse('Biến thể không tồn tại', 404));
    }
    if (variant.stock <= 0) {
      return next(new ErrorResponse('Biến thể đã hết hàng', 409));
    }

    const parsedQty = parseQty(qty);
    const qtyNum = parsedQty === null ? 1 : parsedQty;
    if (!Number.isInteger(qtyNum)) {
      return next(new ErrorResponse('Số lượng không hợp lệ', 400));
    }
    if (qtyNum > variant.stock) {
      return next(new ErrorResponse(`Chỉ còn ${variant.stock} sản phẩm trong kho`, 409));
    }

    const sku = variant.sku;
    const cart = await resolveCart(req, res, res.locals.currentUser, true);

    const existingIdx = (cart.items || []).findIndex(
      (item) => item.sku === sku && String(item.product) === String(product)
    );

    if (existingIdx >= 0) {
      const newQty = cart.items[existingIdx].qty + qtyNum;
      if (newQty > variant.stock) {
        return next(new ErrorResponse(`Vượt quá tồn kho (còn ${variant.stock})`, 409));
      }
      cart.items[existingIdx].qty = newQty;
      cart.items[existingIdx].unitPrice =
        variant.price != null ? variant.price : productObj.basePrice;
    } else {
      cart.items.push({
        product,
        sku,
        size: String(size).toUpperCase(),
        color: String(color),
        qty: qtyNum,
        unitPrice: variant.price != null ? variant.price : productObj.basePrice,
      });
    }

    await cart.save();

    const items = cart.items;
    const summary = buildSummary(items);

    return res.status(200).json({
      success: true,
      data: { items, ...summary },
    });
  })
);

/**
 * PUT /api/cart/items/:id - Cập nhật số lượng
 * Body: { qty }
 */
router.put(
  '/items/:id',
  csrfProtection,
  asyncHandler(async (req, res, next) => {
    const { qty } = req.body;
    const itemId = req.params.id;

    const qtyNum = parseQty(qty);
    if (!Number.isInteger(qtyNum)) {
      return next(new ErrorResponse('Số lượng không hợp lệ', 400));
    }

    const cart = await resolveCart(req, res, res.locals.currentUser);
    if (!cart) {
      return next(new ErrorResponse('Giỏ hàng không tồn tại', 404));
    }

    const itemIdx = findItemIndexById(cart.items || [], itemId);
    if (itemIdx < 0) {
      return next(new ErrorResponse('Sản phẩm không tồn tại trong giỏ', 404));
    }
    const item = cart.items[itemIdx];

    const productObj = await Product.findById(item.product);
    const variant = (productObj && productObj.variants) ? productObj.variants.find((v) => v.sku === item.sku) : null;
    const maxStock = variant ? variant.stock : 0;
    if (qtyNum > maxStock) {
      return next(new ErrorResponse(`Vượt quá tồn kho (còn ${maxStock})`, 409));
    }

    item.qty = qtyNum;
    if (variant) {
      item.unitPrice = variant.price != null ? variant.price : productObj.basePrice;
    }
    await cart.save();

    const items = cart.items;
    const summary = buildSummary(items);

    return res.status(200).json({
      success: true,
      data: { items, ...summary },
    });
  })
);

/**
 * DELETE /api/cart/items/:id - Xóa sản phẩm khỏi giỏ
 */
router.delete(
  '/items/:id',
  csrfProtection,
  asyncHandler(async (req, res, next) => {
    const itemId = req.params.id;

    const cart = await resolveCart(req, res, res.locals.currentUser);
    if (!cart) {
      return next(new ErrorResponse('Giỏ hàng không tồn tại', 404));
    }

    const itemIdx = findItemIndexById(cart.items || [], itemId);
    if (itemIdx < 0) {
      return next(new ErrorResponse('Sản phẩm không tồn tại trong giỏ', 404));
    }

    cart.items.splice(itemIdx, 1);
    await cart.save();

    const items = cart.items;
    const summary = buildSummary(items);

    return res.status(200).json({
      success: true,
      data: { items, ...summary },
    });
  })
);

/**
 * POST /api/cart/merge - Gộp giỏ guest (cartId cookie) vào giỏ user sau đăng nhập
 * Body: {}
 */
router.post(
  '/merge',
  authenticate,
  csrfProtection,
  asyncHandler(async (req, res, next) => {
    const currentUser = req.user;
    if (!currentUser) {
      return next(new ErrorResponse('Chưa đăng nhập', 401));
    }

    const userId = currentUser.id || currentUser._id;
    const cartId = req.cookies ? req.cookies.cartId : undefined;
    const guestCart = cartId ? await Cart.findOne({ sessionId: cartId }) : null;

    let customerCart = await Cart.findOne({ user: userId });

    if (guestCart && guestCart.items && guestCart.items.length > 0) {
      if (!customerCart) {
        customerCart = await Cart.create({ user: userId, items: [] });
      }
      customerCart = await CartService.mergeGuestIntoUser(
        customerCart,
        guestCart,
        res
      );
    }

    const items = customerCart ? customerCart.items : [];
    const summary = buildSummary(items);

    return res.status(200).json({
      success: true,
      data: { items, ...summary },
    });
  })
);

module.exports = router;
