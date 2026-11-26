const crypto = require('crypto');
const Cart = require('../model/Cart');
const Product = require('../model/Products');
const { calculateShippingFee } = require('../model/Order');
const { ensureCartItemIds } = require('../utils/cartItems');
const ErrorResponse = require('../utils/appError');

const CART_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

/**
 * Ghi cookie định danh giỏ khách (cartId) để giữ giỏ qua nhiều request.
 */
const setCartCookie = (res, cartId) => {
  if (!res || !cartId) return;
  res.cookie('cartId', cartId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    maxAge: CART_COOKIE_MAX_AGE,
  });
};

/**
 * Chuẩn hóa màu để so khớp không phân biệt hoa/thường và khoảng trắng.
 */
const normalizeColor = (value) => String(value || '').trim().toLowerCase();

/**
 * Tìm vị trí dòng giỏ hàng theo _id (ưu tiên) hoặc fallback theo sku.
 * Trả về -1 nếu không tìm thấy.
 */
const findItemIndexById = (items = [], id) => {
  if (!id) return -1;
  const target = String(id);

  const byId = items.findIndex(
    (item) => item && item._id != null && String(item._id) === target,
  );
  if (byId >= 0) return byId;

  return items.findIndex((item) => item && item.sku === target);
};

/**
 * Tính tóm tắt giỏ hàng: tạm tính, phí ship, tổng tiền và tổng số lượng.
 */
const buildSummary = (items = []) => {
  let subtotal = 0;
  let count = 0;

  for (const item of items) {
    const unitPrice = Number(item.unitPrice) || 0;
    const qty = Number(item.qty) || 0;
    subtotal += unitPrice * qty;
    count += qty;
  }

  const shippingFee = calculateShippingFee(subtotal);
  const total = subtotal + shippingFee;

  return { subtotal, shippingFee, total, count };
};

/**
 * Làm mới unitPrice của từng dòng giỏ hàng theo giá hiện tại trong DB
 * (variant.price, fallback basePrice). Bỏ qua dòng không tìm thấy biến thể.
 */
const refreshItemPrices = async (items = []) => {
  for (const item of items) {
    const product = await Product.findById(item.product);
    if (!product || product.isDeleted) continue;

    const variant = (product.variants || []).find((v) => v.sku === item.sku);
    if (!variant) continue;

    const price = variant.price != null ? variant.price : product.basePrice;
    if (price != null) {
      item.unitPrice = price;
    }
  }

  return items;
};

/**
 * Gộp giỏ khách (guest) vào giỏ user, cộng dồn số lượng theo SKU,
 * kiểm tra tồn kho và làm mới đơn giá từ DB. Sau khi gộp sẽ xóa giỏ guest.
 * Ném 409 nếu tổng số lượng vượt tồn kho.
 */
const mergeGuestIntoUser = async (userCart, guestCart, res) => {
  if (!userCart || !guestCart) return userCart;

  for (const guestItem of guestCart.items || []) {
    const product = await Product.findById(guestItem.product);
    const variant =
      product && !product.isDeleted
        ? (product.variants || []).find((v) => v.sku === guestItem.sku)
        : null;

    const idx = (userCart.items || []).findIndex(
      (item) => item.sku === guestItem.sku,
    );

    if (idx >= 0) {
      const existingItem = userCart.items[idx];
      const newQty = existingItem.qty + guestItem.qty;

      if (variant && newQty > variant.stock) {
        throw new ErrorResponse(
          `Vượt quá tồn kho cho SKU ${guestItem.sku} (còn ${variant.stock})`,
          409,
        );
      }

      existingItem.qty = newQty;
      if (variant) {
        existingItem.unitPrice =
          variant.price != null ? variant.price : product.basePrice;
      }
      existingItem.mergedAt = new Date();
      existingItem.mergedFrom = 'guest';
    } else {
      const unitPrice = variant
        ? variant.price != null
          ? variant.price
          : product.basePrice
        : guestItem.unitPrice || 0;

      userCart.items.push({
        ...(guestItem._id ? { _id: guestItem._id } : {}),
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

  await userCart.save();
  await Cart.deleteOne({ sessionId: guestCart.sessionId });
  if (res) res.clearCookie('cartId');

  return userCart;
};

/**
 * Xác định giỏ hàng cho request hiện tại.
 * - User đã đăng nhập: ưu tiên giỏ user; nếu chưa có thì chuyển giỏ guest sang user;
 *   nếu đã có cả hai thì gộp giỏ guest vào giỏ user.
 * - Khách vãng lai: dùng giỏ theo cartId cookie.
 * - createIfMissing: tạo giỏ mới khi chưa có (kèm set cookie với khách).
 */
const resolveCartForRequest = async ({
  userId = null,
  cartId = null,
  createIfMissing = false,
  res = null,
} = {}) => {
  let effectiveCartId = cartId;
  let cart = null;

  if (userId) {
    cart = await Cart.findOne({ user: userId });
  }

  const guestCart = effectiveCartId
    ? await Cart.findOne({ sessionId: effectiveCartId })
    : null;

  if (userId) {
    if (!cart && guestCart) {
      // Chuyển quyền sở hữu giỏ guest sang user.
      guestCart.user = userId;
      guestCart.sessionId = null;
      guestCart.expiresAt = null;
      await guestCart.save();
      if (res) res.clearCookie('cartId');
      cart = guestCart;
    } else if (cart && guestCart) {
      cart = await mergeGuestIntoUser(cart, guestCart, res);
    }
  } else if (!cart && guestCart) {
    cart = guestCart;
  }

  if (!cart && createIfMissing) {
    if (userId) {
      cart = await Cart.create({ user: userId, items: [] });
    } else {
      if (!effectiveCartId) {
        effectiveCartId = crypto.randomBytes(16).toString('hex');
      }
      cart = await Cart.create({ sessionId: effectiveCartId, items: [] });
      setCartCookie(res, effectiveCartId);
    }
  }

  if (cart && ensureCartItemIds(cart)) {
    await cart.save();
  }

  return cart;
};

module.exports = {
  buildSummary,
  refreshItemPrices,
  resolveCartForRequest,
  mergeGuestIntoUser,
  findItemIndexById,
  normalizeColor,
};
