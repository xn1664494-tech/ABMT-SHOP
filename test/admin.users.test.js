const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { Types } = require('mongoose');

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

const PASSWORD_HASH = '$2a$10$abcdefghijklmnopqrstuv';
const MISSING_ID = '64b000000000000000000000';

let emailCounter = 0;

const signToken = (payload, options = {}) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '15m',
    issuer: 'abmt-shop',
    audience: 'abmt-shop-client',
    ...options,
  });

const seedUser = (overrides = {}) => {
  emailCounter += 1;
  return fakeUserModel.create({
    _id: new Types.ObjectId().toString(),
    name: `Nguoi Dung ${emailCounter}`,
    email: `user-${emailCounter}@example.com`,
    password: PASSWORD_HASH,
    role: 'customer',
    status: 'active',
    isDeleted: false,
    ...overrides,
  });
};

const accessTokenFor = (user, overrides = {}) =>
  signToken({
    sub: String(user._id),
    role: user.role,
    ver: user.tokenVersion || 0,
    ...overrides,
  });

const accessCookie = (user) => `accessToken=${accessTokenFor(user)}`;

const cookieOf = (res, name) => {
  const cookie = (res.headers['set-cookie'] || []).find((item) =>
    item.startsWith(`${name}=`),
  );
  return cookie ? cookie.split(';')[0] : null;
};

const getCsrf = async () => {
  const res = await request(app).get('/api/auth/csrf');
  return {
    token: res.body.data.csrfToken,
    cookie: cookieOf(res, 'csrfToken'),
  };
};

const listUsers = (user) => {
  const req = request(app).get('/api/admin/users');
  return user ? req.set('Cookie', accessCookie(user)) : req;
};

const patchRole = async ({ actor, targetId, body, withCsrf = true }) => {
  const csrf = withCsrf ? await getCsrf() : null;
  let req = request(app)
    .patch(`/api/admin/users/${targetId}/role`)
    .send(body);

  const cookies = [];
  if (actor) cookies.push(accessCookie(actor));
  if (csrf) cookies.push(csrf.cookie);
  if (cookies.length) req = req.set('Cookie', cookies.join('; '));
  if (csrf) req = req.set('X-CSRF-Token', csrf.token);

  return req;
};

test.beforeEach(() => {
  fakeUserModel.users.length = 0;
});

// ---------------------------------------------------------------------------
// GET /api/admin/users - phân quyền
// ---------------------------------------------------------------------------

test('T5-1-3: guest goi danh sach nguoi dung bi tu choi 401', async () => {
  const res = await listUsers(null);

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test('T5-1-3: customer goi danh sach nguoi dung bi tu choi 403', async () => {
  const customer = await seedUser({ role: 'customer' });

  const res = await listUsers(customer);

  assert.equal(res.status, 403);
  assert.equal(res.body.success, false);
});

test('T5-1-3: role khai trong token khong vuot quyen (DB quyet dinh)', async () => {
  const customer = await seedUser({ role: 'customer' });
  const forged = `accessToken=${signToken({
    sub: String(customer._id),
    role: 'admin',
    ver: 0,
  })}`;

  const res = await request(app).get('/api/admin/users').set('Cookie', forged);

  assert.equal(res.status, 403);
});

test('T5-1-3: admin goi danh sach nguoi dung thanh cong 200', async () => {
  const admin = await seedUser({ role: 'admin' });
  await seedUser({ role: 'customer' });

  const res = await listUsers(admin);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(Array.isArray(res.body.data.items), true);
  assert.equal(res.body.data.pagination.page, 1);
  assert.equal(res.body.data.pagination.limit, 20);
  assert.equal(res.body.data.pagination.total, 2);
  assert.equal(res.body.data.pagination.itemCount, 2);
});

// ---------------------------------------------------------------------------
// GET /api/admin/users - dữ liệu, phân trang, validate
// ---------------------------------------------------------------------------

test('T5-1-3: danh sach rong tra response hop le', async () => {
  const admin = await seedUser({ role: 'admin' });

  const res = await request(app)
    .get('/api/admin/users?q=khong-ton-tai')
    .set('Cookie', accessCookie(admin));

  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data.items, []);
  assert.equal(res.body.data.pagination.total, 0);
  assert.equal(res.body.data.pagination.totalPages, 0);
  assert.equal(res.body.data.pagination.itemCount, 0);
});

test('T5-1-3: phan trang hop le tra dung trang du lieu', async () => {
  const admin = await seedUser({ role: 'admin' });
  await seedUser({
    role: 'customer',
    email: 'oldest@example.com',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  });
  await seedUser({
    role: 'customer',
    email: 'middle@example.com',
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
  });
  await seedUser({
    role: 'customer',
    email: 'newest@example.com',
    createdAt: new Date('2026-01-03T00:00:00.000Z'),
  });

  const res = await request(app)
    .get('/api/admin/users?page=2&limit=2')
    .set('Cookie', accessCookie(admin));

  assert.equal(res.status, 200);
  assert.equal(res.body.data.pagination.page, 2);
  assert.equal(res.body.data.pagination.limit, 2);
  assert.equal(res.body.data.pagination.total, 4);
  assert.equal(res.body.data.pagination.itemCount, 2);
});

test('T5-1-3: page/limit khong hop le bi validate 400', async () => {
  const admin = await seedUser({ role: 'admin' });

  const badPage = await request(app)
    .get('/api/admin/users?page=0')
    .set('Cookie', accessCookie(admin));
  const badLimit = await request(app)
    .get('/api/admin/users?limit=abc')
    .set('Cookie', accessCookie(admin));

  assert.equal(badPage.status, 400);
  assert.equal(badPage.body.success, false);
  assert.equal(badLimit.status, 400);
  assert.equal(badLimit.body.success, false);
});

test('T5-1-3: limit vuot nguong bi ep ve toi da', async () => {
  const admin = await seedUser({ role: 'admin' });

  const res = await request(app)
    .get('/api/admin/users?limit=9999')
    .set('Cookie', accessCookie(admin));

  assert.equal(res.status, 200);
  assert.equal(res.body.data.pagination.limit, 100);
});

test('T5-1-3: response danh sach khong lo du lieu nhay cam', async () => {
  const admin = await seedUser({ role: 'admin' });
  await seedUser({
    role: 'customer',
    password: PASSWORD_HASH,
    tokenVersion: 7,
    resetPasswordTokenHash: 'hash-bi-mat',
    resetPasswordExpires: new Date('2026-12-31T00:00:00.000Z'),
  });

  const res = await request(app)
    .get('/api/admin/users')
    .set('Cookie', accessCookie(admin));

  const item = res.body.data.items.find((user) => user.role === 'customer');
  const serialized = JSON.stringify(res.body);

  assert.equal(res.status, 200);
  assert.ok(item);
  assert.equal(Object.hasOwn(item, 'password'), false);
  assert.equal(Object.hasOwn(item, 'passwordHash'), false);
  assert.equal(Object.hasOwn(item, 'tokenVersion'), false);
  assert.equal(Object.hasOwn(item, 'resetPasswordTokenHash'), false);
  assert.equal(Object.hasOwn(item, 'resetPasswordExpires'), false);
  assert.equal(serialized.includes(PASSWORD_HASH), false);
  assert.equal(serialized.includes('hash-bi-mat'), false);
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/users/:userId/role - phân quyền & CSRF
// ---------------------------------------------------------------------------

test('T5-1-3: guest doi role bi tu choi 401', async () => {
  const target = await seedUser();

  const res = await patchRole({
    actor: null,
    targetId: target._id,
    body: { role: 'admin' },
  });

  assert.equal(res.status, 401);
});

test('T5-1-3: customer doi role bi tu choi 403', async () => {
  const actor = await seedUser({ role: 'customer' });
  const target = await seedUser();

  const res = await patchRole({
    actor,
    targetId: target._id,
    body: { role: 'admin' },
  });

  assert.equal(res.status, 403);
  assert.equal(target.role, 'customer');
});

test('T5-1-3: thieu CSRF token bi tu choi 403', async () => {
  const admin = await seedUser({ role: 'admin' });
  const target = await seedUser();

  // origin/main bypass CSRF khi NODE_ENV=test. Bat tam de van kiem tra
  // csrfProtection tren route doi role, roi tra lai moi truong ban dau.
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  let res;
  try {
    res = await patchRole({
      actor: admin,
      targetId: target._id,
      body: { role: 'admin' },
      withCsrf: false,
    });
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
  }

  assert.equal(res.status, 403);
  assert.equal(target.role, 'customer');
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/users/:userId/role - nghiệp vụ
// ---------------------------------------------------------------------------

test('T5-1-3: admin doi role cua user khac thanh cong', async () => {
  const admin = await seedUser({ role: 'admin' });
  const target = await seedUser({ role: 'customer' });

  const res = await patchRole({
    actor: admin,
    targetId: target._id,
    body: { role: 'admin' },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.changed, true);
  assert.equal(res.body.data.user.id, String(target._id));
  assert.equal(res.body.data.user.role, 'admin');
  assert.equal(target.role, 'admin');
  assert.equal(JSON.stringify(res.body).includes(PASSWORD_HASH), false);
  assert.equal(Object.hasOwn(res.body.data.user, 'passwordHash'), false);
});

test('T5-1-3: admin khong the tu ha quyen chinh minh', async () => {
  const admin = await seedUser({ role: 'admin' });

  const res = await patchRole({
    actor: admin,
    targetId: admin._id,
    body: { role: 'customer' },
  });

  assert.equal(res.status, 403);
  assert.match(res.body.error, /tu ha quyen/i);
  assert.equal(admin.role, 'admin');
});

test('T5-1-3: admin khong the tu ha quyen bang ID viet hoa', async () => {
  const admin = await seedUser({ role: 'admin' });

  const res = await patchRole({
    actor: admin,
    targetId: String(admin._id).toUpperCase(),
    body: { role: 'customer' },
  });

  assert.equal(res.status, 403);
  assert.match(res.body.error, /tu ha quyen/i);
  assert.equal(admin.role, 'admin');
});

test('T5-1-3: admin gui role hien tai cua chinh minh la idempotent', async () => {
  const admin = await seedUser({ role: 'admin' });

  const res = await patchRole({
    actor: admin,
    targetId: admin._id,
    body: { role: 'admin' },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.changed, false);
  assert.equal(admin.role, 'admin');
});

test('T5-1-3: role moi trung role cu tra 200 changed=false', async () => {
  const admin = await seedUser({ role: 'admin' });
  const target = await seedUser({ role: 'customer' });

  const res = await patchRole({
    actor: admin,
    targetId: target._id,
    body: { role: 'customer' },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.changed, false);
  assert.equal(target.role, 'customer');
});

test('T5-1-3: user id khong ton tai tra 404', async () => {
  const admin = await seedUser({ role: 'admin' });

  const res = await patchRole({
    actor: admin,
    targetId: MISSING_ID,
    body: { role: 'admin' },
  });

  assert.equal(res.status, 404);
  assert.match(res.body.error, /khong ton tai/i);
});

test('T5-1-3: user id khong hop le tra 400', async () => {
  const admin = await seedUser({ role: 'admin' });

  const res = await patchRole({
    actor: admin,
    targetId: 'not-an-object-id',
    body: { role: 'admin' },
  });

  assert.equal(res.status, 400);
});

test('T5-1-3: role khong hop le tra 400', async () => {
  const admin = await seedUser({ role: 'admin' });
  const target = await seedUser({ role: 'customer' });

  const res = await patchRole({
    actor: admin,
    targetId: target._id,
    body: { role: 'superadmin' },
  });

  assert.equal(res.status, 400);
  assert.equal(target.role, 'customer');
});

test('T5-1-3: field ngoai pham vi bi tu choi, khong ghi ngoai y muon', async () => {
  const admin = await seedUser({ role: 'admin' });
  const target = await seedUser({ role: 'customer' });

  const res = await patchRole({
    actor: admin,
    targetId: target._id,
    body: { role: 'admin', email: 'hacker@example.com', status: 'blocked' },
  });

  assert.equal(res.status, 400);
  assert.equal(target.role, 'customer');
  assert.notEqual(target.email, 'hacker@example.com');
  assert.equal(target.status, 'active');
});
