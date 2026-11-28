/**
 * Sửa cây danh mục bị lệch: thiếu danh mục cha, danh mục con mồ côi,
 * và sản phẩm trỏ tới danh mục không còn tồn tại.
 * Chỉ cập nhật danh mục + trường category của sản phẩm, không đụng dữ liệu khác.
 * Chạy: npm run repair:categories
 */
require('dotenv').config();
const mongoose = require('mongoose');

const Category = require('../src/model/Category');
const Product = require('../src/model/Products');
const { CATEGORY_TREE, PRODUCTS } = require('./seedCategories');

const out = (text) => process.stdout.write(`${text}\n`);

const ensureCategory = async (data, parentId, now) => {
  const collection = Category.collection;
  const parent = parentId || null;

  let existing = await collection.findOne({ slug: data.slug });
  if (!existing) {
    existing = await collection.findOne({ name: data.name, parentId: parent });
  }

  if (!existing) {
    const result = await collection.insertOne({
      name: data.name,
      slug: data.slug,
      parentId: parent,
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
    {
      $set: {
        name: data.name,
        slug: data.slug,
        parentId: parent,
        order: data.order,
        isVisible: true,
        isDeleted: false,
        deletedAt: null,
        updatedAt: now,
      },
    },
  );
  return existing._id;
};

const run = async () => {
  if (!process.env.MONGODB_URI) throw new Error('Thieu MONGODB_URI');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  await Category.init();
  await Product.init();

  const now = new Date();
  const idBySlug = new Map();

  for (const root of CATEGORY_TREE) {
    const rootDoc = await ensureCategory(root, null, now);
    idBySlug.set(root.slug, rootDoc._id);
    for (const child of root.children) {
      const childDoc = await ensureCategory(child, rootDoc._id, now);
      idBySlug.set(child.slug, childDoc._id);
    }
  }

  const categories = await Category.find({}).select('_id').setOptions({
    includeDeleted: true,
  }).lean();
  const validCategoryIds = new Set(categories.map((c) => String(c._id)));
  const seedCategoryByProductSlug = new Map(
    PRODUCTS.map((product) => [product.slug, product.category]),
  );

  const products = await Product.find({}).select('slug category').lean();
  let relinked = 0;
  const unresolved = [];

  for (const product of products) {
    const current = product.category ? String(product.category) : '';
    if (current && validCategoryIds.has(current)) continue;

    const targetSlug = seedCategoryByProductSlug.get(product.slug);
    const targetId = targetSlug ? idBySlug.get(targetSlug) : null;

    if (!targetId) {
      unresolved.push(product.slug);
      continue;
    }

    await Product.updateOne({ _id: product._id }, { $set: { category: targetId } });
    relinked += 1;
  }

  const categoryCount = await Category.countDocuments({ isDeleted: false });
  out(`repair:categories xong - danh muc: ${categoryCount}, san pham da noi lai: ${relinked}`);
  if (unresolved.length) {
    out(`Khong xac dinh duoc danh muc cho: ${unresolved.join(', ')}`);
  }

  await mongoose.disconnect();
};

run().catch((error) => {
  process.stderr.write(`repair:categories that bai: ${error.message}\n`);
  process.exitCode = 1;
});
