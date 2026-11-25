const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

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

const login = (agent, email = 'customer@example.com') =>
  agent.post('/api/auth/login').send({ email, password: PASSWORD });

const csrfFor = async (agent) => {
  const res = await agent.get('/api/auth/csrf');
  return res.body.data.csrfToken;
};

test.beforeEach(() => {
  fakeUserModel.users.length = 0;
});

test('T4-1-3: lay profile cua chinh minh thanh cong', async () => {
  await seedUser();
  const agent = request.agent(app);
  await login(agent);

  const res = await agent.get('/api/profile/me');

  assert.equal(res.status, 200);
  assert.equal(res.body.data.user.email, 'customer@example.com');
  assert.equal(res.body.data.user.password, undefined);
});

test('T4-1-3: cap nhat profile hop le', async () => {
  const user = await seedUser();
  const agent = request.agent(app);
  await login(agent);
  const csrf = await csrfFor(agent);

  const res = await agent
    .patch('/api/profile/me')
    .set('X-CSRF-Token', csrf)
    .send({ name: 'Tran Thi B' });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.user.name, 'Tran Thi B');
  assert.equal(fakeUserModel.users[0].name, 'Tran Thi B');
  assert.equal(fakeUserModel.users[0].email, user.email);
});

test('T4-1-3: cap nhat email hop le', async () => {
  await seedUser();
  const agent = request.agent(app);
  await login(agent);
  const csrf = await csrfFor(agent);

  const res = await agent
    .patch('/api/profile/me')
    .set('X-CSRF-Token', csrf)
    .send({ email: 'new-email@example.com' });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.user.email, 'new-email@example.com');
});

test('T4-1-3: du lieu cap nhat khong hop le tra 400', async () => {
  await seedUser();
  const agent = request.agent(app);
  await login(agent);
  const csrf = await csrfFor(agent);

  const res = await agent
    .patch('/api/profile/me')
    .set('X-CSRF-Token', csrf)
    .send({ email: 'bad-email' });

  assert.equal(res.status, 400);
});

test('T4-1-3: body rong tra 400', async () => {
  await seedUser();
  const agent = request.agent(app);
  await login(agent);
  const csrf = await csrfFor(agent);

  const res = await agent
    .patch('/api/profile/me')
    .set('X-CSRF-Token', csrf)
    .send({});

  assert.equal(res.status, 400);
  assert.ok(
    res.body.details.some((item) => /it nhat mot truong/i.test(item.message)),
  );
});

test('T4-1-3: khong the tu thay doi role', async () => {
  await seedUser();
  const agent = request.agent(app);
  await login(agent);
  const csrf = await csrfFor(agent);

  const res = await agent
    .patch('/api/profile/me')
    .set('X-CSRF-Token', csrf)
    .send({ role: 'admin' });

  assert.equal(res.status, 400);
  assert.equal(fakeUserModel.users[0].role, 'customer');
});

test('T4-1-3: khong the cap nhat status hoac passwordHash', async () => {
  await seedUser();
  const agent = request.agent(app);
  await login(agent);
  const csrf = await csrfFor(agent);

  await agent
    .patch('/api/profile/me')
    .set('X-CSRF-Token', csrf)
    .send({ status: 'blocked' })
    .expect(400);

  await agent
    .patch('/api/profile/me')
    .set('X-CSRF-Token', csrf)
    .send({ passwordHash: 'hacked' })
    .expect(400);

  assert.equal(fakeUserModel.users[0].status, 'active');
  assert.notEqual(fakeUserModel.users[0].password, 'hacked');
});

test('T4-1-3: cap nhat email trung voi nguoi khac tra 409', async () => {
  await seedUser();
  const password = await bcrypt.hash(PASSWORD, 10);
  await fakeUserModel.create({
    name: 'Other',
    email: 'other@example.com',
    password,
    role: 'customer',
    status: 'active',
  });

  const agent = request.agent(app);
  await login(agent);
  const csrf = await csrfFor(agent);

  const res = await agent
    .patch('/api/profile/me')
    .set('X-CSRF-Token', csrf)
    .send({ email: 'other@example.com' });

  assert.equal(res.status, 409);
});

test('T4-1-3: khong co token tra 401', async () => {
  const res = await request(app).get('/api/profile/me');
  assert.equal(res.status, 401);
});

test('T4-1-3: token khong hop le tra 401', async () => {
  const res = await request(app)
    .get('/api/profile/me')
    .set('Cookie', 'accessToken=not-a-jwt');

  assert.equal(res.status, 401);
});

test.skip('T4-1-3: cap nhat profile thieu CSRF token tra 403', async () => {
  await seedUser();
  const agent = request.agent(app);
  await login(agent);

  const res = await agent.patch('/api/profile/me').send({ name: 'Tran Thi B' });

  assert.equal(res.status, 403);
});

test('T4-1-3: khong the cap nhat profile cua nguoi khac qua URL', async () => {
  await seedUser();
  const password = await bcrypt.hash(PASSWORD, 10);
  await fakeUserModel.create({
    name: 'Other',
    email: 'other@example.com',
    password,
    role: 'customer',
    status: 'active',
  });

  const agent = request.agent(app);
  await login(agent);
  const csrf = await csrfFor(agent);

  const res = await agent
    .patch('/api/profile/2')
    .set('X-CSRF-Token', csrf)
    .send({ name: 'Hacked' });

  assert.equal(res.status, 404);
  assert.equal(fakeUserModel.users[1].name, 'Other');
});
