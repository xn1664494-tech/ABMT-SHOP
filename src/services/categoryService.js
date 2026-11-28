const mongoose = require('mongoose');
const Category = require('../model/Category');
const Product = require('../model/Products');
const slugify = require('slugify');
const ErrorResponse = require('../utils/appError');
const { toPublicCategory } = require('../utils/categorySerializer');
const { collectDescendantIds } = require('../utils/categoryTree');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const buildSlug = (name) =>
  slugify(name, { lower: true, strict: true, locale: 'vi', trim: true });

const validateCategoryInput = ({ name, order, parentId }) => {
  const errors = {};

  if (name !== undefined) {
    if (!name || !name.trim()) {
      errors.name = 'Tên danh mục là bắt buộc';
    } else if (name.trim().length > 80) {
      errors.name = 'Tên danh mục tối đa 80 ký tự';
    }
  }

  if (order !== undefined) {
    if (!Number.isInteger(order) || order < 0) {
      errors.order = 'Thứ tự phải là số nguyên không âm';
    }
  }

  if (parentId !== undefined && parentId !== null && parentId !== '') {
    if (!isValidObjectId(parentId)) {
      errors.parentId = 'Id danh mục cha không hợp lệ';
    }
  }

  return errors;
};

const throwValidation = (errors) => {
  const err = new ErrorResponse('Dữ liệu đầu vào không hợp lệ', 400);
  err.details = Object.entries(errors).map(([field, message]) => ({ field, message }));
  throw err;
};

const ensureParentValid = async (parentId) => {
  if (!parentId) return null;
  if (!isValidObjectId(parentId)) {
    throw new ErrorResponse('Id danh mục cha không hợp lệ', 400);
  }
  const parent = await Category.findById(parentId).setOptions({
    includeDeleted: true,
  });
  if (!parent) throw new ErrorResponse('Danh mục cha không tồn tại', 404);
  if (parent.isDeleted) throw new ErrorResponse('Danh mục cha đã bị xóa', 400);
  return parent;
};

const getDescendantIds = async (categoryId) => {
  const categories = await Category.find({ isDeleted: false })
    .select('_id parentId')
    .lean();
  return collectDescendantIds(categoryId, categories).slice(1);
};

const hasCircularReference = async (categoryId, newParentId) => {
  if (String(newParentId) === String(categoryId)) return true;
  const descendants = await getDescendantIds(categoryId);
  return descendants.some((id) => String(id) === String(newParentId));
};

module.exports = {
  async list() {
    const categories = await Category.find({ isDeleted: false })
      .sort({ parentId: 1, order: 1, createdAt: 1 })
      .lean();
    return categories.map(toPublicCategory);
  },

  async tree() {
    const all = await Category.find({ isDeleted: false }).lean();
    const map = {};
    const roots = [];

    for (const cat of all) {
      map[cat._id.toString()] = {
        ...toPublicCategory(cat),
        children: [],
      };
    }

    for (const cat of all) {
      const node = map[cat._id.toString()];
      if (cat.parentId && map[cat.parentId.toString()]) {
        map[cat.parentId.toString()].children.push(node);
      } else {
        roots.push(node);
      }
    }

    const sortNode = (node) => {
      if (node.children) {
        node.children.sort((a, b) => a.order - b.order || 0);
        node.children.forEach(sortNode);
      }
    };

    roots.sort((a, b) => a.order - b.order || 0);
    roots.forEach(sortNode);
    return roots;
  },

  async getById(id) {
    if (!isValidObjectId(id)) throw new ErrorResponse('Id danh mục không hợp lệ', 400);
    const cat = await Category.findById(id);
    if (!cat || cat.isDeleted) throw new ErrorResponse('Danh mục không tồn tại', 404);
    return cat;
  },

  async create({ name, parentId = null, order = 0 }) {
    const errors = validateCategoryInput({ name, order, parentId });
    if (Object.keys(errors).length) throwValidation(errors);

    await ensureParentValid(parentId);

    const slug = buildSlug(name);
    const exists = await Category.findOne({ slug });
    if (exists) throw new ErrorResponse('Tên danh mục đã tồn tại', 409);

    const cat = new Category({ name, parentId: parentId || null, order: order || 0 });
    await cat.save();
    return cat.toJSON();
  },

  async update(id, input = {}) {
    if (!isValidObjectId(id)) throw new ErrorResponse('Id danh mục không hợp lệ', 400);
    const { name, parentId, order } = input;

    const errors = validateCategoryInput({ name, order, parentId });
    if (Object.keys(errors).length) throwValidation(errors);

    const cat = await Category.findById(id);
    if (!cat || cat.isDeleted) throw new ErrorResponse('Danh mục không tồn tại', 404);

    if (parentId !== undefined) {
      if (parentId === null || parentId === '') {
        cat.parentId = null;
      } else {
        if (!isValidObjectId(parentId)) throw new ErrorResponse('Id danh mục cha không hợp lệ', 400);
        const parent = await Category.findById(parentId).setOptions({
          includeDeleted: true,
        });
        if (!parent) throw new ErrorResponse('Danh mục cha không tồn tại', 404);
        if (parent.isDeleted) throw new ErrorResponse('Danh mục cha đã bị xóa', 400);
        if (parent._id.equals(cat._id)) {
          throw new ErrorResponse('Danh mục không thể là cha của chính nó', 400);
        }
        const circular = await hasCircularReference(cat._id, parent._id);
        if (circular) {
          throw new ErrorResponse('Không thể đặt danh mục con làm cha (vòng lặp cha/con)', 400);
        }
        cat.parentId = parent._id;
      }
    }

    if (order !== undefined) cat.order = order;
    if (name !== undefined) cat.name = name;

    await cat.save();
    return cat.toJSON();
  },

  async softDelete(id) {
    if (!isValidObjectId(id)) throw new ErrorResponse('Id danh mục không hợp lệ', 400);
    const cat = await Category.findById(id);
    if (!cat || cat.isDeleted) throw new ErrorResponse('Danh mục không tồn tại', 404);

    const childrenCount = await Category.countDocuments({
      parentId: id,
      isDeleted: false,
    });
    if (childrenCount > 0) {
      throw new ErrorResponse('Không thể xóa danh mục này vì còn danh mục con', 409);
    }

    const productCount = await Product.countDocuments({ category: id });
    if (productCount > 0) {
      throw new ErrorResponse('Không thể xóa danh mục này vì còn sản phẩm', 409);
    }

    cat.isDeleted = true;
    cat.deletedAt = new Date();
    cat.slug = `${cat.slug}-deleted-${Date.now()}`;
    await cat.save();
    return cat.toJSON();
  },
};
