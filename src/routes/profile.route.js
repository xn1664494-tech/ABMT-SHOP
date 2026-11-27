const express = require('express');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiters');
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
const crypto = require('crypto');
const PhoneVerification = require('../model/PhoneVerification');
const smsService = require('../services/smsService');
const { maskPhone } = require('../utils/maskPhone');
const { phoneUpdateSchema, phoneVerifyCodeSchema } = require('../validators/authValidator');

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
/**
 * POST /api/profile/phone - Dat so dien thoai cho user + gui OTP.
 * Body: { phone }
 */
const normalizePhoneNumber = (value) => {
  let digits = String(value === null || value === undefined ? '' : value).replace(/[\s-]/g, '');
  if (digits.startsWith('+')) {
    digits = digits.slice(1);
  }
  if (digits.startsWith('84')) {
    digits = '0' + digits.slice(2);
  }
  return digits;
};

const sha256Hex = (value) => {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
};

const isProductionEnv = () => String(process.env.NODE_ENV || "development") === "production";
const isConsoleSmsProvider = () => String(process.env.SMS_PROVIDER || 'console').trim().toLowerCase() === 'console';

const issuePhoneOtp = async (userId, phone) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ErrorResponse('Nguoi dung khong ton tai', 404);
  }

  const existingVerified = await User.findOne({
    phone,
    phoneVerified: true,
    _id: { $ne: userId },
  });
  if (existingVerified) {
    throw new ErrorResponse('So dien thoai da duoc xac minh boi tai khoan khac', 409);
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = sha256Hex(code + (process.env.SMS_OTP_SECRET || "abmt-otp-dev-secret"));
  const now = new Date();
  const latest = await PhoneVerification.findOne({ user: userId }).sort({ createdAt: -1 });
  if (latest && latest.lastSentAt) {
    const elapsed = now.getTime() - new Date(latest.lastSentAt).getTime();
    if (elapsed < 60 * 1000) {
      throw new ErrorResponse('Qua it gui, vui long cho de gui lai sau', 429);
    }
  }
  if (latest && Number(latest.sentCount) >= 5) {
    throw new ErrorResponse('Da dat toi so luoc gui ma, vui long cho de gui lai sau', 429);
  }

  user.phone = phone;
  user.phoneVerified = false;
  user.phoneVerifiedAt = null;
  await user.save();
  await PhoneVerification.create({
    user: userId,
    phone,
    codeHash,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    attempts: 0,
    sentCount: Number(latest ? latest.sentCount : 0) + 1,
    lastSentAt: now,
  });

  const provider = isConsoleSmsProvider() ? "console" : String(process.env.SMS_PROVIDER || "console");
  await smsService.sendOtp(phone, code);

  const data = {
    phoneMasked: maskPhone(phone),
    phoneVerified: false,
  };
  if (!isProductionEnv() && provider === 'console') {
    data.devOtp = code;
  }
  return { data };
};

router.post(
  '/phone',
  authenticate,
  authLimiter,
  csrfProtection,
  validate(phoneUpdateSchema),
  asyncHandler(async (req, res, next) => {
    const userId = req.user._id || req.user.id;
    const phone = normalizePhoneNumber(req.body.phone);
    const { data } = await issuePhoneOtp(userId, phone);
    return res.status(201).json({
      success: true,
      message: 'Da gui ma xac minh OTP',
      data,
    });
  }),
);

router.post(
  '/phone/verify',
  authenticate,
  authLimiter,
  csrfProtection,
  validate(phoneVerifyCodeSchema),
  asyncHandler(async (req, res, next) => {
    const userId = req.user._id || req.user.id;
    const code = String(req.body.code || "").trim();
    const latest = await PhoneVerification.findOne({ user: userId }).sort({ createdAt: -1 });
    if (!latest) {
      throw new ErrorResponse('Khong tim thay yeu cau xac minh', 404);
    }
    if (latest.expiresAt && new Date(latest.expiresAt).getTime() < Date.now()) {
      await PhoneVerification.deleteOne({ _id: latest._id });
      throw new ErrorResponse('Ma xac minh da het han', 400);
    }
    if (Number(latest.attempts) >= 5) {
      await PhoneVerification.deleteOne({ _id: latest._id });
      throw new ErrorResponse('Qua nhieu lan thu that, vui long gui ma moi', 429);
    }

    const candidateHash = sha256Hex(code + (process.env.SMS_OTP_SECRET || "abmt-otp-dev-secret"));
    if (candidateHash === latest.codeHash) {
      const user = await User.findById(userId);
      if (user) {
        user.phoneVerified = true;
        user.phoneVerifiedAt = new Date();
        await user.save();
      }
      await PhoneVerification.deleteOne({ _id: latest._id });
      return res.status(200).json({
        success: true,
        data: {
          phoneMasked: maskPhone(latest.phone),
          phoneVerified: true,
        },
      });
    }

    const attempts = Number(latest.attempts) + 1;
    await PhoneVerification.updateOne({ _id: latest._id }, { $set: { attempts } });
    if (attempts >= 5) {
      await PhoneVerification.deleteOne({ _id: latest._id });
    }
    return res.status(400).json({
      success: false,
      message: 'Ma xac minh khong dung',
      data: {
        phoneMasked: maskPhone(latest.phone),
        phoneVerified: false,
      },
    });
  }),
);

router.post(
  '/phone/resend',
  authenticate,
  authLimiter,
  csrfProtection,
  validate(phoneUpdateSchema),
  asyncHandler(async (req, res, next) => {
    const userId = req.user._id || req.user.id;
    const phone = normalizePhoneNumber(req.body.phone);
    const { data } = await issuePhoneOtp(userId, phone);
    return res.status(200).json({
      success: true,
      message: 'Da gui lai ma xac minh OTP',
      data,
    });
  }),
);

router.get('/:userId', authenticate, requireSelfOrAdmin('userId'), getProfile);

module.exports = router;
