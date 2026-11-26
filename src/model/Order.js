const mongoose = require('mongoose');
const { ORDER_CODE_REGEX, buildOrderCode } = require('../utils/orderCode');

const ORDER_STATUSES = Object.freeze([
  'pending',
  'confirmed',
  'shipping',
  'delivered',
  'cancelled',
]);

const ORDER_STATUS_FLOW = Object.freeze({
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipping', 'cancelled'],
  shipping: ['delivered'],
  delivered: [],
  cancelled: [],
});

const PAYMENT_METHODS = Object.freeze(['cod', 'bank_transfer']);
const PAYMENT_STATUSES = Object.freeze(['unpaid', 'paid', 'refunded']);

const SHIPPING_FEE = 30000;
const FREE_SHIPPING_THRESHOLD = 500000;

const calculateShippingFee = (subtotal) =>
  subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;

/**
 * Địa chỉ giao hàng là snapshot tại thời điểm đặt, không tham chiếu Address.
 */
const shippingAddressSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, maxlength: 50 },
    fullName: {
      type: String,
      required: [true, 'Tên người nhận là bắt buộc'],
      trim: true,
      maxlength: [80, 'Tên người nhận tối đa 80 ký tự'],
    },
    phone: {
      type: String,
      required: [true, 'Số điện thoại giao hàng là bắt buộc'],
      trim: true,
      match: [/^(0|\+84)[0-9]{9,10}$/, 'Số điện thoại giao hàng không hợp lệ'],
    },
    province: {
      type: String,
      required: [true, 'Tỉnh/thành phố là bắt buộc'],
      trim: true,
      maxlength: [100, 'Tỉnh/thành phố tối đa 100 ký tự'],
    },
    district: {
      type: String,
      trim: true,
      maxlength: [100, 'Quận/huyện tối đa 100 ký tự'],
    },
    ward: {
      type: String,
      required: [true, 'Phường/xã là bắt buộc'],
      trim: true,
      maxlength: [100, 'Phường/xã tối đa 100 ký tự'],
    },
    provinceCode: { type: String, trim: true, maxlength: 20 },
    wardCode: { type: String, trim: true, maxlength: 20 },
    detail: {
      type: String,
      required: [true, 'Địa chỉ chi tiết là bắt buộc'],
      trim: true,
      maxlength: [200, 'Địa chỉ chi tiết tối đa 200 ký tự'],
    },
    isDefault: { type: Boolean, default: false },
  },
  { _id: false },
);

/**
 * Dòng hàng là snapshot tại thời điểm đặt; không đọc lại Product/Variant.
 */
const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Sản phẩm trong đơn hàng là bắt buộc'],
    },
    name: {
      type: String,
      required: [true, 'Tên sản phẩm trong đơn hàng là bắt buộc'],
      trim: true,
      maxlength: [120, 'Tên sản phẩm trong đơn hàng tối đa 120 ký tự'],
    },
    image: { type: String, trim: true, default: '' },
    sku: {
      type: String,
      required: [true, 'SKU trong đơn hàng là bắt buộc'],
      trim: true,
      uppercase: true,
    },
    size: { type: String, trim: true, uppercase: true },
    color: { type: String, trim: true },
    unitPrice: {
      type: Number,
      required: [true, 'Đơn giá là bắt buộc'],
      min: [0, 'Đơn giá không được âm'],
      validate: {
        validator: Number.isInteger,
        message: 'Đơn giá phải là số nguyên (VND)',
      },
    },
    qty: {
      type: Number,
      required: [true, 'Số lượng là bắt buộc'],
      min: [1, 'Số lượng phải lớn hơn 0'],
      validate: {
        validator: Number.isInteger,
        message: 'Số lượng phải là số nguyên',
      },
    },
    lineTotal: {
      type: Number,
      required: [true, 'Thành tiền dòng hàng là bắt buộc'],
      min: [0, 'Thành tiền không được âm'],
      validate: {
        validator: Number.isInteger,
        message: 'Thành tiền phải là số nguyên (VND)',
      },
    },
  },
  { _id: false },
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
      enum: {
        values: ORDER_STATUSES,
        message: 'Trạng thái lịch sử không hợp lệ',
      },
    },
    at: { type: Date, default: Date.now },
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    note: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { _id: false },
);

/**
 * Schema đơn hàng theo data dictionary T2-2-1 (orders).
 * Không soft-delete: orders giữ lại để audit.
 */
const orderSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
      match: [ORDER_CODE_REGEX, 'Mã đơn phải có dạng ORD-YYYYMMDD-XXXXXX'],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Người đặt hàng là bắt buộc'],
    },
    items: {
      type: [orderItemSchema],
      default: [],
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: 'Đơn hàng phải có ít nhất một sản phẩm',
      },
    },
    shippingAddress: {
      type: shippingAddressSchema,
      required: [true, 'Địa chỉ giao hàng là bắt buộc'],
    },
    paymentMethod: {
      type: String,
      required: [true, 'Phương thức thanh toán là bắt buộc'],
      enum: {
        values: PAYMENT_METHODS,
        message: 'Phương thức thanh toán không hợp lệ',
      },
      default: 'cod',
    },
    paymentStatus: {
      type: String,
      enum: {
        values: PAYMENT_STATUSES,
        message: 'Trạng thái thanh toán không hợp lệ',
      },
      default: 'unpaid',
    },
    status: {
      type: String,
      enum: {
        values: ORDER_STATUSES,
        message: 'Trạng thái đơn hàng không hợp lệ',
      },
      default: 'pending',
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
    subtotal: {
      type: Number,
      required: [true, 'Tạm tính là bắt buộc'],
      min: [0, 'Tạm tính không được âm'],
      validate: {
        validator: Number.isInteger,
        message: 'Tạm tính phải là số nguyên (VND)',
      },
    },
    shippingFee: {
      type: Number,
      required: [true, 'Phí vận chuyển là bắt buộc'],
      min: [0, 'Phí vận chuyển không được âm'],
      validate: {
        validator: Number.isInteger,
        message: 'Phí vận chuyển phải là số nguyên (VND)',
      },
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, 'Giảm giá không được âm'],
      validate: {
        validator: Number.isInteger,
        message: 'Giảm giá phải là số nguyên (VND)',
      },
    },
    total: {
      type: Number,
      required: [true, 'Tổng tiền là bắt buộc'],
      min: [0, 'Tổng tiền không được âm'],
      validate: {
        validator: Number.isInteger,
        message: 'Tổng tiền phải là số nguyên (VND)',
      },
    },
    note: { type: String, trim: true, maxlength: [500, 'Ghi chú tối đa 500 ký tự'] },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

orderSchema.pre('validate', function prepareOrder() {
  if (!this.code && this._id) {
    this.code = buildOrderCode({ id: this._id });
  }

  let subtotal = 0;

  for (const item of this.items || []) {
    if (typeof item.unitPrice === 'number' && typeof item.qty === 'number') {
      item.lineTotal = item.unitPrice * item.qty;
    }

    if (Number.isFinite(item.lineTotal)) {
      subtotal += item.lineTotal;
    }
  }

  this.subtotal = subtotal;

  if (this.discount === undefined || this.discount === null) {
    this.discount = 0;
  }

  if (this.shippingFee === undefined || this.shippingFee === null) {
    this.shippingFee = calculateShippingFee(subtotal);
  }

  this.total = this.subtotal + this.shippingFee - this.discount;

  if (this.isNew && (!this.statusHistory || this.statusHistory.length === 0)) {
    this.statusHistory = [
      { status: this.status || 'pending', at: new Date(), by: this.user },
    ];
  }
});

// Lịch sử đơn của khách.
orderSchema.index({ user: 1, createdAt: 1 });

// Admin lọc đơn theo trạng thái.
orderSchema.index({ status: 1, createdAt: 1 });

orderSchema.statics.ORDER_STATUSES = ORDER_STATUSES;
orderSchema.statics.ORDER_STATUS_FLOW = ORDER_STATUS_FLOW;
orderSchema.statics.PAYMENT_METHODS = PAYMENT_METHODS;
orderSchema.statics.PAYMENT_STATUSES = PAYMENT_STATUSES;
orderSchema.statics.SHIPPING_FEE = SHIPPING_FEE;
orderSchema.statics.FREE_SHIPPING_THRESHOLD = FREE_SHIPPING_THRESHOLD;
orderSchema.statics.calculateShippingFee = calculateShippingFee;

// Service gọi trước khi đổi status; MongoDB không tự biết trạng thái cũ.
orderSchema.statics.canTransition = (from, to) =>
  (ORDER_STATUS_FLOW[from] || []).includes(to);

module.exports =
  mongoose.models.Order || mongoose.model('Order', orderSchema);
