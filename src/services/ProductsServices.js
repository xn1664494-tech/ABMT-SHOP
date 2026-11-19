const mongoose = require('mongoose');
const Product = require('../model/Products');
const Category = require('../model/Category');
const ErrorResponse = require('../utils/appError');
const {
  validateCreateProduct,
  validateUpdateProduct,
} = require('../validators/productValidator');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

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

module.exports = {
  async list(options = {}) {
    return Product.find(buildVisibilityFilter(options)).sort({
      createdAt: -1,
    });
  },

  async getById(id, options = {}) {
    if (!isValidObjectId(id)) {
      throw new ErrorResponse('Id sản phẩm không hợp lệ', 400);
    }

    const product = await Product.findOne({
      _id: id,
      ...buildVisibilityFilter(options),
    });

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
};
