const express = require('express');
const HomeController = require('../controllers/HomeController');
const CartRouter = require('../routes/cart.route');

const router = express.Router();

// Trang chủ (UI)
router.get('/', HomeController.index);

// Trang login
router.get('/login', (req, res) => {
  const error = req.query.error || '';
  res.render('pages/login', {
    title: 'Đăng nhập',
    locals: { error, next: req.query.next || '' }
  });
});

// API
router.use('/auth', require('./auth.route'));
router.use('/profile', require('./profile.route'));
router.use('/admin', require('./admin.route'));
router.use('/categories', require('./category.route'));
router.use('/products', require('./products.route'));
// Route cart
router.use('/cart', CartRouter);

module.exports = router;
