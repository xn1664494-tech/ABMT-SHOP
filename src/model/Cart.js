const mongoose = require('mongoose');

const GUEST_CART_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const GUEST_CART_TTL_SECONDS = Math.floor(GUEST_CART_TTL_MS / 1000);

const cartItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Sản phẩm trong giỏ hàng là bắt buộc'],
    },
    sku: {
      type: String,
      required: [true, 'SKU trong giỏ hàng là bắt buộc'],
      trim: true,
      uppercase: true,
    },
    size: { type: String, trim: true, uppercase: true },
    color: { type: String, trim: true },
    qty: {
      type: Number,
      required: [true, 'Số lượng trong giỏ hàng là bắt buộc'],
      min: [1, 'Số lượng trong giỏ hàng phải lớn hơn 0'],
      validate: {
        validator: Number.isInteger,
        message: 'Số lượng trong giỏ hàng phải là số nguyên',
      },
    },
    unitPrice: {
      type: Number,
      required: [true, 'Đơn giá trong giỏ hàng là bắt buộc'],
      min: [0, 'Đơn giá trong giỏ hàng không được âm'],
      validate: {
        validator: Number.isInteger,
        message: 'Đơn giá trong giỏ hàng phải là số nguyên (VND)',
      },
    },
    // Thời điểm dòng hàng được gộp từ giỏ khách sau khi đăng nhập.
    mergedAt: {
      type: Date,
      default: null,
    },
    // Nguồn gộp của dòng hàng (hiện tại là 'guest').
    mergedFrom: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { _id: true },
);

/**
 * Giỏ hàng theo data dictionary T2-2-1 (carts).
 * Khách vãng lai dùng sessionId + TTL 30 ngày; khách đăng nhập dùng user.
 */
const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    sessionId: {
      type: String,
      trim: true,
      default: null,
    },
    items: {
      type: [cartItemSchema],
      default: [],
    },
    expiresAt: {
      type: Date,
      default: null,
    },
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

cartSchema.pre('validate', function prepareCart() {
  const hasUser = Boolean(this.user);
  const hasSession = Boolean(this.sessionId);

  if (hasUser === hasSession) {
    this.invalidate(
      'user',
      'Giỏ hàng phải thuộc về user hoặc sessionId (không thể cả hai hoặc không có)',
    );
  }

  if (hasSession) {
    if (!this.expiresAt) {
      this.expiresAt = new Date(Date.now() + GUEST_CART_TTL_MS);
    }
  } else {
    this.expiresAt = null;
  }

  const seenSkus = new Set();

  for (const item of this.items || []) {
    if (!item.sku) continue;

    if (seenSkus.has(item.sku)) {
      this.invalidate(
        'items',
        `SKU bị trùng trong giỏ hàng: ${item.sku}`,
      );
    }

    seenSkus.add(item.sku);
  }
});

// 1 giỏ / user.
cartSchema.index(
  { user: 1 },
  {
    unique: true,
    partialFilterExpression: { user: { $type: 'objectId' } },
  },
);

// 1 giỏ / phiên khách.
cartSchema.index(
  { sessionId: 1 },
  {
    unique: true,
    partialFilterExpression: { sessionId: { $type: 'string' } },
  },
);

// Tự xóa giỏ khách hết hạn.
cartSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: GUEST_CART_TTL_SECONDS },
);

cartSchema.statics.GUEST_CART_TTL_MS = GUEST_CART_TTL_MS;
cartSchema.statics.GUEST_CART_TTL_SECONDS = GUEST_CART_TTL_SECONDS;

module.exports = mongoose.models.Cart || mongoose.model('Cart', cartSchema);
