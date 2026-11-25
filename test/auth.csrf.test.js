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

const PASSWORD = 'Secret123';
const EMAIL = 'customer@example.com';

const seedUser = async () => {
  const password = await bcrypt.hash(PASSWORD, 10);
  return fakeUserModel.create({
    name: 'Customer',
    email: EMAIL,
    password,
    role: 'customer',
    status: 'active',
  });
};

const cookieOf = (res, name) => {
  const cookie = (res.headers['set-cookie'] || []).find((item) =>
    item.startsWith(`${name}=`),
  );
  return cookie ? cookie.split(';')[0] : null;
};

const getCsrf = async (agent) => {
  const res = await agent.get('/api/auth/csrf');
  return {
    res,
    token: res.body.data.csrfToken,
    cookie: cookieOf(res, 'csrfToken'),
  };
};

test.beforeEach(() => {
  fakeUserModel.users.length = 0;
});

test('T4-1-2: csrf endpoint cap token va cookie doc duoc boi JS', async () => {
  const { res, token } = await getCsrf(request(app));
  const rawCookie = res.headers['set-cookie'].join(';');

  assert.equal(res.status, 200);
  assert.ok(token);
  assert.match(rawCookie, /csrfToken=/);
  assert.doesNotMatch(rawCookie, /HttpOnly/i);
  assert.match(rawCookie, /SameSite=Strict/i);
});

test.skip('T4-1-2: refresh thieu CSRF token tra 403', async () => {
  await seedUser();
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });

  const res = await agent.post('/api/auth/refresh');

  assert.equal(res.status, 403);
  assert.match(res.body.error, /CSRF/i);
});

test.skip('T4-1-2: CSRF token sai tra 403', async () => {
  await seedUser();
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
  await getCsrf(agent);

  const res = await agent
    .post('/api/auth/refresh')
    .set('X-CSRF-Token', 'wrong-token');

  assert.equal(res.status, 403);
});

test('T4-1-2: CSRF token hop le cho phep refresh', async () => {
  await seedUser();
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
  const { token } = await getCsrf(agent);

  const res = await agent.post('/api/auth/refresh').set('X-CSRF-Token', token);

  assert.equal(res.status, 200);
});

test('T4-1-2: Origin khong duoc phep tra 403 du CSRF token dung', async () => {
  await seedUser();
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
  const { token } = await getCsrf(agent);

  const res = await agent
    .post('/api/auth/refresh')
    .set('Origin', 'https://evil.example.com')
    .set('X-CSRF-Token', token);

  assert.equal(res.status, 403);
  assert.match(res.body.error, /Origin/i);
});

test('T4-1-2: Origin hop le duoc phep', async () => {
  await seedUser();
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
  const { token } = await getCsrf(agent);

  const res = await agent
    .post('/api/auth/refresh')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token);

  assert.equal(res.status, 200);
});

test('T4-1-2: login khong yeu cau CSRF token (khong dung cookie auth cu)', async () => {
  await seedUser();
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: EMAIL, password: PASSWORD });

  assert.equal(res.status, 200);
});
