const mongoose = require('mongoose');
const slugify = require('slugify');

/**
 * Biến thể được nhúng trong Product (Embedded Data).
 * Mỗi phần tử là một cặp Size - Color độc lập với tồn kho riêng.
 * Xem mục 2.3 trong báo cáo thiết kế.
 */
const variantSchema = new mongoose.Schema(
    {
        sku: {
            type: String,
            trim: true,
            uppercase: true,
            // SKU dùng để tham chiếu biến thể từ OrderItem.
            // Không bắt buộc để tránh chặn dữ liệu cũ chưa có mã.
            default: undefined
        },

        size: {
            type: String,
            required: [true, 'Kích cỡ (size) là bắt buộc'],
            trim: true,
            uppercase: true
        },

        color: {
            type: String,
            required: [true, 'Màu sắc (color) là bắt buộc'],
            trim: true
        },

        stock: {
            type: Number,
            required: [true, 'Tồn kho (stock) là bắt buộc'],
            min: [0, 'Tồn kho không được âm'],
            default: 0,
            validate: {
                validator: Number.isInteger,
                message: 'Tồn kho phải là số nguyên'
            }
        }
    },
    { _id: true }
);

const productSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Tiêu đề sản phẩm là bắt buộc'],
            trim: true,
            maxlength: [200, 'Tiêu đề không được vượt quá 200 ký tự']
        },

        // Slug dùng làm URL thân thiện SEO, có chỉ mục duy nhất (mục 2.3).
        slug: {
            type: String,
            trim: true,
            lowercase: true
        },

        description: {
            type: String,
            trim: true,
            default: ''
        },

        price: {
            type: Number,
            required: [true, 'Giá sản phẩm là bắt buộc'],
            min: [0, 'Giá sản phẩm không được âm']
        },

        // Chỉ lưu URL ảnh trên CDN, không lưu tệp nhị phân trong cơ sở dữ liệu.
        images: {
            type: [String],
            default: []
        },

        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Category',
            required: [true, 'Danh mục sản phẩm là bắt buộc']
        },

        material: {
            type: String,
            trim: true,
            default: ''
        },

        variants: {
            type: [variantSchema],
            default: [],
            validate: {
                validator: (variants) => variants.length > 0,
                message: 'Sản phẩm phải có ít nhất một biến thể'
            }
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

/**
 * Tự sinh slug từ title khi tạo mới hoặc khi title thay đổi.
 */
productSchema.pre('validate', function () {
    if (this.title && (!this.slug || this.isModified('title'))) {
        this.slug = slugify(this.title, {
            lower: true,
            strict: true,
            locale: 'vi',
            trim: true
        });
    }
});

/**
 * Kiểm tra không trùng cặp Size - Color trong cùng một sản phẩm.
 * Tầng ứng dụng phải đảm bảo ràng buộc này vì MongoDB không ép được.
 */
productSchema.pre('validate', function () {
    const seen = new Set();

    for (const variant of this.variants) {
        const key = `${variant.size}__${variant.color}`.toLowerCase();

        if (seen.has(key)) {
            throw new Error(
                `Biến thể trùng lặp: Size ${variant.size} - Màu ${variant.color}`
            );
        }

        seen.add(key);
    }
});

// Virtual tiện cho view: tổng tồn kho và trạng thái còn hàng.
productSchema.virtual('totalStock').get(function () {
    return this.variants.reduce((sum, variant) => sum + variant.stock, 0);
});

productSchema.virtual('inStock').get(function () {
    return this.variants.some((variant) => variant.stock > 0);
});

// Chỉ mục duy nhất cho slug (dùng làm URL).
productSchema.index({ slug: 1 }, { unique: true });

// Chỉ mục hợp thành cho bộ lọc danh mục + khoảng giá (mục 2.3).
productSchema.index({ category: 1, price: 1 });

// Chỉ mục đa khóa (multikey) cho bộ lọc biến thể Size / Màu (mục 2.3).
productSchema.index({ 'variants.size': 1, 'variants.color': 1 });

// Chỉ mục văn bản hỗ trợ tìm kiếm theo từ khóa tốt hơn biểu thức chính quy.
productSchema.index(
    { title: 'text', description: 'text' },
    { default_language: 'none' }
);

module.exports = mongoose.model('Product', productSchema);