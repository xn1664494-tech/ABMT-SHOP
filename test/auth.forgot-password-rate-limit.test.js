const test = require('node:test');
const assert = require('node:assert/strict');

// Dat bien truoc khi require app vi authLimiter doc env luc load module.
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
process.env.NODE_ENV = 'test';
process.env.AUTH_RATE_LIMIT_MAX = '2';
process.env.AUTH_RATE_LIMIT_WINDOW_MS = '60000';

const { createFakeUserModel, installFakeUserModel } = require('./support/fakeUserModel');

const fakeUserModel = createFakeUserModel();
installFakeUserModel(fakeUserModel);

const request = require('supertest');
const app = require('../src/app');

const forgot = () =>
  request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });

test.beforeEach(() => {
  fakeUserModel.users.length = 0;
});

test('T4-1-2: forgot-password vuot nguong tra 429', async () => {
  const first = await forgot();
  assert.equal(first.status, 202);
  assert.equal(first.body.success, true);

  const second = await forgot();
  assert.equal(second.status, 202);

  const blocked = await forgot();
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.success, false);
  assert.match(blocked.body.error, /nhieu yeu cau/i);
});

test('T4-1-2: forgotten limiter la mot the thong voi reset-password', async () => {
  await forgot();
  await forgot();

  const reset = await request(app)
    .post('/api/auth/reset-password')
    .send({ token: 'not-a-token', newPassword: 'NewSecret123' });

  assert.equal(reset.status, 429);
});
