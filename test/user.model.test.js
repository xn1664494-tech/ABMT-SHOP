const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const User = require('../src/model/User');

test('T2-2-1: User model khai bao day du field theo data dictionary', () => {
  assert.equal(User.modelName, 'User');
  for (const field of [
    'name',
    'email',
    'password',
    'role',
    'phone',
    'addresses',
    'isDeleted',
    'deletedAt',
    'status',
    'tokenVersion',
    'createdAt',
    'updatedAt',
  ]) {
    assert.ok(User.schema.path(field), `thieu field ${field}`);
  }
  assert.equal(User.schema.path('role').defaultValue, 'customer');
  assert.equal(User.schema.path('status').defaultValue, 'active');
  assert.equal(User.schema.path('isDeleted').defaultValue, false);
  assert.equal(User.schema.path('tokenVersion').defaultValue, 0);
  assert.equal(User.schema.path('email').options.unique, true);
  assert.equal(User.schema.path('email').options.lowercase, true);
  assert.equal(User.schema.path('password').options.select, false);
});

test('T2-2-1: toJSON loai bo password, isDeleted va __v, giu id', () => {
  const doc = new User({
    name: 'Nguyen Van A',
    email: 'a@example.com',
    password: 'hashed-value',
  });

  const json = doc.toJSON();
  assert.equal(json.password, undefined);
  assert.equal(json.passwordHash, undefined);
  assert.equal(json.isDeleted, undefined);
  assert.equal(json.__v, undefined);
  assert.ok(json.id, 'phai tra ve id');
  assert.equal(json.email, 'a@example.com');
});

test('T2-2-1: role ngoai enum bi tu choi', async () => {
  const doc = new User({
    name: 'Nguyen Van A',
    email: 'a@example.com',
    password: 'hashed-value',
    role: 'superadmin',
  });

  const error = await doc.validate().catch((err) => err);
  assert.ok(error);
  assert.ok(error.errors.role);
});

test('T2-2-1: status ngoai enum bi tu choi', async () => {
  const doc = new User({
    name: 'Nguyen Van A',
    email: 'a@example.com',
    password: 'hashed-value',
    status: 'pending',
  });

  const error = await doc.validate().catch((err) => err);
  assert.ok(error);
  assert.ok(error.errors.status);
});

test('T2-2-1: email duoc chuan hoa lowercase va trim', () => {
  const doc = new User({
    name: 'Nguyen Van A',
    email: '  A@Example.COM  ',
    password: 'hashed-value',
  });

  assert.equal(doc.email, 'a@example.com');
});

test('T2-2-1: email sai dinh dang bi tu choi', async () => {
  const doc = new User({
    name: 'Nguyen Van A',
    email: 'not-an-email',
    password: 'hashed-value',
  });

  const error = await doc.validate().catch((err) => err);
  assert.ok(error);
  assert.ok(error.errors.email);
});

test('T2-2-1: phone sai dinh dang bi tu choi', async () => {
  const doc = new User({
    name: 'Nguyen Van A',
    email: 'a@example.com',
    password: 'hashed-value',
    phone: 'abc',
  });

  const error = await doc.validate().catch((err) => err);
  assert.ok(error);
  assert.ok(error.errors.phone);
});

test('T2-2-1: phone hop le duoc chap nhan', async () => {
  const doc = new User({
    name: 'Nguyen Van A',
    email: 'a@example.com',
    password: 'hashed-value',
    phone: '0912345678',
  });

  await doc.validate();
  assert.equal(doc.phone, '0912345678');
});

test('T2-2-1: toi da 3 dia chi', async () => {
  const address = { street: '1 Nguyen Trai', city: 'Ha Noi' };
  const doc = new User({
    name: 'Nguyen Van A',
    email: 'a@example.com',
    password: 'hashed-value',
    addresses: [address, address, address, address],
  });

  const error = await doc.validate().catch((err) => err);
  assert.ok(error);
  assert.ok(error.errors.addresses);
});

test('T2-2-1: 3 dia chi hop le duoc chap nhan', async () => {
  const address = { street: '1 Nguyen Trai', city: 'Ha Noi' };
  const doc = new User({
    name: 'Nguyen Van A',
    email: 'a@example.com',
    password: 'hashed-value',
    addresses: [address, address, address],
  });

  await doc.validate();
  assert.equal(doc.addresses.length, 3);
});

test('T2-2-1: virtual passwordHash tuong thich voi code cu', () => {
  const doc = new User({
    name: 'Nguyen Van A',
    email: 'a@example.com',
    passwordHash: 'legacy-hash',
  });

  assert.equal(doc.password, 'legacy-hash');
  assert.equal(doc.passwordHash, 'legacy-hash');
});

test('T2-2-1: status co index', () => {
  const indexes = User.schema.indexes();
  assert.ok(
    indexes.some(([fields]) => fields.status === 1),
    'thieu index cho status',
  );
});

test.after(() => {
  mongoose.deleteModel(/User/);
});
