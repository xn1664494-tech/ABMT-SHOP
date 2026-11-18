const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.NODE_ENV = 'test';
process.env.APP_ORIGIN = 'http://localhost:3000';

const { createFakeUserModel, installFakeUserModel } = require('./support/fakeUserModel');

const fakeUserModel = createFakeUserModel();
installFakeUserModel(fakeUserModel);

const request = require('supertest');
const app = require('../src/app');

const OLD_PASSWORD = 'Secret123';
const NEW_PASSWORD = 'NewSecret123';
const EMAIL = 'changepw@example.com';

const seedUser = async (overrides = {}) => {
  const password = await bcrypt.hash(OLD_PASSWORD, 10);
  return fakeUserModel.create({
    name: 'Nguoi Doi Mat Khau',
    email: EMAIL,
    password,
    role: 'customer',
    status: 'active',
    isDeleted: false,
    tokenVersion: 0,
    ...overrides,
  });
};

const login = (agent, email = EMAIL, password = OLD_PASSWORD) =>
  agent.post('/api/auth/login').send({ email, password });

const csrfFor = async (agent) => {
  const res = await agent.get('/api/auth/csrf');
  return res.body.data.csrfToken;
};

test.beforeEach(() => {
  fakeUserModel.users.length = 0;
});

// --- Auth / CSRF ---

test('T4-1-3: doi mat khau khong dang nhap tra 401', async () => {
  const res = await request(app)
    .patch('/api/profile/me/password')
    .send({ currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD });

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test('T4-1-3: doi mat khau thieu CSRF token tra 403', async () => {
  await seedUser();
  const agent = request.agent(app);
  await login(agent);

  const res = await agent
    .patch('/api/profile/me/password')
    .send({ currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD });

  assert.equal(res.status, 403);
});

test('T4-1-3: doi mat khau CSRF token khong hop le tra 403', async () => {
  await seedUser();
  const agent = request.agent(app);
  await login(agent);
  await csrfFor(agent);

  const res = await agent
    .patch('/api/profile/me/password')
    .set('X-CSRF-Token', 'wrong-token')
    .send({ currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD });

  assert.equal(res.status, 403);
});

// --- Validation / sai mat khau ---

test('T4-1-3: mat khau hien tai sai tra 401', async () => {
  const user = await seedUser();
  const agent = request.agent(app);
  await login(agent);
  const csrf = await csrfFor(agent);

  const res = await agent
    .patch('/api/profile/me/password')
    .set('X-CSRF-Token', csrf)
    .send({ currentPassword: 'WrongPass123', newPassword: NEW_PASSWORD });

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
  // khong duoc doi mat khau hay tokenVersion khi sai mat khau hien tai
  assert.equal(await bcrypt.compare(OLD_PASSWORD, user.password), true);
  assert.equal(user.tokenVersion, 0);
});

test('T4-1-3: mat khau moi khong hop le tra 400', async () => {
  await seedUser();
  const agent = request.agent(app);
  await login(agent);
  const csrf = await csrfFor(agent);

  const res = await agent
    .patch('/api/profile/me/password')
    .set('X-CSRF-Token', csrf)
    .send({ currentPassword: OLD_PASSWORD, newPassword: 'short' });

  assert.equal(res.status, 400);
});

test('T4-1-3: mat khau moi trung mat khau hien tai tra 400', async () => {
  await seedUser();
  const agent = request.agent(app);
  await login(agent);
  const csrf = await csrfFor(agent);

  const res = await agent
    .patch('/api/profile/me/password')
    .set('X-CSRF-Token', csrf)
    .send({ currentPassword: OLD_PASSWORD, newPassword: OLD_PASSWORD });

  assert.equal(res.status, 400);
  assert.ok(
    (res.body.details || []).some((item) => /khac/i.test(item.message || '')),
  );
});

test('T4-1-3: khong cho gui truong ngoai scope tra 400', async () => {
  await seedUser();
  const agent = request.agent(app);
  await login(agent);
  const csrf = await csrfFor(agent);

  const res = await agent
    .patch('/api/profile/me/password')
    .set('X-CSRF-Token', csrf)
    .send({
      currentPassword: OLD_PASSWORD,
      newPassword: NEW_PASSWORD,
      role: 'admin',
    });

  assert.equal(res.status, 400);
});

// --- Thanh cong ---

test('T4-1-3: doi mat khau thanh cong (200), hash bcrypt, tokenVersion tang, cookie bi xoa', async () => {
  const user = await seedUser();
  const agent = request.agent(app);
  await login(agent);
  const csrf = await csrfFor(agent);
  const hashBefore = user.password;
  const versionBefore = user.tokenVersion;

  const res = await agent
    .patch('/api/profile/me/password')
    .set('X-CSRF-Token', csrf)
    .send({ currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.match(res.body.message, /dang nhap lai/i);
  // khong tra password/hash/token ve client
  const bodyString = JSON.stringify(res.body);
  assert.doesNotMatch(bodyString, /password/i);
  assert.doesNotMatch(bodyString, /\$2[aby]\$/);

  // DB: hash moi, khac plaintext va khac hash cu, verify duoc mat khau moi
  assert.notEqual(user.password, NEW_PASSWORD);
  assert.notEqual(user.password, hashBefore);
  assert.match(user.password, /^\$2[aby]\$/);
  assert.equal(await bcrypt.compare(NEW_PASSWORD, user.password), true);
  assert.equal(await bcrypt.compare(OLD_PASSWORD, user.password), false);

  // tokenVersion tang -> revoke phien/token cu
  assert.equal(user.tokenVersion, versionBefore + 1);

  // auth cookies bi clear
  const setCookies = (res.headers['set-cookie'] || []).join(';');
  assert.match(setCookies, /accessToken=;/);
  assert.match(setCookies, /refreshToken=;/);
});

test('T4-1-3: token cu bi thu hoi sau khi doi mat khau (401)', async () => {
  await seedUser();
  const agent = request.agent(app);
  await login(agent);
  const csrf = await csrfFor(agent);

  await agent
    .patch('/api/profile/me/password')
    .set('X-CSRF-Token', csrf)
    .send({ currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD })
    .expect(200);

  // agent van giu accessToken cu trong cookie jar nhung tokenVersion da tang
  // can set lai csrf cho request tiep theo? endpoint /me chi can authenticate
  const meRes = await agent.get('/api/profile/me');
  assert.equal(meRes.status, 401);
});

test('T4-1-3: dang nhap bang mat khau moi thanh cong, mat khau cu that bai', async () => {
  await seedUser();
  const agent = request.agent(app);
  await login(agent);
  const csrf = await csrfFor(agent);

  await agent
    .patch('/api/profile/me/password')
    .set('X-CSRF-Token', csrf)
    .send({ currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD })
    .expect(200);

  const oldLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: EMAIL, password: OLD_PASSWORD });
  assert.equal(oldLogin.status, 401);

  const newLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: EMAIL, password: NEW_PASSWORD });
  assert.equal(newLogin.status, 200);
  assert.equal(newLogin.body.success, true);
});