/**
 * Integration test chay tren MongoDB that (local test instance).
 *
 * - Khong bao gio dung MONGODB_URI production tu .env.
 * - URI lay tu MONGODB_URI_TEST (bat buoc, fail-fast neu thieu)
 * - Bat buoc ten database phai chua "test" truoc khi ket noi/xoa du lieu.
 * - Chi xoa cac user do lan chay nay tao ra (tien to email it-<runId>-).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Nạp biến môi trường test từ .env.test (không đọc .env của dev/production).
dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), quiet: true });

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'integration-test-jwt-secret-at-least-32-chars';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.APP_ORIGIN = 'http://localhost:3000';
// Tranh rate limit chan cac test chuc nang; rate limit duoc test rieng.
process.env.AUTH_RATE_LIMIT_MAX = '10000';

const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/model/User');

/**
 * URI test chuẩn: `MONGODB_URI_TEST`.
 * `TEST_MONGODB_URI` là tên cũ, chỉ còn hỗ trợ tạm 1 sprint và sẽ bị bỏ.
 * Không fallback im lặng về localhost nữa: thiếu biến thì dừng ngay để tránh
 * chạy test trên nhầm database.
 */
const LEGACY_TEST_URI = process.env.TEST_MONGODB_URI;
const TEST_URI = process.env.MONGODB_URI_TEST || LEGACY_TEST_URI;

if (!TEST_URI) {
  throw new Error(
    'Thiếu MONGODB_URI_TEST. Tạo file .env.test từ .env.test.example rồi chạy lại.',
  );
}

if (!process.env.MONGODB_URI_TEST && LEGACY_TEST_URI) {
  console.warn(
    '[deprecated] TEST_MONGODB_URI đã được thay bằng MONGODB_URI_TEST; tên cũ sẽ bị bỏ sau 1 sprint.',
  );
}

const PASSWORD = 'Secret123';
const RUN_ID = `it-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

const getCsrf = async (agent) => {
  const res = await agent.get('/api/auth/csrf');
  return { token: res.body.data.csrfToken, cookie: cookieOf(res, 'csrfToken') };
};

const withCsrfEnforcement = async (send) => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'integration';
  try {
    return await send();
  } finally {
    process.env.NODE_ENV = previous;
  }
};

const register = (payload) => request(app).post('/api/auth/register').send(payload);

const login = (agent, email, password = PASSWORD) =>
  agent.post('/api/auth/login').send({ email, password });

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

  // Chi cho phep database testing.
  if (!dbName || !dbName.toLowerCase().includes('test')) {
    skipReason = 'MONGODB_URI_TEST phai tro toi database co ten chua "test"';
    return;
  }

  try {
    await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 3000 });
    await User.init();
    available = true;
  } catch (error) {
    skipReason = `Khong ket noi duoc MongoDB test (${error.name})`;
  }
});

test.after(async () => {
  if (available) {
    // Chi xoa du lieu do lan chay nay tao ra.
    await User.deleteMany({ email: { $regex: `^${EMAIL_PREFIX}` } });
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

test('IT-REGISTER: tao user that trong MongoDB va hash password', async (t) => {
  if (skipIfUnavailable(t)) return;

  const res = await register({
    name: 'Integration User',
    email: emailFor('register'),
    password: PASSWORD,
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.user.email, emailFor('register'));

  const stored = await User.findOne({ email: emailFor('register') }).select('+password');
  assert.ok(stored, 'user phai duoc ghi vao MongoDB');
  assert.match(stored.password, /^\$2[aby]\$/);
  assert.equal(await bcrypt.compare(PASSWORD, stored.password), true);
  assert.equal(stored.role, 'customer');
});

test('IT-UNIQUE: email trung tra 409 va khong tao them ban ghi', async (t) => {
  if (skipIfUnavailable(t)) return;

  const email = emailFor('unique');
  await register({ name: 'Alpha', email, password: PASSWORD }).expect(201);

  const res = await register({ name: 'Beta', email, password: PASSWORD });
  assert.equal(res.status, 409);

  const count = await User.countDocuments({ email });
  assert.equal(count, 1);
});

test('IT-SCHEMA: phone va addresses duoc luu va doc lai tu MongoDB', async (t) => {
  if (skipIfUnavailable(t)) return;

  const email = emailFor('schema');
  const created = await User.create({
    name: 'Schema User',
    email,
    password: await bcrypt.hash(PASSWORD, 10),
    phone: '0912345678',
    addresses: [
      { label: 'Nha', street: '1 Nguyen Trai', city: 'Ha Noi', isDefault: true },
    ],
  });

  const stored = await User.findById(created._id);
  assert.equal(stored.phone, '0912345678');
  assert.equal(stored.addresses.length, 1);
  assert.equal(stored.addresses[0].city, 'Ha Noi');
  assert.equal(stored.isDeleted, false);
  assert.equal(stored.status, 'active');
});

test('IT-LOGIN: dang nhap that va access token xac thuc /auth/me', async (t) => {
  if (skipIfUnavailable(t)) return;

  const email = emailFor('login');
  await register({ name: 'Login User', email, password: PASSWORD }).expect(201);

  const agent = request.agent(app);
  const loginRes = await login(agent, email);
  assert.equal(loginRes.status, 200);
  assert.equal(loginRes.body.data.user.password, undefined);

  const me = await agent.get('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.data.user.email, email);
});

test('IT-REFRESH: xoay vong refresh token va chan replay', async (t) => {
  if (skipIfUnavailable(t)) return;

  const email = emailFor('refresh');
  await register({ name: 'Refresh User', email, password: PASSWORD }).expect(201);

  const agent = request.agent(app);
  const loginRes = await login(agent, email);
  const oldRefresh = cookieOf(loginRes, 'refreshToken');
  const csrf = await getCsrf(agent);

  const refreshed = await agent
    .post('/api/auth/refresh')
    .set('X-CSRF-Token', csrf.token);
  assert.equal(refreshed.status, 200);
  assert.notEqual(cookieOf(refreshed, 'refreshToken'), oldRefresh);

  const replay = await request(app)
    .post('/api/auth/refresh')
    .set('Cookie', `${oldRefresh}; ${csrf.cookie}`)
    .set('X-CSRF-Token', csrf.token);
  assert.equal(replay.status, 401);
});

test('IT-CSRF: refresh thieu CSRF token tra 403', async (t) => {
  if (skipIfUnavailable(t)) return;

  const email = emailFor('csrf');
  await register({ name: 'Csrf User', email, password: PASSWORD }).expect(201);

  const agent = request.agent(app);
  await login(agent, email);

  const res = await withCsrfEnforcement(() => agent.post('/api/auth/refresh'));
  assert.equal(res.status, 403);
  assert.match(res.body.error, /CSRF/i);
});

test('IT-LOGOUT: logout thu hoi refresh token trong DB', async (t) => {
  if (skipIfUnavailable(t)) return;

  const email = emailFor('logout');
  await register({ name: 'Logout User', email, password: PASSWORD }).expect(201);

  const agent = request.agent(app);
  const loginRes = await login(agent, email);
  const oldRefresh = cookieOf(loginRes, 'refreshToken');
  const csrf = await getCsrf(agent);

  const before = await User.findOne({ email });
  await agent.post('/api/auth/logout').set('X-CSRF-Token', csrf.token).expect(200);
  const after = await User.findOne({ email });
  assert.ok(after.tokenVersion > before.tokenVersion);

  const replay = await request(app)
    .post('/api/auth/refresh')
    .set('Cookie', `${oldRefresh}; ${csrf.cookie}`)
    .set('X-CSRF-Token', csrf.token);
  assert.equal(replay.status, 401);
});

test('IT-RBAC-IDOR: customer khong xem duoc profile admin', async (t) => {
  if (skipIfUnavailable(t)) return;

  const customerEmail = emailFor('rbac-customer');
  const adminEmail = emailFor('rbac-admin');
  await register({ name: 'Customer', email: customerEmail, password: PASSWORD }).expect(201);

  const admin = await User.create({
    name: 'Admin',
    email: adminEmail,
    password: await bcrypt.hash(PASSWORD, 10),
    role: 'admin',
  });

  const agent = request.agent(app);
  await login(agent, customerEmail);

  const own = await agent.get('/api/profile/me');
  assert.equal(own.status, 200);

  const forbidden = await agent.get(`/api/profile/${admin._id}`);
  assert.equal(forbidden.status, 403);
});

test('IT-PROFILE: GET/PATCH profile cap nhat that trong MongoDB', async (t) => {
  if (skipIfUnavailable(t)) return;

  const email = emailFor('profile');
  await register({ name: 'Profile User', email, password: PASSWORD }).expect(201);

  const agent = request.agent(app);
  await login(agent, email);
  const csrf = await getCsrf(agent);

  const updated = await agent
    .patch('/api/profile/me')
    .set('X-CSRF-Token', csrf.token)
    .send({ name: 'Updated Name' });

  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.user.name, 'Updated Name');

  const stored = await User.findOne({ email });
  assert.equal(stored.name, 'Updated Name');
});

test('IT-SOFT-DELETE: user da xoa mem khong the dang nhap', async (t) => {
  if (skipIfUnavailable(t)) return;

  const email = emailFor('deleted');
  await User.create({
    name: 'Deleted User',
    email,
    password: await bcrypt.hash(PASSWORD, 10),
    isDeleted: true,
    deletedAt: new Date(),
  });

  const res = await login(request.agent(app), email);
  assert.equal(res.status, 401);
});

test('IT-COOKIE: refresh token cookie khong lo trong body', async (t) => {
  if (skipIfUnavailable(t)) return;

  const email = emailFor('cookie');
  await register({ name: 'Cookie User', email, password: PASSWORD }).expect(201);

  const agent = request.agent(app);
  const res = await login(agent, email);

  assert.ok(cookieOf(res, 'accessToken'));
  assert.ok(cookieOf(res, 'refreshToken'));
  assert.equal(JSON.stringify(res.body).includes(cookieValue(res, 'accessToken')), false);
});
