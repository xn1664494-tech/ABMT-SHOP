const asyncHandler = require('../utils/asyncHandler');
const sendResponse = require('../utils/sendResponse');
const productService = require('../services/ProductsServices');

const parseFlag = (value) => value === true || value === 'true' || value === '1';

const visibilityOptions = (req) => {
  const isAdmin = Boolean(req.user && req.user.role === 'admin');

  return {
    includeInactive: isAdmin && parseFlag(req.query.includeInactive),
    includeDeleted: isAdmin && parseFlag(req.query.includeDeleted),
  };
};

const ProductsController = {
  list: asyncHandler(async (req, res) => {
    const data = await productService.list(visibilityOptions(req));
    return sendResponse(
      res,
      200,
      true,
      'Lấy danh sách sản phẩm thành công',
      data,
    );
  }),

  getById: asyncHandler(async (req, res) => {
    const data = await productService.getById(
      req.params.id,
      visibilityOptions(req),
    );
    return sendResponse(
      res,
      200,
      true,
      'Lấy chi tiết sản phẩm thành công',
      data,
    );
  }),

  create: asyncHandler(async (req, res) => {
    const data = await productService.create(req.body);
    return sendResponse(res, 201, true, 'Tạo sản phẩm thành công', data);
  }),

  update: asyncHandler(async (req, res) => {
    const data = await productService.update(req.params.id, req.body);
    return sendResponse(res, 200, true, 'Cập nhật sản phẩm thành công', data);
  }),

  softDelete: asyncHandler(async (req, res) => {
    const data = await productService.softDelete(req.params.id);
    return sendResponse(res, 200, true, 'Xóa mềm sản phẩm thành công', data);
  }),
};

module.exports = ProductsController;
