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
const { installFakeModel } = require('./support/fakeCartModels');

const fakeUserModel = createFakeUserModel();
installFakeUserModel(fakeUserModel);

const categoryRows = [
  {
    _id: new Types.ObjectId().toString(),
    name: 'Áo thun',
    slug: 'ao-thun',
    parentId: null,
    order: 1,
    isDeleted: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  },
  {
    _id: new Types.ObjectId().toString(),
    name: 'Áo thun nam',
    slug: 'ao-thun-nam',
    parentId: null,
    order: 2,
    isDeleted: false,
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
  },
];
categoryRows[1].parentId = categoryRows[0]._id;

const createCategoryQuery = (input) => {
  let result = [...input];
  const query = {
    sort() {
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

const fakeCategoryModel = {
  find(filter = {}) {
    return createCategoryQuery(
      categoryRows.filter((category) => category.isDeleted === filter.isDeleted),
    );
  },
};
installFakeModel('../../src/model/Category', fakeCategoryModel);

const orderRows = [
  {
    _id: new Types.ObjectId().toString(),
    code: 'DH-001',
    user: new Types.ObjectId().toString(),
    total: 250000,
    status: 'pending',
    createdAt: new Date('2026-02-01T00:00:00.000Z'),
  },
  {
    _id: new Types.ObjectId().toString(),
    code: 'DH-002',
    user: new Types.ObjectId().toString(),
    total: 400000,
    status: 'shipping',
    createdAt: new Date('2026-02-02T00:00:00.000Z'),
  },
];

const createOrderQuery = (input) => {
  let result = [...input];
  const query = {
    sort() {
      return query;
    },
    limit(count) {
      result = result.slice(0, count);
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

const STATUS_FLOW = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipping', 'cancelled'],
  shipping: ['delivered'],
  delivered: [],
  cancelled: [],
};

const fakeOrderModel = {
  ORDER_STATUSES: ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'],
  ORDER_STATUS_FLOW: STATUS_FLOW,
  canTransition(from, to) {
    return (STATUS_FLOW[from] || []).includes(to);
  },
  find(filter = {}) {
    return createOrderQuery(
      orderRows.filter((order) => !filter.status || order.status === filter.status),
    );
  },
  async countDocuments(filter = {}) {
    return orderRows.filter((order) => !filter.status || order.status === filter.status).length;
  },
};
installFakeModel('../../src/model/Order', fakeOrderModel);

const request = require('supertest');
const app = require('../src/app');
const adminService = require('../src/services/adminService');

const originalGetStats = adminService.getStats;
adminService.getStats = async () => ({
  stats: {
    totalProducts: 10,
    totalOrders: 2,
    totalRevenue: 650000,
    activeUsers: 3,
  },
  recentOrders: [],
  lowStockProducts: [],
});

test.after(() => {
  adminService.getStats = originalGetStats;
});

const signToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '15m',
    issuer: 'abmt-shop',
    audience: 'abmt-shop-client',
  });

const seedUser = (overrides = {}) => {
  const user = {
    _id: new Types.ObjectId().toString(),
    name: 'Nguoi Dung',
    email: `user-${new Types.ObjectId().toString()}@example.com`,
    password: '$2a$10$abcdefghijklmnopqrstuv',
    role: 'customer',
    status: 'active',
    isDeleted: false,
    addresses: [],
    tokenVersion: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
  fakeUserModel.users.push(user);
  return user;
};

const cookieFor = (user) => {
  const token = signToken({
    sub: String(user._id),
    role: user.role,
    ver: user.tokenVersion || 0,
  });
  return `accessToken=${token}`;
};

const adminUser = seedUser({ name: 'Quản trị viên', role: 'admin' });
const customerUser = seedUser({ name: 'Nguyễn Văn A', role: 'customer' });
const adminCookie = cookieFor(adminUser);
const customerCookie = cookieFor(customerUser);

const ADMIN_LINKS = [
  'href="/admin"',
  'href="/admin/products/new"',
  'href="/admin/categories"',
  'href="/admin/orders"',
  'href="/admin/users"',
];

test('cac trang admin yeu cau dang nhap va quyen admin', async () => {
  const guest = await request(app).get('/admin/categories');
  assert.equal(guest.status, 302);
  assert.equal(guest.headers.location, '/login?next=/admin/categories');

  const customer = await request(app).get('/admin/users').set('Cookie', customerCookie);
  assert.equal(customer.status, 403);
});

test('dashboard va form san pham co du 5 lien ket quan tri', async () => {
  for (const path of ['/admin', '/admin/products/new']) {
    const res = await request(app).get(path).set('Cookie', adminCookie);
    assert.equal(res.status, 200);
    ADMIN_LINKS.forEach((link) => assert.ok(res.text.includes(link), `${path} thieu ${link}`));
  }
  assert.ok(customerUser);
});

test('trang danh muc hien danh sach tu service va co form quan ly', async () => {
  const res = await request(app).get('/admin/categories').set('Cookie', adminCookie);
  assert.equal(res.status, 200);
  assert.match(res.text, /Quản lý danh mục/);
  assert.match(res.text, /id="categoryForm"/);
  assert.match(res.text, /Áo thun nam/);
  assert.match(res.text, /id="categoryList"/);
});

test('trang don hang loc theo trang thai va hien nut huy hop le', async () => {
  const res = await request(app)
    .get('/admin/orders?status=pending')
    .set('Cookie', adminCookie);
  assert.equal(res.status, 200);
  assert.match(res.text, /Quản lý đơn hàng/);
  assert.match(res.text, /DH-001/);
  assert.doesNotMatch(res.text, /DH-002/);
  assert.match(res.text, /data-action="cancel-order"/);
  assert.match(res.text, /Chờ xử lý/);
});

test('trang nguoi dung hien ket qua tim kiem va selector quyen', async () => {
  const res = await request(app)
    .get('/admin/users?q=Nguyễn')
    .set('Cookie', adminCookie);
  assert.equal(res.status, 200);
  assert.match(res.text, /Quản lý người dùng/);
  assert.match(res.text, /Nguyễn Văn A/);
  assert.match(res.text, /class="user-role"/);

  const self = await request(app)
    .get('/admin/users?q=Quản trị')
    .set('Cookie', adminCookie);
  assert.equal(self.status, 200);
  assert.match(self.text, /Quản trị viên/);
  assert.match(self.text, /disabled/);
});
