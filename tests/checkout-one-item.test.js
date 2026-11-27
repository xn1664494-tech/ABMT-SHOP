process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-characters-long';

const request = require('supertest');
const mongoose = require('mongoose');

const app = require('../src/app');
const Cart = require('../src/model/Cart');
const Order = require('../src/model/Order');
const Product = require('../src/model/Products');
const User = require('../src/model/User');
const { signAccessToken } = require('../src/services/tokenService');

const address = {
  fullName: 'Nguyen Van A',
  phone: '0901234567',
  province: 'Ha Noi',
  ward: 'Giang Vo',
  detail: '12 Nguyen Van Huyen',
};

const orderPayload = (extra = {}) => ({
  address,
  paymentMethod: 'cod',
  note: '',
  ...extra,
});

const createUser = (email) =>
  User.create({ name: 'Test User', email, password: 'password123', role: 'customer' });

const createProduct = ({ slug, sku, name, price, stock }) =>
  Product.create({
    name,
    slug,
    description: '',
    category: new mongoose.Types.ObjectId(),
    basePrice: price,
    images: [],
    variants: [{ size: 'M', color: 'DEN', sku, stock, price }],
  });

const createCart = (user, items) =>
  Cart.create({ user: user._id, sessionId: null, items });

const cartItem = (product, sku, qty, price) => ({
  product: product._id,
  sku,
  size: 'M',
  color: 'DEN',
  qty,
  unitPrice: price,
});

const postOrder = (token, payload) =>
  request(app)
    .post('/api/orders')
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', 'http://localhost:3000')
    .send(payload);

describe('checkout mot item trong gio', () => {
  test('tra ve tong cua rieng item duoc chon, khong tin gia/qty tu client', async () => {
    const user = await createUser('single-item-1@test.com');
    const skuA = 'SP-AO-911-M-DEN';
    const skuB = 'SP-AO-912-M-DEN';
    const productA = await createProduct({ slug: 'ao-a', sku: skuA, name: 'Ao A', price: 199000, stock: 10 });
    const productB = await createProduct({ slug: 'ao-b', sku: skuB, name: 'Ao B', price: 350000, stock: 10 });
    const cart = await createCart(user, [
      cartItem(productA, skuA, 2, 199000),
      cartItem(productB, skuB, 1, 350000),
    ]);
    const token = signAccessToken(user);
    const itemAId = String(cart.items[0]._id);

    const checkoutPage = await request(app)
      .get(`/checkout?item=${itemAId}`)
      .set('Cookie', `accessToken=${token}`);

    expect(checkoutPage.status).toBe(200);
    expect(checkoutPage.text).toContain(`name="item" value="${itemAId}"`);
    expect(checkoutPage.text).toContain(skuA);
    expect(checkoutPage.text).not.toContain(skuB);
    expect(checkoutPage.text).toContain('428.000₫');

    const res = await postOrder(token, orderPayload({ item: itemAId, unitPrice: 1, qty: 99 }));

    expect(res.status).toBe(201);
    expect(res.body.data.total).toBe(428000);

    const order = await Order.findOne({ user: user._id });
    expect(order.items).toHaveLength(1);
    expect(order.items[0].sku).toBe(skuA);
    expect(order.subtotal).toBe(398000);
    expect(order.total).toBe(428000);
  });

  test('tu choi item khong thuoc gio cua user hien tai va id khong hop le', async () => {
    const user = await createUser('single-item-2@test.com');
    const otherUser = await createUser('single-item-2-other@test.com');
    const skuA = 'SP-AO-913-M-DEN';
    const skuB = 'SP-AO-914-M-DEN';
    const productA = await createProduct({ slug: 'ao-c', sku: skuA, name: 'Ao C', price: 199000, stock: 10 });
    const productB = await createProduct({ slug: 'ao-d', sku: skuB, name: 'Ao D', price: 350000, stock: 10 });
    await createCart(user, [cartItem(productA, skuA, 1, 199000)]);
    const otherCart = await createCart(otherUser, [cartItem(productB, skuB, 1, 350000)]);
    const token = signAccessToken(user);

    const foreignRes = await postOrder(token, orderPayload({ item: String(otherCart.items[0]._id) }));
    expect(foreignRes.status).toBe(404);

    const invalidRes = await postOrder(token, orderPayload({ item: 'not-an-id' }));
    expect(invalidRes.status).toBe(400);

    expect(await Order.countDocuments({})).toBe(0);
  });

  test('sau khi dat hang chi item duoc chon bi xoa khoi gio', async () => {
    const user = await createUser('single-item-3@test.com');
    const skuA = 'SP-AO-915-M-DEN';
    const skuB = 'SP-AO-916-M-DEN';
    const productA = await createProduct({ slug: 'ao-e', sku: skuA, name: 'Ao E', price: 199000, stock: 10 });
    const productB = await createProduct({ slug: 'ao-f', sku: skuB, name: 'Ao F', price: 350000, stock: 7 });
    const cart = await createCart(user, [
      cartItem(productA, skuA, 2, 199000),
      cartItem(productB, skuB, 3, 350000),
    ]);
    const token = signAccessToken(user);

    const res = await postOrder(token, orderPayload({ item: String(cart.items[0]._id) }));
    expect(res.status).toBe(201);

    const remainingCart = await Cart.findOne({ user: user._id });
    expect(remainingCart.items).toHaveLength(1);
    expect(String(remainingCart.items[0]._id)).toBe(String(cart.items[1]._id));
    expect(remainingCart.items[0].sku).toBe(skuB);
    expect(remainingCart.items[0].qty).toBe(3);

    const updatedA = await Product.findById(productA._id);
    const updatedB = await Product.findById(productB._id);
    expect(updatedA.variants[0].stock).toBe(8);
    expect(updatedB.variants[0].stock).toBe(7);
  });
});
