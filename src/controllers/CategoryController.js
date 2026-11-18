const asyncHandler = require('../utils/asyncHandler');
const sendResponse = require('../utils/sendResponse');
const categoryService = require('../services/categoryService');

const CategoryController = {
  list: asyncHandler(async (req, res) => {
    const data = await categoryService.list();
    return sendResponse(res, 200, true, 'Lấy danh sách danh mục thành công', data);
  }),

  tree: asyncHandler(async (req, res) => {
    const data = await categoryService.tree();
    return sendResponse(res, 200, true, 'Lấy cây danh mục thành công', data);
  }),

  getById: asyncHandler(async (req, res) => {
    const data = await categoryService.getById(req.params.id);
    return sendResponse(res, 200, true, 'Lấy chi tiết danh mục thành công', data);
  }),

  create: asyncHandler(async (req, res) => {
    const data = await categoryService.create(req.body);
    return sendResponse(res, 201, true, 'Tạo danh mục thành công', data);
  }),

  update: asyncHandler(async (req, res) => {
    const data = await categoryService.update(req.params.id, req.body);
    return sendResponse(res, 200, true, 'Cập nhật danh mục thành công', data);
  }),

  softDelete: asyncHandler(async (req, res) => {
    await categoryService.softDelete(req.params.id);
    return sendResponse(res, 200, true, 'Xóa mềm danh mục thành công');
  }),
};

module.exports = CategoryController;
