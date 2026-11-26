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
const User = require('../model/User');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/appError');
const addressService = require('../services/addressService');

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
/**
 * GET /api/profile/addresses - Danh sách địa chỉ của user
 */
router.get(
  '/addresses',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id || req.user.id)
      .select('addresses')
      .lean();
    const addresses = (user && user.addresses) || [];
    return res.status(200).json({
      success: true,
      data: { addresses },
    });
  })
);

/**
 * POST /api/profile/addresses - Thêm địa chỉ mới (tối đa 3)
 * Body: { fullName, phone, province, district, ward, detail }
 */
router.post(
  '/addresses',
  authenticate,
  csrfProtection,
  asyncHandler(async (req, res) => {
    const userId = req.user._id || req.user.id;
    const { fullName, phone, province, district, ward, detail, provinceCode, wardCode } =
      req.body || {};

    if (!fullName || !phone || !detail) {
      throw new ErrorResponse('Thiếu thông tin địa chỉ', 400);
    }

    let finalProvince = province;
    let finalWard = ward;

    if (provinceCode && wardCode) {
      const found = addressService.findWard(provinceCode, wardCode);
      if (!found) {
        throw new ErrorResponse('Địa chỉ không hợp lệ', 400);
      }
      finalProvince = found.province.fullName;
      finalWard = found.ward.name;
    } else if (!province || !ward) {
      throw new ErrorResponse('Thiếu thông tin địa chỉ', 400);
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new ErrorResponse('Người dùng không tồn tại', 404);
    }

    if ((user.addresses || []).length >= 3) {
      throw new ErrorResponse('Đã đạt tối đa 3 địa chỉ', 400);
    }

    user.addresses.push({
      recipient: fullName,
      phone,
      city: finalProvince,
      district: district || undefined,
      ward: finalWard,
      street: detail,
      provinceCode: provinceCode && wardCode ? String(provinceCode) : undefined,
      wardCode: provinceCode && wardCode ? String(wardCode) : undefined,
      isDefault: (user.addresses || []).length === 0,
    });

    await user.save();

    return res.status(201).json({
      success: true,
      message: 'Thêm địa chỉ thành công',
      data: { address: user.addresses[user.addresses.length - 1] },
    });
  })
);

/**
 * PUT /api/profile/addresses/:id - Cập nhật địa chỉ
 * Body: { fullName, phone, province, district, ward, detail }
 */
router.put(
  '/addresses/:id',
  authenticate,
  csrfProtection,
  asyncHandler(async (req, res) => {
    const userId = req.user._id || req.user.id;
    const { id } = req.params;
    const { fullName, phone, province, district, ward, detail, provinceCode, wardCode } =
      req.body || {};

    const user = await User.findById(userId);
    if (!user) {
      throw new ErrorResponse('Người dùng không tồn tại', 404);
    }

    const addrIdx = (user.addresses || []).findIndex((a) => String(a._id) === id);
    if (addrIdx < 0) {
      throw new ErrorResponse('Địa chỉ không tồn tại', 404);
    }

    if (fullName !== undefined) user.addresses[addrIdx].recipient = fullName;
    if (phone !== undefined) user.addresses[addrIdx].phone = phone;
    if (district !== undefined) user.addresses[addrIdx].district = district;
    if (detail !== undefined) user.addresses[addrIdx].street = detail;

    if (provinceCode && wardCode) {
      const found = addressService.findWard(provinceCode, wardCode);
      if (!found) {
        throw new ErrorResponse('Địa chỉ không hợp lệ', 400);
      }
      user.addresses[addrIdx].city = found.province.fullName;
      user.addresses[addrIdx].ward = found.ward.name;
      user.addresses[addrIdx].provinceCode = String(provinceCode);
      user.addresses[addrIdx].wardCode = String(wardCode);
    } else {
      if (province !== undefined) user.addresses[addrIdx].city = province;
      if (ward !== undefined) user.addresses[addrIdx].ward = ward;
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Cập nhật địa chỉ thành công',
      data: { address: user.addresses[addrIdx] },
    });
  })
);

/**
 * DELETE /api/profile/addresses/:id - Xóa địa chỉ
 */
router.delete(
  '/addresses/:id',
  authenticate,
  csrfProtection,
  asyncHandler(async (req, res) => {
    const userId = req.user._id || req.user.id;
    const { id } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      throw new ErrorResponse('Người dùng không tồn tại', 404);
    }

    const addrIdx = (user.addresses || []).findIndex((a) => String(a._id) === id);
    if (addrIdx < 0) {
      throw new ErrorResponse('Địa chỉ không tồn tại', 404);
    }

    user.addresses.splice(addrIdx, 1);
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Xóa địa chỉ thành công',
    });
  })
);

// Dat sau cac route /addresses de "addresses" khong bi bat nhu mot userId.
router.get('/:userId', authenticate, requireSelfOrAdmin('userId'), getProfile);

module.exports = router;
