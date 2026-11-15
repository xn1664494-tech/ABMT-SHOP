const express = require('express');
const validate = require('../middleware/validate');
const { registerSchema } = require('../validators/authValidator');
const { register } = require('../controllers/authController');

const router = express.Router();

router.post('/register', validate(registerSchema), register);

module.exports = router;
