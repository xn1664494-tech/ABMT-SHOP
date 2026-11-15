const express = require('express');
const validate = require('../middleware/validate');
const { registerSchema, loginSchema } = require('../validators/authValidator');
const { register, login, refresh, logout } = require('../controllers/authController');
const { me } = require('../controllers/profileController');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', authenticate, me);

module.exports = router;
