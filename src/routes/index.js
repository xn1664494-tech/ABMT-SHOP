const express = require('express');
const HomeController = require('../controllers/HomeController');
const CartRouter = require('../routes/cart.route');
const User = require('../model/User');
const Order = require('../model/Order');
const { ACCESS_COOKIE, verifyToken } = require('../services/tokenService');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

const extractAccessToken = (req) => {
  const cookieToken = req.cookies ? req.cookies[ACCESS_COOKIE] : undefined;
  if (cookieToken) {
    return cookieToken;
  }
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim();
  }
  return null;
};

const isSafeNext = (next) => {
  if (typeof next !== 'string' || next === '') {
    return false;
  }
  if (!next.startsWith('/') || next.startsWith('//')) {
    return false;
  }
  if (next.includes('\\') || next.includes('://')) {
    return false;
  }
  return true;
};

// Trang chủ (UI)
router.get('/', HomeController.index);

// Trang login
router.get('/login', (req, res) => {
  if (res.locals.currentUser) {
    const next = isSafeNext(req.query.next) ? req.query.next : '/account';
    return res.redirect(302, next);
  }
  const error = req.query.error || '';
  const next = isSafeNext(req.query.next) ? req.query.next : '';
  res.render('pages/login', {
    title: 'Đăng nhập',
    locals: { error, next },
  });
});

// Trang đăng ký
router.get('/register', (req, res) => {
  res.render('pages/register', {
    title: 'Đăng ký'
  });
});

// Trang tài khoản của tôi (đích mặc định sau khi đăng nhập)
router.get('/account', asyncHandler(async (req, res, next) => {
  if (!res.locals.currentUser) {
    return res.redirect(302, '/login?next=/account');
  }

  const user = await User.findById(res.locals.currentUser.id)
    .select('-password -resetPasswordTokenHash -resetPasswordExpires')
    .lean();

  if (!user || user.isDeleted || user.status !== 'active') {
    return res.redirect(302, '/login?next=/account');
  }

  const orders = await Order.find({ user: user._id })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  res.set('Cache-Control', 'no-store');
  res.render('pages/account', {
    title: 'Tài khoản của tôi',
    user,
    orders
  });
}));

// API
router.use('/auth', require('./auth.route'));
router.use('/profile', require('./profile.route'));
router.use('/admin', require('./admin.route'));
router.use('/categories', require('./category.route'));
router.use('/products', require('./products.route'));
// Route cart
router.use('/cart', CartRouter);

module.exports = router;
