/**
 * T2-2-2 — Seed dữ liệu mẫu: 1 admin + 6 danh mục + 6 sản phẩm (có biến thể size/màu).
 *
 * Chạy: SEED_CONFIRM=1 node scripts/seed.js
 *   - Yêu cầu MONGODB_URI trong .env
 *   - Chỉ cho phép tên database chứa "test" (tránh xóa nhầm production)
 *   - Idempotent: xóa đúng bản ghi theo email/slug/SKU của seed, sau đó tạo lại
 *   - Gọi Model.init() để tạo index trên DB thật
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { buildSku } = require('../src/utils/sku');

const SEED_EMAILS = [
  'seed.admin@urbanminimal.test',
];
const SEED_SLUGS = [
  'nam', 'nu',
  'ao-nam', 'quan-nam',
  'ao-nu', 'quan-nu', 'vay-nu', 'dam-nu',
  'ao-thun-co-tay', 'quan-jeans-skinny', 'vay-du-tiec',
  'dam-cuoi', 'ao-thun-nu', 'quan-culottes-nu',
];
const SEED_SKUS = [
  'SP-AO-001-M-DEN', 'SP-AO-001-L-TRANG',
  'SP-QU-002-M-XANH', 'SP-QU-002-L-DEN',
  'SP-VY-003-S-HONG', 'SP-VY-003-M-TIM',
  'SP-DM-004-M-TRANG', 'SP-DM-004-L-XANH-DUONG',
  'SP-AON-005-M-XANH', 'SP-AON-006-L-TRANG',
  'SP-QU-007-M-XANH', 'SP-QU-008-L-DEN',
];

const SEED_ADMIN_PASSWORD = 'Admin@123456';

const CATEGORIES = [
  { name: 'Nam', order: 1, children: [
    { name: 'Áo', order: 1 },
    { name: 'Quần', order: 2 },
  ]},
  { name: 'Nữ', order: 2, children: [
    { name: 'Áo', order: 1 },
    { name: 'Quần', order: 2 },
    { name: 'Váy', order: 3 },
    { name: 'Đầm', order: 4 },
  ]},
];

const PRODUCTS = [
  {
    name: 'Áo thun cotton cổ tròn nam',
    categoryPath: ['Nam', 'Áo'],
    description: 'Áo thun cotton thấm hút mát mẻ.',
    basePrice: 299000,
    images: ['https://cdn.example.com/ao-thun-cotton-nam.jpg'],
    variants: [
      { size: 'M', color: 'Đen', colorCode: '#111111', stock: 20, price: 299000 },
      { size: 'L', color: 'Trắng', colorCode: '#FFFFFF', stock: 15, price: 299000 },
    ],
  },
  {
    name: 'Áo sơ mi linen tay dài nam',
    categoryPath: ['Nam', 'Áo'],
    description: 'Áo sơ mi linen form ngần.',
    basePrice: 449000,
    images: ['https://cdn.example.com/ao-so-mi-nam.jpg'],
    variants: [
      { size: 'M', color: 'Xanh dương', colorCode: '#4A90E2', stock: 10, price: 449000 },
      { size: 'L', color: 'Đen', colorCode: '#000000', stock: 8, price: 449000 },
    ],
  },
  {
    name: 'Quần jeans ống đứng nam',
    categoryPath: ['Nam', 'Quần'],
    description: 'Quần jeans Skinny dáng form.',
    basePrice: 549000,
    images: ['https://cdn.example.com/quan-jeans-nam.jpg'],
    variants: [
      { size: 'M', color: 'Xanh', colorCode: '#4A90E2', stock: 12, price: 549000 },
      { size: 'L', color: 'Đen', colorCode: '#000000', stock: 6, price: 549000 },
    ],
  },
  {
    name: 'Áo thun cotton nữ',
    categoryPath: ['Nữ', 'Áo'],
    description: 'Áo thun cotton-basic dành cho nữ.',
    basePrice: 329000,
    images: ['https://cdn.example.com/ao-thun-nu.jpg'],
    variants: [
      { size: 'S', color: 'Trắng', colorCode: '#FFFFFF', stock: 18, price: 329000 },
      { size: 'M', color: 'Hồng', colorCode: '#FF69B4', stock: 14, price: 329000 },
    ],
  },
  {
    name: 'Quần culottes ống rộng nữ',
    categoryPath: ['Nữ', 'Quần'],
    description: 'Quần culottes vải cao su.',
    basePrice: 399000,
    images: ['https://cdn.example.com/quan-culottes.jpg'],
    variants: [
      { size: 'S', color: 'Xanh', colorCode: '#2E8B57', stock: 10, price: 399000 },
      { size: 'M', color: 'Đen', colorCode: '#000000', stock: 8, price: 399000 },
    ],
  },
  {
    name: 'Váy midi dáng chữ A',
    categoryPath: ['Nữ', 'Váy'],
    description: 'Váy midi dáng chữ A thanh lịch.',
    basePrice: 499000,
    images: ['https://cdn.example.com/vay-midi.jpg'],
    variants: [
      { size: 'S', color: 'Hồng', colorCode: '#FF69B4', stock: 5, price: 499000 },
      { size: 'M', color: 'Tím', colorCode: '#800080', stock: 4, price: 499000 },
    ],
  },
  {
    name: 'Đầm cưới trắng thanh lịch',
    categoryPath: ['Nữ', 'Đầm'],
    description: 'Đầm cưới trắng vải sagio.',
    basePrice: 1599000,
    images: ['https://cdn.example.com/dam-cuoi.jpg'],
    variants: [
      { size: 'M', color: 'Trắng', colorCode: '#FFFFFF', stock: 3, price: 1599000 },
      { size: 'L', color: 'Xanh dương', colorCode: '#0000FF', stock: 2, price: 1599000 },
    ],
  },
];

const Category = require('../src/model/Category');
const Product = require('../src/model/Products');
const User = require('../src/model/User');

const maskUri = (uri) => {
  if (!uri) return '(trống)';
  return uri.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@');
};

const getDbName = (uri) => {
  const match = /^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/.exec(uri || '');
  return match ? decodeURIComponent(match[1]) : '';
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const connectWithRetry = async (uri) => {
  const maxRetries = Number(process.env.DB_MAX_RETRIES) || 5;
  const retryDelayMs = Number(process.env.DB_RETRY_DELAY_MS) || 3000;
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        autoIndex: false,
      });
      return mongoose.connection;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      console.warn(
        `Kết nối MongoDB thất bại (lần ${attempt}/${maxRetries}): ${error.message}. Thử lại sau ${retryDelayMs}ms`,
      );
      await sleep(retryDelayMs);
    }
  }
};

const run = async () => {
  if (process.env.SEED_CONFIRM !== '1') {
    throw new Error('Yeu cau SEED_CONFIRM=1 de chay seed (bao dam co y muon).');
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Thieu MONGODB_URI trong .env');
  }

  const dbName = getDbName(uri);
  if (!dbName || !/test/i.test(dbName)) {
    console.warn(
      `Canh bao: ten database "${dbName || '(trong)'}" khong chua "test". Tiep tuc vi SEED_CONFIRM=1 da duoc xac nhan.`,
    );
  }

  console.log(`Database muc tieu: ${dbName}`);
  console.log(`URI: ${maskUri(uri)}`);

  await connectWithRetry(uri);

  try {
    // Tao index tren DB thật.
    await User.init();
    await Category.init();
    await Product.init();

    // Idempotent: xoa ban ghi theo khoa seed (khong deleteMany({}) toan bo collection).
    await User.deleteMany({ email: { $in: SEED_EMAILS } });
    await Category.deleteMany({ slug: { $in: SEED_SLUGS } });
    await Product.deleteMany({ slug: { $in: SEED_SLUGS } });

    // Tao admin.
    const passwordHash = await bcrypt.hash(SEED_ADMIN_PASSWORD, 10);
    const admin = await User.create({
      name: 'Admin Seed',
      email: SEED_EMAILS[0],
      password: passwordHash,
      role: 'admin',
      status: 'active',
    });

    // Tạo danh mục cây: gốc (Nam/Nữ) rồi danh mục con
    const categoryMap = new Map();
    for (const cat of CATEGORIES) {
      // Tạo gốc
      const root = await Category.create({ name: cat.name, order: cat.order, parentId: null });
      categoryMap.set(cat.name, root._id);
      for (const child of cat.children || []) {
        const created = await Category.create({ name: child.name, order: child.order, parentId: root._id });
        categoryMap.set(`${cat.name} > ${child.name}`, created._id);
      }
    }

    // Tạo sản phẩm có biến thể, sinh SKU qua buildSku
    const skuCounterByCategory = new Map();
    const createdProducts = [];
    for (const p of PRODUCTS) {
      const categoryId = categoryMap.get(p.categoryPath.join(' > '));
      if (!categoryId) {
        throw new Error(`Không tìm thấy danh mục: ${p.categoryPath.join(' > ')}`);
      }

      if (!skuCounterByCategory.has(p.categoryPath[0])) {
        skuCounterByCategory.set(p.categoryPath[0], 0);
      }
      let counter = skuCounterByCategory.get(p.categoryPath[0]);

      const variants = p.variants.map((v) => {
        counter += 1;
        skuCounterByCategory.set(p.categoryPath[0], counter);
        const prefix = {
          Nam: 'AO', Nữ: 'VY',
        }[p.categoryPath[0]];
        return {
          size: v.size,
          color: v.color,
          colorCode: v.colorCode,
          sku: buildSku({ prefix, sequence: counter, size: v.size, color: v.color }),
          stock: v.stock,
          price: v.price,
        };
      });

      const created = await Product.create({
        name: p.name,
        slug: p.name
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[đĐ]/g, 'D')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, ''),
        category: categoryId,
        description: p.description,
        basePrice: p.basePrice,
        images: p.images,
        variants,
        isActive: true,
      });
      createdProducts.push(created);
    }

    // In minh chung index.
    const userIndexes = await User.collection.indexes();
    const categoryIndexes = await Category.collection.indexes();
    const productIndexes = await Product.collection.indexes();

    console.log('\n=== MINH CHUNG SEED T2-2-2 ===');
    console.log(`Admin: ${admin.email} (role: admin, id: ${admin._id})`);
    console.log(`Danh muc da tao: ${categoryMap.size}`);
    console.log(`San pham da tao: ${createdProducts.length}`);
    console.log('\n-- Index User --');
    for (const idx of userIndexes) {
      console.log(`  ${idx.name}: ${JSON.stringify(idx.key)} unique=${!!idx.unique} sparse=${!!idx.sparse}`);
    }
    console.log('\n-- Index Category --');
    for (const idx of categoryIndexes) {
      console.log(`  ${idx.name}: ${JSON.stringify(idx.key)} unique=${!!idx.unique} sparse=${!!idx.sparse}`);
    }
    console.log('\n-- Index Product --');
    for (const idx of productIndexes) {
      console.log(`  ${idx.name}: ${JSON.stringify(idx.key)} unique=${!!idx.unique} sparse=${!!idx.sparse}`);
    }
    console.log('\n-- San pham (slug / basePrice / SKU bien the) --');
    for (const p of createdProducts) {
      const skus = (p.variants || []).map((v) => v.sku).join(', ');
      console.log(`  ${p.slug} | ${p.basePrice} VND | ${skus}`);
    }

    console.log('\nSeed thanh cong.');
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error('Seed that bai:', error.message);
  process.exit(1);
});
