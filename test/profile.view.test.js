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

test.beforeEach(() => {
  fakeUserModel.users.length = 0;
});

test('T4-4-2: khach truy cap /profile bi chuyen ve login voi next', async () => {
  const res = await request(app).get('/profile');

  assert.equal(res.status, 302);
  assert.equal(res.headers.location, '/login?next=/profile');
});

test('T4-4-2: user dang nhap xem duoc view profile va khong lo thong tin nhay cam', async () => {
  const unsafeName = '<img src=x onerror=alert(1)>';
  await seedUser({ name: unsafeName });

  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email: 'customer@example.com', password: PASSWORD });

  const res = await agent.get('/profile');

  assert.equal(res.status, 200);
  assert.match(res.text, /id="profileForm"/);
  assert.match(res.text, /id="passwordForm"/);
  assert.match(res.text, /data-profile="name"/);
  assert.match(res.text, /&lt;img/);
  assert.equal(res.text.includes(unsafeName), false);
  assert.equal(res.text.includes('passwordHash'), false);
  assert.equal(res.text.includes(PASSWORD), false);
  assert.equal(res.headers['cache-control'], 'no-store');
});
