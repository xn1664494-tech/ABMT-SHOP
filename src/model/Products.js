const mongoose = require('mongoose');
const slugify = require('slugify');
const { SKU_REGEX } = require('../utils/sku');
const softDeletePlugin = require('../plugins/softDelete');

const URL_REGEX = /^https?:\/\/\S+$/i;

/**
 * Biến thể được nhúng trong Product (Embedded Data) theo data dictionary:
 * size, color, colorCode, sku, stock, price.
 *
 * Mỗi phần tử là một cặp Size - Color độc lập với tồn kho riêng.
 */
const variantSchema = new mongoose.Schema(
  {
    size: {
      type: String,
      required: [true, 'Kích cỡ (size) là bắt buộc'],
      trim: true,
      uppercase: true,
    },
    color: {
      type: String,
      required: [true, 'Màu sắc (color) là bắt buộc'],
      trim: true,
    },
    colorCode: {
      type: String,
      trim: true,
      match: [/^#[0-9A-Fa-f]{6}$/, 'Mã màu phải có dạng #RRGGBB'],
    },
    sku: {
      type: String,
      required: [true, 'SKU là bắt buộc'],
      trim: true,
      uppercase: true,
      match: [
        SKU_REGEX,
        'SKU không đúng định dạng SP-{CAT}-{NNN}-{SIZE}-{COLOR}',
      ],
    },
    stock: {
      type: Number,
      default: 0,
      min: [0, 'Tồn kho không được âm'],
      validate: {
        validator: Number.isInteger,
        message: 'Tồn kho phải là số nguyên',
      },
    },
    price: {
      type: Number,
      default: null,
      min: [0, 'Giá biến thể không được âm'],
      validate: {
        validator: (value) =>
          value === null || value === undefined || Number.isInteger(value),
        message: 'Giá biến thể phải là số nguyên (VND)',
      },
    },
  },
  { _id: true },
);

/**
 * Schema sản phẩm theo data dictionary T2-2-1 (products):
 * name, slug, description, category, images, basePrice, variants,
 * isActive, isDeleted, deletedAt, timestamps.
 */
const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tên sản phẩm là bắt buộc'],
      trim: true,
      maxlength: [120, 'Tên sản phẩm tối đa 120 ký tự'],
    },
    slug: {
      type: String,
      required: [true, 'Slug sản phẩm là bắt buộc'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [2000, 'Mô tả sản phẩm tối đa 2000 ký tự'],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Danh mục sản phẩm là bắt buộc'],
    },
    // Chỉ lưu URL ảnh, không lưu tệp nhị phân trong cơ sở dữ liệu.
    images: {
      type: [String],
      default: [],
      validate: {
        validator: (urls) =>
          Array.isArray(urls) && urls.every((url) => URL_REGEX.test(url)),
        message: 'Ảnh phải là URL hợp lệ (http/https)',
      },
    },
    basePrice: {
      type: Number,
      required: [true, 'Giá cơ bản là bắt buộc'],
      min: [0, 'Giá cơ bản không được âm'],
      validate: {
        validator: Number.isInteger,
        message: 'Giá cơ bản phải là số nguyên (VND)',
      },
    },
    variants: {
      type: [variantSchema],
      default: undefined,
      required: [true, 'Sản phẩm phải có ít nhất một biến thể'],
      validate: {
        validator: (variants) => Array.isArray(variants) && variants.length > 0,
        message: 'Sản phẩm phải có ít nhất một biến thể',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
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
        delete ret.isDeleted;
        delete ret.deletedAt;
        return ret;
      },
    },
    toObject: { virtuals: true },
  },
);

productSchema.pre('validate', function generateSlug() {
  if (this.name && (!this.slug || this.isModified('name'))) {
    this.slug = slugify(this.name, {
      lower: true,
      strict: true,
      locale: 'vi',
      trim: true,
    });
  }
});

productSchema.pre('validate', function rejectDuplicateVariants() {
  const sizeColorKeys = new Set();
  const skuKeys = new Set();

  for (const variant of this.variants || []) {
    const sizeColorKey = `${variant.size || ''}__${
      variant.color || ''
    }`.toLowerCase();

    if (sizeColorKeys.has(sizeColorKey)) {
      this.invalidate(
        'variants',
        `Biến thể trùng lặp: Size ${variant.size} - Màu ${variant.color}`,
      );
    }
    sizeColorKeys.add(sizeColorKey);

    if (variant.sku) {
      if (skuKeys.has(variant.sku)) {
        this.invalidate(
          'variants',
          `SKU bị trùng trong cùng sản phẩm: ${variant.sku}`,
        );
      }
      skuKeys.add(variant.sku);
    }
  }
});

// Virtual tiện cho view: tổng tồn kho và trạng thái còn hàng.
productSchema.virtual('totalStock').get(function totalStock() {
  return (this.variants || []).reduce(
    (sum, variant) => sum + (variant.stock || 0),
    0,
  );
});

productSchema.virtual('inStock').get(function inStock() {
  return (this.variants || []).some((variant) => variant.stock > 0);
});

// Lọc danh mục + khoảng giá.
productSchema.index({ category: 1, basePrice: 1 });

// SKU duy nhất toàn cục; sparse để không ảnh hưởng dữ liệu thiếu SKU cũ.
productSchema.index({ 'variants.sku': 1 }, { unique: true, sparse: true });

// Lọc theo Size / Màu (multikey).
productSchema.index({ 'variants.size': 1, 'variants.color': 1 });

// Lọc sản phẩm đang hiển thị.
productSchema.index({ isActive: 1, isDeleted: 1 });

// Danh sách mặc định (visibility + sort newest kèm tie-breaker _id) dùng trọn
// index này nên không cần SORT trong bộ nhớ.
productSchema.index({ isActive: 1, isDeleted: 1, createdAt: -1, _id: -1 });
productSchema.index({
  category: 1,
  isActive: 1,
  isDeleted: 1,
  createdAt: -1,
  _id: -1,
});

productSchema.plugin(softDeletePlugin);

module.exports =
  mongoose.models.Product || mongoose.model('Product', productSchema);
