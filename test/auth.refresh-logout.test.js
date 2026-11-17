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

const PASSWORD = 'Secret123';
const EMAIL = 'customer@example.com';

const seedUser = async (overrides = {}) => {
  const password = await bcrypt.hash(PASSWORD, 10);
  return fakeUserModel.create({
    name: 'Nguyen Van A',
    email: EMAIL,
    password,
    role: 'customer',
    status: 'active',
    ...overrides,
  });
};

const cookieOf = (res, name) => {
  const cookie = (res.headers['set-cookie'] || []).find((item) =>
    item.startsWith(`${name}=`),
  );
  return cookie ? cookie.split(';')[0] : null;
};

const csrfPair = async (client) => {
  const res = await client.get('/api/auth/csrf');
  return {
    token: res.body.data.csrfToken,
    cookie: cookieOf(res, 'csrfToken'),
  };
};

const login = (agent) =>
  agent.post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });

test.beforeEach(() => {
  fakeUserModel.users.length = 0;
});

test('T3-1-3: refresh token hop le cap cap token moi va xoay vong token', async () => {
  await seedUser();
  const agent = request.agent(app);
  const loginRes = await login(agent);
  const oldRefresh = cookieOf(loginRes, 'refreshToken');
  const csrf = await csrfPair(agent);

  const res = await agent.post('/api/auth/refresh').set('X-CSRF-Token', csrf.token);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.user.email, EMAIL);
  assert.equal(res.body.data.user.password, undefined);

  const newRefresh = cookieOf(res, 'refreshToken');
  assert.ok(newRefresh);
  assert.notEqual(newRefresh, oldRefresh);

  // Token cũ đã bị thu hồi, không thể dùng lại (replay).
  const replay = await request(app)
    .post('/api/auth/refresh')
    .set('Cookie', `${oldRefresh}; ${csrf.cookie}`)
    .set('X-CSRF-Token', csrf.token);

  assert.equal(replay.status, 401);
});

test('T3-1-3: refresh khong co cookie tra 401', async () => {
  const csrf = await csrfPair(request(app));
  const res = await request(app)
    .post('/api/auth/refresh')
    .set('Cookie', csrf.cookie)
    .set('X-CSRF-Token', csrf.token);

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test('T3-1-3: refresh token khong hop le tra 401', async () => {
  const csrf = await csrfPair(request(app));
  const res = await request(app)
    .post('/api/auth/refresh')
    .set('Cookie', `refreshToken=not-a-jwt; ${csrf.cookie}`)
    .set('X-CSRF-Token', csrf.token);

  assert.equal(res.status, 401);
});

test('T3-1-3: refresh token het han tra 401', async () => {
  await seedUser();
  const csrf = await csrfPair(request(app));
  const expired = jwt.sign(
    { sub: '1', ver: 0, type: 'refresh' },
    process.env.JWT_SECRET,
    { expiresIn: -1, issuer: 'abmt-shop', audience: 'abmt-shop-client' },
  );

  const res = await request(app)
    .post('/api/auth/refresh')
    .set('Cookie', `refreshToken=${expired}; ${csrf.cookie}`)
    .set('X-CSRF-Token', csrf.token);

  assert.equal(res.status, 401);
});

test('T3-1-3: access token khong duoc dung lam refresh token', async () => {
  await seedUser();
  const agent = request.agent(app);
  const loginRes = await login(agent);
  const accessToken = cookieOf(loginRes, 'accessToken').split('=')[1];
  const csrf = await csrfPair(request(app));

  const res = await request(app)
    .post('/api/auth/refresh')
    .set('Cookie', `refreshToken=${accessToken}; ${csrf.cookie}`)
    .set('X-CSRF-Token', csrf.token);

  assert.equal(res.status, 401);
});

test('T3-1-3: tai khoan bi khoa khong the refresh', async () => {
  await seedUser();
  const agent = request.agent(app);
  await login(agent);
  const csrf = await csrfPair(agent);

  fakeUserModel.users[0].status = 'blocked';

  const res = await agent.post('/api/auth/refresh').set('X-CSRF-Token', csrf.token);
  assert.equal(res.status, 401);
});

test('T3-1-3: logout xoa cookie va thu hoi refresh token', async () => {
  await seedUser();
  const agent = request.agent(app);
  const loginRes = await login(agent);
  const oldRefresh = cookieOf(loginRes, 'refreshToken');
  const csrf = await csrfPair(agent);

  const res = await agent.post('/api/auth/logout').set('X-CSRF-Token', csrf.token);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);

  const cleared = res.headers['set-cookie'].join(';');
  assert.match(cleared, /accessToken=;/);
  assert.match(cleared, /refreshToken=;/);
  assert.match(cleared, /Expires=Thu, 01 Jan 1970/);

  assert.equal(fakeUserModel.users[0].tokenVersion, 1);

  // Refresh token cũ bị thu hồi ở server, không chỉ xóa cookie phía client.
  const replay = await request(app)
    .post('/api/auth/refresh')
    .set('Cookie', `${oldRefresh}; ${csrf.cookie}`)
    .set('X-CSRF-Token', csrf.token);
  assert.equal(replay.status, 401);

  const afterLogout = await agent
    .post('/api/auth/refresh')
    .set('X-CSRF-Token', csrf.token);
  assert.equal(afterLogout.status, 401);
});

test('T3-1-3: logout khong co cookie van thanh cong (idempotent)', async () => {
  const csrf = await csrfPair(request(app));
  const res = await request(app)
    .post('/api/auth/logout')
    .set('Cookie', csrf.cookie)
    .set('X-CSRF-Token', csrf.token);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
});

test('T3-1-3: khong the refresh sau khi token da bi thu hoi boi logout', async () => {
  const user = await seedUser();
  const initialVersion = user.tokenVersion;
  const agent = request.agent(app);
  const loginRes = await login(agent);
  const refreshCookie = cookieOf(loginRes, 'refreshToken');
  const csrf = await csrfPair(agent);

  await request(app)
    .post('/api/auth/logout')
    .set('Cookie', `${refreshCookie}; ${csrf.cookie}`)
    .set('X-CSRF-Token', csrf.token);

  const res = await request(app)
    .post('/api/auth/refresh')
    .set('Cookie', `${refreshCookie}; ${csrf.cookie}`)
    .set('X-CSRF-Token', csrf.token);

  assert.equal(res.status, 401);
  assert.ok(fakeUserModel.users[0].tokenVersion > initialVersion);
});
