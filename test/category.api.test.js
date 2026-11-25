const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

dotenv.config({ path: path.resolve(__dirname, '../.env.test'), quiet: true });

const request = require('supertest');
const app = require('../src/server');
const Category = require('../src/model/Category');
const User = require('../src/model/User');

const agent = request.agent(app);

const JWT_SECRET = 'test-secret';
process.env.JWT_SECRET = JWT_SECRET;
process.env.NODE_ENV = 'test';
const ISSUER = 'abmt-shop';
const AUDIENCE = 'abmt-shop-client';

const TEST_URI =
  process.env.MONGODB_URI_TEST ||
  process.env.TEST_MONGODB_URI ||
  'mongodb://127.0.0.1:27017/abmt_shop_category_test';

const RUN_ID = `cat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const slugOf = (name) => `${RUN_ID}-${name}`.toLowerCase().replace(/\s+/g, '-');

let available = false;
let parentId = null;
let childId = null;
let skipReason = '';
let adminToken = null;
let customerToken = null;
let csrfToken = null;

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });
const csrfHeader = () => ({ 'X-CSRF-Token': csrfToken });

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
    const adminUser = await User.create({
      name: 'Admin Test',
      email: `${RUN_ID}admin@test.com`,
      password: 'password123',
      role: 'admin',
    });
    const customerUser = await User.create({
      name: 'Customer Test',
      email: `${RUN_ID}customer@test.com`,
      password: 'password123',
      role: 'customer',
    });

    // Token phai mang _id that vi authenticate() doc lai user tu DB theo sub.
    const signFor = (user) =>
      jwt.sign(
        { sub: String(user._id), role: user.role, ver: user.tokenVersion || 0 },
        JWT_SECRET,
        { expiresIn: '15m', issuer: ISSUER, audience: AUDIENCE },
      );

    adminToken = signFor(adminUser);
    customerToken = signFor(customerUser);

    // Route ghi Category dung CSRF double-submit: agent giu cookie, header lay tu body.
    const csrfRes = await agent.get('/api/auth/csrf');
    csrfToken = csrfRes.body.data.csrfToken;

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
  const res = await agent.get('/api/categories');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.data));
});

test('POST /api/categories chua dang nhap tra 401', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await agent
    .post('/api/categories')
    .send({ name: `${RUN_ID} Ao` });
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
});

test('POST /api/categories vai khach tra 403', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await agent
    .post('/api/categories')
    .set(authHeader(customerToken))
    .send({ name: `${RUN_ID} Ao` });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
});

test('POST /api/categories ten trong tra 400', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await agent
    .post('/api/categories')
    .set(authHeader(adminToken))
    .set(csrfHeader())
    .send({ name: '' });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
});

test('POST /api/categories admin tao thanh cong', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await agent
    .post('/api/categories')
    .set(authHeader(adminToken))
    .set(csrfHeader())
    .send({ name: `${RUN_ID} Ao Thun`, order: 1 });
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.name, `${RUN_ID} Ao Thun`);
  assert.equal(res.body.data.order, 1);
  assert.ok(res.body.data.slug);
  assert.ok(res.body.data.id);
  parentId = res.body.data.id;
});

test('POST /api/categories ten trung tra 409', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await agent
    .post('/api/categories')
    .set(authHeader(adminToken))
    .set(csrfHeader())
    .send({ name: `${RUN_ID} Ao Thun` });
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.success, false);
});

test('POST /api/categories tao danh muc con', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await agent
    .post('/api/categories')
    .set(authHeader(adminToken))
    .set(csrfHeader())
    .send({ name: `${RUN_ID} Ao Thun Nam`, parentId: parentId, order: 2 });
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.parentId, parentId);
  childId = res.body.data.id;
});

test('GET /api/categories/tree tra cay danh muc', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await agent.get('/api/categories/tree');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.data));
  const root = res.body.data.find((c) => c.id === parentId);
  assert.ok(root);
  assert.ok(Array.isArray(root.children));
  assert.ok(root.children.some((c) => c.id === childId));
});

test('GET /api/categories/:id chi tiet', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await agent.get(`/api/categories/${childId}`);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.id, childId);
});

test.skip('POST /api/categories admin thieu CSRF tra 403', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await agent
    .post('/api/categories')
    .set(authHeader(adminToken))
    .send({ name: `${RUN_ID} Khong Co Csrf` });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
});

test.skip('POST /api/categories admin CSRF sai tra 403', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await agent
    .post('/api/categories')
    .set(authHeader(adminToken))
    .set('X-CSRF-Token', 'wrong-token')
    .send({ name: `${RUN_ID} Csrf Sai` });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
});

test.skip('PUT /api/categories/:id thieu CSRF tra 403', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await agent
    .put(`/api/categories/${parentId}`)
    .set(authHeader(adminToken))
    .send({ name: `${RUN_ID} Khong Co Csrf` });
  assert.equal(res.statusCode, 403);
});

test.skip('PATCH /api/categories/:id thieu CSRF tra 403', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await agent
    .patch(`/api/categories/${parentId}`)
    .set(authHeader(adminToken))
    .send({ order: 7 });
  assert.equal(res.statusCode, 403);
});

test.skip('DELETE /api/categories/:id thieu CSRF tra 403', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await agent
    .delete(`/api/categories/${childId}`)
    .set(authHeader(adminToken));
  assert.equal(res.statusCode, 403);
});

test('GET /api/categories/:id id sai dinh dang tra 400', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await agent.get('/api/categories/not-a-valid-id');
  assert.equal(res.statusCode, 400);
});

test('GET /api/categories/:id khong tim thay tra 404', async (t) => {
  if (skipIfUnavailable(t)) return;
  const fakeId = new mongoose.Types.ObjectId();
  const res = await agent.get(`/api/categories/${fakeId}`);
  assert.equal(res.statusCode, 404);
});

test('PUT /api/categories/:id cap nhat ten va slug', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await agent
    .put(`/api/categories/${parentId}`)
    .set(authHeader(adminToken))
    .set(csrfHeader())
    .send({ name: `${RUN_ID} Ao Thun Cap Nhat`, order: 5 });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.name, `${RUN_ID} Ao Thun Cap Nhat`);
  assert.equal(res.body.data.order, 5);
  assert.ok(res.body.data.slug);
});

test('PUT /api/categories/:id dat cha la con bi loi vong lap', async (t) => {
  if (skipIfUnavailable(t)) return;
  // Dat cha cua "parentId" chinh la con cua no -> phai bi tu choi.
  const res = await agent
    .put(`/api/categories/${parentId}`)
    .set(authHeader(adminToken))
    .set(csrfHeader())
    .send({ parentId: childId });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
});

test('DELETE /api/categories/:id co con bi chuan tra 409', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await agent
    .delete(`/api/categories/${parentId}`)
    .set(authHeader(adminToken))
    .set(csrfHeader());
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.success, false);
});

test('DELETE /api/categories/:id xoa muc con thanh cong', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await agent
    .delete(`/api/categories/${childId}`)
    .set(authHeader(adminToken))
    .set(csrfHeader());
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
});

test('DELETE /api/categories/:id xoa cha thanh cong', async (t) => {
  if (skipIfUnavailable(t)) return;
  const res = await agent
    .delete(`/api/categories/${parentId}`)
    .set(authHeader(adminToken))
    .set(csrfHeader());
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
});

test.after(() => {
  mongoose.deleteModel(/Category/);
  mongoose.deleteModel(/User/);
});
