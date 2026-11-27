const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { installFakeModel } = require('./support/fakeCartModels');

// Chỉ lấy static flow/canTransition thật (không kết nối DB), còn đọc/ghi dùng fake model.
const RealOrder = require('../src/model/Order');

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
  Promise.resolve(ctx.orders.find((order) => String(order._id) === String(id)) || null);

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

/**
 * Fake Order model cài vào require cache trước khi service được require.
 * Vẫn dùng nguyên static canTransition/ORDER_STATUS_FLOW của model thật.
 */
const fakeOrderModel = {
  canTransition: RealOrder.canTransition,
  ORDER_STATUS_FLOW: RealOrder.ORDER_STATUS_FLOW,
  findById(id) {
    return (ctx.findByIdImpl || defaultFindById)(id);
  },
  findOneAndUpdate(filter, update, options) {
    ctx.casCalls.push({ filter, update, options });
    return (ctx.findOneAndUpdateImpl || defaultFindOneAndUpdate)(
      filter,
      update,
      options
    );
  },
};

installFakeModel('../../src/model/Order', fakeOrderModel);

const { transitionOrderStatus } = require('../src/services/orderStateMachine');

const makeOrder = (status = 'pending', overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  user: new mongoose.Types.ObjectId(),
  status,
  statusHistory: [
    {
      status: 'pending',
      at: new Date('2026-01-01T00:00:00.000Z'),
      by: new mongoose.Types.ObjectId(),
      note: '',
    },
  ],
  ...overrides,
});

const setup = (orders = [makeOrder()]) => {
  ctx.orders = orders;
  ctx.casCalls = [];
  ctx.findByIdImpl = null;
  ctx.findOneAndUpdateImpl = null;
  return orders[0];
};

const transition = (overrides = {}) =>
  transitionOrderStatus({
    orderId: ctx.orders[0] && ctx.orders[0]._id,
    to: 'confirmed',
    actorRole: 'admin',
    actorId: new mongoose.Types.ObjectId(),
    note: '',
    ...overrides,
  });

const expectError = async (promise, statusCode, code) => {
  const error = await promise.then(
    () => null,
    (err) => err
  );
  assert.ok(error, 'phong doi loi');
  assert.equal(error.statusCode, statusCode);
  assert.equal(error.code, code);
  return error;
};

test('T5-1-2: service dung lai static flow/canTransition cua Order', () => {
  assert.equal(fakeOrderModel.canTransition, RealOrder.canTransition);
  assert.equal(fakeOrderModel.ORDER_STATUS_FLOW, RealOrder.ORDER_STATUS_FLOW);
  assert.equal(typeof transitionOrderStatus, 'function');
});

test('T5-1-2: admin chuyen hop le theo moi canh cua flow', async () => {
  const cases = [
    ['pending', 'confirmed'],
    ['confirmed', 'shipping'],
    ['shipping', 'delivered'],
    ['pending', 'cancelled'],
    ['confirmed', 'cancelled'],
  ];

  for (const [from, to] of cases) {
    const order = setup([makeOrder(from)]);
    const result = await transition({ to, actorRole: 'admin' });

    assert.equal(result.from, from);
    assert.equal(result.order.status, to);
    assert.equal(String(result.order._id), String(order._id));
    assert.deepEqual(ctx.casCalls[0].filter, { _id: order._id, status: from });
    assert.equal(ctx.casCalls[0].update.$set.status, to);
    assert.equal(ctx.casCalls[0].options.new, true);
    assert.equal(ctx.casCalls[0].options.runValidators, true);
  }
});

test('T5-1-2: skip, backward va trang thai khong hop le tra 409, khong CAS', async () => {
  const cases = [
    ['pending', 'shipping'],
    ['pending', 'delivered'],
    ['confirmed', 'pending'],
    ['shipping', 'confirmed'],
    ['delivered', 'cancelled'],
    ['cancelled', 'pending'],
    ['pending', 'unknown'],
    ['unknown', 'confirmed'],
  ];

  for (const [from, to] of cases) {
    setup([makeOrder(from)]);
    await expectError(
      transition({ to, actorRole: 'admin' }),
      409,
      'ORDER_INVALID_TRANSITION'
    );
    assert.equal(ctx.casCalls.length, 0, `khong duoc CAS cho ${from} -> ${to}`);
  }
});

test('T5-1-2: customer/system chi duoc pending -> cancelled', async () => {
  for (const actorRole of ['customer', 'system']) {
    setup([makeOrder('pending')]);
    const result = await transition({
      to: 'cancelled',
      actorRole,
      actorId: new mongoose.Types.ObjectId(),
    });
    assert.equal(result.from, 'pending');
    assert.equal(result.order.status, 'cancelled');
    assert.equal(ctx.casCalls[0].update.$set.status, 'cancelled');
    assert.equal(ctx.orders[0].status, 'cancelled');
  }

  const forbidden = [
    ['customer', 'confirmed', 'cancelled'],
    ['customer', 'confirmed', 'shipping'],
    ['customer', 'shipping', 'delivered'],
    ['system', 'confirmed', 'cancelled'],
    ['system', 'confirmed', 'shipping'],
    ['system', 'shipping', 'delivered'],
    ['manager', 'pending', 'cancelled'],
  ];

  for (const [actorRole, from, to] of forbidden) {
    setup([makeOrder(from)]);
    await expectError(
      transition({ to, actorRole }),
      403,
      'ORDER_FORBIDDEN_ROLE'
    );
    assert.equal(ctx.casCalls.length, 0, `khong duoc CAS cho ${actorRole}`);
  }
});

test('T5-1-2: order khong ton tai tra 404', async () => {
  setup([]);
  ctx.findByIdImpl = async () => null;

  await expectError(transition(), 404, 'ORDER_NOT_FOUND');
  assert.equal(ctx.casCalls.length, 0);
});

test('T5-1-2: CAS tra null -> 409 conflict va khong ghi history gia', async () => {
  const order = setup([makeOrder('pending')]);
  const historyBefore = order.statusHistory.length;

  ctx.findOneAndUpdateImpl = async () => null;

  const error = await expectError(transition(), 409, 'ORDER_STATUS_CONFLICT');
  assert.match(error.message, /thay đổi/);

  assert.equal(ctx.casCalls.length, 1);
  assert.equal(order.status, 'pending');
  assert.equal(order.statusHistory.length, historyBefore);
  assert.deepEqual(ctx.casCalls[0].filter, { _id: order._id, status: 'pending' });
  assert.equal(ctx.casCalls[0].update.$push.statusHistory.status, 'confirmed');
});

test('T5-1-2: concurrent 2 request chi 1 thang CAS', async () => {
  setup([makeOrder('pending')]);

  const outcomes = await Promise.all([
    transition({
      to: 'confirmed',
      actorRole: 'admin',
      actorId: new mongoose.Types.ObjectId(),
    }).then(
      () => 'win',
      (err) => err.code
    ),
    transition({
      to: 'confirmed',
      actorRole: 'admin',
      actorId: new mongoose.Types.ObjectId(),
    }).then(
      () => 'win',
      (err) => err.code
    ),
  ]);

  assert.equal(outcomes.filter((outcome) => outcome === 'win').length, 1);
  assert.equal(outcomes.filter((outcome) => outcome === 'ORDER_STATUS_CONFLICT').length, 1);
  assert.equal(ctx.orders[0].status, 'confirmed');
  assert.equal(ctx.orders[0].statusHistory.length, 2);
  assert.equal(ctx.casCalls.length, 2);
});

test('T5-1-2: history co by/note/at, role marker va actorRole trong payload', async () => {
  const actorId = new mongoose.Types.ObjectId();
  setup([makeOrder('pending')]);

  const result = await transition({
    to: 'confirmed',
    actorRole: 'admin',
    actorId,
    note: 'xac nhan don',
  });

  const entry = ctx.casCalls[0].update.$push.statusHistory;
  assert.equal(entry.status, 'confirmed');
  assert.equal(String(entry.by), String(actorId));
  assert.ok(entry.at instanceof Date);
  assert.equal(entry.note, '[role:admin] xac nhan don');
  assert.match(entry.note, /^\[role:admin\]/);
  assert.equal(entry.actorRole, 'admin');
  assert.equal(result.from, 'pending');
  assert.equal(result.order.statusHistory.length, 2);
  assert.equal(result.order.statusHistory[1].actorRole, 'admin');

  setup([makeOrder('pending')]);
  await transition({
    to: 'cancelled',
    actorRole: 'system',
    actorId: 'not-an-object-id',
    note: '',
  });
  const systemEntry = ctx.casCalls[0].update.$push.statusHistory;
  assert.equal(systemEntry.by, null);
  assert.equal(systemEntry.note, '[role:system]');
  assert.equal(systemEntry.actorRole, 'system');
});
