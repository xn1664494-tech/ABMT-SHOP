const express = require('express');
const validate = require('../middleware/validate');
const {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('../validators/authValidator');
const {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController');
const { me } = require('../controllers/profileController');
const { authenticate } = require('../middleware/authenticate');
const { authLimiter } = require('../middleware/rateLimiters');
const { csrfProtection, issueCsrfToken } = require('../middleware/csrf');

const router = express.Router();

router.get('/csrf', issueCsrfToken);

router.post('/register', authLimiter, csrfProtection, validate(registerSchema), register);
router.post('/login', authLimiter, csrfProtection, validate(loginSchema), login);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), resetPassword);
router.post('/refresh', authLimiter, csrfProtection, refresh);
router.post('/logout', authLimiter, csrfProtection, logout);
router.get('/me', authenticate, me);

module.exports = router;
