const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.NODE_ENV = 'test';
process.env.APP_ORIGIN = 'http://localhost:3000';

const { createFakeUserModel, installFakeUserModel } = require('./support/fakeUserModel');
const { installFakeModel } = require('./support/fakeCartModels');

// Muon static that cua Order (flow/canTransition) truoc khi cai fake model.
// Khong ket noi MongoDB, khong doc .env that.
const RealOrder = require('../src/model/Order');

const fakeUserModel = createFakeUserModel();
installFakeUserModel(fakeUserModel);

const ctx = {
  orders: [],
  casCalls: [],
  findByIdImpl: null,
  findOneAndUpdateImpl: null,
};

const matches = (doc, filter) =>
  Object.entries(filter).every(([key, value]) => {
    if (['_id', 'user'].includes(key)) {
      return String(doc[key]) === String(value);
    }
    return doc[key] === value;
  });

const defaultFindById = (id) =>
  Promise.resolve(
    ctx.orders.find((order) => String(order._id) === String(id)) || null,
  );

const defaultFindOneAndUpdate = async (filter, update, options) => {
  const index = ctx.orders.findIndex((order) => matches(order, filter));
  if (index < 0) return null;

  const pushed = update.$push && update.$push.statusHistory;
  const next = {
    ...ctx.orders[index],
    ...(update.$set || {}),
    statusHistory: [
      ...(ctx.orders[index].statusHistory || []),
      ...(pushed ? [pushed] : []),
    ],
  };
  ctx.orders[index] = next;
  return options && options.new ? { ...next } : next;
};

const fakeOrderModel = {
  ORDER_STATUSES: RealOrder.ORDER_STATUSES,
  ORDER_STATUS_FLOW: RealOrder.ORDER_STATUS_FLOW,
  canTransition: RealOrder.canTransition,
  calculateShippingFee: RealOrder.calculateShippingFee,
  findById(id) {
    return (ctx.findByIdImpl || defaultFindById)(id);
  },
  findOneAndUpdate(filter, update, options) {
    ctx.casCalls.push({ filter, update, options });
    return (ctx.findOneAndUpdateImpl || defaultFindOneAndUpdate)(
      filter,
      update,
      options,
    );
  },
};

installFakeModel('../../src/model/Order', fakeOrderModel);

const request = require('supertest');
const app = require('../src/app');
const { setAuditPublisher } = require('../src/services/auditEvent');

const signToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '15m',
    issuer: 'abmt-shop',
    audience: 'abmt-shop-client',
  });

const seedUser = (overrides = {}) =>
  fakeUserModel.create({
    _id: new mongoose.Types.ObjectId().toString(),
    name: 'Nguoi Dung',
    email: `user-${new mongoose.Types.ObjectId()}@example.com`,
    password: '$2a$10$abcdefghijklmnopqrstuv',
    role: 'customer',
    status: 'active',
    isDeleted: false,
    tokenVersion: 0,
    addresses: [],
    ...overrides,
  });

const accessCookie = (user) =>
  `accessToken=${signToken({
    sub: String(user._id || user.id),
    role: user.role,
    ver: user.tokenVersion || 0,
  })}`;

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

const patchStatus = async ({
  actor = null,
  orderId,
  body = { status: 'confirmed' },
  withCsrf = true,
}) => {
  const csrf = withCsrf ? await getCsrf() : null;
  let req = request(app).patch(`/api/admin/orders/${orderId}/status`).send(body);

  const cookies = [];
  if (actor) cookies.push(accessCookie(actor));
  if (csrf) cookies.push(csrf.cookie);
  if (cookies.length) req = req.set('Cookie', cookies.join('; '));
  if (csrf) req = req.set('X-CSRF-Token', csrf.token);

  return req;
};

const makeOrder = (status = 'pending', overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  code: 'DH-0001',
  user: new mongoose.Types.ObjectId(),
  status,
  statusHistory: [
    {
      status,
      at: new Date('2026-01-01T00:00:00.000Z'),
      by: new mongoose.Types.ObjectId(),
      note: '',
    },
  ],
  ...overrides,
});

let events = [];

test.beforeEach(() => {
  fakeUserModel.users.length = 0;
  ctx.orders = [];
  ctx.casCalls = [];
  ctx.findByIdImpl = null;
  ctx.findOneAndUpdateImpl = null;

  events = [];
  setAuditPublisher(async (event) => {
    events.push(event);
  });
});

test.afterEach(() => {
  // Tra lai publisher no-op mac dinh de khong anh huong file test khac.
  setAuditPublisher(undefined);
});

test('PR-4: guest goi API doi trang thai bi tu choi 401', async () => {
  const order = makeOrder();
  ctx.orders = [order];

  const res = await patchStatus({ orderId: order._id });

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
  assert.equal(events.length, 0);
  assert.equal(ctx.casCalls.length, 0);
});

test('PR-4: customer goi API doi trang thai bi tu choi 403', async () => {
  const customer = await seedUser({ role: 'customer' });
  const order = makeOrder();
  ctx.orders = [order];

  const res = await patchStatus({ actor: customer, orderId: order._id });

  assert.equal(res.status, 403);
  assert.equal(res.body.success, false);
  assert.equal(events.length, 0);
  assert.equal(ctx.casCalls.length, 0);
});

test('PR-4: admin pending -> confirmed tra 200 va dung 1 audit event', async () => {
  const admin = await seedUser({ role: 'admin' });
  const order = makeOrder('pending');
  ctx.orders = [order];

  const res = await patchStatus({
    actor: admin,
    orderId: order._id,
    body: { status: 'confirmed', note: 'xac nhan don' },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, 'Cap nhat trang thai don hang thanh cong');
  assert.equal(res.body.data.order.status, 'confirmed');
  assert.equal(ctx.orders[0].status, 'confirmed');

  const cas = ctx.casCalls[0];
  assert.equal(String(cas.filter._id), String(order._id));
  assert.equal(cas.filter.status, 'pending');
  assert.equal(cas.update.$set.status, 'confirmed');
  assert.equal(cas.update.$push.statusHistory.note, '[role:admin] xac nhan don');
  assert.equal(cas.options.new, true);

  assert.equal(events.length, 1);
  assert.deepEqual(Object.keys(events[0]).sort(), [
    'action',
    'actorId',
    'actorRole',
    'after',
    'before',
    'targetId',
    'targetType',
  ]);
  assert.equal(events[0].actorId, String(admin._id));
  assert.equal(events[0].actorRole, 'admin');
  assert.equal(events[0].action, 'admin.order.status.changed');
  assert.equal(events[0].targetType, 'Order');
  assert.equal(events[0].targetId, String(order._id));
  assert.deepEqual(events[0].before, { status: 'pending' });
  assert.deepEqual(events[0].after, { status: 'confirmed' });
});

test('PR-4: admin pending -> shipping tra 409, khong audit', async () => {
  const admin = await seedUser({ role: 'admin' });
  const order = makeOrder('pending');
  ctx.orders = [order];

  const res = await patchStatus({
    actor: admin,
    orderId: order._id,
    body: { status: 'shipping' },
  });

  assert.equal(res.status, 409);
  assert.equal(res.body.success, false);
  assert.match(res.body.error, /Không thể chuyển/);
  assert.equal(ctx.orders[0].status, 'pending');
  assert.equal(ctx.casCalls.length, 0);
  assert.equal(events.length, 0);
});

test('PR-4: order khong ton tai tra 404, khong audit', async () => {
  const admin = await seedUser({ role: 'admin' });
  const missingId = new mongoose.Types.ObjectId();
  ctx.findByIdImpl = async () => null;

  const res = await patchStatus({ actor: admin, orderId: missingId });

  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
  assert.equal(ctx.casCalls.length, 0);
  assert.equal(events.length, 0);
});

test('PR-4: CAS conflict (findOneAndUpdate tra null) tra 409, khong audit', async () => {
  const admin = await seedUser({ role: 'admin' });
  const order = makeOrder('pending');
  ctx.orders = [order];
  ctx.findOneAndUpdateImpl = async () => null;

  const res = await patchStatus({ actor: admin, orderId: order._id });

  assert.equal(res.status, 409);
  assert.equal(res.body.success, false);
  assert.match(res.body.error, /thay đổi trạng thái/);
  assert.equal(ctx.casCalls.length, 1);
  assert.equal(String(ctx.casCalls[0].filter._id), String(order._id));
  assert.equal(ctx.casCalls[0].filter.status, 'pending');
  assert.equal(ctx.orders[0].status, 'pending');
  assert.equal(ctx.orders[0].statusHistory.length, 1);
  assert.equal(events.length, 0);
});

test('PR-4: status khong hop le / field ngoai pham vi tra 400, khong audit', async () => {
  const admin = await seedUser({ role: 'admin' });
  const order = makeOrder('pending');
  ctx.orders = [order];

  const badStatus = await patchStatus({
    actor: admin,
    orderId: order._id,
    body: { status: 'approved' },
  });
  const badField = await patchStatus({
    actor: admin,
    orderId: order._id,
    body: { status: 'confirmed', role: 'customer' },
  });

  assert.equal(badStatus.status, 400);
  assert.equal(badField.status, 400);
  assert.equal(ctx.casCalls.length, 0);
  assert.equal(events.length, 0);
});

test('PR-4: csrfProtection dung truoc validate (thieu CSRF -> 403, khong 400)', async () => {
  const admin = await seedUser({ role: 'admin' });
  const order = makeOrder('pending');
  ctx.orders = [order];

  // NODE_ENV=test bypass CSRF; bat tam de kiem tra vi tri middleware.
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  let res;
  try {
    res = await patchStatus({
      actor: admin,
      orderId: order._id,
      body: { status: 'confirmed' },
      withCsrf: false,
    });
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
  }

  assert.equal(res.status, 403);
  assert.equal(res.body.success, false);
  assert.equal(ctx.casCalls.length, 0);
  assert.equal(events.length, 0);
});
