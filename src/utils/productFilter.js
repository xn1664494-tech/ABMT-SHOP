const mongoose = require('mongoose');
const ErrorResponse = require('./appError');

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;
const MAX_KEYWORD_LENGTH = 100;

const hasOwn = (object, key) =>
  Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isObjectId = (value) =>
  typeof value === 'string' && OBJECT_ID_REGEX.test(value.trim());

const toTextList = (value) => {
  const list = Array.isArray(value) ? value : [value];
  return list
    .filter((item) => item !== undefined && item !== null)
    .map((item) => String(item).trim())
    .filter(Boolean);
};

// Một giá trị -> regex neo hai đầu; nhiều giá trị -> $in, vẫn nằm trong
// cùng một $elemMatch nên Size và Màu phải thuộc cùng một biến thể.
const buildTextMatch = (values) => {
  const patterns = values.map((value) => `^${escapeRegex(value)}$`);
  if (patterns.length === 1) {
    return { $regex: patterns[0], $options: 'i' };
  }
  return { $in: patterns.map((pattern) => new RegExp(pattern, 'i')) };
};

const parsePrice = (value, field, errors) => {
  if (value === undefined || value === null || value === '') return undefined;

  const raw = Array.isArray(value) ? value[0] : value;
  const price = Number(raw);

  if (!Number.isFinite(price) || !Number.isInteger(price) || price < 0) {
    errors.push({
      field,
      message: `${field} phải là số nguyên không âm`,
    });
    return undefined;
  }

  return price;
};

const isTruthyFlag = (value) => {
  if (Array.isArray(value)) return value.some(isTruthyFlag);
  return value === true || value === 'true' || value === '1';
};

/**
 * Dựng filter Mongo cho GET /api/products.
 *
 * - category: ObjectId 24 hex (slug được service resolve trước rồi truyền
 *   qua `categoryId`).
 * - minPrice / maxPrice: khoảng giá trên `basePrice`.
 * - keyword: tìm gần đúng trên name/description, đã thoát ký tự regex.
 * - size / color / inStock: một `$elemMatch` duy nhất kèm `stock > 0`, nhờ đó
 *   "M + Đỏ" chỉ khớp biến thể vừa size M vừa màu Đỏ (không ghép chéo các
 *   biến thể khác nhau của cùng sản phẩm).
 *
 * Không đụng tới isActive/isDeleted; phần hiển thị do service/plugin lo.
 */
const buildFilter = (query = {}, { categoryId } = {}) => {
  const errors = [];
  const filter = {};
  const source = query || {};

  const rawCategory = Array.isArray(source.category)
    ? source.category[0]
    : source.category;
  const category = categoryId || rawCategory;

  if (category) {
    if (categoryId || isObjectId(category)) {
      filter.category = new mongoose.Types.ObjectId(String(category));
    } else {
      errors.push({
        field: 'category',
        message: 'category phải là ObjectId hoặc slug danh mục hợp lệ',
      });
    }
  }

  const minPrice = parsePrice(source.minPrice, 'minPrice', errors);
  const maxPrice = parsePrice(source.maxPrice, 'maxPrice', errors);

  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    errors.push({
      field: 'minPrice',
      message: 'minPrice không được lớn hơn maxPrice',
    });
  } else if (minPrice !== undefined || maxPrice !== undefined) {
    filter.basePrice = {};
    if (minPrice !== undefined) filter.basePrice.$gte = minPrice;
    if (maxPrice !== undefined) filter.basePrice.$lte = maxPrice;
  }

  if (hasOwn(source, 'keyword') && source.keyword !== undefined) {
    const [keyword] = toTextList(source.keyword);
    if (keyword) {
      if (keyword.length > MAX_KEYWORD_LENGTH) {
        errors.push({
          field: 'keyword',
          message: `keyword tối đa ${MAX_KEYWORD_LENGTH} ký tự`,
        });
      } else {
        const regex = { $regex: escapeRegex(keyword), $options: 'i' };
        filter.$or = [{ name: regex }, { description: regex }];
      }
    }
  }

  const sizes = toTextList(source.size);
  const colors = toTextList(source.color);
  const requireStock = isTruthyFlag(source.inStock);

  if (sizes.length || colors.length || requireStock) {
    const elemMatch = { stock: { $gt: 0 } };
    if (sizes.length) elemMatch.size = buildTextMatch(sizes);
    if (colors.length) elemMatch.color = buildTextMatch(colors);
    filter.variants = { $elemMatch: elemMatch };
  }

  if (errors.length) {
    const error = new ErrorResponse('Tham số lọc không hợp lệ', 400);
    error.details = errors;
    throw error;
  }

  return filter;
};

module.exports = {
  MAX_KEYWORD_LENGTH,
  buildFilter,
  escapeRegex,
  isObjectId,
};
