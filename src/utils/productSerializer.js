/**
 * Chuyển một Product dạng `.lean()` (plain object, không có virtual/getter
 * của Mongoose) sang đúng shape API danh sách.
 *
 * Vì `.lean()` bỏ qua `toJSON` transform, serializer tự:
 * - đổi `_id` thành `id`;
 * - ẩn `_id`, `__v`, `isDeleted`, `deletedAt`;
 * - tính lại `totalStock` / `inStock` từ `variants`.
 */
const normalizeVariants = (variants) =>
  Array.isArray(variants) ? variants : [];

const toPublicProductListItem = (doc = {}) => {
  const variants = normalizeVariants(doc.variants);
  const totalStock = variants.reduce(
    (sum, variant) => sum + (Number(variant.stock) || 0),
    0,
  );
  const inStock = variants.some((variant) => Number(variant.stock) > 0);

  return {
    id: doc._id ? String(doc._id) : undefined,
    name: doc.name,
    slug: doc.slug,
    category: doc.category,
    images: Array.isArray(doc.images) ? doc.images : [],
    basePrice: doc.basePrice,
    variants,
    isActive: doc.isActive,
    totalStock,
    inStock,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

module.exports = { toPublicProductListItem };
