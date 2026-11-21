const express = require('express');
const HomeController = require('../controllers/HomeController');
const CartRouter = require('../routes/cart.route');
const User = require('../model/User');
const Order = require('../model/Order');
const { ACCESS_COOKIE, verifyToken } = require('../services/tokenService');
const asyncHandler = require('../utils/asyncHandler');

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

// Trang đăng ký
router.get('/register', (req, res) => {
  res.render('pages/register', {
    title: 'Đăng ký'
  });
});

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

// Trang tài khoản của tôi (đích mặc định sau khi đăng nhập)
router.get('/account', asyncHandler(async (req, res, next) => {
  const token = extractAccessToken(req);
  if (!token) {
    return res.redirect(302, '/login?next=/account');
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch (error) {
    return res.redirect(302, '/login?next=/account');
  }

  if (payload.type === 'refresh') {
    return res.redirect(302, '/login?next=/account');
  }

  const user = await User.findById(payload.sub)
    .select('-password -resetPasswordTokenHash -resetPasswordExpires')
    .lean();

  if (!user || user.isDeleted || user.status !== 'active') {
    return res.redirect(302, '/login?next=/account');
  }

  if (Number(payload.ver || 0) !== Number(user.tokenVersion || 0)) {
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
