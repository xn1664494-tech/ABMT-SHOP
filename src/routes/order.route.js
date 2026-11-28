const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Order = require('../model/Order');
const Cart = require('../model/Cart');
const Product = require('../model/Products');
const User = require('../model/User');
const { authenticate } = require('../middleware/authenticate');
const { csrfProtection } = require('../middleware/csrf');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/appError');
const { calculateShippingFee } = require('../model/Order');
const addressService = require('../services/addressService');
const { createOrder } = require('../services/CheckoutService');
const { cancelOrder } = require('../services/OrderCancellationService');
const { ORDER_SUMMARY_FIELDS } = require('../utils/orderFields');

const PRODUCT_ORDER_LOOKUP_FIELDS = 'name images basePrice variants isDeleted';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * POST /api/orders - Tạo đơn hàng mới (yêu cầu đăng nhập + CSRF)
 * Body: { item?, addressId | address{fullName, phone, province, district, ward, detail}, note, paymentMethod }
 */
router.post(
  '/',
  authenticate,
  csrfProtection,
  asyncHandler(async (req, res, next) => {
    const userId = req.user._id || req.user.id;
    const { addressId, address, note, paymentMethod, item: rawItemId } = req.body || {};
    const requirePhoneVerified = String(process.env.REQUIRE_PHONE_VERIFIED || "true") !== "false";
    if (requirePhoneVerified && req.user.role !== "admin" && !req.user.phoneVerified) {
      const err = new ErrorResponse("Nguoi dung chua xac minh so dien thoai", 403);
      err.code = "PHONE_NOT_VERIFIED";
      return next(err);
    }

    // Lấy giỏ hàng của user
    const cart = await Cart.findOne({ user: userId });
    if (!cart || !cart.items || cart.items.length === 0) {
      return next(new ErrorResponse('Giỏ hàng trống, không thể đặt hàng', 400));
    }

    let selectedItemId = null;
    if (rawItemId !== undefined && rawItemId !== null && rawItemId !== '') {
      if (typeof rawItemId !== 'string' || !isValidObjectId(rawItemId)) {
        return next(new ErrorResponse('Id sản phẩm trong giỏ không hợp lệ', 400));
      }
      const hasItem = cart.items.some((entry) => String(entry._id) === rawItemId);
      if (!hasItem) {
        return next(new ErrorResponse('Sản phẩm không tồn tại trong giỏ hàng', 404));
      }
      selectedItemId = rawItemId;
    }

    const itemsToOrder = selectedItemId
      ? cart.items.filter((entry) => String(entry._id) === selectedItemId)
      : cart.items;

    // Xác định địa chỉ giao hàng
    let shippingAddress = null;

    if (addressId) {
      if (!isValidObjectId(addressId)) {
        return next(new ErrorResponse('Id địa chỉ không hợp lệ', 400));
      }
      const userDoc = await User.findById(userId).select('addresses').lean();
      const addr = (userDoc && userDoc.addresses) ? userDoc.addresses.find((a) => String(a._id) === addressId) : null;
      if (!addr) {
        return next(new ErrorResponse('Địa chỉ không tồn tại', 404));
      }

      let province = addr.city;
      let ward = addr.ward;
      let provinceCode = addr.provinceCode;
      let wardCode = addr.wardCode;

      if (provinceCode && wardCode) {
        const found = addressService.findWard(provinceCode, wardCode);
        if (!found) {
          return next(new ErrorResponse('Địa chỉ không hợp lệ', 400));
        }
        province = found.province.fullName;
        ward = found.ward.name;
        provinceCode = found.province.code;
        wardCode = found.ward.code;
      }

      shippingAddress = {
        fullName: addr.recipient || addr.label || 'Người nhận',
        phone: addr.phone,
        province,
        district: addr.district,
        ward,
        detail: addr.street,
        provinceCode,
        wardCode,
      };
    } else if (address && typeof address === 'object') {
      const { fullName, phone, province, district, ward, detail, provinceCode, wardCode } = address;
      if (!fullName || !phone || !detail) {
        return next(new ErrorResponse('Thiếu thông tin địa chỉ giao hàng', 400));
      }

      let finalProvince = province;
      let finalWard = ward;
      let finalProvinceCode = provinceCode;
      let finalWardCode = wardCode;

      if (provinceCode && wardCode) {
        const found = addressService.findWard(provinceCode, wardCode);
        if (!found) {
          return next(new ErrorResponse('Địa chỉ không hợp lệ', 400));
        }
        finalProvince = found.province.fullName;
        finalWard = found.ward.name;
        finalProvinceCode = found.province.code;
        finalWardCode = found.ward.code;
      } else if (!province || !ward) {
        return next(new ErrorResponse('Thiếu thông tin địa chỉ giao hàng', 400));
      }

      shippingAddress = {
        fullName,
        phone,
        province: finalProvince,
        district: district || undefined,
        ward: finalWard,
        detail,
        provinceCode: finalProvinceCode || undefined,
        wardCode: finalWardCode || undefined,
      };
    } else {
      return next(new ErrorResponse('Thiếu địa chỉ giao hàng', 400));
    }

    // Xác định phương thức thanh toán
    const pm = paymentMethod || 'cod';
    if (!['cod', 'bank_transfer'].includes(pm)) {
      return next(new ErrorResponse('Phương thức thanh toán không hợp lệ', 400));
    }

    const productIds = [...new Set(itemsToOrder.map((item) => String(item.product)))];
    const products = await Product.find({ _id: { $in: productIds } })
      .select(PRODUCT_ORDER_LOOKUP_FIELDS)
      .lean();
    const productsById = new Map(
      products.map((product) => [String(product._id), product]),
    );

    const orderItems = [];
    let subtotal = 0;

    for (const item of itemsToOrder) {
      const productObj = productsById.get(String(item.product));
      if (!productObj || productObj.isDeleted) {
        return next(new ErrorResponse(`Sản phẩm ${item.sku} không còn tồn tại`, 404));
      }

      const variant = (productObj.variants || []).find((v) => v.sku === item.sku);
      if (!variant) {
        return next(new ErrorResponse(`Biến thể ${item.sku} không tồn tại`, 404));
      }

      if (variant.stock < item.qty) {
        return next(new ErrorResponse(`SKU ${item.sku} (${variant.size}/${variant.color}) chỉ còn ${variant.stock} (bạn đặt ${item.qty})`, 409));
      }

      const unitPrice = variant.price ?? productObj.basePrice;
      const lineTotal = unitPrice * item.qty;
      subtotal += lineTotal;

      orderItems.push({
        product: item.product,
        name: productObj.name,
        image: (productObj.images && productObj.images[0]) || '',
        sku: item.sku,
        size: item.size,
        color: item.color,
        unitPrice,
        qty: item.qty,
        lineTotal,
      });
    }

    const shippingFee = calculateShippingFee(subtotal);
    const discount = 0;
    const total = subtotal + shippingFee - discount;

    const order = await createOrder({
      userId,
      selectedItemId,
      orderPayload: {
        items: orderItems,
        shippingAddress,
        paymentMethod: pm,
        subtotal,
        shippingFee,
        discount,
        total,
        note: note || '',
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Tạo đơn hàng thành công',
      data: {
        id: String(order._id),
        code: order.code,
        total: order.total,
        status: order.status,
      },
    });
  })
);

/**
 * POST /api/orders/:id/cancel - Hủy đơn và hoàn kho (yêu cầu đăng nhập + CSRF)
 */
router.post(
  '/:id/cancel',
  authenticate,
  csrfProtection,
  asyncHandler(async (req, res, next) => {
    if (!isValidObjectId(req.params.id)) {
      return next(new ErrorResponse('Id đơn hàng không hợp lệ', 400));
    }

    const userId = req.user._id || req.user.id;
    const order = await Order.findById(req.params.id).select('user').lean();
    if (!order) {
      return next(new ErrorResponse('Đơn hàng không tồn tại', 404));
    }

    const cancelled = await cancelOrder({
      orderId: req.params.id,
      actorRole: req.user.role,
      actorId: userId,
      isOwner: String(order.user) === String(userId),
      note: req.body && req.body.note ? String(req.body.note).slice(0, 500) : '',
    });

    return res.status(200).json({
      success: true,
      message: 'Hủy đơn thành công',
      data: {
        id: String(cancelled._id),
        code: cancelled.code,
        status: cancelled.status,
        stockRestoredAt: cancelled.stockRestoredAt,
      },
    });
  })
);

/**
 * GET /api/orders - Danh sách đơn của tôi (phân trang đơn giản)
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res, next) => {
    const userId = req.user._id || req.user.id;
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(Math.max(1, parseInt(req.query.limit || '20', 10)), 100);
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find({ user: userId })
        .select(ORDER_SUMMARY_FIELDS)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments({ user: userId }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        items: orders.map((o) => ({
          id: String(o._id),
          code: o.code,
          createdAt: o.createdAt,
          total: o.total,
          status: o.status,
          paymentStatus: o.paymentStatus,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  })
);

/**
 * GET /api/orders/:id - Chi tiết đơn hàng (chỉ chủ đơn hoặc admin)
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res, next) => {
    if (!isValidObjectId(req.params.id)) {
      return next(new ErrorResponse('Id đơn hàng không hợp lệ', 400));
    }

    const order = await Order.findById(req.params.id).lean();
    if (!order) {
      return next(new ErrorResponse('Đơn hàng không tồn tại', 404));
    }

    const isOwner = String(order.user) === String(req.user._id || req.user.id);
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return next(new ErrorResponse('Không có quyền xem đơn hàng này', 403));
    }

    return res.status(200).json({
      success: true,
      data: {
        id: String(order._id),
        code: order.code,
        user: String(order.user),
        items: order.items,
        shippingAddress: order.shippingAddress,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        status: order.status,
        statusHistory: order.statusHistory,
        subtotal: order.subtotal,
        shippingFee: order.shippingFee,
        discount: order.discount,
        total: order.total,
        note: order.note,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
    });
  })
);

module.exports = router;
