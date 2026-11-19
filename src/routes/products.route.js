const express = require('express');
const ProductsController = require('../controllers/ProductsController');
const {
  authenticate,
  optionalAuthenticate,
} = require('../middleware/authenticate');
const requireAdmin = require('../middleware/requireAdmin');
const { csrfProtection } = require('../middleware/csrf');

const router = express.Router();

// Public — khách duyệt sản phẩm đang bán. Admin có thể mở rộng phạm vi
// bằng includeInactive/includeDeleted (optionalAuthenticate chỉ gắn req.user).
router.get('/', optionalAuthenticate, ProductsController.list);
router.get('/:id', optionalAuthenticate, ProductsController.getById);

// Admin only — POST/PUT/PATCH/DELETE (cookie auth nên bắt buộc CSRF)
router.post('/', authenticate, requireAdmin, csrfProtection, ProductsController.create);
router.put('/:id', authenticate, requireAdmin, csrfProtection, ProductsController.update);
router.patch('/:id', authenticate, requireAdmin, csrfProtection, ProductsController.update);
router.delete('/:id', authenticate, requireAdmin, csrfProtection, ProductsController.softDelete);

module.exports = router;
