const ErrorResponse = require('../utils/appError');
const { SKU_REGEX } = require('../utils/sku');

const URL_REGEX = /^https?:\/\/\S+$/i;
const COLOR_CODE_REGEX = /^#[0-9A-Fa-f]{6}$/;
const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;
const MAX_IMAGES = 20;
const MAX_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 2000;

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const throwValidation = (errors) => {
  const error = new ErrorResponse('Du lieu dau vao khong hop le', 400);
  error.details = Object.entries(errors).map(([field, message]) => ({
    field,
    message,
  }));
  throw error;
};

const validateImages = (images, errors, data) => {
  if (images === undefined) {
    data.images = [];
    return;
  }

  if (!Array.isArray(images)) {
    errors.images = 'Danh sách ảnh phải là mảng URL';
    return;
  }

  if (images.length > MAX_IMAGES) {
    errors.images = `Số lượng ảnh tối đa là ${MAX_IMAGES}`;
    return;
  }

  const invalid = images.some(
    (url) => typeof url !== 'string' || !URL_REGEX.test(url.trim()),
  );

  if (invalid) {
    errors.images = 'Ảnh phải là URL hợp lệ (http/https)';
    return;
  }

  data.images = images.map((url) => url.trim());
};

const validateBasePrice = (basePrice, errors, data) => {
  if (basePrice === undefined || basePrice === null) {
    errors.basePrice = 'Giá cơ bản là bắt buộc';
    return;
  }

  if (!Number.isInteger(basePrice) || basePrice < 0) {
    errors.basePrice = 'Giá cơ bản phải là số nguyên không âm (VND)';
    return;
  }

  data.basePrice = basePrice;
};

const validateVariant = (variant, index, errors) => {
  const field = `variants.${index}`;
  const out = {};

  if (!isPlainObject(variant)) {
    errors[field] = 'Biến thể không hợp lệ';
    return null;
  }

  if (typeof variant.size !== 'string' || !variant.size.trim()) {
    errors[`${field}.size`] = 'Kích cỡ (size) là bắt buộc';
  } else {
    out.size = variant.size.trim().toUpperCase();
  }

  if (typeof variant.color !== 'string' || !variant.color.trim()) {
    errors[`${field}.color`] = 'Màu sắc (color) là bắt buộc';
  } else {
    out.color = variant.color.trim();
  }

  if (variant.colorCode !== undefined && variant.colorCode !== '') {
    if (
      typeof variant.colorCode !== 'string' ||
      !COLOR_CODE_REGEX.test(variant.colorCode)
    ) {
      errors[`${field}.colorCode`] = 'Mã màu phải có dạng #RRGGBB';
    } else {
      out.colorCode = variant.colorCode;
    }
  }

  if (typeof variant.sku !== 'string' || !variant.sku.trim()) {
    errors[`${field}.sku`] = 'SKU là bắt buộc';
  } else {
    const sku = variant.sku.trim().toUpperCase();
    if (!SKU_REGEX.test(sku)) {
      errors[`${field}.sku`] =
        'SKU không đúng định dạng SP-{CAT}-{NNN}-{SIZE}-{COLOR}';
    } else {
      out.sku = sku;
    }
  }

  if (variant.stock === undefined) {
    out.stock = 0;
  } else if (!Number.isInteger(variant.stock) || variant.stock < 0) {
    errors[`${field}.stock`] = 'Tồn kho phải là số nguyên không âm';
  } else {
    out.stock = variant.stock;
  }

  if (variant.price === undefined || variant.price === null) {
    out.price = null;
  } else if (!Number.isInteger(variant.price) || variant.price < 0) {
    errors[`${field}.price`] = 'Giá biến thể phải là số nguyên không âm (VND)';
  } else {
    out.price = variant.price;
  }

  return out;
};

const validateVariants = (variants, errors, data, { required = true } = {}) => {
  if (variants === undefined) {
    if (required) errors.variants = 'Sản phẩm phải có ít nhất một biến thể';
    return;
  }

  if (!Array.isArray(variants) || variants.length === 0) {
    errors.variants = 'Sản phẩm phải có ít nhất một biến thể';
    return;
  }

  const normalized = [];
  variants.forEach((variant, index) => {
    const result = validateVariant(variant, index, errors);
    if (result) normalized.push(result);
  });

  const sizeColorKeys = new Set();
  const skuKeys = new Set();
  const duplicateMessages = [];

  for (const variant of normalized) {
    if (variant.size && variant.color) {
      const key = `${variant.size}__${variant.color.toLowerCase()}`;
      if (sizeColorKeys.has(key)) {
        duplicateMessages.push(
          `Biến thể trùng lặp: Size ${variant.size} - Màu ${variant.color}`,
        );
      }
      sizeColorKeys.add(key);
    }

    if (variant.sku) {
      if (skuKeys.has(variant.sku)) {
        duplicateMessages.push(
          `SKU bị trùng trong cùng sản phẩm: ${variant.sku}`,
        );
      }
      skuKeys.add(variant.sku);
    }
  }

  if (duplicateMessages.length > 0) {
    errors.variants = duplicateMessages.join('; ');
  }

  data.variants = normalized;
};

const validateCreateProduct = (body) => {
  const errors = {};
  const data = {};

  if (!isPlainObject(body)) {
    throwValidation({ body: 'Dữ liệu đầu vào không hợp lệ' });
  }

  if (typeof body.name !== 'string' || !body.name.trim()) {
    errors.name = 'Tên sản phẩm là bắt buộc';
  } else {
    const name = body.name.trim();
    if (name.length > MAX_NAME_LENGTH) {
      errors.name = `Tên sản phẩm tối đa ${MAX_NAME_LENGTH} ký tự`;
    } else {
      data.name = name;
    }
  }

  if (body.description !== undefined) {
    if (typeof body.description !== 'string') {
      errors.description = 'Mô tả sản phẩm không hợp lệ';
    } else {
      const description = body.description.trim();
      if (description.length > MAX_DESCRIPTION_LENGTH) {
        errors.description = `Mô tả sản phẩm tối đa ${MAX_DESCRIPTION_LENGTH} ký tự`;
      } else {
        data.description = description;
      }
    }
  }

  if (typeof body.category !== 'string' || !OBJECT_ID_REGEX.test(body.category)) {
    errors.category = 'Id danh mục không hợp lệ';
  } else {
    data.category = body.category;
  }

  validateImages(body.images, errors, data);
  validateBasePrice(body.basePrice, errors, data);

  if (body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') {
      errors.isActive = 'Trạng thái hiển thị phải là boolean';
    } else {
      data.isActive = body.isActive;
    }
  }

  validateVariants(body.variants, errors, data, { required: true });

  if (Object.keys(errors).length > 0) throwValidation(errors);
  return data;
};

const validateUpdateProduct = (body) => {
  const errors = {};
  const data = {};

  if (!isPlainObject(body)) {
    throwValidation({ body: 'Dữ liệu đầu vào không hợp lệ' });
  }

  const hasRecognizedField = [
    'name',
    'description',
    'category',
    'images',
    'basePrice',
    'variants',
    'isActive',
  ].some((field) => body[field] !== undefined);

  if (!hasRecognizedField) {
    throwValidation({ body: 'Cần có ít nhất một trường để cập nhật' });
  }

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      errors.name = 'Tên sản phẩm là bắt buộc';
    } else {
      const name = body.name.trim();
      if (name.length > MAX_NAME_LENGTH) {
        errors.name = `Tên sản phẩm tối đa ${MAX_NAME_LENGTH} ký tự`;
      } else {
        data.name = name;
      }
    }
  }

  if (body.description !== undefined) {
    if (typeof body.description !== 'string') {
      errors.description = 'Mô tả sản phẩm không hợp lệ';
    } else {
      const description = body.description.trim();
      if (description.length > MAX_DESCRIPTION_LENGTH) {
        errors.description = `Mô tả sản phẩm tối đa ${MAX_DESCRIPTION_LENGTH} ký tự`;
      } else {
        data.description = description;
      }
    }
  }

  if (body.category !== undefined) {
    if (typeof body.category !== 'string' || !OBJECT_ID_REGEX.test(body.category)) {
      errors.category = 'Id danh mục không hợp lệ';
    } else {
      data.category = body.category;
    }
  }

  if (body.images !== undefined) {
    validateImages(body.images, errors, data);
  }

  if (body.basePrice !== undefined) {
    validateBasePrice(body.basePrice, errors, data);
  }

  if (body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') {
      errors.isActive = 'Trạng thái hiển thị phải là boolean';
    } else {
      data.isActive = body.isActive;
    }
  }

  if (body.variants !== undefined) {
    validateVariants(body.variants, errors, data, { required: true });
  }

  if (Object.keys(errors).length > 0) throwValidation(errors);
  return data;
};

module.exports = {
  validateCreateProduct,
  validateUpdateProduct,
};
