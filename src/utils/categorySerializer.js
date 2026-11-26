/**
 * Chuẩn hoá Category (kể cả object `.lean()`) về shape API công khai.
 *
 * `.lean()` bỏ qua `toJSON` transform của Mongoose, nên list/tree phải tự:
 * - đổi `_id` thành `id`;
 * - ẩn `_id`, `__v`, `isDeleted`, `deletedAt`;
 * - chuẩn hoá `parentId` thành chuỗi hoặc `null`.
 */
const toPublicCategory = (doc = {}) => {
  const rawId = doc._id !== undefined && doc._id !== null ? doc._id : doc.id;

  return {
    id: rawId !== undefined && rawId !== null ? String(rawId) : undefined,
    name: doc.name,
    slug: doc.slug,
    parentId:
      doc.parentId !== undefined && doc.parentId !== null
        ? String(doc.parentId)
        : null,
    order: Number.isInteger(doc.order) ? doc.order : 0,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

module.exports = { toPublicCategory };
