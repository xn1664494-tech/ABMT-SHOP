const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.NODE_ENV = 'test';

const { createFakeUserModel, installFakeUserModel } = require('./support/fakeUserModel');

const fakeUserModel = createFakeUserModel();
installFakeUserModel(fakeUserModel);

const request = require('supertest');
const app = require('../src/app');
const tokenService = require('../src/services/tokenService');

const PASSWORD = 'Secret123';

const seedUser = async (overrides = {}) => {
  const password = await bcrypt.hash(PASSWORD, 10);
  return fakeUserModel.create({
    name: 'Nguyen Van A',
    email: 'customer@example.com',
    password,
    role: 'customer',
    status: 'active',
    ...overrides,
  });
};

const cookiesOf = (res) => res.headers['set-cookie'] || [];

test.beforeEach(() => {
  fakeUserModel.users.length = 0;
});

test('T3-1-2: login thanh cong tra 200, dat cookie HttpOnly va khong lo token trong body', async () => {
  const user = await seedUser();

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'customer@example.com', password: PASSWORD });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.user.email, 'customer@example.com');
  assert.equal(res.body.data.user.password, undefined);
  assert.equal(JSON.stringify(res.body).includes(PASSWORD), false);
  assert.doesNotMatch(JSON.stringify(res.body), /\$2[aby]\$\d{2}\$/);

  // Khong duoc tra token trong body: chi co cookie HttpOnly.
  const bodyText = JSON.stringify(res.body);
  assert.doesNotMatch(
    bodyText,
    /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
    'body khong duoc chua JWT',
  );
  assert.equal(res.body.accessToken, undefined);
  assert.equal(res.body.refreshToken, undefined);
  assert.equal(res.body.token, undefined);
  assert.equal(res.body.data.accessToken, undefined);
  assert.equal(res.body.data.refreshToken, undefined);
  assert.equal(res.body.data.user.token, undefined);

  const cookies = cookiesOf(res);
  const accessCookie = cookies.find((item) => item.startsWith('accessToken='));
  const refreshCookie = cookies.find((item) => item.startsWith('refreshToken='));

  assert.ok(accessCookie, 'thieu accessToken cookie');
  assert.ok(refreshCookie, 'thieu refreshToken cookie');
  assert.match(accessCookie, /HttpOnly/i);
  assert.match(accessCookie, /SameSite=Strict/i);
  assert.match(accessCookie, /Path=\//i);
  assert.match(refreshCookie, /HttpOnly/i);
  assert.match(refreshCookie, /Path=\/api\/auth/i);

  const accessToken = accessCookie.split(';')[0].split('=')[1];
  const payload = jwt.verify(accessToken, process.env.JWT_SECRET);
  assert.equal(payload.sub, String(user._id));
  assert.equal(payload.role, 'customer');
  assert.ok(payload.exp > payload.iat, 'token phai co thoi han');
  assert.equal(payload.exp - payload.iat, 15 * 60);
});

test('T3-1-2: cookie co Secure=true o production', async () => {
  await seedUser();
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  try {
    // Production bat CSRF: lay token tu body va gui lai bang cookie + header.
    const csrfRes = await request(app).get('/api/auth/csrf');
    const csrfToken = csrfRes.body.data.csrfToken;
    assert.ok(csrfToken);

    const res = await request(app)
      .post('/api/auth/login')
      .set('Cookie', `csrfToken=${csrfToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({ email: 'customer@example.com', password: PASSWORD });

    assert.equal(res.status, 200);
    const cookies = cookiesOf(res);
    const accessCookie = cookies.find((item) => item.startsWith('accessToken='));
    assert.ok(accessCookie, 'phai co accessToken cookie');
    assert.match(accessCookie, /Secure/i);
    assert.match(accessCookie, /HttpOnly/i);
    assert.match(accessCookie, /SameSite=Strict/i);
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});

test('T3-1-2: response body khong chua bat ky token bao mat nao', async () => {
  await seedUser();

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'customer@example.com', password: PASSWORD });

  assert.equal(res.status, 200);
  const serialized = JSON.stringify(res.body);
  assert.doesNotMatch(serialized, /accessToken|refreshToken|resetToken|"token"/i);
  assert.equal(res.body.data.accessToken, undefined);
  assert.equal(res.body.data.refreshToken, undefined);
});

test('T3-1-2: sai email tra 401 voi thong bao chung', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'unknown@example.com', password: PASSWORD });

  assert.equal(res.status, 401);
  assert.equal(res.body.error, 'Email hoac mat khau khong chinh xac');
  assert.equal(cookiesOf(res).length, 0);
});

test('T3-1-2: sai password tra 401 voi cung thong bao', async () => {
  await seedUser();

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'customer@example.com', password: 'WrongPass123' });

  assert.equal(res.status, 401);
  assert.equal(res.body.error, 'Email hoac mat khau khong chinh xac');
  assert.equal(cookiesOf(res).length, 0);
});

test('T3-1-2: thieu du lieu tra 400', async () => {
  const res = await request(app).post('/api/auth/login').send({});

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.ok(res.body.details.length > 0);
});

test('T3-1-2: tai khoan bi khoa tra 403', async () => {
  await seedUser({ status: 'blocked' });

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'customer@example.com', password: PASSWORD });

  assert.equal(res.status, 403);
  assert.equal(cookiesOf(res).length, 0);
});

test('T3-1-2: token het han bi tu choi', () => {
  const expired = jwt.sign(
    { sub: '1', role: 'customer' },
    process.env.JWT_SECRET,
    { expiresIn: -1, issuer: 'abmt-shop', audience: 'abmt-shop-client' },
  );

  assert.throws(() => tokenService.verifyToken(expired), /expired/i);
});

test('T3-1-2: token bi chinh sua bi tu choi', () => {
  const token = jwt.sign({ sub: '1', role: 'customer' }, 'wrong-secret', {
    expiresIn: '15m',
    issuer: 'abmt-shop',
    audience: 'abmt-shop-client',
  });

  assert.throws(() => tokenService.verifyToken(token), /invalid/i);
});

test('T3-1-2: khong the dang nhap khi thieu JWT_SECRET', async () => {
  await seedUser();
  const originalSecret = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;

  try {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'customer@example.com', password: PASSWORD });

    assert.equal(res.status, 500);
  } finally {
    process.env.JWT_SECRET = originalSecret;
  }
});
