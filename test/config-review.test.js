'use strict';

// T7-1-3: kiểm chứng cấu hình đã rà soát — kích thước body, cờ cookie,
// và việc ghi nhận limitation của rate limit store. Không đổi contract API.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';

const app = require('../src/app');
const { accessCookieOptions, refreshCookieOptions } = require('../src/services/tokenService');

const ROOT = path.join(__dirname, '..');
const OVERSIZE = 'x'.repeat(110 * 1024); // > 100kb

test('T7-1-3: body JSON vuot nguong tra 413, khong tra 500', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .set('Content-Type', 'application/json')
    .send({ blob: OVERSIZE });

  assert.equal(res.status, 413);
  assert.equal(res.body.success, false);
  assert.doesNotMatch(res.text, /stack|SECRET|at Object\./i);
});

test('T7-1-3: body form-urlencoded vuot nguong cung tra 413', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .type('form')
    .send({ blob: OVERSIZE });

  assert.equal(res.status, 413);
  assert.equal(res.body.success, false);
});

test('T7-1-3: body nho nguong van duoc parse (khong bi chan boi limit)', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .set('Content-Type', 'application/json')
    .send({ email: 'not-an-email' });

  assert.notEqual(res.status, 413);
  assert.equal(res.status, 400);
});

test('T7-1-3: cookie access/refresh co HttpOnly + SameSite=Strict', () => {
  for (const options of [accessCookieOptions(), refreshCookieOptions()]) {
    assert.equal(options.httpOnly, true);
    assert.equal(options.sameSite, 'strict');
    assert.equal(options.secure, false); // NODE_ENV=test
  }
  assert.equal(accessCookieOptions().path, '/');
  assert.equal(refreshCookieOptions().path, '/api/auth');
});

test('T7-1-3: Secure bat len o production va tat o test', () => {
  const prev = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    assert.equal(accessCookieOptions().secure, true);
    assert.equal(refreshCookieOptions().secure, true);

    process.env.NODE_ENV = 'test';
    assert.equal(accessCookieOptions().secure, false);
    assert.equal(refreshCookieOptions().secure, false);
  } finally {
    process.env.NODE_ENV = prev;
  }
});

test('T7-1-3: cookie CSRF khong HttpOnly la ngoai le co chu dich, van SameSite=Strict', async () => {
  const res = await request(app).get('/api/auth/csrf');
  const cookies = res.headers['set-cookie'] || [];
  const csrf = cookies.find((value) => value.startsWith('csrfToken='));

  assert.equal(res.status, 200);
  assert.ok(csrf, 'thieu cookie csrfToken');
  assert.match(csrf, /SameSite=Strict/i);
  assert.doesNotMatch(csrf, /HttpOnly/i); // frontend phai doc token de gui header
});

test('T7-1-3: cau hinh body limit va xu ly 413 duoc khai bao ro trong ma nguon', () => {
  const appSource = fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8');
  const handlerSource = fs.readFileSync(path.join(ROOT, 'src', 'middleware', 'errorHandler.js'), 'utf8');
  const limiterSource = fs.readFileSync(path.join(ROOT, 'src', 'middleware', 'rateLimiters.js'), 'utf8');

  assert.match(appSource, /const BODY_LIMIT = '100kb'/);
  assert.match(appSource, /express\.json\(\{ limit: BODY_LIMIT \}\)/);
  assert.match(appSource, /express\.urlencoded\(\{ extended: true, limit: BODY_LIMIT \}\)/);
  assert.match(handlerSource, /err\.type === 'entity\.too\.large'/);
  assert.match(handlerSource, /new ErrorResponse\('Payload too large', 413\)/);
  assert.match(limiterSource, /MemoryStore/); // limitation duoc ghi ro, khong nguynhien
});
