const asyncHandler = require('../utils/asyncHandler');

const homeData = {
  title: 'ABMT SHOP – Trang chủ',
  vouchers: [
    { code: 'GIAM30K', desc: 'Giảm 30.000₫', note: 'Cho đơn từ 300.000₫ HSD 30/11/2026' },
    { code: 'GIAM10', desc: 'Giảm 10%, tối đa 50.000₫', note: 'Cho đơn từ 400.000₫ HSD 31/12/2026' },
    { code: 'KHACHMOI', desc: 'Giảm 50.000₫', note: 'Đơn đầu tiên từ 250.000₫ HSD 31/12/2026' }
  ],
  categories: [
    { slug: 'ao-thun', name: 'Áo thun', image: '/images/placeholder/category.svg' },
    { slug: 'ao-so-mi', name: 'Áo sơ mi', image: '/images/placeholder/category.svg' },
    { slug: 'ao-khoac', name: 'Áo khoác', image: '/images/placeholder/category.svg' },
    { slug: 'quan-dai', name: 'Quần dài', image: '/images/placeholder/category.svg' },
    { slug: 'quan-short', name: 'Quần short', image: '/images/placeholder/category.svg' },
    { slug: 'vay-dam', name: 'Váy đầm', image: '/images/placeholder/category.svg' }
  ],
  productsNewMen: [
    { slug: 'ao-thun-cotton-co-tron', name: 'Áo thun cotton cổ tròn', image: '/images/placeholder/product.svg', price: 299000 },
    { slug: 'ao-so-mi-linen-tay-dai', name: 'Áo sơ mi linen tay dài', image: '/images/placeholder/product.svg', price: 449000 },
    { slug: 'quan-jeans-ong-dung', name: 'Quần jeans ống đứng', image: '/images/placeholder/product.svg', price: 549000 },
    { slug: 'ao-khoac-gio-le', name: 'Áo khoác gió nhẹ', image: '/images/placeholder/product.svg', price: 649000 }
  ],
  productsNewWomen: [
    { slug: 'vay-midi-dang-chu-a', name: 'Váy midi dáng chữ A', image: '/images/placeholder/product.svg', price: 499000 },
    { slug: 'ao-kieu-tay-phong', name: 'Áo kiểu tay phồng', image: '/images/placeholder/product.svg', price: 329000 },
    { slug: 'quan-culottes-ong-rong', name: 'Quần culottes ống rộng', image: '/images/placeholder/product.svg', price: 399000 },
    { slug: 'chan-vay-xep-ly', name: 'Chân váy xếp ly', image: '/images/placeholder/product.svg', price: 329000 }
  ],
  productsSale: [
    { slug: 'ao-thun-polo-ca-sau', name: 'Áo thun polo cá sấu', image: '/images/placeholder/product.svg', price: 349000, salePrice: 279000 },
    { slug: 'ao-khoac-bomber', name: 'Áo khoác bomber', image: '/images/placeholder/product.svg', price: 649000, salePrice: 519000 },
    { slug: 'quan-short-kaki', name: 'Quần short kaki', image: '/images/placeholder/product.svg', price: 189000, salePrice: 149000 },
    { slug: 'vay-xep-ly-dai', name: 'Váy xếp lý dài', image: '/images/placeholder/product.svg', price: 429000, salePrice: 339000 },
    { slug: 'ao-thun-ba-lot-the-thao', name: 'Áo thun ba lỗ thể thao', image: '/images/placeholder/product.svg', price: 199000, salePrice: 159000 },
    { slug: 'quan-jeans-ong-rong', name: 'Quần jeans ống rộng', image: '/images/placeholder/product.svg', price: 549000, salePrice: 429000 },
    { slug: 'vay-lien-than', name: 'Váy liền thân', image: '/images/placeholder/product.svg', price: 499000, salePrice: 399000 },
    { slug: 'ao-so-mi-ke-soc', name: 'Áo sơ mi kẻ sọc', image: '/images/placeholder/product.svg', price: 379000, salePrice: 299000 }
  ],
  productsBestSeller: [
    { slug: 'ao-thun-oversize', name: 'Áo thun oversize', image: '/images/placeholder/product.svg', price: 329000 },
    { slug: 'quan-tay-ong-con', name: 'Quần tây ống côn', image: '/images/placeholder/product.svg', price: 499000 },
    { slug: 'ao-polo-ca-sau', name: 'Áo polo cá sấu', image: '/images/placeholder/product.svg', price: 329000 },
    { slug: 'quan-short-denim', name: 'Quần short denim', image: '/images/placeholder/product.svg', price: 259000 },
    { slug: 'ao-so-mi-co-no', name: 'Áo sơ mi cổ nơ', image: '/images/placeholder/product.svg', price: 389000 },
    { slug: 'ao-khoac-cardigan', name: 'Áo khoác cardigan', image: '/images/placeholder/product.svg', price: 459000 },
    { slug: 'vay-suong-co-vuong', name: 'Váy suông cổ vuông', image: '/images/placeholder/product.svg', price: 429000 },
    { slug: 'quan-short-kaki-bestseller', name: 'Quần short kaki', image: '/images/placeholder/product.svg', price: 189000 }
  ]
};

module.exports = {
  index: asyncHandler(async (req, res) => {
    res.render('pages/home', homeData);
  })
};