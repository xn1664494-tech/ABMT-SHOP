/**
 * T4-1-2 — Integration test MongoDB thật cho quên / đặt lại mật khẩu.
 *
 * - Chỉ dùng database test (`MONGODB_URI_TEST`, tên bắt buộc chứa "test").
 * - Không mock model: token/hash/expiry được đọc trực tiếp từ MongoDB thật.
 * - Chỉ xoá user do lần chạy này tạo ra (tiền tố email fp-<runId>-).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), quiet: true });

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'fp-integration-jwt-secret-at-least-32-chars';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.APP_ORIGIN = 'http://localhost:3000';
process.env.AUTH_RATE_LIMIT_MAX = '10000';

const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/model/User');

const LEGACY_TEST_URI = process.env.TEST_MONGODB_URI;
const TEST_URI = process.env.MONGODB_URI_TEST || LEGACY_TEST_URI;

if (!TEST_URI) {
  throw new Error('Thiếu MONGODB_URI_TEST. Tạo file .env.test từ .env.test.example rồi chạy lại.');
}

const OLD_PASSWORD = 'Secret123';
const NEW_PASSWORD = 'NewSecret456';
const RUN_ID = `fp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const EMAIL_PREFIX = `${RUN_ID}-`;

let available = false;
let skipReason = '';

const emailFor = (name) => `${EMAIL_PREFIX}${name}@example.com`;
const forgot = (email, extra = {}) =>
  request(app).post('/api/auth/forgot-password').send({ email, ...extra });
const reset = (body) => request(app).post('/api/auth/reset-password').send(body);
const login = (email, password) =>
  request(app).post('/api/auth/login').send({ email, password });

const skipIfUnavailable = (t) => {
  if (!available) {
    t.skip(skipReason);
    return true;
  }
  return false;
};

const seedUser = async (name) => {
  const email = emailFor(name);
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: `FP ${name}`, email, password: OLD_PASSWORD });
  assert.equal(res.status, 201);
  return email;
};

const issueToken = async (email) => {
  const res = await forgot(email);
  assert.equal(res.status, 202);
  assert.match(res.body.data.resetToken, /^[a-f0-9]{64}$/);
  return res.body.data.resetToken;
};

const getUser = (email) =>
  User.findOne({ email }).select('+resetPasswordTokenHash +resetPasswordExpires +password');

test.before(async () => {
  const dbName = (() => {
    try {
      const withoutParams = TEST_URI.split('?')[0];
      const afterScheme = withoutParams.replace(/^mongodb(\+srv)?:\/\//, '');
      const afterAt = afterScheme.includes('@')
        ? afterScheme.slice(afterScheme.lastIndexOf('@') + 1)
        : afterScheme;
      const slash = afterAt.indexOf('/');
      return slash >= 0 ? afterAt.slice(slash + 1) : '';
    } catch (error) {
      return '';
    }
  })();

  if (!dbName || !dbName.toLowerCase().includes('test')) {
    skipReason = 'MONGODB_URI_TEST phai tro toi database co ten chua "test"';
    return;
  }

  try {
    await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 5000 });
    await User.init();
    available = true;
  } catch (error) {
    skipReason = `Khong ket noi duoc MongoDB test (${error.name})`;
  }
});

test.after(async () => {
  if (available) {
    await User.deleteMany({ email: { $regex: `^${EMAIL_PREFIX}` } });
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

// --- Validation & chống enumeration ---

test('FP-1: email sai dinh dang tra 400', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await forgot('not-an-email');
  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
});

test('FP-2: field ngoai scope bi tu choi', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await forgot(emailFor('extra'), { role: 'admin' });
  assert.equal(res.status, 400);
});

test('FP-3: email khong ton tai van tra 202 va message chung', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await forgot(emailFor('missing'));
  assert.equal(res.status, 202);
  assert.equal(res.body.success, true);
  assert.match(res.body.message, /Neu email ton tai/);
  assert.equal(res.body.data, undefined);
});

test('FP-4: production khong tra token', async (t) => {
  if (skipIfUnavailable(t)) return;
  const email = await seedUser('prod');
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const res = await forgot(email);
    assert.equal(res.status, 202);
    assert.equal(res.body.data, undefined);
  } finally {
    process.env.NODE_ENV = previous;
  }
});

// --- Phát hành token ---

test('FP-5: email ton tai tra token va luu hash, khong luu token tho', async (t) => {
  if (skipIfUnavailable(t)) return;
  const email = await seedUser('issue');
  const token = await issueToken(email);

  const user = await getUser(email);
  assert.notEqual(user.resetPasswordTokenHash, null);
  assert.notEqual(user.resetPasswordTokenHash, token);
  assert.equal(user.resetPasswordTokenHash.length, 64);
  assert.ok(user.resetPasswordExpires instanceof Date);
  assert.ok(user.resetPasswordExpires.getTime() > Date.now());
});

test('FP-6: yeu cau moi ghi de token cu', async (t) => {
  if (skipIfUnavailable(t)) return;
  const email = await seedUser('overwrite');
  const oldToken = await issueToken(email);
  const newToken = await issueToken(email);
  assert.notEqual(newToken, oldToken);

  const res = await reset({ token: oldToken, newPassword: NEW_PASSWORD });
  assert.equal(res.status, 400);
});

// --- Đặt lại ---

test('FP-7: token sai dinh dang tra 400', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await reset({ token: 'abc', newPassword: NEW_PASSWORD });
  assert.equal(res.status, 400);
});

test('FP-8: token hex nhung sai tra 400', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await reset({ token: 'a'.repeat(64), newPassword: NEW_PASSWORD });
  assert.equal(res.status, 400);
});

test('FP-9: mat khau moi yeu tra 400', async (t) => {
  if (skipIfUnavailable(t)) return;
  const email = await seedUser('weak');
  const token = await issueToken(email);
  const res = await reset({ token, newPassword: '123' });
  assert.equal(res.status, 400);
});

test('FP-10: token het han tra 400', async (t) => {
  if (skipIfUnavailable(t)) return;
  const email = await seedUser('expired');
  const token = await issueToken(email);
  await User.updateOne(
    { email },
    { $set: { resetPasswordExpires: new Date(Date.now() - 1000) } },
  );

  const res = await reset({ token, newPassword: NEW_PASSWORD });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /Token dat lai mat khau/);
});

test('FP-11: dat lai thanh cong, hash bcrypt va token dung mot lan', async (t) => {
  if (skipIfUnavailable(t)) return;
  const email = await seedUser('success');
  const token = await issueToken(email);

  const res = await reset({ token, newPassword: NEW_PASSWORD });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);

  const user = await getUser(email);
  assert.ok(!user.resetPasswordTokenHash);
  assert.ok(!user.resetPasswordExpires);
  assert.notEqual(user.password, OLD_PASSWORD);
  assert.equal(await bcrypt.compare(NEW_PASSWORD, user.password), true);

  const replay = await reset({ token, newPassword: NEW_PASSWORD });
  assert.equal(replay.status, 400);
});

test('FP-12: mat khau cu fail, mat khau moi login duoc', async (t) => {
  if (skipIfUnavailable(t)) return;
  const email = await seedUser('login');
  const token = await issueToken(email);
  await reset({ token, newPassword: NEW_PASSWORD }).expect(200);

  const oldLogin = await login(email, OLD_PASSWORD);
  assert.equal(oldLogin.status, 401);

  const newLogin = await login(email, NEW_PASSWORD);
  assert.equal(newLogin.status, 200);
});

test('FP-13: reset thu hoi access token cu (tokenVersion)', async (t) => {
  if (skipIfUnavailable(t)) return;
  const email = await seedUser('revoke');
  const before = await login(email, OLD_PASSWORD);
  assert.equal(before.status, 200);

  // login chỉ trả user trong body; lấy access token từ cookie HttpOnly.
  const accessCookie = (before.headers['set-cookie'] || []).find((item) =>
    item.startsWith('accessToken='),
  );
  assert.ok(accessCookie);
  const oldToken = accessCookie.split(';')[0].split('=').slice(1).join('=');

  const token = await issueToken(email);
  await reset({ token, newPassword: NEW_PASSWORD }).expect(200);

  const me = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${oldToken}`);
  assert.equal(me.status, 401);
});
