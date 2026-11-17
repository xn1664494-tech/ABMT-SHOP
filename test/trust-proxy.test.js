const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const rateLimit = require('express-rate-limit');
const request = require('supertest');

test('T4-1-2 trust proxy: khi khong tin proxy, X-Forwarded-For khong lam thay doi req.ip/rate-limit key', async () => {
  const app = express();
  // Khong set trust proxy -> mac dinh false
  app.get('/ip', (req, res) => res.json({ ip: req.ip }));

  const limiter = rateLimit({
    windowMs: 60_000,
    limit: 2,
    standardHeaders: false,
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ limited: true }),
  });
  app.get('/limited', limiter, (req, res) => res.json({ ok: true }));

  // Client co gang gia mao IP khac nhau qua X-Forwarded-For nhung khong co proxy tin cay
  const ipRes = await request(app)
    .get('/ip')
    .set('X-Forwarded-For', '203.0.113.10');
  assert.notEqual(ipRes.body.ip, '203.0.113.10');

  const statuses = [];
  for (const spoofed of ['203.0.113.1', '203.0.113.2', '203.0.113.3']) {
    const res = await request(app)
      .get('/limited')
      .set('X-Forwarded-For', spoofed);
    statuses.push(res.status);
  }

  // Tat ca bi tinh chung mot key (IP socket thuc) nen vuot nguong o request thu 3
  assert.deepEqual(statuses, [200, 200, 429]);
});

test('T4-1-2 trust proxy: khi tin dung 1 hop proxy, req.ip va rate-limit key lay tu client IP duoc forward', async () => {
  const app = express();
  app.set('trust proxy', 1);
  app.get('/ip', (req, res) => res.json({ ip: req.ip }));

  const limiter = rateLimit({
    windowMs: 60_000,
    limit: 1,
    standardHeaders: false,
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ limited: true }),
  });
  app.get('/limited', limiter, (req, res) => res.json({ ok: true }));

  const ipRes = await request(app)
    .get('/ip')
    .set('X-Forwarded-For', '203.0.113.50');
  assert.equal(ipRes.body.ip, '203.0.113.50');

  const firstClientA = await request(app)
    .get('/limited')
    .set('X-Forwarded-For', '198.51.100.1');
  const secondClientA = await request(app)
    .get('/limited')
    .set('X-Forwarded-For', '198.51.100.1');
  const clientB = await request(app)
    .get('/limited')
    .set('X-Forwarded-For', '198.51.100.2');

  assert.equal(firstClientA.status, 200);
  assert.equal(secondClientA.status, 429); // cung client IP -> bi gioi han
  assert.equal(clientB.status, 200); // client IP khac -> key rieng
});

test('T4-1-2: auth rate limit tren app that van hoat dong', async () => {
  const prev = {
    NODE_ENV: process.env.NODE_ENV,
    MAX: process.env.AUTH_RATE_LIMIT_MAX,
    WINDOW: process.env.AUTH_RATE_LIMIT_WINDOW_MS,
  };

  try {
    process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
    process.env.NODE_ENV = 'test';
    process.env.AUTH_RATE_LIMIT_MAX = '3';
    process.env.AUTH_RATE_LIMIT_WINDOW_MS = '60000';

    // load app sau khi set env rate limit
    delete require.cache[require.resolve('../src/middleware/rateLimiters')];
    delete require.cache[require.resolve('../src/routes/auth.route')];
    delete require.cache[require.resolve('../src/routes/index')];
    delete require.cache[require.resolve('../src/app')];

    const { createFakeUserModel, installFakeUserModel } = require('./support/fakeUserModel');
    installFakeUserModel(createFakeUserModel());
    const app = require('../src/app');

    const statuses = [];
    for (let i = 0; i < 4; i += 1) {
      const res = await request(app).post('/api/auth/login').send({});
      statuses.push(res.status);
    }

    assert.deepEqual(statuses.slice(0, 3), [400, 400, 400]);
    assert.equal(statuses[3], 429);
  } finally {
    process.env.NODE_ENV = prev.NODE_ENV;
    if (prev.MAX === undefined) delete process.env.AUTH_RATE_LIMIT_MAX;
    else process.env.AUTH_RATE_LIMIT_MAX = prev.MAX;
    if (prev.WINDOW === undefined) delete process.env.AUTH_RATE_LIMIT_WINDOW_MS;
    else process.env.AUTH_RATE_LIMIT_WINDOW_MS = prev.WINDOW;

    delete require.cache[require.resolve('../src/middleware/rateLimiters')];
    delete require.cache[require.resolve('../src/routes/auth.route')];
    delete require.cache[require.resolve('../src/routes/index')];
    delete require.cache[require.resolve('../src/app')];
  }
});
