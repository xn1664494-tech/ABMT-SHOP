const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';

const { createFakeCartModel, installFakeModel } = require('./support/fakeCartModels');

const cartModel = createFakeCartModel();
installFakeModel('../../src/model/Cart', cartModel);

const request = require('supertest');
const app = require('../src/app');

const seedCart = (items) => {
  cartModel.carts.length = 0;
  cartModel.carts.push({
    _id: new mongoose.Types.ObjectId(),
    sessionId: 'session-abc',
    items,
    async save() {
      return this;
    },
  });
};

test.beforeEach(() => {
  cartModel.carts.length = 0;
});

test('T5-4-1: gio rong hien empty state, an thanh toan va khong cache', async () => {
  seedCart([]);

  const res = await request(app).get('/cart').set('Cookie', 'cartId=session-abc');

  assert.equal(res.status, 200);
  assert.match(res.text, /Giỏ hàng đang trống/);
  assert.match(res.text, /id="full"[^>]*hidden/);
  assert.equal(res.headers['cache-control'], 'no-store');
});

test('T5-4-1: view hien ten/anh/gia/tong va escape du lieu san pham', async () => {
  const unsafeName = '<img src=x onerror=alert(1)> Áo đen';
  const product = {
    _id: new mongoose.Types.ObjectId(),
    name: unsafeName,
    slug: 'ao-den',
    images: ['https://example.com/ao-den.jpg'],
    variants: [{ sku: 'SP-AO-001-M-DEN', stock: 5 }],
  };
  seedCart([
    {
      _id: new mongoose.Types.ObjectId(),
      product,
      sku: 'SP-AO-001-M-DEN',
      size: 'M',
      color: 'Den',
      qty: 2,
      unitPrice: 199000,
    },
  ]);

  const res = await request(app).get('/cart').set('Cookie', 'cartId=session-abc');

  assert.equal(res.status, 200);
  assert.match(res.text, /&lt;img/);
  assert.equal(res.text.includes(unsafeName), false);
  assert.match(res.text, /href="\/products\/ao-den"/);
  assert.match(res.text, /https:\/\/example\.com\/ao-den\.jpg/);
  assert.match(res.text, /data-sku="SP-AO-001-M-DEN"/);
  assert.match(res.text, /max="5"/);
  assert.match(res.text, /id="empty"[^>]*hidden/);
  assert.doesNotMatch(res.text, /id="full"[^>]*hidden/);
  assert.match(res.text, /href="\/checkout"/);
});
