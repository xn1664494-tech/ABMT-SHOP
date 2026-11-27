const mongoose = require('mongoose');
const softDeletePlugin = require('../plugins/softDelete');

/**
 * Địa chỉ nhúng trong user (data dictionary: addresses: Address[], tối đa 3).
 * Chi tiết từng trường Address chưa được đặc tả riêng trong data dictionary,
 * nên schema dưới đây giữ các trường phổ biến và cho phép mở rộng sau này.
 */
const addressSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, maxlength: 50 },
    recipient: { type: String, trim: true, maxlength: 80 },
    phone: { type: String, trim: true },
    street: { type: String, trim: true, maxlength: 200 },
    ward: { type: String, trim: true, maxlength: 100 },
    district: { type: String, trim: true, maxlength: 100 },
    city: { type: String, trim: true, maxlength: 100 },
    provinceCode: { type: String, trim: true, maxlength: 20 },
    wardCode: { type: String, trim: true, maxlength: 20 },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true },
);

/**
 * Schema người dùng theo data dictionary T1-2-1 (users):
 * name, email, password, role, phone, addresses, isDeleted, deletedAt, timestamps.
 *
 * Phần mở rộng cần cho Phase 2 Dev 1 (được ghi nhận trong báo cáo):
 * - status: khóa/mở tài khoản (docx mô tả trường status + index trạng thái).
 * - tokenVersion: thu hồi refresh/access token khi logout/refresh.
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Ten khong duoc de trong'],
      trim: true,
      maxlength: [80, 'Ten toi da 80 ky tu'],
    },
    email: {
      type: String,
      required: [true, 'Email khong duoc de trong'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^(?:[A-Za-z0-9_'+.-]+)*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/,
        'Email khong hop le',
      ],
    },
    password: {
      type: String,
      required: [true, 'Mat khau khong duoc de trong'],
      // Không bao giờ trả hash ra ngoài theo mặc định.
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: ['customer', 'admin'],
        message: 'Role khong hop le',
      },
      default: 'customer',
    },
    phone: {
      type: String,
      trim: true,
      match: [/^0(3|5|7|8|9)[0-9]{8}$/, "So dien thoai khong hop le"],
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    phoneVerifiedAt: {
      type: Date,
      default: null,
    },
    addresses: {
      type: [addressSchema],
      default: [],
      validate: {
        validator: (value) => !value || value.length <= 3,
        message: 'Toi da 3 dia chi',
      },
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'blocked'],
        message: 'Trang thai tai khoan khong hop le',
      },
      default: 'active',
    },
    // Tăng mỗi lần refresh/logout để thu hồi toàn bộ refresh token cũ.
    tokenVersion: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Reset mật khẩu: chỉ lưu hash của token, không lưu token thô.
    resetPasswordTokenHash: {
      type: String,
      default: null,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        delete ret.passwordHash;
        delete ret.resetPasswordTokenHash;
        delete ret.resetPasswordExpires;
        delete ret.isDeleted;
        return ret;
      },
    },
  },
);

// Alias tương thích cho code cũ dùng tên passwordHash; không lưu thêm field.
userSchema
  .virtual('passwordHash')
  .get(function getPasswordHash() {
    return this.password;
  })
  .set(function setPasswordHash(value) {
    this.password = value;
  });

// Index trạng thái theo mô tả tài liệu.
userSchema.index({ status: 1 });

userSchema.plugin(softDeletePlugin);

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
