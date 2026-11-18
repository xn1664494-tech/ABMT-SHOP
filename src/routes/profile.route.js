const express = require('express');
const validate = require('../middleware/validate');
const { updateProfileSchema, changePasswordSchema } = require('../validators/authValidator');
const { authenticate, requireSelfOrAdmin } = require('../middleware/authenticate');
const { csrfProtection } = require('../middleware/csrf');
const {
  getProfile,
  getMyProfile,
  updateMyProfile,
  changeMyPassword,
} = require('../controllers/profileController');

const router = express.Router();

router.get('/me', authenticate, getMyProfile);
router.patch(
  '/me',
  authenticate,
  csrfProtection,
  validate(updateProfileSchema),
  updateMyProfile,
);
router.patch(
  '/me/password',
  authenticate,
  csrfProtection,
  validate(changePasswordSchema),
  changeMyPassword,
);
router.get('/:userId', authenticate, requireSelfOrAdmin('userId'), getProfile);

module.exports = router;
