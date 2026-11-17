const test = require('node:test');
const assert = require('node:assert/strict');
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

const PASSWORD_HASH = '$2a$10$abcdefghijklmnopqrstuv';

const signToken = (payload, options = {}) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '15m',
    issuer: 'abmt-shop',
    audience: 'abmt-shop-client',
    ...options,
  });

const seedUser = (overrides = {}) =>
  fakeUserModel.create({
    name: 'Nguoi Dung',
    email: `user-${Math.random().toString(36).slice(2, 10)}@example.com`,
    password: PASSWORD_HASH,
    role: 'customer',
    status: 'active',
    isDeleted: false,
    ...overrides,
  });

const accessTokenFor = (user, overrides = {}) =>
  signToken({
    sub: String(user._id),
    role: user.role,
    ver: user.tokenVersion || 0,
    ...overrides,
  });

const asCookie = (token) => `accessToken=${token}`;

test.beforeEach(() => {
  fakeUserModel.users.length = 0;
});

// ---------------------------------------------------------------------------
// Route Admin thật của ứng dụng: GET /api/admin/access-check
// ---------------------------------------------------------------------------

test('T4-1-1 (route thật): chua dang nhap tra 401', async () => {
  const res = await request(app).get('/api/admin/access-check');

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test('T4-1-1 (route thật): customer bi chan 403', async () => {
  const customer = await seedUser({ role: 'customer' });

  const res = await request(app)
    .get('/api/admin/access-check')
    .set('Cookie', asCookie(accessTokenFor(customer)));

  assert.equal(res.status, 403);
  assert.equal(res.body.success, false);
});

test('T4-1-1 (route thật): admin duoc phep 200', async () => {
  const admin = await seedUser({ role: 'admin' });

  const res = await request(app)
    .get('/api/admin/access-check')
    .set('Cookie', asCookie(accessTokenFor(admin)));

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.authorized, true);
  assert.equal(res.body.data.role, 'admin');
  assert.equal(res.body.data.user.id, String(admin._id));
});

test('T4-1-1 (route thật): token tu khai role admin khong vuot quyen (DB quyet dinh)', async () => {
  const customer = await seedUser({ role: 'customer' });

  const forged = signToken({ sub: String(customer._id), role: 'admin', ver: 0 });

  const res = await request(app)
    .get('/api/admin/access-check')
    .set('Cookie', asCookie(forged));

  assert.equal(res.status, 403);
});

test('T4-1-1 (route thật): token khai role customer nhung DB la admin van duoc phep', async () => {
  const admin = await seedUser({ role: 'admin' });

  const staleRoleToken = signToken({ sub: String(admin._id), role: 'customer', ver: 0 });

  const res = await request(app)
    .get('/api/admin/access-check')
    .set('Cookie', asCookie(staleRoleToken));

  assert.equal(res.status, 200);
  assert.equal(res.body.data.role, 'admin');
});

test('T4-1-1 (route thật): token khong hop le tra 401', async () => {
  const res = await request(app)
    .get('/api/admin/access-check')
    .set('Cookie', 'accessToken=not-a-jwt');

  assert.equal(res.status, 401);
});

test('T4-1-1 (route thật): refresh token khong dung duoc nhu access token', async () => {
  const admin = await seedUser({ role: 'admin' });

  const refreshToken = signToken(
    { sub: String(admin._id), ver: 0, type: 'refresh' },
    { expiresIn: '7d' },
  );

  const res = await request(app)
    .get('/api/admin/access-check')
    .set('Cookie', asCookie(refreshToken));

  assert.equal(res.status, 401);
});

test('T4-1-1 (route thật): tokenVersion lech bi thu hoi 401', async () => {
  const admin = await seedUser({ role: 'admin', tokenVersion: 3 });

  const revoked = signToken({ sub: String(admin._id), role: 'admin', ver: 2 });

  const res = await request(app)
    .get('/api/admin/access-check')
    .set('Cookie', asCookie(revoked));

  assert.equal(res.status, 401);
  assert.match(res.body.error, /thu hoi/i);
});

test('T4-1-1 (route thật): tai khoan bi khoa khong truy cap duoc 401', async () => {
  const admin = await seedUser({ role: 'admin', status: 'blocked' });

  const res = await request(app)
    .get('/api/admin/access-check')
    .set('Cookie', asCookie(accessTokenFor(admin)));

  assert.equal(res.status, 401);
});

test('T4-1-1 (route thật): tai khoan xoa mem khong truy cap duoc 401', async () => {
  const admin = await seedUser({ role: 'admin', isDeleted: true });

  const res = await request(app)
    .get('/api/admin/access-check')
    .set('Cookie', asCookie(accessTokenFor(admin)));

  assert.equal(res.status, 401);
});

// ---------------------------------------------------------------------------
// IDOR trên route tài nguyên riêng tư hiện có: GET /api/profile/:userId
// ---------------------------------------------------------------------------

test('T4-1-1 (IDOR): customer xem profile nguoi khac tra 403', async () => {
  const userA = await seedUser({ role: 'customer' });
  const userB = await seedUser({ role: 'customer' });

  const res = await request(app)
    .get(`/api/profile/${userB._id}`)
    .set('Cookie', asCookie(accessTokenFor(userA)));

  assert.equal(res.status, 403);
});

test('T4-1-1 (IDOR): customer xem profile cua chinh minh tra 200', async () => {
  const userA = await seedUser({ role: 'customer' });

  const res = await request(app)
    .get(`/api/profile/${userA._id}`)
    .set('Cookie', asCookie(accessTokenFor(userA)));

  assert.equal(res.status, 200);
  assert.equal(res.body.data.user.id, String(userA._id));
});

test('T4-1-1 (IDOR): admin xem profile nguoi khac tra 200', async () => {
  const admin = await seedUser({ role: 'admin' });
  const userB = await seedUser({ role: 'customer' });

  const res = await request(app)
    .get(`/api/profile/${userB._id}`)
    .set('Cookie', asCookie(accessTokenFor(admin)));

  assert.equal(res.status, 200);
  assert.equal(res.body.data.user.id, String(userB._id));
});

test('T4-1-1 (IDOR): user da dang xuat (token bi thu hoi) khong xem duoc profile', async () => {
  const userA = await seedUser({ role: 'customer' });
  const staleToken = accessTokenFor(userA);

  userA.tokenVersion += 1;

  const res = await request(app)
    .get(`/api/profile/${userA._id}`)
    .set('Cookie', asCookie(staleToken));

  assert.equal(res.status, 401);
});
