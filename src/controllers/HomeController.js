class HomeController {
  static index(req, res) {
    // TODO: sau này thay bằng service gọi DB
    const categories = [
      { name: 'Áo thun', slug: 'ao-thun', image: '/images/placeholder/cat-1.svg' },
      { name: 'Sơ mi', slug: 'so-mi', image: '/images/placeholder/cat-2.svg' },
      { name: 'Quần jean', slug: 'quan-jean', image: '/images/placeholder/cat-3.svg' },
      { name: 'Váy', slug: 'vay', image: '/images/placeholder/cat-4.svg' }
    ];

    const vouchers = [
      { code: 'ABMT10', desc: 'Giảm 10% đơn đầu tiên', note: 'Tối đa 50K' },
      { code: 'FREESHIP', desc: 'Miễn phí vận chuyển', note: 'Đơn từ 299K' },
      { code: 'SALE20', desc: 'Giảm 20% bộ sưu tập mới', note: 'HSD 30/11' }
    ];

    const p = (name, slug, image, price, salePrice = null) => ({ name, slug, image, price, salePrice });

    const productsNewMen = [
      p('Áo thun nam basic', 'ao-thun-nam-basic', '/images/placeholder/men-1.svg', 299000),
      p('Áo sơ mi nam trắng', 'ao-so-mi-nam-trang', '/images/placeholder/men-2.svg', 459000),
      p('Quần jean nam slim', 'quan-jean-nam-slim', '/images/placeholder/men-3.svg', 529000),
      p('Áo polo nam', 'ao-polo-nam', '/images/placeholder/men-4.svg', 349000)
    ];

    const productsNewWomen = [
      p('Áo thun nữ form rộng', 'ao-thun-nu-form-rong', '/images/placeholder/women-1.svg', 279000),
      p('Váy midi nữ', 'vay-midi-nu', '/images/placeholder/women-2.svg', 499000),
      p('Áo sơ mi nữ pastel', 'ao-so-mi-nu-pastel', '/images/placeholder/women-3.svg', 429000),
      p('Quần tây nữ', 'quan-tay-nu', '/images/placeholder/women-4.svg', 469000)
    ];

    const productsSale = [
      p('Áo khoác nam nhẹ', 'ao-khoac-nam-nhe', '/images/placeholder/sale-1.svg', 699000, 499000),
      p('Váy hoa nữ', 'vay-hoa-nu', '/images/placeholder/sale-2.svg', 559000, 399000),
      p('Quần kaki nam', 'quan-kaki-nam', '/images/placeholder/sale-3.svg', 489000, 349000),
      p('Áo len nữ', 'ao-len-nu', '/images/placeholder/sale-4.svg', 519000, 379000)
    ];

    const productsBestSeller = [
      p('Áo thun unisex', 'ao-thun-unisex', '/images/placeholder/best-1.svg', 259000),
      p('Quần jean nữ ống đứng', 'quan-jean-nu-ong-dung', '/images/placeholder/best-2.svg', 549000),
      p('Sơ mi nam kẻ', 'so-mi-nam-ke', '/images/placeholder/best-3.svg', 439000),
      p('Váy chữ A', 'vay-chu-a', '/images/placeholder/best-4.svg', 479000)
    ];

    res.render('pages/home', {
      title: 'ABMT SHOP - Trang chủ',
      categories,
      vouchers,
      productsNewMen,
      productsNewWomen,
      productsSale,
      productsBestSeller
    });
  }
}

module.exports = HomeController;
