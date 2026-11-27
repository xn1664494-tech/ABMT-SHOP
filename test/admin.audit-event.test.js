const test = require('node:test');
const assert = require('node:assert/strict');

const {
  AUDIT_ACTIONS,
  TARGET_TYPES,
  buildAuditEvent,
  publishAuditEvent,
  setAuditPublisher,
} = require('../src/services/auditEvent');

test('T5-1-3/T6-1-2: buildAuditEvent tra dung contract 7 field', () => {
  const event = buildAuditEvent({
    actorId: 12,
    actorRole: 'admin',
    action: AUDIT_ACTIONS.ADMIN_ROLE_CHANGED,
    targetType: TARGET_TYPES.USER,
    targetId: 34,
    before: { role: 'customer' },
    after: { role: 'admin' },
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
  assert.equal(event.action, 'admin.user.role.changed');
  assert.deepEqual(event.before, { role: 'customer' });
  assert.deepEqual(event.after, { role: 'admin' });
});

test('T5-1-3/T6-1-2: publisher mac dinh la no-op va co the thay the', async () => {
  setAuditPublisher(undefined);
  await assert.doesNotReject(publishAuditEvent(buildAuditEvent({})));

  const received = [];
  setAuditPublisher(async (event) => received.push(event));
  const event = buildAuditEvent({ actorId: 'a', targetId: 'b' });
  await publishAuditEvent(event);

  assert.equal(received.length, 1);
  assert.equal(received[0], event);

  setAuditPublisher(undefined);
});

test('PR6: AUDIT_ACTIONS co action he thong', () => {
  assert.equal(AUDIT_ACTIONS.SYSTEM_ORDER_EXPIRED, 'system.order.expired');
});

test('PR6: publisher loi duoc fail-open va log structured', async () => {
  const logs = [];
  const originalError = console.error;
  console.error = (line) => logs.push(line);

  setAuditPublisher(async () => {
    throw new Error('audit down');
  });

  try {
    await assert.doesNotReject(
      publishAuditEvent(
        buildAuditEvent({
          actorId: 'a',
          actorRole: 'admin',
          action: AUDIT_ACTIONS.ADMIN_ORDER_STATUS_CHANGED,
          targetType: TARGET_TYPES.ORDER,
          targetId: 'o',
        })
      )
    );
  } finally {
    setAuditPublisher(undefined);
    console.error = originalError;
  }

  assert.equal(logs.length, 1);
  const logged = JSON.parse(logs[0]);
  assert.equal(logged.level, 'error');
  assert.equal(logged.scope, 'audit');
  assert.equal(logged.action, AUDIT_ACTIONS.ADMIN_ORDER_STATUS_CHANGED);
  assert.equal(logged.targetType, TARGET_TYPES.ORDER);
  assert.equal(logged.targetId, 'o');
  assert.equal(logged.actorId, 'a');
  assert.equal(logged.actorRole, 'admin');
  assert.equal(logged.message, 'audit down');
});
