'use strict';

const sendOtp = async (phone, code) => {
  const provider = String(process.env.SMS_PROVIDER || 'console').trim().toLowerCase();
  if (provider === 'console') {
    // eslint-disable-next-line no-console
    console.log('[SMS][OTP] provider=console phone=' + phone + ' code=' + code);
    return { provider: 'console', sent: true };
  }
  // TODO: integrate real SMS provider later.
  return { provider: provider, sent: true };
};

module.exports = { sendOtp };