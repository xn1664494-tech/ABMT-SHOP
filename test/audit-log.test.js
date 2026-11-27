const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { Types } = require('mongoose');

process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.NODE_ENV = 'test';
process.env.APP_ORIGIN = 'http://localhost:3000';

const { installFakeModel } = require('./support/fakeCartModels');
const {
  createFakeUserModel,
  installFakeUserModel,
} = require('./support/fakeUserModel');

// Fake AuditLog duoc cai truoc khi require app/service: khong mongoose.connect,
// khong .env that, khong ghi DB.
const createFakeAuditLogModel = (logs = []) => {
  const matches = (log, filter = {}) =>
    Object.entries(filter).every(([key, expected]) =>
      ['actorId', 'action', 'targetType', 'targetId'].includes(key)
        ? String(log[key]) === String(expected)
        : log[key] === expected,
    );

  const createQuery = (input) => {
    let result = [...input];

    const query = {
      select() {
        return query;
      },
      setOptions() {
        return query;
      },
      sort(spec = {}) {
        const entries = Object.entries(spec);
        result = [...result].sort((left, right) => {
          for (const [key, direction] of entries) {
            const a = left[key] instanceof Date ? left[key].getTime() : left[key];
            const b = right[key] instanceof Date ? right[key].getTime() : right[key];
            if (a === b) continue;
            return a > b ? (direction < 0 ? -1 : 1) : direction < 0 ? 1 : -1;
          }
          return 0;
        });
        return query;
      },
      skip(count = 0) {
        result = result.slice(count);
        return query;
      },
      limit(count) {
        if (Number.isInteger(count) && count >= 0) {
          result = result.slice(0, count);
        }
        return query;
      },
      lean() {
        return Promise.resolve(result);
      },
      then(resolve, reject) {
        return Promise.resolve(result).then(resolve, reject);
      },
      catch(reject) {
        return Promise.resolve(result).catch(reject);
      },
    };

    return query;
  };

  return {
    logs,
    async create(doc) {
      const entry = { _id: `log-${logs.length + 1}`, ...doc };
      logs.push(entry);
      return entry;
    },
    find(filter = {}) {
      return createQuery(logs.filter((log) => matches(log, filter)));
    },
    async countDocuments(filter = {}) {
      return logs.filter((log) => matches(log, filter)).length;
    },
  };
};

const fakeAuditLogModel = createFakeAuditLogModel();
installFakeModel('../../src/model/AuditLog', fakeAuditLogModel);

const fakeUserModel = createFakeUserModel();
installFakeUserModel(fakeUserModel);

const request = require('supertest');
const app = require('../src/app');
const {
  AUDIT_ACTIONS,
  TARGET_TYPES,
  buildAuditEvent,
  setAuditPublisher,
} = require('../src/services/auditEvent');
const {
  writeAuditLog,
  installAuditLogPublisher,
  listAuditLogs,
} = require('../src/services/auditLogService');
const { updateUserRole } = require('../src/services/adminUserService');

const seedUser = (overrides = {}) =>
  fakeUserModel.create({
    _id: new Types.ObjectId().toString(),
    name: 'Nguoi Dung',
    email: `user-${fakeUserModel.users.length + 1}@example.com`,
    password: '$2a$10$abcdefghijklmnopqrstuv',
    role: 'customer',
    status: 'active',
    isDeleted: false,
    tokenVersion: 0,
    ...overrides,
  });

const accessCookie = (user) =>
  `accessToken=${jwt.sign(
    {
      sub: String(user._id),
      role: user.role,
      ver: user.tokenVersion || 0,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '15m',
      issuer: 'abmt-shop',
      audience: 'abmt-shop-client',
    },
  )}`;

const seedLog = (overrides = {}) =>
  writeAuditLog(
    buildAuditEvent({
      actorId: 'actor-a',
      actorRole: 'admin',
      action: AUDIT_ACTIONS.ADMIN_ROLE_CHANGED,
      targetType: TARGET_TYPES.USER,
      targetId: 'u1',
      before: { role: 'customer' },
      after: { role: 'admin' },
      ...overrides,
    }),
  );

test.beforeEach(() => {
  fakeAuditLogModel.logs.length = 0;
  fakeUserModel.users.length = 0;
  setAuditPublisher(undefined);
});

// ---------------------------------------------------------------------------
// Contract su kien: giu nguyen 7 field cua buildAuditEvent
// ---------------------------------------------------------------------------

test('T6-1-2: buildAuditEvent van tra dung 7 field, constants moi khong doi cu', () => {
  const event = buildAuditEvent({
    actorId: 12,
    actorRole: 'admin',
    action: AUDIT_ACTIONS.ADMIN_ORDER_STATUS_CHANGED,
    targetType: TARGET_TYPES.ORDER,
    targetId: 34,
    before: { status: 'pending' },
    after: { status: 'confirmed' },
  });

  assert.deepEqual(Object.keys(event).sort(), [
    'action',
    'actorId',
    'actorRole',
    'after',
    'before',
    'targetId',
    'targetType',
  ]);
  assert.equal(event.actorId, '12');
  assert.equal(event.targetId, '34');
  assert.equal(AUDIT_ACTIONS.ADMIN_ROLE_CHANGED, 'admin.user.role.changed');
  assert.equal(AUDIT_ACTIONS.ADMIN_ORDER_STATUS_CHANGED, 'admin.order.status.changed');
  assert.equal(TARGET_TYPES.USER, 'User');
  assert.equal(TARGET_TYPES.ORDER, 'Order');
  assert.equal(event.action, 'admin.order.status.changed');
  assert.equal(event.targetType, 'Order');
});

// ---------------------------------------------------------------------------
// writeAuditLog: sanitize sau + timestamp do he thong gan
// ---------------------------------------------------------------------------

test('T6-1-2: writeAuditLog sanitize sensitive key trong before/after va gan timestamp moi', async () => {
  const before = {
    role: 'customer',
    password: 'plain-password',
    passwordHash: '$2a$10$passwordhash',
    token: 'jwt-token',
    resetPasswordTokenHash: 'reset-hash',
  };
  const after = {
    role: 'admin',
    AUTHOrization: 'Bearer secret-token',
    'Set-Cookie': 'session=cookie-value',
    clientSecret: 'client-secret-value',
    nested: {
      apiToken: 'nested-token',
      keep: 'visible',
      list: [{ csrfToken: 'csrf-value', value: 'kept' }],
    },
  };
  const staleTimestamp = new Date('2000-01-01T00:00:00.000Z');
  const event = {
    ...buildAuditEvent({
      actorId: 'actor-a',
      actorRole: 'admin',
      action: 'test.action',
      targetType: 'User',
      targetId: 'u1',
      before,
      after,
    }),
    timestamp: staleTimestamp,
  };

  const created = await writeAuditLog(event);

  assert.equal(fakeAuditLogModel.logs.length, 1);
  assert.deepEqual(created.before, { role: 'customer' });
  assert.deepEqual(created.after, {
    role: 'admin',
    nested: { keep: 'visible', list: [{ value: 'kept' }] },
  });
  assert.ok(created.timestamp instanceof Date);
  assert.notEqual(created.timestamp.getTime(), staleTimestamp.getTime());

  const serialized = JSON.stringify(created);
  for (const secret of [
    'plain-password',
    '$2a$10$passwordhash',
    'jwt-token',
    'reset-hash',
    'secret-token',
    'cookie-value',
    'client-secret-value',
    'nested-token',
    'csrf-value',
  ]) {
    assert.equal(serialized.includes(secret), false, `leak: ${secret}`);
  }

  // Khong lam thay doi event nguon truyen vao.
  assert.equal(before.password, 'plain-password');
  assert.equal(after.nested.apiToken, 'nested-token');
});

test('T6-1-2: writeAuditLog that bai khong de lai ban ghi gia', async () => {
  const originalCreate = fakeAuditLogModel.create;
  fakeAuditLogModel.create = async () => {
    throw new Error('audit store unavailable');
  };

  try {
    await assert.rejects(
      () => writeAuditLog(buildAuditEvent({ actorId: 'a', targetId: 'b' })),
      /audit store unavailable/,
    );
    assert.equal(fakeAuditLogModel.logs.length, 0);
  } finally {
    fakeAuditLogModel.create = originalCreate;
  }
});

// ---------------------------------------------------------------------------
// Publisher: doi role phat dung 1 event; that bai khong ghi event
// ---------------------------------------------------------------------------

test('T6-1-2: doi role phat dung 1 event qua publisher that', async () => {
  const admin = await seedUser({ role: 'admin' });
  const target = await seedUser({ role: 'customer' });

  // Fake User mac dinh cap nhat ngay tren doi tuong ma findById tra ve, lam
  // snapshot `before` bi doi theo. Mongoose tra document rieng; o day ta mo
  // phong hanh vi do bang cach thay the phan tu trong mang fake.
  const originalFindByIdAndUpdate = fakeUserModel.findByIdAndUpdate;
  fakeUserModel.findByIdAndUpdate = async (id, update = {}, options = {}) => {
    const index = fakeUserModel.users.findIndex(
      (item) => String(item._id).toLowerCase() === String(id).toLowerCase(),
    );
    if (index === -1) return null;
    const updated = { ...fakeUserModel.users[index], ...(update.$set || {}) };
    fakeUserModel.users[index] = updated;
    return options.new ? { ...updated } : updated;
  };

  try {
    installAuditLogPublisher();
    const result = await updateUserRole({
      targetUserId: String(target._id),
      role: 'admin',
      actor: admin,
    });

    assert.equal(result.changed, true);
    assert.equal(fakeAuditLogModel.logs.length, 1);
    const log = fakeAuditLogModel.logs[0];
    assert.equal(log.actorId, String(admin._id));
    assert.equal(log.actorRole, 'admin');
    assert.equal(log.action, AUDIT_ACTIONS.ADMIN_ROLE_CHANGED);
    assert.equal(log.targetType, TARGET_TYPES.USER);
    assert.equal(log.targetId, String(target._id));
    assert.deepEqual(log.before, { role: 'customer' });
    assert.deepEqual(log.after, { role: 'admin' });
    assert.ok(log.timestamp instanceof Date);
  } finally {
    fakeUserModel.findByIdAndUpdate = originalFindByIdAndUpdate;
  }
});

test('T6-1-2: that bai hoac khong doi role thi khong ghi event gia', async () => {
  const admin = await seedUser({ role: 'admin' });
  installAuditLogPublisher();

  await assert.rejects(
    () =>
      updateUserRole({
        targetUserId: '64b000000000000000000000',
        role: 'admin',
        actor: admin,
      }),
    /khong ton tai/i,
  );
  assert.equal(fakeAuditLogModel.logs.length, 0);

  const target = await seedUser({ role: 'customer' });
  const unchanged = await updateUserRole({
    targetUserId: String(target._id),
    role: 'customer',
    actor: admin,
  });
  assert.equal(unchanged.changed, false);
  assert.equal(fakeAuditLogModel.logs.length, 0);
});

// ---------------------------------------------------------------------------
// GET /api/admin/audit-logs
// ---------------------------------------------------------------------------

test('T6-1-2: admin GET 200 co phan trang, khong can CSRF', async () => {
  const admin = await seedUser({ role: 'admin' });
  await seedLog();
  await seedLog();

  // Khong gui CSRF token/cookie: GET phai di thang.
  const res = await request(app)
    .get('/api/admin/audit-logs')
    .set('Cookie', accessCookie(admin));

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(Array.isArray(res.body.data.items), true);
  assert.equal(res.body.data.items.length, 2);
  assert.deepEqual(Object.keys(res.body.data.items[0]).sort(), [
    'action',
    'actorId',
    'actorRole',
    'after',
    'before',
    'id',
    'targetId',
    'targetType',
    'timestamp',
  ]);
  assert.deepEqual(res.body.data.pagination, {
    page: 1,
    limit: 20,
    total: 2,
    totalPages: 1,
    itemCount: 2,
  });
});

test('T6-1-2: customer GET bi tu choi 403, guest 401', async () => {
  const customer = await seedUser({ role: 'customer' });

  const denied = await request(app)
    .get('/api/admin/audit-logs')
    .set('Cookie', accessCookie(customer));
  const guest = await request(app).get('/api/admin/audit-logs');

  assert.equal(denied.status, 403);
  assert.equal(denied.body.success, false);
  assert.equal(guest.status, 401);
});

test('T6-1-2: filter actor/action/targetType/targetId va phan trang hoat dong', async () => {
  const admin = await seedUser({ role: 'admin' });

  await seedLog({
    actorId: 'actor-a',
    action: AUDIT_ACTIONS.ADMIN_ROLE_CHANGED,
    targetType: TARGET_TYPES.USER,
    targetId: 'u1',
  });
  await seedLog({
    actorId: 'actor-b',
    action: AUDIT_ACTIONS.ADMIN_ORDER_STATUS_CHANGED,
    targetType: TARGET_TYPES.ORDER,
    targetId: 'o1',
  });
  await seedLog({
    actorId: 'actor-a',
    action: AUDIT_ACTIONS.ADMIN_ORDER_STATUS_CHANGED,
    targetType: TARGET_TYPES.ORDER,
    targetId: 'o2',
  });

  const get = (query) =>
    request(app)
      .get(`/api/admin/audit-logs?${query}`)
      .set('Cookie', accessCookie(admin));

  const byActor = await get('actorId=actor-a');
  const byAction = await get(`action=${AUDIT_ACTIONS.ADMIN_ORDER_STATUS_CHANGED}`);
  const byTargetType = await get('targetType=Order');
  const byTargetId = await get('targetId=u1');
  const combined = await get(
    `actorId=actor-a&action=${AUDIT_ACTIONS.ADMIN_ORDER_STATUS_CHANGED}&targetType=Order&targetId=o2`,
  );
  const secondPage = await get('page=2&limit=1');

  assert.equal(byActor.body.data.items.length, 2);
  assert.equal(byAction.body.data.items.length, 2);
  assert.equal(byTargetType.body.data.items.length, 2);
  assert.deepEqual(
    byTargetId.body.data.items.map((item) => item.targetId),
    ['u1'],
  );
  assert.deepEqual(
    combined.body.data.items.map((item) => item.targetId),
    ['o2'],
  );
  assert.equal(secondPage.body.data.pagination.page, 2);
  assert.equal(secondPage.body.data.pagination.limit, 1);
  assert.equal(secondPage.body.data.pagination.total, 3);
  assert.equal(secondPage.body.data.items.length, 1);

  // Service tra ve dung shape { items, pagination }.
  const listed = await listAuditLogs({ actorId: 'actor-b' });
  assert.deepEqual(Object.keys(listed).sort(), ['items', 'pagination']);
  assert.equal(listed.items.length, 1);
});

test('T6-1-2: khong co endpoint update/delete audit log', async () => {
  const admin = await seedUser({ role: 'admin' });
  await seedLog();

  // Mini app chi mount admin router: khong di qua navCategories (DB) nhu app
  // chinh, nen request 404 khong doi buffer timeout cua Mongoose.
  const miniApp = express();
  miniApp.use(express.json());
  miniApp.use(cookieParser());
  miniApp.use('/api/admin', require('../src/routes/admin.route'));
  miniApp.use((req, res) =>
    res.status(404).json({ success: false, error: 'Route not found' }),
  );

  for (const method of ['post', 'patch', 'delete']) {
    const res = await request(miniApp)[method]('/api/admin/audit-logs/log-1')
      .set('Cookie', accessCookie(admin))
      .send({ after: { role: 'admin' } });

    assert.equal(res.status, 404, `${method} khong duoc phep`);
  }
  assert.equal(fakeAuditLogModel.logs.length, 1);
});
