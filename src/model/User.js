const mongoose = require('mongoose');

/**
 * Schema người dùng tối thiểu phục vụ Phase 2 - Dev 1 (auth/RBAC/profile).
 * Bám theo data dictionary trong docs: name, email, passwordHash, role, status.
 * Các nghiệp vụ mở rộng của Dev 2 (địa chỉ, giỏ hàng, ...) không thuộc phạm vi này.
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Ten khong duoc de trong'],
      trim: true,
      maxlength: [100, 'Ten toi da 100 ky tu'],
    },
    email: {
      type: String,
      required: [true, 'Email khong duoc de trong'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
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
    status: {
      type: String,
      enum: {
        values: ['active', 'blocked'],
        message: 'Trang thai tai khoan khong hop le',
      },
      default: 'active',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  },
);

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
