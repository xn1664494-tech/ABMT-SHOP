const mongoose = require('mongoose');

/**
 * Đánh giá sản phẩm theo data dictionary T2-2-1 (reviews).
 * Không soft-delete: reviews giữ lại để audit.
 *
 * Ràng buộc verified purchase (order đã delivered và chứa product) và
 * unique (user, product) được service kiểm tra trước khi tạo.
 */
const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Người đánh giá là bắt buộc'],
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Sản phẩm được đánh giá là bắt buộc'],
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Đơn hàng xác thực là bắt buộc'],
    },
    rating: {
      type: Number,
      required: [true, 'Số sao đánh giá là bắt buộc'],
      min: [1, 'Số sao đánh giá tối thiểu là 1'],
      max: [5, 'Số sao đánh giá tối đa là 5'],
      validate: {
        validator: Number.isInteger,
        message: 'Số sao đánh giá phải là số nguyên',
      },
    },
    comment: {
      type: String,
      trim: true,
      default: '',
      maxlength: [1000, 'Nội dung đánh giá tối đa 1000 ký tự'],
    },
    isApproved: {
      type: Boolean,
      default: false,
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

// 1 đánh giá / sản phẩm / người dùng.
reviewSchema.index({ user: 1, product: 1 }, { unique: true });

// Hiển thị đánh giá đã duyệt theo sản phẩm.
reviewSchema.index({ product: 1, isApproved: 1, createdAt: 1 });

module.exports =
  mongoose.models.Review || mongoose.model('Review', reviewSchema);
