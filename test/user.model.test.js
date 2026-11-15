const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const User = require('../src/model/User');

test('T3-1-1: User model khai bao dung schema toi thieu', () => {
  assert.equal(User.modelName, 'User');
  for (const field of ['name', 'email', 'passwordHash', 'role', 'status']) {
    assert.ok(User.schema.path(field), `thieu field ${field}`);
  }
  assert.equal(User.schema.path('role').defaultValue, 'customer');
  assert.equal(User.schema.path('status').defaultValue, 'active');
  assert.equal(User.schema.path('email').options.unique, true);
  assert.equal(User.schema.path('passwordHash').options.select, false);
});

test('T3-1-1: toJSON loai bo passwordHash', () => {
  const doc = new User({
    name: 'Nguyen Van A',
    email: 'a@example.com',
    passwordHash: 'hashed-value',
  });

  const json = doc.toJSON();
  assert.equal(json.passwordHash, undefined);
  assert.equal(json.email, 'a@example.com');
});

test('T3-1-1: role ngoai enum bi tu choi', async () => {
  const doc = new User({
    name: 'Nguyen Van A',
    email: 'a@example.com',
    passwordHash: 'hashed-value',
    role: 'superadmin',
  });

  const error = await doc.validate().catch((err) => err);
  assert.ok(error);
  assert.ok(error.errors.role);
});

test.after(() => {
  mongoose.deleteModel(/User/);
});
