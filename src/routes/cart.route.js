const express = require('express');
const router = express.Router();
const Cart = require('../model/Cart');
const Product = require('../model/Products');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/appError');

/**
 * Kiểm tra xem user đã đăng nhập qua session chưa
 */
const isAuthenticated = (req) => !!req.session && !!req.session.user;

/**
 * GET /cart - Render trang giỏ hàng
 * - Đã đăng nhập: lấy giỏ hàng theo user
 * - Chưa đăng nhập: render giỏ rỗng an toàn
 */
router.get('/', function (req, res, next) {
  const authenticated = isAuthenticated(req);

  if (authenticated) {
    Cart.findOne({ user: req.session.user._id })
      .then((cart) => {
        const items = cart ? cart.items : [];
        const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
        const shippingFee = subtotal >= 500000 ? 0 : 30000;
        const total = subtotal + shippingFee;
        const count = items.reduce((sum, item) => sum + item.qty, 0);

        const cartData = {
          empty: items.length === 0,
          items,
          subtotal,
          shippingFee,
          total,
          count
        };

        res.render('pages/cart', {
          title: 'Giỏ hàng',
          locals: cartData,
          user: req.session.user
        });
      })
      .catch(next);
  } else {
    // Chưa đăng nhập: render giỏ rỗng (không redirect sang login)
    const cartData = {
      empty: true,
      items: [],
      subtotal: 0,
      shippingFee: 0,
      total: 0,
      count: 0
    };
    res.render('pages/cart', {
      title: 'Giỏ hàng',
      locals: cartData
    });
  }
});

/**
 * POST /api/cart/items - Thêm sản phẩm vào giỏ
 * - Khách đã đăng nhập: lưu vào giỏ theo user
 * - Khách vãng lai: lưu vào giỏ theo sessionId
 */
router.post(
  '/items',
  asyncHandler(async (req, res, next) => {
    const { product, size, color, qty } = req.body;

    if (!product || !size || !color) {
      return next(new ErrorResponse('Thiếu thông tin sản phẩm', 400));
    }

    const productObj = await Product.findById(product);
    if (!productObj) {
      return next(new ErrorResponse('Sản phẩm không tồn tại', 404));
    }

    // Tạo SKU từ size và color
    const sku = `${size}__${color}`;

    const authenticated = isAuthenticated(req);

    if (authenticated) {
      // Khách đã đăng nhập: thêm/sửa vào giỏ theo user
      let cart = await Cart.findOne({ user: req.session.user._id });

      if (!cart) {
        cart = await Cart.create({ user: req.session.user._id, items: [] });
      }

      // Kiểm tra xem sản phẩm đã có trong giỏ chưa (trùng SKU)
      const existingItemIndex = cart.items.findIndex(
        (item) => item.sku === sku && item.product.equals(product)
      );

      if (existingItemIndex >= 0) {
        cart.items[existingItemIndex].qty += Number(qty) || 1;
      } else {
        cart.items.push({
          product,
          sku,
          size,
          color,
          qty: Number(qty) || 1,
          unitPrice: productObj.variants?.find(
            (v) => v.size === size && v.color === color
          )?.price || productObj.basePrice,
        });
      }

      await cart.save();

      const items = cart.items;
      const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
      const shippingFee = subtotal >= 500000 ? 0 : 30000;
      const total = subtotal + shippingFee;
      const count = items.reduce((sum, item) => sum + item.qty, 0);

      return res.status(200).json({
        success: true,
        data: {
          items,
          subtotal,
          shippingFee,
          total,
          count,
        }
      });
    } else {
      // Khách vãng lai: thêm/sửa vào giỏ theo sessionId
      let sessionId = req.sessionID;

      let cart = await Cart.findOne({ sessionId });

      if (!cart) {
        cart = await Cart.create({ sessionId, items: [] });
      }

      const existingItemIndex = cart.items.findIndex(
        (item) => item.sku === sku && item.product.equals(product)
      );

      if (existingItemIndex >= 0) {
        cart.items[existingItemIndex].qty += Number(qty) || 1;
      } else {
        cart.items.push({
          product,
          sku,
          size,
          color,
          qty: Number(qty) || 1,
          unitPrice: productObj.variants?.find(
            (v) => v.size === size && v.color === color
          )?.price || productObj.basePrice,
        });
      }

      await cart.save();

      const items = cart.items;
      const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
      const shippingFee = subtotal >= 500000 ? 0 : 30000;
      const total = subtotal + shippingFee;
      const count = items.reduce((sum, item) => sum + item.qty, 0);

      return res.status(200).json({
        success: true,
        data: {
          items,
          subtotal,
          shippingFee,
          total,
          count,
        }
      });
    }
  })
);

/**
 * PUT /api/cart/items/:id - Cập nhật số lượng sản phẩm trong giỏ
 */
router.put(
  '/items/:id',
  asyncHandler(async (req, res, next) => {
    const { qty } = req.body;
    const itemId = req.params.id;

    if (!qty || qty < 1) {
      return next(new ErrorResponse('Số lượng không hợp lệ', 400));
    }

    const authenticated = isAuthenticated(req);

    if (authenticated) {
      let cart = await Cart.findOne({ user: req.session.user._id });

      if (!cart) {
        return next(new ErrorResponse('Giỏ hàng không tồn tại', 404));
      }

      const item = cart.items.find((item) => item._id.toString() === itemId);

      if (!item) {
        return next(new ErrorResponse('Sản phẩm không tồn tại trong giỏ', 404));
      }

      item.qty = Math.max(1, qty);

      await cart.save();

      const items = cart.items;
      const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
      const shippingFee = subtotal >= 500000 ? 0 : 30000;
      const total = subtotal + shippingFee;
      const count = items.reduce((sum, item) => sum + item.qty, 0);

      return res.status(200).json({
        success: true,
        data: {
          items,
          subtotal,
          shippingFee,
          total,
          count,
        }
      });
    } else {
      let cart = await Cart.findOne({ sessionId: req.sessionID });

      if (!cart) {
        return next(new ErrorResponse('Giỏ hàng không tồn tại', 404));
      }

      const item = cart.items.find((item) => item._id.toString() === itemId);

      if (!item) {
        return next(new ErrorResponse('Sản phẩm không tồn tại trong giỏ', 404));
      }

      item.qty = Math.max(1, qty);

      await cart.save();

      const items = cart.items;
      const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
      const shippingFee = subtotal >= 500000 ? 0 : 30000;
      const total = subtotal + shippingFee;
      const count = items.reduce((sum, item) => sum + item.qty, 0);

      return res.status(200).json({
        success: true,
        data: {
          items,
          subtotal,
          shippingFee,
          total,
          count,
        }
      });
    }
  })
);

/**
 * DELETE /api/cart/items/:id - Xóa sản phẩm khỏi giỏ
 */
router.delete(
  '/items/:id',
  asyncHandler(async (req, res, next) => {
    const itemId = req.params.id;

    const authenticated = isAuthenticated(req);

    if (authenticated) {
      let cart = await Cart.findOneAndUpdate(
        { user: req.session.user._id },
        { $pull: { items: { _id: itemId } } },
        { new: true }
      );

      if (!cart) {
        return next(new ErrorResponse('Giỏ hàng không tồn tại', 404));
      }

      const items = cart.items || [];
      const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
      const shippingFee = subtotal >= 500000 ? 0 : 30000;
      const total = subtotal + shippingFee;
      const count = items.reduce((sum, item) => sum + item.qty, 0);

      return res.status(200).json({
        success: true,
        data: {
          items,
          subtotal,
          shippingFee,
          total,
          count,
        }
      });
    } else {
      let cart = await Cart.findOneAndUpdate(
        { sessionId: req.sessionID },
        { $pull: { items: { _id: itemId } } },
        { new: true }
      );

      if (!cart) {
        return next(new ErrorResponse('Giỏ hàng không tồn tại', 404));
      }

      const items = cart.items || [];
      const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
      const shippingFee = subtotal >= 500000 ? 0 : 30000;
      const total = subtotal + shippingFee;
      const count = items.reduce((sum, item) => sum + item.qty, 0);

      return res.status(200).json({
        success: true,
        data: {
          items,
          subtotal,
          shippingFee,
          total,
          count,
        }
      });
    }
  })
);

/**
 * GET /cart/merge - Gộp giỏ guest vào giỏ customer khi đăng nhập
 */
router.get(
  '/merge',
  asyncHandler(async (req, res, next) => {
    if (!req.session.user) {
      return next(new ErrorResponse('Chưa đăng nhập', 401));
    }

    // Lấy giỏ khách vãng lai hiện tại
    const guestCart = await Cart.findOne({ sessionId: req.sessionID });

    // Lấy/giỏ khách hàng
    let customerCart = await Cart.findOne({ user: req.session.user._id });

    if (guestCart && guestCart.items && guestCart.items.length > 0) {
      if (!customerCart) {
        customerCart = await Cart.create({
          user: req.session.user._id,
          items: [],
        });
      }

      // Giữ lại items từ giỏ khách, tránh trùng SKU
      const existingSkus = new Set(
        (customerCart.items || []).map((item) => item.sku)
      );

      guestCart.items.forEach((item) => {
        if (!existingSkus.has(item.sku)) {
          customerCart.items.push(item);
        }
      });

      await customerCart.save();
    }

    // Xóa giỏ khách vãng lai sau khi gộp
    await Cart.findOneAndDelete({ sessionId: req.sessionID });

    const items = customerCart.items || [];
    const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
    const shippingFee = subtotal >= 500000 ? 0 : 30000;
    const total = subtotal + shippingFee;
    const count = items.reduce((sum, item) => sum + item.qty, 0);

    return res.status(200).json({
      success: true,
      data: {
        items,
        subtotal,
        shippingFee,
        total,
        count,
      }
    });
  })
);

module.exports = router;