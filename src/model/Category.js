const mongoose = require('mongoose');
const slugify = require('slugify');
const softDeletePlugin = require('../plugins/softDelete');

/**
 * Schema danh mục theo data dictionary T2-2-1 (categories).
 * Hỗ trợ cây danh mục cha/con qua parentId (tự tham chiếu).
 * Soft-delete qua isDeleted / deletedAt.
 */
const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tên danh mục là bắt buộc'],
      trim: true,
      maxlength: [80, 'Tên danh mục tối đa 80 ký tự'],
    },
    slug: {
      type: String,
      required: [true, 'Slug danh mục là bắt buộc'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    order: {
      type: Number,
      default: 0,
      min: [0, 'Thứ tự không được âm'],
      validate: {
        validator: Number.isInteger,
        message: 'Thứ tự phải là số nguyên',
      },
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
        ret.id = ret._id ? ret._id.toString() : undefined;
        delete ret._id;
        delete ret.__v;
        delete ret.isDeleted;
        delete ret.deletedAt;
        return ret;
      },
    },
  },
);

categorySchema.pre('validate', function generateSlug() {
  if (this.name && (!this.slug || this.isModified('name'))) {
    this.slug = slugify(this.name, {
      lower: true,
      strict: true,
      locale: 'vi',
      trim: true,
    });
  }
});

categorySchema.pre('validate', function rejectSelfParent() {
  if (this.parentId && this._id && this.parentId.equals(this._id)) {
    this.invalidate(
      'parentId',
      'Danh mục không thể là cha của chính nó',
      this.parentId,
    );
  }
});

// Cây danh mục: duyệt theo cha và thứ tự sắp xếp.
categorySchema.index({ parentId: 1, order: 1 });

categorySchema.plugin(softDeletePlugin);

module.exports =
  mongoose.models.Category || mongoose.model('Category', categorySchema);
