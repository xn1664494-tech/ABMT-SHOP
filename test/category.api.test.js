const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { default: request } = require('supertest');
const app = require('../src/server');
const Category = require('../src/model/Category');
const User = require('../src/model/User');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const ISSUER = 'abmt-shop';
const AUDIENCE = 'abmt-shop-client';

const TEST_URI =
  process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/abmt_shop_category_test';

const RUN_ID = `cat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const slugOf = (name) => `${RUN_ID}-${name}`.toLowerCase().replace(/\s+/g, '-');

let available = false;
let skipReason = '';

const adminToken = jwt.sign(
  { sub: 'admin-test-id', role: 'admin', ver: 0 },
  JWT_SECRET,
  { issuer: ISSUER, audience: AUDIENCE },
);
const customerToken = jwt.sign(
  { sub: 'customer-test-id', role: 'customer', ver: 0 },
  JWT_SECRET,
  { issuer: ISSUER, audience: AUDIENCE },
);

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

const skipIfUnavailable = (t) => {
  if (!available) {
    t.skip(skipReason);
    return true;
  }
  return false;
};

const cleanup = async () => {
  if (!available) return;
  await Category.deleteMany({ name: { $regex: `^${RUN_ID}` } });
  await User.deleteMany({ email: { $regex: `^${RUN_ID}` } });
};

test.before(async () => {
  const dbName = (() => {
    try {
      const withoutParams = TEST_URI.split('?')[0];
      const afterScheme = withoutParams.replace(/^mongodb(\+srv)?:\/\//, '');
      const afterAt = afterScheme.includes('@')
        ? afterScheme.slice(afterScheme.lastIndexOf('@') + 1)
        : afterScheme;
      const slash = afterAt.indexOf('/');
      return slash >= 0 ? afterAt.slice(slash + 1) : '';
    } catch (error) {
      return '';
    }
  })();

  if (!dbName || !dbName.toLowerCase().includes('test')) {
    skipReason = 'TEST_MONGODB_URI phai tro toi database co ten chua "test"';
    return;
  }

  try {
    await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 3000 });
    await Category.init();
    await User.init();

    // Tao thuc te admin user trong DB de authenticate (main) lay duoc user
    await User.create({
      name: 'Admin Test',
      email: `${RUN_ID}admin@test.com`,
      password: 'password123',
      role: 'admin',
    });
    await User.create({
      name: 'Customer Test',
      email: `${RUN_ID}customer@test.com`,
      password: 'password123',
      role: 'customer',
    });

    available = true;
  } catch (error) {
    skipReason = `Khong ket noi duoc MongoDB test (${error.name})`;
  }
});

test.after(async () => {
  await cleanup();
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

test('GET /api/categories - danh sach danh muc ban dau trong', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await request(app).get('/api/categories');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.data));
});

test('POST /api/categories chua dang nhap tra 401', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await request(app)
    .post('/api/categories')
    .send({ name: `${RUN_ID} Ao` });
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
});

test('POST /api/categories vai khach tra 403', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await request(app)
    .post('/api/categories')
    .set(authHeader(customerToken))
    .send({ name: `${RUN_ID} Ao` });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
});

test('POST /api/categories ten trong tra 400', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await request(app)
    .post('/api/categories')
    .set(authHeader(adminToken))
    .send({ name: '' });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
});

test('POST /api/categories admin tao thanh cong', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await request(app)
    .post('/api/categories')
    .set(authHeader(adminToken))
    .send({ name: `${RUN_ID} Ao Thun`, order: 1 });
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.name, `${RUN_ID} Ao Thun`);
  assert.equal(res.body.data.order, 1);
  assert.ok(res.body.data.slug);
  assert.ok(res.body.data.id);
  t.context.parentId = res.body.data.id;
});

test('POST /api/categories ten trung tra 409', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await request(app)
    .post('/api/categories')
    .set(authHeader(adminToken))
    .send({ name: `${RUN_ID} Ao Thun` });
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.success, false);
});

test('POST /api/categories tao danh muc con', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await request(app)
    .post('/api/categories')
    .set(authHeader(adminToken))
    .send({ name: `${RUN_ID} Ao Thun Nam`, parentId: t.context.parentId, order: 2 });
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.parentId, t.context.parentId);
  t.context.childId = res.body.data.id;
});

test('GET /api/categories/tree tra cay danh muc', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await request(app).get('/api/categories/tree');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.data));
  const root = res.body.data.find((c) => c.id === t.context.parentId);
  assert.ok(root);
  assert.ok(Array.isArray(root.children));
  assert.ok(root.children.some((c) => c.id === t.context.childId));
});

test('GET /api/categories/:id chi tiet', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await request(app).get(`/api/categories/${t.context.childId}`);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.id, t.context.childId);
});

test('GET /api/categories/:id id sai dinh dang tra 400', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await request(app).get('/api/categories/not-a-valid-id');
  assert.equal(res.statusCode, 400);
});

test('GET /api/categories/:id khong tim thay tra 404', async (t) => {
  if (skipIfUnavailable(t)) return;
  const fakeId = new mongoose.Types.ObjectId();
  const res = await request(app).get(`/api/categories/${fakeId}`);
  assert.equal(res.statusCode, 404);
});

test('PUT /api/categories/:id cap nhat ten va slug', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await request(app)
    .put(`/api/categories/${t.context.parentId}`)
    .set(authHeader(adminToken))
    .send({ name: `${RUN_ID} Ao Thun Cap Nhat`, order: 5 });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.name, `${RUN_ID} Ao Thun Cap Nhat`);
  assert.equal(res.body.data.order, 5);
  assert.ok(res.body.data.slug);
});

test('PUT /api/categories/:id dat cha la con bi loi vong lap', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await request(app)
    .put(`/api/categories/${t.context.childId}`)
    .set(authHeader(adminToken))
    .send({ parentId: t.context.parentId });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
});

test('DELETE /api/categories/:id co con bi chuan tra 409', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await request(app)
    .delete(`/api/categories/${t.context.parentId}`)
    .set(authHeader(adminToken));
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.success, false);
});

test('DELETE /api/categories/:id xoa muc con thanh cong', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await request(app)
    .delete(`/api/categories/${t.context.childId}`)
    .set(authHeader(adminToken));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
});

test('DELETE /api/categories/:id xoa cha thanh cong', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await request(app)
    .delete(`/api/categories/${t.context.parentId}`)
    .set(authHeader(adminToken));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
});

test.after(() => {
  mongoose.deleteModel(/Category/);
  mongoose.deleteModel(/User/);
});
