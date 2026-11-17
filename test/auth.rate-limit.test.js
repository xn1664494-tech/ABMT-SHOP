const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
process.env.NODE_ENV = 'test';
process.env.AUTH_RATE_LIMIT_MAX = '5';
process.env.AUTH_RATE_LIMIT_WINDOW_MS = '60000';

const { createFakeUserModel, installFakeUserModel } = require('./support/fakeUserModel');

const fakeUserModel = createFakeUserModel();
installFakeUserModel(fakeUserModel);

const request = require('supertest');
const app = require('../src/app');

test.beforeEach(() => {
  fakeUserModel.users.length = 0;
});

test('T4-1-2: vuot rate limit login tra 429', async () => {
  const attempt = () =>
    request(app)
      .post('/api/auth/login')
      .send({ email: 'unknown@example.com', password: 'Secret123' });

  for (let index = 0; index < 5; index += 1) {
    const res = await attempt();
    assert.equal(res.status, 401);
  }

  const blocked = await attempt();
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.success, false);
  assert.match(blocked.body.error, /nhieu yeu cau/i);
});

test('T4-1-2: rate limit ap dung cho register', async () => {
  for (let index = 0; index < 5; index += 1) {
    await request(app)
      .post('/api/auth/login')
      .send({ email: `${index}@example.com`, password: 'Secret123' });
  }

  const res = await request(app).post('/api/auth/register').send({
    name: 'Nguyen Van A',
    email: 'new@example.com',
    password: 'Secret123',
  });

  assert.equal(res.status, 429);
});

test('T4-1-2: endpoint khong nhay cam khong bi anh huong boi auth rate limit', async () => {
  for (let index = 0; index < 6; index += 1) {
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'unknown@example.com', password: 'Secret123' });
  }

  const csrf = await request(app).get('/api/auth/csrf');
  assert.equal(csrf.status, 200);
});
