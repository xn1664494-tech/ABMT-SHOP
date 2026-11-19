const express = require('express');
const HomeController = require('../controllers/HomeController');

const router = express.Router();

// Trang chủ (UI)
router.get('/', HomeController.index);

// API
router.use('/auth', require('./auth.route'));
router.use('/profile', require('./profile.route'));
router.use('/admin', require('./admin.route'));
router.use('/categories', require('./category.route'));
router.use('/products', require('./products.route'));

module.exports = router;
