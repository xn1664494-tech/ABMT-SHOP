const crypto = require('crypto');
const Cart = require('../model/Cart');
const Product = require('../model/Products');
const { calculateShippingFee } = require('../model/Order');
const { ensureCartItemIds } = require('../utils/cartItems');
const ErrorResponse = require('../utils/appError');

const CART_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const PRODUCT_CART_LOOKUP_FIELDS = 'isDeleted isActive basePrice variants';

const loadProductsByIds = async (ids = []) => {
  const uniqueIds = [...new Set(ids.map((id) => String(id)))].filter(Boolean);
  if (!uniqueIds.length) return new Map();

  const products = await Product.find({ _id: { $in: uniqueIds } })
    .select(PRODUCT_CART_LOOKUP_FIELDS)
    .lean();
  return new Map(products.map((product) => [String(product._id), product]));
};

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
  const productsById = await loadProductsByIds(items.map((item) => item.product));

  for (const item of items) {
    const product = productsById.get(String(item.product));
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
 * - onOverflow='throw' (mặc định): ném 409 khi vượt tồn kho (dùng cho API).
 * - onOverflow='clamp': cắt số lượng về mức tồn kho tối đa và gắn cờ
 *   userCart.mergeAdjusted để tầng web hiển thị flash (dùng cho trang HTML).
 */
const mergeGuestIntoUser = async (
  userCart,
  guestCart,
  res,
  { onOverflow = 'throw' } = {},
) => {
  if (!userCart || !guestCart) return userCart;

  const clamp = onOverflow === 'clamp';
  const productsById = await loadProductsByIds(
    (guestCart.items || []).map((item) => item.product),
  );

  for (const guestItem of guestCart.items || []) {
    const product = productsById.get(String(guestItem.product));
    const variant =
      product && !product.isDeleted
        ? (product.variants || []).find((v) => v.sku === guestItem.sku)
        : null;

    // Bỏ qua dòng không còn bán được: sản phẩm/biến thể đã xóa hoặc ngừng bán.
    if (!product || product.isDeleted || product.isActive === false || !variant) {
      continue;
    }

    const idx = (userCart.items || []).findIndex(
      (item) => item.sku === guestItem.sku,
    );

    if (idx >= 0) {
      const existingItem = userCart.items[idx];
      const desiredQty = existingItem.qty + guestItem.qty;

      if (desiredQty > variant.stock) {
        if (!clamp) {
          throw new ErrorResponse(
            `Vượt quá tồn kho cho SKU ${guestItem.sku} (${variant.size}/${variant.color}) — còn ${variant.stock}, giỏ khách ${guestItem.qty}`,
            409,
          );
        }

        const allowed = Math.max(0, variant.stock - existingItem.qty);
        const addQty = Math.min(guestItem.qty, allowed);
        if (addQty < guestItem.qty) userCart.mergeAdjusted = true;
        if (addQty > 0) existingItem.qty = existingItem.qty + addQty;
      } else {
        existingItem.qty = desiredQty;
      }

      existingItem.unitPrice =
        variant.price != null ? variant.price : product.basePrice;
      existingItem.mergedAt = new Date();
      existingItem.mergedFrom = 'guest';
    } else {
      let qty = guestItem.qty;

      if (guestItem.qty > variant.stock) {
        if (!clamp) {
          throw new ErrorResponse(
            `Vượt quá tồn kho cho SKU ${guestItem.sku} (${variant.size}/${variant.color}) — còn ${variant.stock}, giỏ khách ${guestItem.qty}`,
            409,
          );
        }

        qty = variant.stock;
        userCart.mergeAdjusted = true;
      }

      // Bỏ dòng hết hàng khi đang clamp (không thể thêm vào giỏ).
      if (clamp && qty <= 0) continue;

      const unitPrice =
        variant.price != null ? variant.price : product.basePrice;

      userCart.items.push({
        ...(guestItem._id ? { _id: guestItem._id } : {}),
        product: guestItem.product,
        sku: guestItem.sku,
        size: guestItem.size,
        color: guestItem.color,
        qty,
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
 * - User đã đăng nhập: ưu tiên giỏ user; nếu chưa có thì chuyển giỏ guest sang user.
 * - Khách vãng lai: dùng giỏ theo cartId cookie.
 * - createIfMissing: tạo giỏ mới khi chưa có (kèm set cookie với khách).
 * - mergeOnConflict: xử lý khi có cả giỏ user và giỏ guest:
 *   'none' (mặc định) giữ nguyên chờ /merge tường minh;
 *   'throw' gộp và ném 409 nếu vượt kho;
 *   'clamp' gộp và cắt số lượng về tồn kho tối đa (cho trang HTML).
 */
const resolveCartForRequest = async ({
  userId = null,
  cartId = null,
  createIfMissing = false,
  res = null,
  mergeOnConflict = 'none',
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
      if (mergeOnConflict === 'throw' || mergeOnConflict === 'clamp') {
        cart = await mergeGuestIntoUser(cart, guestCart, res, {
          onOverflow: mergeOnConflict,
        });
      }
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
