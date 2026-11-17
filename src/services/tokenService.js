const jwt = require('jsonwebtoken');

const ISSUER = 'abmt-shop';
const AUDIENCE = 'abmt-shop-client';

const ACCESS_COOKIE = 'accessToken';
const REFRESH_COOKIE = 'refreshToken';

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Thieu JWT_SECRET trong bien moi truong');
  }
  return secret;
};

const accessTokenTtl = () => process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const refreshTokenTtl = () => process.env.JWT_REFRESH_EXPIRES_IN || '7d';

/**
 * Đổi TTL dạng '15m' / '7d' / '3600' (giây) sang mili-giây cho cookie maxAge.
 */
const ttlToMs = (ttl) => {
  const match = String(ttl).trim().match(/^(\d+)\s*([smhd])?$/i);
  if (!match) {
    throw new Error(`Gia tri TTL khong hop le: ${ttl}`);
  }

  const value = Number(match[1]);
  const unit = (match[2] || 's').toLowerCase();
  const factors = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return value * factors[unit];
};

const signAccessToken = (user) =>
  jwt.sign(
    { sub: String(user._id || user.id), role: user.role, ver: user.tokenVersion || 0 },
    getSecret(),
    {
      expiresIn: accessTokenTtl(),
      issuer: ISSUER,
      audience: AUDIENCE,
    },
  );

const signRefreshToken = (user, tokenVersion = 0) =>
  jwt.sign(
    { sub: String(user._id || user.id), ver: tokenVersion, type: 'refresh' },
    getSecret(),
    {
      expiresIn: refreshTokenTtl(),
      issuer: ISSUER,
      audience: AUDIENCE,
    },
  );

const verifyToken = (token) =>
  jwt.verify(token, getSecret(), { issuer: ISSUER, audience: AUDIENCE });

/**
 * Cookie access token: HttpOnly, SameSite=Strict, Secure bật ở production.
 */
const accessCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
});

/**
 * Cookie refresh token: chỉ gửi tới các endpoint auth để giảm bề mặt tấn công.
 */
const refreshCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api/auth',
});

const setAuthCookies = (res, accessToken, refreshToken) => {
  const accessOptions = accessCookieOptions();
  const refreshOptions = refreshCookieOptions();

  accessOptions.maxAge = ttlToMs(accessTokenTtl());
  refreshOptions.maxAge = ttlToMs(refreshTokenTtl());

  res.cookie(ACCESS_COOKIE, accessToken, accessOptions);
  res.cookie(REFRESH_COOKIE, refreshToken, refreshOptions);
};

const clearAuthCookies = (res) => {
  res.clearCookie(ACCESS_COOKIE, accessCookieOptions());
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
};

module.exports = {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  signAccessToken,
  signRefreshToken,
  verifyToken,
  setAuthCookies,
  clearAuthCookies,
  accessCookieOptions,
  refreshCookieOptions,
};
