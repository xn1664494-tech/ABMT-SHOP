/**
 * V2 — Integration test MongoDB thật cho API đổi mật khẩu (T4-1-3).
 *
 * - Chỉ dùng database test (`MONGODB_URI_TEST`, tên bắt buộc chứa "test").
 * - Không mock model: mọi thao tác đi qua MongoDB thật.
 * - Chỉ xoá user do lần chạy này tạo ra (tiền tố email v2-<runId>-).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), quiet: true });

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'v2-integration-jwt-secret-at-least-32-chars';
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
  throw new Error(
    'Thiếu MONGODB_URI_TEST. Tạo file .env.test từ .env.test.example rồi chạy lại.',
  );
}

const OLD_PASSWORD = 'Secret123';
const NEW_PASSWORD = 'NewSecret456';
const RUN_ID = `v2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const EMAIL_PREFIX = `${RUN_ID}-`;

let available = false;
let skipReason = '';

const emailFor = (name) => `${EMAIL_PREFIX}${name}@example.com`;

const cookieOf = (res, name) => {
  const cookie = (res.headers['set-cookie'] || []).find((item) =>
    item.startsWith(`${name}=`),
  );
  return cookie ? cookie.split(';')[0] : null;
};

const cookieValue = (res, name) => {
  const cookie = cookieOf(res, name);
  return cookie ? cookie.split('=').slice(1).join('=') : null;
};

const csrfFor = async (agent) => {
  const res = await agent.get('/api/auth/csrf');
  return res.body.data.csrfToken;
};

const register = (payload) =>
  request(app).post('/api/auth/register').send(payload);

const login = (agent, email, password = OLD_PASSWORD) =>
  agent.post('/api/auth/login').send({ email, password });

const changePassword = (agent, csrf, body) => {
  const req = agent.patch('/api/profile/me/password');
  return (csrf ? req.set('X-CSRF-Token', csrf) : req).send(body);
};

const seedUser = async (name) => {
  const email = emailFor(name);
  await register({ name: `V2 ${name}`, email, password: OLD_PASSWORD }).expect(201);
  return email;
};

const skipIfUnavailable = (t) => {
  if (!available) {
    t.skip(skipReason);
    return true;
  }
  return false;
};

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

// --- 1..3: xác thực / CSRF ---

test('V2-1: doi mat khau khi chua dang nhap tra 401', async (t) => {
  if (skipIfUnavailable(t)) return;

  const res = await request(app)
    .patch('/api/profile/me/password')
    .send({ currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD });

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test('V2-2: doi mat khau thieu CSRF token tra 403', async (t) => {
  if (skipIfUnavailable(t)) return;

  const email = await seedUser('noc-csrf');
  const agent = request.agent(app);
  await login(agent, email).expect(200);

  const res = await changePassword(agent, null, {
    currentPassword: OLD_PASSWORD,
    newPassword: NEW_PASSWORD,
  });

  assert.equal(res.status, 403);
});

test('V2-3: doi mat khau voi CSRF token sai tra 403', async (t) => {
  if (skipIfUnavailable(t)) return;

  const email = await seedUser('bad-csrf');
  const agent = request.agent(app);
  await login(agent, email).expect(200);
  await csrfFor(agent);

  const res = await changePassword(agent, 'sai-token', {
    currentPassword: OLD_PASSWORD,
    newPassword: NEW_PASSWORD,
  });

  assert.equal(res.status, 403);
});

// --- 4..6: sai mật khẩu / validation (phải không đổi dữ liệu) ---

test('V2-4: mat khau hien tai sai tra 401 va khong doi DB', async (t) => {
  if (skipIfUnavailable(t)) return;

  const email = await seedUser('wrong-current');
  const agent = request.agent(app);
  await login(agent, email).expect(200);
  const csrf = await csrfFor(agent);

  const res = await changePassword(agent, csrf, {
    currentPassword: 'WrongPass123',
    newPassword: NEW_PASSWORD,
  });

  assert.equal(res.status, 401);

  const stored = await User.findOne({ email }).select('+password tokenVersion');
  assert.equal(await bcrypt.compare(OLD_PASSWORD, stored.password), true);
  assert.equal(stored.tokenVersion, 0);
});

test('V2-5: mat khau moi yeu tra 400 va khong doi DB', async (t) => {
  if (skipIfUnavailable(t)) return;

  const email = await seedUser('weak-new');
  const agent = request.agent(app);
  await login(agent, email).expect(200);
  const csrf = await csrfFor(agent);

  const res = await changePassword(agent, csrf, {
    currentPassword: OLD_PASSWORD,
    newPassword: 'short',
  });

  assert.equal(res.status, 400);

  const stored = await User.findOne({ email }).select('+password tokenVersion');
  assert.equal(await bcrypt.compare(OLD_PASSWORD, stored.password), true);
  assert.equal(stored.tokenVersion, 0);
});

test('V2-6: mat khau moi trung mat khau hien tai tra 400', async (t) => {
  if (skipIfUnavailable(t)) return;

  const email = await seedUser('same-new');
  const agent = request.agent(app);
  await login(agent, email).expect(200);
  const csrf = await csrfFor(agent);

  const res = await changePassword(agent, csrf, {
    currentPassword: OLD_PASSWORD,
    newPassword: OLD_PASSWORD,
  });

  assert.equal(res.status, 400);
});

// --- 7..9: đổi thành công + dữ liệu lưu trong MongoDB ---

test('V2-7: doi mat khau thanh cong tra 200 va xoa auth cookies', async (t) => {
  if (skipIfUnavailable(t)) return;

  const email = await seedUser('success');
  const agent = request.agent(app);
  await login(agent, email).expect(200);
  const csrf = await csrfFor(agent);

  const res = await changePassword(agent, csrf, {
    currentPassword: OLD_PASSWORD,
    newPassword: NEW_PASSWORD,
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);

  const cleared = (res.headers['set-cookie'] || []).join(';');
  assert.match(cleared, /accessToken=;/);
  assert.match(cleared, /refreshToken=;/);
});

test('V2-8: mat khau moi duoc hash bcrypt va tokenVersion tang 1', async (t) => {
  if (skipIfUnavailable(t)) return;

  const email = await seedUser('hash-stored');
  const agent = request.agent(app);
  await login(agent, email).expect(200);
  const csrf = await csrfFor(agent);

  await changePassword(agent, csrf, {
    currentPassword: OLD_PASSWORD,
    newPassword: NEW_PASSWORD,
  }).expect(200);

  const stored = await User.findOne({ email }).select('+password tokenVersion');
  assert.match(stored.password, /^\$2[aby]\$/);
  assert.notEqual(stored.password, NEW_PASSWORD);
  assert.equal(stored.password.includes(NEW_PASSWORD), false);
  assert.equal(await bcrypt.compare(NEW_PASSWORD, stored.password), true);
  assert.equal(await bcrypt.compare(OLD_PASSWORD, stored.password), false);
  assert.equal(stored.tokenVersion, 1);
});

test('V2-9: dang nhap bang mat khau cu that bai, mat khau moi thanh cong', async (t) => {
  if (skipIfUnavailable(t)) return;

  const email = await seedUser('relogin');
  const agent = request.agent(app);
  await login(agent, email).expect(200);
  const csrf = await csrfFor(agent);

  await changePassword(agent, csrf, {
    currentPassword: OLD_PASSWORD,
    newPassword: NEW_PASSWORD,
  }).expect(200);

  const oldLogin = await login(request.agent(app), email, OLD_PASSWORD);
  assert.equal(oldLogin.status, 401);

  const newLogin = await login(request.agent(app), email, NEW_PASSWORD);
  assert.equal(newLogin.status, 200);
  assert.equal(newLogin.body.data.user.email, email);
});

// --- 10..12: token cũ bị vô hiệu, user khác không bị ảnh hưởng ---

test('V2-10: access token cu bi tu choi sau khi doi mat khau', async (t) => {
  if (skipIfUnavailable(t)) return;

  const email = await seedUser('old-access');
  const agent = request.agent(app);
  const loginRes = await login(agent, email).expect(200);
  const oldAccess = cookieValue(loginRes, 'accessToken');
  assert.ok(oldAccess);

  const csrf = await csrfFor(agent);
  await changePassword(agent, csrf, {
    currentPassword: OLD_PASSWORD,
    newPassword: NEW_PASSWORD,
  }).expect(200);

  const replay = await request(app)
    .get('/api/auth/me')
    .set('Cookie', `accessToken=${oldAccess}`);

  assert.equal(replay.status, 401);
});

test('V2-11: refresh token cu bi tu choi sau khi doi mat khau', async (t) => {
  if (skipIfUnavailable(t)) return;

  const email = await seedUser('old-refresh');
  const agent = request.agent(app);
  const loginRes = await login(agent, email).expect(200);
  const oldRefresh = cookieValue(loginRes, 'refreshToken');
  assert.ok(oldRefresh);

  const csrf = await csrfFor(agent);
  await changePassword(agent, csrf, {
    currentPassword: OLD_PASSWORD,
    newPassword: NEW_PASSWORD,
  }).expect(200);

  const replay = await request(app)
    .post('/api/auth/refresh')
    .set('Cookie', `refreshToken=${oldRefresh}; csrfToken=${csrf}`)
    .set('X-CSRF-Token', csrf);

  assert.equal(replay.status, 401);
});

test('V2-12: doi mat khau cua user nay khong anh huong user khac', async (t) => {
  if (skipIfUnavailable(t)) return;

  const email = await seedUser('target');
  const otherEmail = await seedUser('bystander');

  const agent = request.agent(app);
  await login(agent, email).expect(200);
  const csrf = await csrfFor(agent);
  await changePassword(agent, csrf, {
    currentPassword: OLD_PASSWORD,
    newPassword: NEW_PASSWORD,
  }).expect(200);

  const otherLogin = await login(request.agent(app), otherEmail, OLD_PASSWORD);
  assert.equal(otherLogin.status, 200);

  const otherStored = await User.findOne({ email: otherEmail }).select(
    '+password tokenVersion',
  );
  assert.equal(otherStored.tokenVersion, 0);
  assert.equal(await bcrypt.compare(OLD_PASSWORD, otherStored.password), true);
});
