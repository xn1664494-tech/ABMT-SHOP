const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

// ---------------------------------------------------------------------------
// Cô lập tầng persistence: thay model User bằng in-memory fake để test HTTP
// end-to-end qua Express mà không ghi dữ liệu thật vào MongoDB.
// ---------------------------------------------------------------------------
const users = [];

const fakeUserModel = {
  async findOne({ email }) {
    return users.find((user) => user.email === email) || null;
  },
  async create(doc) {
    if (users.some((user) => user.email === doc.email)) {
      const error = new Error('E11000 duplicate key error');
      error.code = 11000;
      error.keyValue = { email: doc.email };
      throw error;
    }
    const user = {
      _id: String(users.length + 1),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      ...doc,
    };
    users.push(user);
    return user;
  },
};

const userModelPath = require.resolve('../src/model/User');
require.cache[userModelPath] = {
  id: userModelPath,
  filename: userModelPath,
  loaded: true,
  exports: fakeUserModel,
};

const request = require('supertest');
const app = require('../src/app');

const validPayload = {
  name: 'Nguyen Van A',
  email: 'customer@example.com',
  password: 'Secret123',
};

test.beforeEach(() => {
  users.length = 0;
});

test('T3-1-1: dang ky thanh cong tra 201 va khong lo password', async () => {
  const res = await request(app).post('/api/auth/register').send(validPayload);

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.user.email, 'customer@example.com');
  assert.equal(res.body.data.user.role, 'customer');
  assert.equal(res.body.data.user.status, 'active');
  assert.equal(res.body.data.user.password, undefined);
  assert.equal(res.body.data.user.passwordHash, undefined);
  assert.equal(JSON.stringify(res.body).includes('Secret123'), false);
  assert.equal(users.length, 1);
});

test('T3-1-1: password duoc hash bang bcrypt truoc khi luu', async () => {
  await request(app).post('/api/auth/register').send(validPayload).expect(201);

  const stored = users[0];
  assert.notEqual(stored.password, validPayload.password);
  assert.match(stored.password, /^\$2[aby]\$/);
  assert.equal(await bcrypt.compare(validPayload.password, stored.password), true);
});

test('T3-1-1: email da ton tai tra 409', async () => {
  await request(app).post('/api/auth/register').send(validPayload).expect(201);

  const res = await request(app).post('/api/auth/register').send(validPayload);

  assert.equal(res.status, 409);
  assert.equal(res.body.success, false);
  assert.equal(users.length, 1);
});

test('T3-1-1: email sai dinh dang tra 400', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ ...validPayload, email: 'not-an-email' });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.ok(res.body.details.some((item) => item.field === 'email'));
  assert.equal(users.length, 0);
});

test('T3-1-1: password khong dat yeu cau tra 400', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ ...validPayload, password: '123' });

  assert.equal(res.status, 400);
  assert.ok(res.body.details.some((item) => item.field === 'password'));
  assert.equal(users.length, 0);
});

test('T3-1-1: thieu truong bat buoc tra 400', async () => {
  const res = await request(app).post('/api/auth/register').send({});

  assert.equal(res.status, 400);
  const fields = res.body.details.map((item) => item.field);
  assert.ok(fields.includes('name'));
  assert.ok(fields.includes('email'));
  assert.ok(fields.includes('password'));
  assert.equal(users.length, 0);
});

test('T3-1-1: khong the tu dang ky vai tro admin', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ ...validPayload, role: 'admin' });

  assert.equal(res.status, 400);
  assert.equal(users.length, 0);
});

test('T3-1-1: role customer duoc chap nhan nhung luon luu la customer', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ ...validPayload, role: 'customer' });

  assert.equal(res.status, 201);
  assert.equal(users[0].role, 'customer');
});

test('T3-1-1: email duoc chuan hoa lowercase', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ ...validPayload, email: '  CUSTOMER@Example.COM  ' });

  assert.equal(res.status, 201);
  assert.equal(users[0].email, 'customer@example.com');
});
