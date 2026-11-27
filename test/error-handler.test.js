const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');

process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.NODE_ENV = 'test';

const { createFakeUserModel, installFakeUserModel } = require('./support/fakeUserModel');

const fakeUserModel = createFakeUserModel();
installFakeUserModel(fakeUserModel);

const app = require('../src/app');
const notFound = require('../src/middleware/404');
const errorHandler = require('../src/middleware/errorHandler');
const securityHeaders = require('../src/middleware/securityHeaders');

const seedUser = () =>
  fakeUserModel.create({
    name: 'User',
    email: `eh-${Math.random().toString(36).slice(2, 8)}@example.com`,
    password: '$2a$10$abcdefghijklmnopqrstuv',
    role: 'customer',
    status: 'active',
    isDeleted: false,
  });

test.beforeEach(() => {
  fakeUserModel.users.length = 0;
});

// --- 404 ---

test('T5: Request HTML gap 404 nhan error page', async () => {
  const res = await request(app)
    .get('/trang-khong-ton-tai')
    .set('Accept', 'text/html');

  assert.equal(res.status, 404);
  assert.match(res.headers['content-type'] || '', /text\/html/);
  assert.match(res.text, /404/);
  assert.match(res.text, /Về trang chủ|trang chủ/i);
  assert.doesNotMatch(res.text, /"success"\s*:\s*false/);
});

test('T5: Request API gap 404 nhan JSON', async () => {
  const res = await request(app)
    .get('/api/khong-ton-tai')
    .set('Accept', 'application/json');

  assert.equal(res.status, 404);
  assert.match(res.headers['content-type'] || '', /application\/json/);
  assert.equal(res.body.success, false);
  assert.ok(res.body.error);
});

// --- Status codes giu dung tren API ---

test('T5: loi validation tra 400 JSON', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email: 'bad-email' });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
});

test('T5: loi unauthorized tra 401 JSON', async () => {
  const res = await request(app).get('/api/profile/me');

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test('T5: loi forbidden tra 403 JSON', async () => {
  const user = await seedUser();
  const jwt = require('jsonwebtoken');
  const token = jwt.sign(
    { sub: String(user._id), role: user.role, ver: user.tokenVersion || 0 },
    process.env.JWT_SECRET,
    { expiresIn: '15m', issuer: 'abmt-shop', audience: 'abmt-shop-client' },
  );

  const res = await request(app)
    .get('/api/admin/access-check')
    .set('Cookie', `accessToken=${token}`);

  assert.equal(res.status, 403);
  assert.equal(res.body.success, false);
});

test('T5: loi conflict tra 409 JSON', async () => {
  const email = 'dup@example.com';
  await fakeUserModel.create({
    name: 'A',
    email,
    password: '$2a$10$abcdefghijklmnopqrstuv',
    role: 'customer',
    status: 'active',
  });

  const res = await request(app).post('/api/auth/register').send({
    name: 'User B',
    email,
    password: 'Secret123',
  });

  assert.equal(res.status, 409);
  assert.equal(res.body.success, false);
});

// --- 500 production khong lo message/stack ---

test('T5: loi 500 production (API JSON) khong lo error.message hoac stack trace', async () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const mini = express();
    mini.get('/boom', () => {
      const err = new Error('SECRET_INTERNAL_DETAIL');
      err.stack = 'SECRET_STACK_TRACE';
      throw err;
    });
    mini.use(notFound);
    mini.use(errorHandler);

    const res = await request(mini).get('/boom').set('Accept', 'application/json');

    assert.equal(res.status, 500);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error, 'Lỗi máy chủ nội bộ');
    assert.doesNotMatch(JSON.stringify(res.body), /SECRET_INTERNAL_DETAIL/);
    assert.doesNotMatch(JSON.stringify(res.body), /SECRET_STACK_TRACE/);
  } finally {
    process.env.NODE_ENV = prev;
  }
});

test('T5: loi 500 production (HTML) khong lo error.message hoac stack trace', async () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const mini = express();
    mini.set('view engine', 'ejs');
    mini.set('views', require('path').join(__dirname, '..', 'src', 'views'));
    // error.ejs include header.ejs, van ban cap nonce tu middleware CSP nhu app that.
    mini.use(securityHeaders);
    mini.get('/boom', () => {
      const err = new Error('SECRET_INTERNAL_DETAIL');
      err.stack = 'SECRET_STACK_TRACE';
      throw err;
    });
    mini.use(notFound);
    mini.use(errorHandler);

    const res = await request(mini).get('/boom').set('Accept', 'text/html');

    assert.equal(res.status, 500);
    assert.match(res.headers['content-type'] || '', /text\/html/);
    assert.match(res.text, /Lỗi máy chủ nội bộ/);
    assert.doesNotMatch(res.text, /SECRET_INTERNAL_DETAIL/);
    assert.doesNotMatch(res.text, /SECRET_STACK_TRACE/);
  } finally {
    process.env.NODE_ENV = prev;
  }
});
