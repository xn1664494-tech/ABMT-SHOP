const express = require('express');
const router = express.Router();

// API sub-routers (chỉ mount dưới /api)
router.use('/auth', require('./auth.route'));
router.use('/profile', require('./profile.route'));
router.use('/admin', require('./admin.route'));
router.use('/categories', require('./category.route'));
router.use('/products', require('./products.route'));
router.use('/cart', require('./cart.route'));
router.use('/orders', require('./order.route'));
router.use('/address', require('./address.route'));

module.exports = router;
