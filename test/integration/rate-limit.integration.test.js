/**
 * Kiem thu rate limiting tren endpoint auth.
 * Chay trong file rieng de co cau hinh nguong thap, khong anh huong test khac.
 * Khong can MongoDB vi limiter chay truoc validate.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'integration-test-jwt-secret-at-least-32-chars';
process.env.AUTH_RATE_LIMIT_MAX = '3';
process.env.AUTH_RATE_LIMIT_WINDOW_MS = '60000';

const request = require('supertest');
const app = require('../../src/app');

test('IT-RATE-LIMIT: vuot nguong login tra 429', async () => {
  const statuses = [];
  for (let i = 0; i < 4; i += 1) {
    const res = await request(app).post('/api/auth/login').send({});
    statuses.push(res.status);
  }

  assert.deepEqual(statuses.slice(0, 3), [400, 400, 400]);
  assert.equal(statuses[3], 429);
});
