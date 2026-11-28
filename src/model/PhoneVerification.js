'use strict';

const mongoose = require('mongoose');

const phoneVerificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    phone: { type: String, trim: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: '5m' } },
    attempts: { type: Number, default: 0, min: 0 },
    sentCount: { type: Number, default: 0, min: 0 },
    lastSentAt: { type: Date, default: null },
  },
  { timestamps: true },
);

phoneVerificationSchema.index({ user: 1, phone: 1, expiresAt: -1 });
phoneVerificationSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.models.PhoneVerification || mongoose.model('PhoneVerification', phoneVerificationSchema);