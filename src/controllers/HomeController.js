const asyncHandler = require('../utils/asyncHandler');
const homeService = require('../services/homeService');

class HomeController {
  // Trang chủ: lấy dữ liệu từ service rồi render view, lỗi được chuyển cho errorHandler.
  static index = asyncHandler(async (req, res) => {
    const data = await homeService.getHomeData();

    res.render('pages/home', {
      title: 'ABMT SHOP - Trang chủ',
      categories: data.categories || [],
      vouchers: data.vouchers || [],
      productsNewMen: data.productsNewMen || [],
      productsNewWomen: data.productsNewWomen || [],
      productsSale: data.productsSale || [],
      productsBestSeller: data.productsBestSeller || []
    });
  });
}

module.exports = HomeController;
