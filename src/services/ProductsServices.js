const mongoose = require('mongoose');
const Product = require('../model/Products');
const Category = require('../model/Category');
const ErrorResponse = require('../utils/appError');
const {
  validateCreateProduct,
  validateUpdateProduct,
} = require('../validators/productValidator');
const {
  buildFilter,
  buildPagination,
  buildSort,
  isObjectId,
  PRODUCT_LIST_FIELDS,
} = require('../utils/productFilter');
const { toPublicProductListItem } = require('../utils/productSerializer');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// category có thể là ObjectId hoặc slug; slug được tra sang _id trước khi build.
const resolveCategoryFilter = async (category) => {
  const raw = Array.isArray(category) ? category[0] : category;
  const value = raw === undefined || raw === null ? '' : String(raw).trim();

  if (!value) return { categoryId: undefined, found: true };
  if (isObjectId(value)) return { categoryId: value, found: true };

  const found = await Category.findOne({
    slug: value.toLowerCase(),
    isDeleted: false,
  }).select('_id');

  if (!found) return { categoryId: undefined, found: false };
  return { categoryId: found._id, found: true };
};

const resolveCategoryIds = async (categoryId) => {
  const ids = [categoryId];
  const queue = [categoryId];
  while (queue.length) {
    const current = queue.shift();
    const children = await Category.find({ parentId: current, isDeleted: false })
      .select('_id')
      .lean();
    for (const child of children) {
      ids.push(child._id);
      queue.push(child._id);
    }
  }
  return ids;
};

const buildVisibilityFilter = ({
  includeInactive = false,
  includeDeleted = false,
} = {}) => {
  const filter = {};

  if (!includeDeleted) {
    filter.isDeleted = false;
  }

  if (!includeInactive) {
    filter.isActive = true;
  }

  return filter;
};

const applyDeletedOption = (query, { includeDeleted = false } = {}) => {
  if (includeDeleted) {
    query.setOptions({ includeDeleted: true });
  }
  return query;
};

const ensureCategoryValid = async (categoryId) => {
  if (!isValidObjectId(categoryId)) {
    throw new ErrorResponse('Id danh mục không hợp lệ', 400);
  }

  const category = await Category.findOne({
    _id: categoryId,
    isDeleted: false,
  });

  if (!category) {
    throw new ErrorResponse('Danh mục không tồn tại', 404);
  }

  return category;
};

/**
 * Trừ kho điều kiện cho danh sách dòng hàng.
 * items: Array<{ productId, variantSku, qty }>
 * CAS trên đúng (_id, sku) với stock >= qty để tránh oversell.
 * Tự hoàn các dòng đã trừ nếu có dòng lỗi, rồi ném ErrorResponse.
 */
async function decrementStock(items) {
  const deducted = [];

  for (const item of items || []) {
    if (!Number.isInteger(item.qty) || item.qty <= 0) {
      await restoreStock(deducted);
      throw new ErrorResponse('Số lượng đặt hàng không hợp lệ', 400);
    }

    const updateResult = await Product.updateOne(
      {
        _id: item.productId,
        'variants.sku': item.variantSku,
        'variants.stock': { $gte: item.qty },
        isDeleted: false,
      },
      { $inc: { 'variants.$.stock': -item.qty } }
    );

    if (updateResult.modifiedCount === 0) {
      await restoreStock(deducted);
      throw new ErrorResponse(
        `Không đủ tồn kho cho SKU ${item.variantSku}`,
        409
      );
    }

    deducted.push({ ...item });
  }

  return { ok: true };
}

/**
 * Hoàn kho cho danh sách dòng hàng.
 * items: Array<{ productId, variantSku, qty }>
 * Dùng khi hủy đơn hoặc rollback tạo đơn thất bại.
 * Caller phải chặn double-restore bằng Order.stockRestoredAt (xem T6-1-3).
 */
async function restoreStock(items) {
  for (const item of items || []) {
    if (!Number.isInteger(item.qty) || item.qty <= 0) {
      throw new ErrorResponse('Số lượng hoàn kho không hợp lệ', 400);
    }

    await Product.updateOne(
      { _id: item.productId, 'variants.sku': item.variantSku },
      { $inc: { 'variants.$.stock': item.qty } }
    );
  }
  return { ok: true };
}

module.exports = {
  async list(filters = {}, options = {}) {
    // Validate toàn bộ tham số trước, kể cả khi slug danh mục không tồn tại.
    const { page, limit, skip } = buildPagination(filters);
    const sort = buildSort(filters.sort);
    const { categoryId, found } = await resolveCategoryFilter(
      filters.category,
    );

    const { category: _categoryParam, ...filterSource } = filters;
    const filter = {
      ...buildVisibilityFilter(options),
      ...buildFilter(filterSource, {}),
    };

    if (!found) {
      return {
        items: [],
        pagination: { page, limit, total: 0, totalPages: 0, itemCount: 0 },
      };
    }

    if (categoryId) {
      filter.category = { $in: await resolveCategoryIds(categoryId) };
    }

    const countQuery = Product.countDocuments(filter);
    if (options.includeDeleted) {
      countQuery.setOptions({ includeDeleted: true });
    }

    // Danh sách chỉ cần trường hiển thị card/catalog + biến thể để tính tồn.
    // `.lean()` trả plain object nên serializer dựng lại `id`/virtual.
    const findQuery = applyDeletedOption(
      Product.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .select(PRODUCT_LIST_FIELDS)
        .lean(),
      options,
    );

    const [total, docs] = await Promise.all([countQuery, findQuery]);
    const items = docs.map(toPublicProductListItem);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        itemCount: items.length,
      },
    };
  },

  async getById(id, options = {}) {
    if (!isValidObjectId(id)) {
      throw new ErrorResponse('Id sản phẩm không hợp lệ', 400);
    }

    const product = await applyDeletedOption(
      Product.findOne({
        _id: id,
        ...buildVisibilityFilter(options),
      }),
      options,
    );

    if (!product) {
      throw new ErrorResponse('Sản phẩm không tồn tại', 404);
    }

    return product;
  },

  async create(input) {
    const data = validateCreateProduct(input);
    await ensureCategoryValid(data.category);

    const product = new Product(data);
    await product.save();
    return product.toJSON();
  },

  async update(id, input) {
    if (!isValidObjectId(id)) {
      throw new ErrorResponse('Id sản phẩm không hợp lệ', 400);
    }

    const data = validateUpdateProduct(input);

    const product = await Product.findById(id);
    if (!product || product.isDeleted) {
      throw new ErrorResponse('Sản phẩm không tồn tại', 404);
    }

    if (data.category !== undefined) {
      await ensureCategoryValid(data.category);
    }

    Object.assign(product, data);
    await product.save();
    return product.toJSON();
  },

  async softDelete(id) {
    if (!isValidObjectId(id)) {
      throw new ErrorResponse('Id sản phẩm không hợp lệ', 400);
    }

    const product = await Product.findById(id);
    if (!product || product.isDeleted) {
      throw new ErrorResponse('Sản phẩm không tồn tại', 404);
    }

    product.isDeleted = true;
    product.deletedAt = new Date();
    product.slug = `${product.slug}-deleted-${Date.now()}`;
    await product.save();
    return product.toJSON();
  },

  decrementStock,
  restoreStock,
};
