const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';

const { createFakeUserModel, installFakeUserModel } = require('./support/fakeUserModel');
const { installFakeModel } = require('./support/fakeCartModels');

const fakeUserModel = createFakeUserModel();
installFakeUserModel(fakeUserModel);

const orders = [];
const flow = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipping', 'cancelled'],
  shipping: ['delivered'],
  delivered: [],
  cancelled: [],
};

const thenable = (value, extra = {}) => ({
  ...extra,
  select() {
    return this;
  },
  lean() {
    return this;
  },
  then(resolve, reject) {
    return Promise.resolve(value).then(resolve, reject);
  },
  catch(reject) {
    return Promise.resolve(value).catch(reject);
  },
});

const fakeOrderModel = {
  ORDER_STATUS_FLOW: flow,
  canTransition(from, to) {
    return (flow[from] || []).includes(to);
  },
  find(filter = {}) {
    let result = orders.filter((order) => String(order.user) === String(filter.user));
    const query = {
      select() {
        return query;
      },
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
  },
  findById(id) {
    return thenable(orders.find((order) => String(order._id) === String(id)) || null);
  },
};

installFakeModel('../../src/model/Order', fakeOrderModel);

const request = require('supertest');
const app = require('../src/app');

const PASSWORD = 'Secret123';

const seedUser = async (overrides = {}) => {
  const password = await bcrypt.hash(PASSWORD, 10);
  return fakeUserModel.create({
    name: 'Khach hang A',
    email: 'customer@example.com',
    password,
    role: 'customer',
    status: 'active',
    ...overrides,
  });
};

const login = async (email) => {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password: PASSWORD });
  assert.equal(res.status, 200);
  return agent;
};

const seedOrder = (overrides = {}) => {
  const order = {
    _id: new mongoose.Types.ObjectId(),
    user: '1',
    code: 'ORD-20261126-000001',
    status: 'pending',
    paymentStatus: 'unpaid',
    paymentMethod: 'cod',
    items: [
      {
        name: 'Áo đen',
        image: 'https://example.com/ao-den.jpg',
        sku: 'SP-AO-001-M-DEN',
        size: 'M',
        color: 'Đen',
        qty: 2,
        unitPrice: 199000,
        lineTotal: 398000,
      },
    ],
    shippingAddress: {
      fullName: 'Nguyen Van A',
      phone: '0901234567',
      province: 'Hà Nội',
      district: 'Hoàn Kiếm',
      ward: 'Hàng Bạc',
      detail: '12 Lê Duẩn',
    },
    subtotal: 398000,
    shippingFee: 0,
    discount: 0,
    total: 398000,
    note: '',
    statusHistory: [{ status: 'pending', at: new Date('2026-11-26T08:00:00.000Z'), note: '' }],
    createdAt: new Date('2026-11-26T08:00:00.000Z'),
    updatedAt: new Date('2026-11-26T08:00:00.000Z'),
    ...overrides,
  };
  orders.push(order);
  return order;
};

test.beforeEach(() => {
  fakeUserModel.users.length = 0;
  orders.length = 0;
});

test('T6-4-1: guest bi chuyen ve login khi xem danh sach va chi tiet', async () => {
  const listRes = await request(app).get('/orders');
  const orderId = new mongoose.Types.ObjectId().toString();
  const detailRes = await request(app).get(`/orders/${orderId}`);

  assert.equal(listRes.status, 302);
  assert.equal(listRes.headers.location, '/login?next=/orders');
  assert.equal(detailRes.status, 302);
  assert.equal(detailRes.headers.location, `/login?next=/orders/${orderId}`);
});

test('T6-4-1: danh sach hien dung nhan status va chi nut huy khi hop le', async () => {
  await seedUser();
  const agent = await login('customer@example.com');
  seedOrder({ status: 'pending' });
  seedOrder({ status: 'confirmed', code: 'ORD-20261126-000002' });
  seedOrder({ status: 'delivered', code: 'ORD-20261126-000003' });
  seedOrder({ status: 'cancelled', code: 'ORD-20261126-000004' });

  const res = await agent.get('/orders');

  assert.equal(res.status, 200);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.match(res.text, /data-status-label="pending">Chờ xác nhận</);
  assert.match(res.text, /data-status-label="confirmed">Đã xác nhận</);
  assert.match(res.text, /data-status-label="delivered">Đã giao - chờ bạn xác nhận</);
  assert.match(res.text, /data-status-label="cancelled">Đã hủy</);
  assert.equal((res.text.match(/data-action="cancel-order"/g) || []).length, 1);
  assert.match(res.text, /data-order-status="pending"[\s\S]*?data-action="cancel-order"/);
});

test('T6-4-1: chi tiet hien dung status, lich su, tong tien va escape XSS', async () => {
  await seedUser();
  const agent = await login('customer@example.com');
  const unsafeCode = '<img src=x onerror=alert(1)>';
  const order = seedOrder({
    code: unsafeCode,
    status: 'shipping',
    note: '<script>alert(1)</script>',
    statusHistory: [
      { status: 'pending', at: new Date('2026-11-26T08:00:00.000Z'), note: '' },
      { status: 'shipping', at: new Date('2026-11-26T09:00:00.000Z'), note: 'Đã lấy hàng' },
    ],
  });

  const res = await agent.get(`/orders/${order._id.toString()}`);

  assert.equal(res.status, 200);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.match(res.text, /data-status-label="shipping">Đang giao</);
  assert.match(res.text, /data-history-status="pending"[\s\S]*?Chờ xác nhận/);
  assert.match(res.text, /data-history-status="shipping"[\s\S]*?Đang giao/);
  assert.match(res.text, /398\.000₫/);
  assert.match(res.text, /Áo đen/);
  assert.equal(res.text.includes(unsafeCode), false);
  assert.equal(res.text.includes('<script>alert(1)</script>'), false);
  assert.doesNotMatch(res.text, /data-action="cancel-order"/);
});

test('T6-4-1: don pending hien nut huy, don khong phai cua khach bi tu choi', async () => {
  await seedUser();
  const owner = await login('customer@example.com');
  const order = seedOrder({ status: 'pending' });

  const ownerRes = await owner.get(`/orders/${order._id.toString()}`);
  assert.equal(ownerRes.status, 200);
  assert.match(ownerRes.text, /data-action="cancel-order"/);

  await seedUser({ email: 'other@example.com', name: 'Khach hang B' });
  const other = await login('other@example.com');
  const otherRes = await other.get(`/orders/${order._id.toString()}`);

  assert.equal(otherRes.status, 403);
  assert.match(otherRes.text, /Bạn không có quyền xem đơn hàng này/);
  assert.equal(otherRes.text.includes(order.code), false);
});

test('T6-4-1: admin xem don cua khach va thay nut huy o trang thai confirmed', async () => {
  await seedUser();
  const order = seedOrder({ status: 'confirmed' });
  await seedUser({ email: 'admin@example.com', role: 'admin', name: 'Quan tri vien' });
  const admin = await login('admin@example.com');

  const res = await admin.get(`/orders/${order._id.toString()}`);

  assert.equal(res.status, 200);
  assert.match(res.text, /data-status-label="confirmed">Đã xác nhận</);
  assert.match(res.text, /data-action="cancel-order"/);
});

test('T6-4-1: id khong hop le va don khong ton tai tra 404', async () => {
  await seedUser();
  const agent = await login('customer@example.com');

  const invalidRes = await agent.get('/orders/not-an-object-id');
  const missingRes = await agent.get(`/orders/${new mongoose.Types.ObjectId().toString()}`);

  assert.equal(invalidRes.status, 404);
  assert.equal(missingRes.status, 404);
});
