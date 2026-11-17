const express = require('express');
const validate = require('../middleware/validate');
const { registerSchema, loginSchema } = require('../validators/authValidator');
const { register, login, refresh, logout } = require('../controllers/authController');
const { me } = require('../controllers/profileController');
const { authenticate } = require('../middleware/authenticate');
const { authLimiter } = require('../middleware/rateLimiters');
const { csrfProtection, issueCsrfToken } = require('../middleware/csrf');

const router = express.Router();

router.get('/csrf', issueCsrfToken);

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/refresh', authLimiter, csrfProtection, refresh);
router.post('/logout', authLimiter, csrfProtection, logout);
router.get('/me', authenticate, me);

module.exports = router;
