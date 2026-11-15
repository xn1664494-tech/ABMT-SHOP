const express = require('express');
const { authenticate, requireSelfOrAdmin } = require('../middleware/authenticate');
const { getProfile } = require('../controllers/profileController');

const router = express.Router();

router.get('/:userId', authenticate, requireSelfOrAdmin('userId'), getProfile);

module.exports = router;
