const express = require('express');
const CategoryController = require('../controllers/CategoryController');
const { authenticate } = require('../middleware/authenticate');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

// Public — khách cần xem danh mục để duyệt sản phẩm
router.get('/tree', CategoryController.tree);
router.get('/', CategoryController.list);
router.get('/:id', CategoryController.getById);

// Admin only — POST/PUT/PATCH/DELETE
router.post('/', authenticate, requireAdmin, CategoryController.create);
router.put('/:id', authenticate, requireAdmin, CategoryController.update);
router.patch('/:id', authenticate, requireAdmin, CategoryController.update);
router.delete('/:id', authenticate, requireAdmin, CategoryController.softDelete);

module.exports = router;
