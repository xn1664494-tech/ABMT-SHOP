const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const Cart = require('../model/Cart');
const Product = require('../model/Products');
const { calculateShippingFee } = require('../model/Order');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/appError');
const { authenticate } = require('../middleware/authenticate');
const { csrfProtection } = require('../middleware/csrf');
const { ensureCartItemIds } = require('../utils/cartItems');

const CART_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

const setCartCookie = (res, cartId) => {
  res.cookie('cartId', cartId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    maxAge: CART_COOKIE_MAX_AGE,
  });
};

const calcSummary = (items) => {
  const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
  const shippingFee = calculateShippingFee(subtotal);
  const total = subtotal + shippingFee;
  const count = items.reduce((sum, item) => sum + item.qty, 0);
  return { subtotal, shippingFee, total, count };
};

/**
 * Lấy giỏ hàng hiện tại: ưu tiên user (nếu đăng nhập), còn không thì theo sessionId (cookie cartId)
 */
const resolveCart = async (req, res, currentUser, createIfMissing = false) => {
  const cookieCartId = req.cookies ? req.cookies.cartId : undefined;
  let cartId = cookieCartId;

  let cart = null;
  if (currentUser) {
    cart = await Cart.findOne({ user: currentUser.id });
  }
  if (!cart && cartId) {
    cart = await Cart.findOne({ sessionId: cartId });
  }
  if (!cart && createIfMissing) {
    if (!currentUser && !cartId) {
      cartId = crypto.randomBytes(16).toString('hex');
    }
    const fields = currentUser ? { user: currentUser.id } : { sessionId: cartId };
    cart = await Cart.create({ ...fields, items: [] });
    if (!currentUser) setCartCookie(res, cartId);
  }

  if (cart && ensureCartItemIds(cart)) {
    await cart.save();
  }

  return cart;
};

/**
 * GET /api/cart - Trả về giỏ hàng dạng JSON
 */
router.get(
  '/',
  asyncHandler(async (req, res, next) => {
    const cart = await resolveCart(req, res, res.locals.currentUser, true);
    const items = cart ? cart.items : [];
    const summary = calcSummary(items);

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
    if (!productObj || productObj.isDeleted) {
      return next(new ErrorResponse('Sản phẩm không tồn tại', 404));
    }

    const variant = (productObj.variants || []).find(
      (v) => v.size === String(size).toUpperCase() && v.color === String(color)
    );
    if (!variant) {
      return next(new ErrorResponse('Biến thể không tồn tại', 404));
    }
    if (variant.stock <= 0) {
      return next(new ErrorResponse('Biến thể đã hết hàng', 409));
    }

    const qtyNum = Math.max(1, Number(qty) || 1);
    if (qtyNum > variant.stock) {
      return next(new ErrorResponse(`Chỉ còn ${variant.stock} sản phẩm trong kho`, 409));
    }

    const sku = variant.sku;
    const cart = await resolveCart(req, res, res.locals.currentUser, true);

    const existingIdx = (cart.items || []).findIndex(
      (item) => item.sku === sku && item.product.equals(product)
    );

    if (existingIdx >= 0) {
      const newQty = cart.items[existingIdx].qty + qtyNum;
      if (newQty > variant.stock) {
        return next(new ErrorResponse(`Vượt quá tồn kho (còn ${variant.stock})`, 409));
      }
      cart.items[existingIdx].qty = newQty;
    } else {
      cart.items.push({
        product,
        sku,
        size: String(size).toUpperCase(),
        color: String(color),
        qty: qtyNum,
        unitPrice: variant.price || productObj.basePrice,
      });
    }

    await cart.save();

    const items = cart.items;
    const summary = calcSummary(items);

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

    const qtyNum = Math.max(1, Number(qty) || 1);

    const cart = await resolveCart(req, res, res.locals.currentUser);
    if (!cart) {
      return next(new ErrorResponse('Giỏ hàng không tồn tại', 404));
    }

    const item = (cart.items || []).find((it) => it.sku === itemId);
    if (!item) {
      return next(new ErrorResponse('Sản phẩm không tồn tại trong giỏ', 404));
    }

    const productObj = await Product.findById(item.product);
    const variant = (productObj && productObj.variants) ? productObj.variants.find((v) => v.sku === item.sku) : null;
    const maxStock = variant ? variant.stock : 0;
    if (qtyNum > maxStock) {
      return next(new ErrorResponse(`Vượt quá tồn kho (còn ${maxStock})`, 409));
    }

    item.qty = qtyNum;
    await cart.save();

    const items = cart.items;
    const summary = calcSummary(items);

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

    const beforeLen = (cart.items || []).length;
    cart.items = (cart.items || []).filter((it) => it.sku !== itemId);

    if (cart.items.length === beforeLen) {
      return next(new ErrorResponse('Sản phẩm không tồn tại trong giỏ', 404));
    }

    await cart.save();

    const items = cart.items;
    const summary = calcSummary(items);

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

    const cartId = req.cookies ? req.cookies.cartId : undefined;
    const guestCart = cartId ? await Cart.findOne({ sessionId: cartId }) : null;

    let customerCart = await Cart.findOne({ user: currentUser.id });

    if (guestCart && guestCart.items && guestCart.items.length > 0) {
      if (!customerCart) {
        customerCart = await Cart.create({ user: currentUser.id, items: [] });
      }

      for (const guestItem of guestCart.items) {
        const existingIdx = (customerCart.items || []).findIndex(
          (item) => item.sku === guestItem.sku
        );

        if (existingIdx >= 0) {
          const existingItem = customerCart.items[existingIdx];
          const productObj = await Product.findById(guestItem.product);
          const variant = (productObj && productObj.variants)
            ? productObj.variants.find((v) => v.sku === guestItem.sku)
            : null;
          const maxStock = variant ? variant.stock : 0;
          const newQty = existingItem.qty + guestItem.qty;
          if (newQty > maxStock) {
            return next(
              new ErrorResponse(
                `Vượt quá tồn kho cho SKU ${guestItem.sku} (còn ${maxStock})`,
                409
              )
            );
          }
          existingItem.qty = newQty;
          existingItem.unitPrice = variant ? (variant.price || productObj.basePrice) : existingItem.unitPrice;
          existingItem.mergedAt = new Date();
          existingItem.mergedFrom = 'guest';
        } else {
          const productObj = await Product.findById(guestItem.product);
          const variant = (productObj && productObj.variants)
            ? productObj.variants.find((v) => v.sku === guestItem.sku)
            : null;
          const unitPrice = variant
            ? variant.price || productObj.basePrice
            : guestItem.unitPrice || 0;
          customerCart.items.push({
            product: guestItem.product,
            sku: guestItem.sku,
            size: guestItem.size,
            color: guestItem.color,
            qty: guestItem.qty,
            unitPrice,
            mergedAt: new Date(),
            mergedFrom: 'guest',
          });
        }
      }

      await customerCart.save();
      await Cart.deleteOne({ sessionId: cartId });
      res.clearCookie('cartId');
    }

    const items = customerCart ? customerCart.items : [];
    const summary = calcSummary(items);

    return res.status(200).json({
      success: true,
      data: { items, ...summary },
    });
  })
);

module.exports = router;
