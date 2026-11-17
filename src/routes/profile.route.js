const express = require('express');
const validate = require('../middleware/validate');
const { updateProfileSchema } = require('../validators/authValidator');
const { authenticate, requireSelfOrAdmin } = require('../middleware/authenticate');
const { csrfProtection } = require('../middleware/csrf');
const { getProfile, getMyProfile, updateMyProfile } = require('../controllers/profileController');

const router = express.Router();

router.get('/me', authenticate, getMyProfile);
router.patch(
  '/me',
  authenticate,
  csrfProtection,
  validate(updateProfileSchema),
  updateMyProfile,
);
router.get('/:userId', authenticate, requireSelfOrAdmin('userId'), getProfile);

module.exports = router;
