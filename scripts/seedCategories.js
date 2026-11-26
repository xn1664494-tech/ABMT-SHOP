/**
 * Seed danh mục Nam/Nữ và sản phẩm mẫu cho giao diện.
 * Chạy: npm run seed:categories
 * Idempotent: chỉ xoá/tạo đúng slug và SKU do script này quản lý.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { buildSku } = require('../src/utils/sku');

const Category = require('../src/model/Category');
const Product = require('../src/model/Products');

const CATEGORY_TREE = [
  { name: 'Nam', slug: 'nam', order: 1, children: [
    { name: 'Áo thun', slug: 'ao-thun-nam', order: 1, prefix: 'AO' },
    { name: 'Áo sơ mi', slug: 'ao-so-mi-nam', order: 2, prefix: 'AO' },
    { name: 'Áo khoác', slug: 'ao-khoac-nam', order: 3, prefix: 'AO' },
    { name: 'Quần dài', slug: 'quan-dai-nam', order: 4, prefix: 'QU' },
    { name: 'Quần short', slug: 'quan-short-nam', order: 5, prefix: 'QU' },
  ] },
  { name: 'Nữ', slug: 'nu', order: 2, children: [
    { name: 'Áo thun', slug: 'ao-thun-nu', order: 1, prefix: 'AO' },
    { name: 'Áo sơ mi', slug: 'ao-so-mi-nu', order: 2, prefix: 'AO' },
    { name: 'Quần dài', slug: 'quan-dai-nu', order: 3, prefix: 'QU' },
    { name: 'Váy đầm', slug: 'vay-dam-nu', order: 4, prefix: 'VY' },
    { name: 'Chân váy', slug: 'chan-vay-nu', order: 5, prefix: 'VY' },
  ] },
];

const PRODUCTS = [
  { name: 'Áo thun cotton cổ tròn nam', slug: 'ao-thun-cotton-co-tron-nam', category: 'ao-thun-nam', price: 299000, color: 'Đen', colorCode: '#2A2F36' },
  { name: 'Áo thun basic tay ngắn nam', slug: 'ao-thun-basic-tay-ngan-nam', category: 'ao-thun-nam', price: 259000, color: 'Xanh', colorCode: '#4E7F6D' },
  { name: 'Áo thun polo pique nam', slug: 'ao-thun-polo-pique-nam', category: 'ao-thun-nam', price: 349000, color: 'Trắng', colorCode: '#EFEBE3' },
  { name: 'Áo sơ mi linen tay dài nam', slug: 'ao-so-mi-linen-tay-dai-nam', category: 'ao-so-mi-nam', price: 449000, color: 'Xanh', colorCode: '#4E7F6D' },
  { name: 'Áo sơ mi oxford nam', slug: 'ao-so-mi-oxford-nam', category: 'ao-so-mi-nam', price: 499000, color: 'Trắng', colorCode: '#EFEBE3' },
  { name: 'Áo khoác nhẹ chống gió nam', slug: 'ao-khoac-nhe-chong-gio-nam', category: 'ao-khoac-nam', price: 699000, color: 'Đen', colorCode: '#2A2F36' },
  { name: 'Áo khoác bomber nam', slug: 'ao-khoac-bomber-nam', category: 'ao-khoac-nam', price: 749000, color: 'Xanh', colorCode: '#4E7F6D' },
  { name: 'Quần jeans ống đứng nam', slug: 'quan-jeans-ong-dung-nam', category: 'quan-dai-nam', price: 549000, color: 'Xanh', colorCode: '#4E7F6D' },
  { name: 'Quần chinos basic nam', slug: 'quan-chinos-basic-nam', category: 'quan-dai-nam', price: 459000, color: 'Đen', colorCode: '#2A2F36' },
  { name: 'Quần short cotton nam', slug: 'quan-short-cotton-nam', category: 'quan-short-nam', price: 299000, color: 'Xanh', colorCode: '#4E7F6D' },
  { name: 'Áo thun cotton nữ', slug: 'ao-thun-cotton-nu', category: 'ao-thun-nu', price: 329000, color: 'Hồng', colorCode: '#B97A86' },
  { name: 'Áo thun croptop nữ', slug: 'ao-thun-croptop-nu', category: 'ao-thun-nu', price: 279000, color: 'Trắng', colorCode: '#EFEBE3' },
  { name: 'Áo thun oversized nữ', slug: 'ao-thun-oversized-nu', category: 'ao-thun-nu', price: 319000, color: 'Xanh', colorCode: '#4E7F6D' },
  { name: 'Áo sơ mi linen nữ', slug: 'ao-so-mi-linen-nu', category: 'ao-so-mi-nu', price: 429000, color: 'Trắng', colorCode: '#EFEBE3' },
  { name: 'Áo sơ mi cổ bẻ nữ', slug: 'ao-so-mi-co-be-nu', category: 'ao-so-mi-nu', price: 459000, color: 'Hồng', colorCode: '#B97A86' },
  { name: 'Quần culottes ống rộng nữ', slug: 'quan-culottes-ong-rong-nu', category: 'quan-dai-nu', price: 399000, color: 'Đen', colorCode: '#2A2F36' },
  { name: 'Quần jeans mom nữ', slug: 'quan-jeans-mom-nu', category: 'quan-dai-nu', price: 519000, color: 'Xanh', colorCode: '#4E7F6D' },
  { name: 'Váy midi dáng chữ A', slug: 'vay-midi-dang-chu-a', category: 'vay-dam-nu', price: 499000, color: 'Hồng', colorCode: '#B97A86' },
  { name: 'Đầm linen dáng dài', slug: 'dam-linen-dang-dai', category: 'vay-dam-nu', price: 649000, color: 'Trắng', colorCode: '#EFEBE3' },
  { name: 'Chân váy ngắn dáng xòe', slug: 'chan-vay-ngan-dang-xoe', category: 'chan-vay-nu', price: 359000, color: 'Đen', colorCode: '#2A2F36' },
];

const out = (text) => process.stdout.write(`${text}\n`);

const LEGACY_SLUGS = ['ao-thun', 'ao-so-mi', 'ao-khoac', 'quan-dai', 'quan-short'];

const ensureCategory = async (data, parentId, now) => {
  const collection = Category.collection;
  const existing = await collection.findOne({ slug: data.slug });
  if (!existing) {
    const result = await collection.insertOne({
      name: data.name,
      slug: data.slug,
      parentId,
      order: data.order,
      isVisible: true,
      isDeleted: false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    return result.insertedId;
  }
  await collection.updateOne(
    { _id: existing._id },
    { $set: { parentId, order: data.order, isVisible: true, isDeleted: false, deletedAt: null, updatedAt: now } },
  );
  return existing._id;
};

const run = async () => {
  if (!process.env.MONGODB_URI) throw new Error('Thieu MONGODB_URI');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  await Category.init();
  await Product.init();

  const now = new Date();
  await Category.collection.deleteMany({ slug: { $in: LEGACY_SLUGS } });

  const idBySlug = new Map();
  for (const root of CATEGORY_TREE) {
    const rootId = await ensureCategory(root, null, now);
    idBySlug.set(root.slug, rootId);
    for (const child of root.children) {
      const childId = await ensureCategory(child, rootId, now);
      idBySlug.set(child.slug, childId);
    }
  }

  const prefixBySlug = new Map();
  for (const root of CATEGORY_TREE) {
    for (const child of root.children) prefixBySlug.set(child.slug, child.prefix);
  }

  const productSlugs = PRODUCTS.map((p) => p.slug);
  const existingProducts = await Product.find({ slug: { $in: productSlugs } }).setOptions({ includeDeleted: true });
  const productMap = new Map(existingProducts.map((p) => [p.slug, p]));
  const counters = new Map();
  const SKU_SEQUENCE_OFFSET = 500;
  const SALE_SLUGS = new Set([
    'ao-thun-polo-pique-nam', 'ao-khoac-bomber-nam', 'quan-jeans-mom-nu', 'vay-midi-dang-chu-a'
  ]);

  for (const product of PRODUCTS) {
    const categoryId = idBySlug.get(product.category);
    if (!categoryId) throw new Error(`Thieu danh muc: ${product.category}`);
    const prefix = prefixBySlug.get(product.category) || 'AO';
    const sequence = SKU_SEQUENCE_OFFSET + (counters.get(prefix) || 0) + 1;
    counters.set(prefix, (counters.get(prefix) || 0) + 1);

    const variant = {
      size: 'M',
      color: product.color,
      colorCode: product.colorCode,
      sku: buildSku({ prefix, sequence, size: 'M', color: product.color }),
      stock: 12,
      price: SALE_SLUGS.has(product.slug) ? Math.round((product.price * 0.8) / 1000) * 1000 : product.price,
    };

    let doc = productMap.get(product.slug);
    if (!doc) {
      doc = new Product({ name: product.name, slug: product.slug });
    }
    doc.name = product.name;
    doc.category = categoryId;
    doc.basePrice = product.price;
    doc.description = `${product.name} - chất liệu thoáng mát, thiết kế tối giản.`;
    doc.images = [`https://cdn.example.com/${product.slug}.svg`];
    doc.variants = [variant];
    doc.isActive = true;
    doc.isDeleted = false;
    doc.deletedAt = null;
    await doc.save();
  }

  const catCount = await Category.countDocuments({ slug: { $in: ['nam', 'nu', 'ao-thun-nam', 'vay-dam-nu'] }, isDeleted: false });
  const productCount = await Product.countDocuments({ slug: { $in: productSlugs }, isDeleted: false, isActive: true });
  out(`seed:categories xong - danh muc: ${catCount}, san pham: ${productCount}`);
  await mongoose.disconnect();
};

run().catch((error) => {
  process.stderr.write(`seed:categories that bai: ${error.message}\n`);
  process.exitCode = 1;
});
