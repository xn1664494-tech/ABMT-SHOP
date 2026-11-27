const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
delete process.env.ORDER_PENDING_TTL_MINUTES;

const {
  installFakeModel,
  createFakeCartModel,
} = require('./support/fakeCartModels');

// Đọc schema/statics thật trước khi cài fake model. Không connect MongoDB.
const RealOrder = require('../src/model/Order');

const NOW = new Date('2026-11-27T12:00:00.000Z');
const TTL_MINUTES = RealOrder.PENDING_TTL_MINUTES;
const userId = new mongoose.Types.ObjectId();
const productId = new mongoose.Types.ObjectId();

const withPatches = async (patches, fn) => {
  const saved = patches.map(([target, key]) => [target, key, target[key]]);
  for (const [target, key, impl] of patches) {
    target[key] = impl;
  }
  try {
    return await fn();
  } finally {
    for (const [target, key, original] of saved) {
      target[key] = original;
    }
  }
};

const isPlainObject = (value) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  !(value instanceof Date) &&
  !(value instanceof mongoose.Types.ObjectId);

const matchesValue = (key, actual, expected) => {
  if (expected === null) return actual === null || actual === undefined;

  if (isPlainObject(expected)) {
    return Object.entries(expected).every(([operator, value]) => {
      if (operator === '$lte') {
        return (
          actual !== null &&
          actual !== undefined &&
          new Date(actual).getTime() <= new Date(value).getTime()
        );
      }
      if (operator === '$gte') {
        return (
          actual !== null &&
          actual !== undefined &&
          new Date(actual).getTime() >= new Date(value).getTime()
        );
      }
      if (operator === '$exists') return (actual !== undefined) === Boolean(value);
      if (operator === '$in') {
        return value.some((item) => matchesValue(key, actual, item));
      }
      if (operator === '$ne') return !matchesValue(key, actual, value);
      throw new Error(`Unsupported fake operator: ${operator}`);
    });
  }

  if (['_id', 'user', 'product', 'sessionId'].includes(key)) {
    return String(actual) === String(expected);
  }
  return actual === expected;
};

const matches = (doc, filter = {}) =>
  Object.entries(filter).every(([key, expected]) => {
    if (key === '$or') return expected.some((part) => matches(doc, part));
    if (key === '$and') return expected.every((part) => matches(doc, part));
    return matchesValue(key, doc[key], expected);
  });

const queryOf = (docs, onLimit) => {
  const list = Array.isArray(docs) ? docs : docs ? [docs] : [];

  const make = (items) => ({
    limit(size) {
      if (onLimit) onLimit(size);
      return make(items.slice(0, size));
    },
    select() {
      return this;
    },
    lean() {
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve(items).then(resolve, reject);
    },
    catch(reject) {
      return Promise.resolve(items).catch(reject);
    },
  });

  return make(list);
};

const oneOf = (doc) => {
  const query = queryOf(doc);
  return {
    then(resolve, reject) {
      return query.then((items) => resolve(items[0] || null), reject);
    },
    catch(reject) {
      return this.then(undefined, reject);
    },
  };
};

const makeOrderStore = () => {
  const state = {
    orders: [],
    snapshot: null,
    calls: { find: [], limits: [], cas: [], updates: [], deletes: [], created: [] },
  };

  const model = {
    PENDING_TTL_MINUTES: RealOrder.PENDING_TTL_MINUTES,
    ORDER_STATUSES: RealOrder.ORDER_STATUSES,
    ORDER_STATUS_FLOW: RealOrder.ORDER_STATUS_FLOW,
    PAYMENT_STATUSES: RealOrder.PAYMENT_STATUSES,
    canTransition: RealOrder.canTransition,
    calculateShippingFee: RealOrder.calculateShippingFee,

    find(filter = {}) {
      state.calls.find.push(filter);
      const source = state.snapshot || state.orders;
      return queryOf(source.filter((order) => matches(order, filter)), (size) =>
        state.calls.limits.push(size)
      );
    },

    findById(id) {
      return oneOf(state.orders.find((order) => String(order._id) === String(id)));
    },

    async findOneAndUpdate(filter, update, options) {
      state.calls.cas.push({ filter, update, options });
      const index = state.orders.findIndex((order) => matches(order, filter));
      if (index < 0) return null;

      const current = state.orders[index];
      const next = { ...current, ...(update.$set || {}) };
      for (const [key, value] of Object.entries(update.$push || {})) {
        next[key] = [...(Array.isArray(current[key]) ? current[key] : []), value];
      }
      state.orders[index] = next;
      return { ...next };
    },

    async updateOne(filter, update) {
      state.calls.updates.push({ filter, update });
      const index = state.orders.findIndex((order) => matches(order, filter));
      if (index < 0) return { matchedCount: 0, modifiedCount: 0 };
      state.orders[index] = { ...state.orders[index], ...(update.$set || {}) };
      return { matchedCount: 1, modifiedCount: 1 };
    },

    async deleteOne(filter) {
      state.calls.deletes.push(filter);
      const index = state.orders.findIndex((order) => matches(order, filter));
      if (index < 0) return { deletedCount: 0 };
      state.orders.splice(index, 1);
      return { deletedCount: 1 };
    },

    async create(doc) {
      const created = {
        _id: new mongoose.Types.ObjectId(),
        createdAt: new Date(),
        expiresAt: null,
        stockRestoredAt: null,
        ...doc,
      };
      state.orders.push(created);
      state.calls.created.push(created);
      return created;
    },
  };

  return { model, state };
};

const makeProductStore = () => {
  const state = { calls: [] };
  return {
    state,
    model: {
      async updateOne(filter, update) {
        state.calls.push({ filter, update });
        return { modifiedCount: 1 };
      },
    },
  };
};

const orders = makeOrderStore();
const products = makeProductStore();
const cart = createFakeCartModel([]);

installFakeModel('../../src/model/Order', orders.model);
installFakeModel('../../src/model/Products', products.model);
installFakeModel('../../src/model/Cart', cart);

const { cancelOrder } = require('../src/services/OrderCancellationService');
const {
  cancelOverdueOrders,
  overdueFilter,
} = require('../src/jobs/cancelOverdueOrders');
const { createOrder } = require('../src/services/CheckoutService');
const {
  runCli,
  parseArgs: parseJobArgs,
} = require('../scripts/run-overdue-orders');
const {
  migrateOrderExpiresAt,
  parseArgs: parseMigrationArgs,
} = require('../scripts/migrate-order-expires-at');

const makeOrder = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  code: 'ORD-20261127-000001',
  user: userId,
  status: 'pending',
  paymentStatus: 'unpaid',
  expiresAt: new Date(NOW.getTime() - 60 * 1000),
  stockRestoredAt: null,
  createdAt: new Date(NOW.getTime() - TTL_MINUTES * 60 * 1000),
  items: [{ product: productId, sku: 'SP-AO-001-M-DEN', qty: 2 }],
  statusHistory: [],
  ...overrides,
});

const silent = (fn) =>
  withPatches(
    [
      [console, 'warn', () => {}],
      [console, 'error', () => {}],
    ],
    fn
  );

test.beforeEach(() => {
  orders.state.orders.length = 0;
  orders.state.snapshot = null;
  for (const key of Object.keys(orders.state.calls)) {
    orders.state.calls[key].length = 0;
  }
  products.state.calls.length = 0;
  cart.carts.length = 0;
});

test('PR5: schema co expiresAt, actorRole va index moi khong sparse', () => {
  assert.equal(TTL_MINUTES, 30);
  assert.equal(RealOrder.schema.path('expiresAt').defaultValue, null);
  assert.equal(
    RealOrder.schema.path('statusHistory').schema.path('actorRole').defaultValue,
    ''
  );

  const indexes = RealOrder.schema.indexes();
  const overdueIndex = indexes.find(
    ([fields]) => fields.status === 1 && fields.paymentStatus === 1 && fields.expiresAt === 1
  );
  assert.ok(overdueIndex, 'thieu index (status, paymentStatus, expiresAt)');
  assert.notEqual(overdueIndex[1].sparse, true);
  assert.ok(
    indexes.some(([fields]) => fields.user === 1 && fields.createdAt === 1)
  );
  assert.ok(
    indexes.some(([fields]) => fields.status === 1 && fields.createdAt === 1)
  );
});

test('PR5: job query dung filter va limit', () => {
  assert.deepEqual(overdueFilter(NOW), {
    status: 'pending',
    paymentStatus: 'unpaid',
    expiresAt: { $lte: NOW },
    $or: [{ stockRestoredAt: null }, { stockRestoredAt: { $exists: false } }],
  });

  orders.state.orders.push(makeOrder());
  return silent(async () => {
    await cancelOverdueOrders({ now: NOW, batchSize: 7 });
    assert.deepEqual(orders.state.calls.limits, [7]);
  });
});

test('PR5: order chua qua han khong bi huy', async () => {
  const order = makeOrder({ expiresAt: new Date(NOW.getTime() + 60 * 1000) });
  orders.state.orders.push(order);

  const summary = await cancelOverdueOrders({ now: NOW, batchSize: 100 });

  assert.deepEqual(summary, { found: 0, cancelled: 0, skipped: 0, failed: 0, errors: [] });
  assert.equal(orders.state.orders[0].status, 'pending');
  assert.equal(orders.state.calls.cas.length, 0);
  assert.equal(products.state.calls.length, 0);
});

test('PR5: order qua han unpaid bi huy va hoan kho dung 1 lan', async () => {
  orders.state.orders.push(makeOrder());

  const summary = await cancelOverdueOrders({ now: NOW, batchSize: 100 });

  assert.deepEqual(summary, { found: 1, cancelled: 1, skipped: 0, failed: 0, errors: [] });
  assert.equal(orders.state.orders[0].status, 'cancelled');
  assert.ok(orders.state.orders[0].stockRestoredAt instanceof Date);
  assert.equal(products.state.calls.length, 1);
  assert.equal(products.state.calls[0].update.$inc['variants.$.stock'], 2);

  const cas = orders.state.calls.cas[0];
  assert.equal(String(cas.filter._id), String(orders.state.orders[0]._id));
  assert.equal(cas.filter.status, 'pending');
  assert.equal(cas.filter.paymentStatus, 'unpaid');
  assert.equal(cas.filter.stockRestoredAt, null);
  assert.equal(cas.update.$push.statusHistory.actorRole, 'system');
  assert.equal(cas.update.$push.statusHistory.note, 'Huy don qua han');
});

test('PR5: order paid du expiresAt qua han van khong bi job chon', async () => {
  const order = makeOrder({ paymentStatus: 'paid' });
  orders.state.orders.push(order);

  const summary = await cancelOverdueOrders({ now: NOW });

  assert.equal(summary.found, 0);
  assert.equal(summary.cancelled, 0);
  assert.equal(orders.state.orders[0].status, 'pending');
  assert.equal(products.state.calls.length, 0);
});

test('PR5: race paid sau khi query bi chan boi check som va CAS', async () => {
  const found = makeOrder();
  orders.state.orders.push({ ...found, paymentStatus: 'paid' });
  orders.state.snapshot = [found];

  const summary = await silent(() => cancelOverdueOrders({ now: NOW }));

  assert.equal(summary.found, 1);
  assert.equal(summary.cancelled, 0);
  assert.equal(summary.skipped, 1);
  assert.equal(summary.failed, 0);
  assert.equal(orders.state.calls.cas.length, 0);
  assert.equal(products.state.calls.length, 0);
});

test('PR5: chay job 2 lan khong double-restock', async () => {
  orders.state.orders.push(makeOrder());

  const first = await cancelOverdueOrders({ now: NOW });
  const second = await cancelOverdueOrders({ now: NOW });

  assert.equal(first.cancelled, 1);
  assert.deepEqual(second, { found: 0, cancelled: 0, skipped: 0, failed: 0, errors: [] });
  assert.equal(products.state.calls.length, 1);
  assert.equal(orders.state.calls.cas.length, 1);
});

test('PR5: hai worker cung thay mot order thi chi 1 thang CAS', async () => {
  const order = makeOrder();
  orders.state.orders.push(order);
  orders.state.snapshot = [{ ...order }];

  const [a, b] = await silent(() =>
    Promise.all([
      cancelOverdueOrders({ now: NOW }),
      cancelOverdueOrders({ now: NOW }),
    ])
  );

  assert.equal(a.cancelled + b.cancelled, 1);
  assert.equal(a.skipped + b.skipped, 1);
  assert.equal(a.failed + b.failed, 0);
  assert.equal(orders.state.calls.cas.length, 2);
  assert.equal(orders.state.orders[0].status, 'cancelled');
  assert.equal(products.state.calls.length, 1);
});

test('PR5: system cancel paid khong expected van bi tu choi', async () => {
  const order = makeOrder({ paymentStatus: 'paid' });
  orders.state.orders.push(order);

  const error = await silent(() =>
    cancelOrder({
      orderId: order._id,
      actorRole: 'system',
      actorId: null,
    }).catch((err) => err)
  );

  assert.equal(error.statusCode, 409);
  assert.equal(error.code, 'ORDER_PAYMENT_CONFLICT');
  assert.equal(orders.state.calls.cas.length, 0);
  assert.equal(products.state.calls.length, 0);
});

test('PR5: system expected sai tra conflict truoc CAS', async () => {
  const order = makeOrder();
  orders.state.orders.push(order);

  const error = await silent(() =>
    cancelOrder({
      orderId: order._id,
      actorRole: 'system',
      actorId: null,
      expectedPaymentStatus: 'refunded',
    }).catch((err) => err)
  );

  assert.equal(error.statusCode, 409);
  assert.equal(error.code, 'ORDER_PAYMENT_CONFLICT');
  assert.equal(orders.state.calls.cas.length, 0);
  assert.equal(products.state.calls.length, 0);
});

test('PR5: customer/admin truyen expected van giu rule cu', async () => {
  const customerOrder = makeOrder();
  const adminOrder = makeOrder({ status: 'confirmed' });
  orders.state.orders.push(customerOrder, adminOrder);

  await cancelOrder({
    orderId: customerOrder._id,
    actorRole: 'customer',
    actorId: userId,
    isOwner: true,
    expectedPaymentStatus: 'refunded',
  });
  await cancelOrder({
    orderId: adminOrder._id,
    actorRole: 'admin',
    actorId: userId,
    isOwner: false,
    expectedPaymentStatus: 'paid',
  });

  assert.equal(orders.state.calls.cas.length, 2);
  for (const call of orders.state.calls.cas) {
    assert.equal(call.filter.paymentStatus, undefined);
    assert.equal(call.filter.stockRestoredAt, null);
  }
  assert.equal(products.state.calls.length, 2);
});

const checkoutPayload = () => ({
  items: [
    {
      product: productId,
      name: 'Ao Thun Basic',
      sku: 'SP-AO-001-M-DEN',
      qty: 1,
      unitPrice: 199000,
      lineTotal: 199000,
    },
  ],
  shippingAddress: {
    fullName: 'Nguyen Van A',
    phone: '0912345678',
    province: 'Ha Noi',
    ward: 'Dich Vong',
    detail: '1 Nguyen Trai',
  },
  paymentMethod: 'cod',
  subtotal: 199000,
  shippingFee: 30000,
  discount: 0,
  total: 229000,
  note: '',
});

test('PR5: checkout gan expiresAt dung TTL va giu thu tu tru kho -> order -> xoa gio', async () => {
  const calls = [];
  const fixedNow = NOW.getTime();

  await withPatches(
    [
      [Date, 'now', () => fixedNow],
      [
        cart,
        'deleteOne',
        async () => {
          calls.push('cart');
          return { deletedCount: 1 };
        },
      ],
    ],
    async () => {
      const created = await createOrder({
        userId,
        orderPayload: checkoutPayload(),
      });
      calls.push('order');
      assert.deepEqual(created.expiresAt, new Date(fixedNow + TTL_MINUTES * 60 * 1000));
    }
  );

  assert.equal(products.state.calls.length, 1);
  assert.deepEqual(calls, ['cart', 'order']);
  assert.equal(orders.state.calls.created[0].expiresAt.getTime(), fixedNow + TTL_MINUTES * 60 * 1000);
});

test('PR5: compensation xoa gio that bai van xoa don va hoan kho', async () => {
  const fixedNow = NOW.getTime();

  await withPatches(
    [
      [Date, 'now', () => fixedNow],
      [cart, 'deleteOne', async () => ({ deletedCount: 0 })],
    ],
    async () => {
      const error = await createOrder({
        userId,
        orderPayload: checkoutPayload(),
      }).catch((err) => err);

      assert.equal(error.statusCode, 409);
      assert.match(error.message, /Giỏ hàng đã thay đổi/);
    }
  );

  assert.equal(orders.state.calls.deletes.length, 1);
  assert.equal(orders.state.calls.deletes[0].status, 'pending');
  assert.equal(orders.state.orders.length, 0);
  assert.equal(products.state.calls.length, 2);
  assert.equal(products.state.calls[0].update.$inc['variants.$.stock'], -1);
  assert.equal(products.state.calls[1].update.$inc['variants.$.stock'], 1);
});

test('PR5: runner dry-run chi dem, khong goi execute', async () => {
  let executeCalls = 0;
  const lines = [];

  const summary = await runCli({
    argv: ['--dry-run', '--batch=7'],
    find: async ({ batchSize }) => {
      assert.equal(batchSize, 7);
      return [makeOrder(), makeOrder()];
    },
    execute: async () => {
      executeCalls += 1;
      throw new Error('khong duoc goi');
    },
    now: NOW,
    log: (line) => lines.push(line),
  });

  assert.deepEqual(summary, { found: 2, cancelled: 0, skipped: 0, failed: 0, errors: [] });
  assert.equal(executeCalls, 0);
  assert.match(lines[0], /DRY-RUN/);
  assert.match(lines[0], /timThay=2/);
  assert.match(lines[0], /daHuy=0/);
});

test('PR5: runner apply chay that va in cac so', async () => {
  const lines = [];
  let received = null;

  const summary = await runCli({
    argv: ['--batch=3'],
    find: async () => {
      throw new Error('khong duoc goi');
    },
    execute: async (options) => {
      received = options;
      return { found: 3, cancelled: 2, skipped: 1, failed: 0, errors: [] };
    },
    now: NOW,
    log: (line) => lines.push(line),
  });

  assert.equal(summary.cancelled, 2);
  assert.equal(received.batchSize, 3);
  assert.equal(received.now, NOW);
  assert.match(lines[0], /APPLY/);
  assert.match(lines[0], /timThay=3 daHuy=2 boQua=1 loi=0/);
});

test('PR5: parse args cua runner va migration', () => {
  assert.deepEqual(parseJobArgs([]), { dryRun: false, batchSize: 100 });
  assert.deepEqual(parseJobArgs(['--dry-run', '--batch=25']), {
    dryRun: true,
    batchSize: 25,
  });
  assert.deepEqual(parseMigrationArgs([]), { apply: false });
  assert.deepEqual(parseMigrationArgs(['--apply']), { apply: true });
  assert.throws(() => parseJobArgs(['--batch=0']), /--batch/);
  assert.throws(() => parseMigrationArgs(['--apply=true']), /--apply=true/);
});

test('PR5: migration dry-run khong ghi DB', async () => {
  orders.state.orders.push(
    makeOrder({ expiresAt: null }),
    makeOrder({ expiresAt: undefined })
  );
  const lines = [];

  const summary = await migrateOrderExpiresAt({
    apply: false,
    OrderModel: orders.model,
    log: (line) => lines.push(line),
  });

  assert.equal(summary.found, 2);
  assert.equal(summary.planned, 2);
  assert.equal(summary.updated, 0);
  assert.equal(orders.state.calls.updates.length, 0);
  assert.match(lines[0], /DRY-RUN/);
  assert.match(lines[0], /duKienCapNhat=2/);
});

test('PR5: migration apply backfill createdAt + TTL va chay lai khong doi', async () => {
  const legacyA = makeOrder({ expiresAt: null });
  const legacyB = makeOrder({ expiresAt: undefined });
  const fresh = makeOrder({ expiresAt: new Date(NOW.getTime() + 1000) });
  orders.state.orders.push(legacyA, legacyB, fresh);

  const first = await migrateOrderExpiresAt({
    apply: true,
    OrderModel: orders.model,
    log: () => {},
  });

  assert.equal(first.found, 2);
  assert.equal(first.planned, 2);
  assert.equal(first.updated, 2);
  assert.deepEqual(
    orders.state.orders[0].expiresAt,
    new Date(legacyA.createdAt.getTime() + TTL_MINUTES * 60 * 1000)
  );
  assert.deepEqual(
    orders.state.orders[1].expiresAt,
    new Date(legacyB.createdAt.getTime() + TTL_MINUTES * 60 * 1000)
  );
  assert.deepEqual(orders.state.orders[2].expiresAt, fresh.expiresAt);
  assert.equal(orders.state.calls.updates.length, 2);

  const second = await migrateOrderExpiresAt({
    apply: true,
    OrderModel: orders.model,
    log: () => {},
  });
  assert.equal(second.found, 0);
  assert.equal(second.updated, 0);
  assert.equal(orders.state.calls.updates.length, 2);
});
