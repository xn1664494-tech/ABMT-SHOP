const mongoose = require('mongoose');

/**
 * Thống kê bán hàng theo từng sản phẩm và từng ngày (múi giờ Asia/Ho_Chi_Minh).
 * `day` là chuỗi 'YYYY-MM-DD' để so sánh khoảng ngày bằng index đơn giản.
 */
const productSalesDailySchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Sản phẩm là bắt buộc'],
  },
  day: {
    type: String,
    required: [true, 'Ngày là bắt buộc'],
    match: [/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải có dạng YYYY-MM-DD'],
  },
  units: {
    type: Number,
    default: 0,
    min: [0, 'Số lượng bán không được âm'],
  },
  revenue: {
    type: Number,
    default: 0,
    min: [0, 'Doanh thu không được âm'],
  },
  orders: {
    type: Number,
    default: 0,
    min: [0, 'Số đơn không được âm'],
  },
});

productSalesDailySchema.index({ product: 1, day: 1 }, { unique: true });
productSalesDailySchema.index({ day: 1 });

module.exports =
  mongoose.models.ProductSalesDaily ||
  mongoose.model('ProductSalesDaily', productSalesDailySchema);
