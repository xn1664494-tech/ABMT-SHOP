const express = require('express');
const CategoryController = require('../controllers/CategoryController');
const { authenticate } = require('../middleware/authenticate');
const requireAdmin = require('../middleware/requireAdmin');
const { csrfProtection } = require('../middleware/csrf');

const router = express.Router();

// Public — khách cần xem danh mục để duyệt sản phẩm
router.get('/tree', CategoryController.tree);
router.get('/', CategoryController.list);
router.get('/:id', CategoryController.getById);

// Admin only — POST/PUT/PATCH/DELETE (cookie auth nên bắt buộc CSRF)
router.post('/', authenticate, requireAdmin, csrfProtection, CategoryController.create);
router.put('/:id', authenticate, requireAdmin, csrfProtection, CategoryController.update);
router.patch('/:id', authenticate, requireAdmin, csrfProtection, CategoryController.update);
router.delete('/:id', authenticate, requireAdmin, csrfProtection, CategoryController.softDelete);

module.exports = router;
