const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const express = require('express');

process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.NODE_ENV = 'test';

const { createFakeUserModel, installFakeUserModel } = require('./support/fakeUserModel');

const fakeUserModel = createFakeUserModel();
installFakeUserModel(fakeUserModel);

const request = require('supertest');
const app = require('../src/app');
const { authorize } = require('../src/middleware/authenticate');
const requireAdmin = require('../src/middleware/requireAdmin');

const PASSWORD = 'Secret123';

const seedUsers = async () => {
  const password = await bcrypt.hash(PASSWORD, 10);
  const customer = await fakeUserModel.create({
    name: 'Customer',
    email: 'customer@example.com',
    password,
    role: 'customer',
    status: 'active',
  });
  const admin = await fakeUserModel.create({
    name: 'Admin',
    email: 'admin@example.com',
    password,
    role: 'admin',
    status: 'active',
  });
  return { customer, admin };
};

const loginAs = (agent, email) =>
  agent.post('/api/auth/login').send({ email, password: PASSWORD });

const accessCookieOf = (res) => {
  const cookie = (res.headers['set-cookie'] || []).find((item) =>
    item.startsWith('accessToken='),
  );
  return cookie ? cookie.split(';')[0] : null;
};

const signTestToken = (payload, options = {}) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '15m',
    issuer: 'abmt-shop',
    audience: 'abmt-shop-client',
    ...options,
  });

test.beforeEach(() => {
  fakeUserModel.users.length = 0;
});

test('T4-1-1: /me khong co token tra 401', async () => {
  const res = await request(app).get('/api/auth/me');
  assert.equal(res.status, 401);
});

test('T4-1-1: token khong hop le tra 401', async () => {
  const res = await request(app)
    .get('/api/auth/me')
    .set('Cookie', 'accessToken=not-a-jwt');

  assert.equal(res.status, 401);
});

test('T4-1-1: access token het han tra 401', async () => {
  const { customer } = await seedUsers();
  const expired = signTestToken({ sub: customer._id, role: 'customer', ver: 0 }, { expiresIn: -1 });

  const res = await request(app)
    .get('/api/auth/me')
    .set('Cookie', `accessToken=${expired}`);

  assert.equal(res.status, 401);
});

test('T4-1-1: customer xem duoc profile cua chinh minh', async () => {
  const { customer } = await seedUsers();
  const agent = request.agent(app);
  await loginAs(agent, 'customer@example.com');

  const res = await agent.get(`/api/profile/${customer._id}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.data.user.email, 'customer@example.com');
  assert.equal(res.body.data.user.password, undefined);
});

test('T4-1-1: customer khong xem duoc profile nguoi khac (IDOR)', async () => {
  const { admin } = await seedUsers();
  const agent = request.agent(app);
  await loginAs(agent, 'customer@example.com');

  const res = await agent.get(`/api/profile/${admin._id}`);

  assert.equal(res.status, 403);
  assert.equal(res.body.success, false);
});

test('T4-1-1: thay doi userId tren URL khong vuot quyen', async () => {
  const { customer, admin } = await seedUsers();
  const agent = request.agent(app);
  await loginAs(agent, 'customer@example.com');

  await agent.get(`/api/profile/${customer._id}`).expect(200);
  const res = await agent.get(`/api/profile/${admin._id}`);

  assert.equal(res.status, 403);
});

test('T4-1-1: admin xem duoc profile nguoi khac', async () => {
  const { customer } = await seedUsers();
  const agent = request.agent(app);
  await loginAs(agent, 'admin@example.com');

  const res = await agent.get(`/api/profile/${customer._id}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.data.user.email, 'customer@example.com');
});

test('T4-1-1: role trong token khong duoc tin tuong (DB role quyet dinh)', async () => {
  const { customer, admin } = await seedUsers();

  // Token tự khai role admin nhưng user trong DB vẫn là customer.
  const forgedRoleToken = signTestToken({ sub: customer._id, role: 'admin', ver: 0 });

  const res = await request(app)
    .get(`/api/profile/${admin._id}`)
    .set('Cookie', `accessToken=${forgedRoleToken}`);

  assert.equal(res.status, 403);
});

test('T4-1-1: token bi thu hoi sau logout khong dung duoc', async () => {
  const { customer } = await seedUsers();
  const agent = request.agent(app);
  const loginRes = await loginAs(agent, 'customer@example.com');
  const accessCookie = accessCookieOf(loginRes);

  const csrfRes = await agent.get('/api/auth/csrf');
  await agent
    .post('/api/auth/logout')
    .set('X-CSRF-Token', csrfRes.body.data.csrfToken)
    .expect(200);

  const res = await request(app)
    .get('/api/auth/me')
    .set('Cookie', accessCookie);

  assert.equal(res.status, 401);
  assert.equal(res.body.error, 'Phien dang nhap da bi thu hoi');
});

test('T4-1-1: middleware authorize chan customer va cho phep admin', async () => {
  const miniApp = express();
  miniApp.get('/admin-only', (req, res, next) => {
    req.user = { role: req.headers['x-test-role'] };
    next();
  }, authorize('admin'), (req, res) => res.status(200).json({ success: true }));

  await request(miniApp).get('/admin-only').set('x-test-role', 'customer').expect(403);
  await request(miniApp).get('/admin-only').set('x-test-role', 'admin').expect(200);
});

test('T4-4-3: requireAdmin tra 403 khi chua co req.user', async () => {
  const miniApp = express();
  miniApp.get('/admin-only', requireAdmin, (req, res) =>
    res.status(200).json({ success: true }),
  );

  const res = await request(miniApp).get('/admin-only');

  assert.equal(res.status, 403);
});

test('T4-4-3: requireAdmin chan customer va cho phep admin', async () => {
  const miniApp = express();
  miniApp.get('/admin-only', (req, res, next) => {
    req.user = { role: req.headers['x-test-role'] };
    next();
  }, requireAdmin, (req, res) => res.status(200).json({ success: true }));

  const denied = await request(miniApp)
    .get('/admin-only')
    .set('x-test-role', 'customer');
  assert.equal(denied.status, 403);

  const allowed = await request(miniApp)
    .get('/admin-only')
    .set('x-test-role', 'admin');
  assert.equal(allowed.status, 200);
  assert.equal(allowed.body.success, true);
});

test('T4-1-1: /me tra thong tin user hien tai, khong lo password', async () => {
  await seedUsers();
  const agent = request.agent(app);
  await loginAs(agent, 'customer@example.com');

  const res = await agent.get('/api/auth/me');

  assert.equal(res.status, 200);
  assert.equal(res.body.data.user.email, 'customer@example.com');
  assert.equal(res.body.data.user.password, undefined);
});
