const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 't7-4-2-security-test-secret-at-least-32-chars';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.APP_ORIGIN = 'http://localhost:3000';
process.env.AUTH_RATE_LIMIT_MAX = '10000';

const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/model/User');
const Category = require('../../src/model/Category');
const Product = require('../../src/model/Products');
const Review = require('../../src/model/Review');
const Order = require('../../src/model/Order');
const Cart = require('../../src/model/Cart');
const { signAccessToken } = require('../../src/services/tokenService');
const { MongoMemoryServer } = require('mongodb-memory-server');

const RUN_ID = `t742-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const PASSWORD = 'Security123';
const XSS_PAYLOAD = '<img src=x onerror=alert(1)>';
const TEST_URI =
  process.env.MONGODB_URI_TEST ||
  process.env.TEST_MONGODB_URI ||
  'mongodb://127.0.0.1:27017/abmt_shop_test';
const explicitUri = Boolean(process.env.MONGODB_URI_TEST || process.env.TEST_MONGODB_URI);

let memoryServer = null;
let available = false;
let skipReason = '';
let seq = 0;
const created = { users: [], categories: [], products: [], reviews: [], carts: [] };

const skipIfUnavailable = (t) => {
  if (!available) {
    t.skip(skipReason);
    return true;
  }
  return false;
};

const emailFor = (role) => `${RUN_ID}-${role}-${++seq}@example.com`;

const skuFor = () => `SP-AO-${String((seq % 900) + 100)}-M-DEN`;

const seedUser = async (role = 'customer', overrides = {}) => {
  const user = await User.create({
    name: `Security ${role} ${RUN_ID} ${seq}`,
    email: emailFor(role),
    password: await bcrypt.hash(PASSWORD, 10),
    role,
    status: 'active',
    phone: '0912345678',
    phoneVerified: true,
    phoneVerifiedAt: new Date(),
    ...overrides,
  });
  created.users.push(user._id);
  return user;
};

const cookieFor = (user, roleOverride) => {
  const token = signAccessToken({
    _id: user._id,
    role: roleOverride === undefined ? user.role : roleOverride,
    tokenVersion: user.tokenVersion,
  });
  return [`accessToken=${token}`];
};

const getCsrfToken = async (agent) => {
  const res = await agent.get('/api/auth/csrf');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const token = res.body && res.body.data && res.body.data.csrfToken;
  assert.ok(token, 'CSRF token phai duoc cap');
  return token;
};

const loginAgent = async (user) => {
  const agent = request.agent(app);
  const csrf = await getCsrfToken(agent);
  const res = await agent
    .post('/api/auth/login')
    .set('X-CSRF-Token', csrf)
    .send({ email: user.email, password: PASSWORD });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return { agent, csrf };
};

const withCsrfEnforcement = async (send) => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'integration';
  try {
    return await send();
  } finally {
    process.env.NODE_ENV = previous;
  }
};

const addressPayload = (overrides = {}) => ({
  fullName: 'Nguyen Van Security',
  phone: '0912345678',
  province: 'Ha Noi',
  district: 'Cau Giay',
  ward: 'Dich Vong',
  detail: '1 Nguyen Trai',
  ...overrides,
});

const embeddedAddress = (recipient) => ({
  recipient,
  phone: '0912345678',
  city: 'Ha Noi',
  district: 'Cau Giay',
  ward: 'Dich Vong',
  street: '1 Nguyen Trai',
  isDefault: true,
});

const seedProduct = async (label) => {
  const sku = skuFor();
  const category = await Category.create({ name: `${RUN_ID} ${label} category` });
  created.categories.push(category._id);
  const product = await Product.create({
    name: `${RUN_ID} ${label} product`,
    category: category._id,
    basePrice: 199000,
    images: ['https://example.com/security.jpg'],
    variants: [{ sku, size: 'M', color: 'DEN', stock: 5, price: 199000 }],
  });
  created.products.push(product._id);
  return { product, sku };
};

const seedCart = async (userId, product, sku) => {
  const cart = await Cart.create({
    user: userId,
    items: [
      {
        product: product._id,
        sku,
        size: 'M',
        color: 'DEN',
        qty: 1,
        unitPrice: product.basePrice,
      },
    ],
  });
  created.carts.push(cart._id);
  return cart;
};

test.before(async () => {
  const dbName = (() => {
    try {
      const withoutParams = TEST_URI.split('?')[0];
      const afterScheme = withoutParams.replace(/^mongodb(\+srv)?:\/\//, '');
      const afterAt = afterScheme.includes('@')
        ? afterScheme.slice(afterScheme.lastIndexOf('@') + 1)
        : afterScheme;
      const slash = afterAt.indexOf('/');
      return slash >= 0 ? afterAt.slice(slash + 1) : '';
    } catch (error) {
      return '';
    }
  })();

  if (!dbName || !dbName.toLowerCase().includes('test')) {
    skipReason = 'MongoDB URI phai tro toi database co ten chua "test"';
    return;
  }

  try {
    try {
      await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 3000 });
    } catch (error) {
      if (explicitUri) {
        throw error;
      }
      memoryServer = await MongoMemoryServer.create();
      await mongoose.connect(memoryServer.getUri('abmt_shop_test'), {
        serverSelectionTimeoutMS: 3000,
      });
    }

    await Promise.all([
      User.init(),
      Category.init(),
      Product.init(),
      Review.init(),
      Order.init(),
      Cart.init(),
    ]);
    available = true;
  } catch (error) {
    skipReason = `Khong ket noi duoc MongoDB test (${error.name})`;
  }
});

test.after(async () => {
  const userIds = created.users.map((id) => id);
  if (available) {
    await Review.deleteMany({ product: { $in: created.products } });
    await Order.deleteMany({ user: { $in: userIds } });
    await Cart.deleteMany({ _id: { $in: created.carts } });
    await Product.deleteMany({ _id: { $in: created.products } });
    await Category.deleteMany({ _id: { $in: created.categories } });
    await User.deleteMany({ _id: { $in: userIds } });
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (memoryServer) {
    await memoryServer.stop();
  }
});

test('T7-4-2 IDOR: cap/xoa dia chi cua user khac bi chan 404 va khong doi DB', async (t) => {
  if (skipIfUnavailable(t)) return;

  const victim = await seedUser('customer', {
    addresses: [embeddedAddress('Victim Address')],
  });
  const attacker = await seedUser('customer');
  const foreignAddressId = String(victim.addresses[0]._id);
  const { agent, csrf } = await loginAgent(attacker);

  const update = await agent
    .put(`/api/profile/addresses/${foreignAddressId}`)
    .set('X-CSRF-Token', csrf)
    .send(addressPayload({ fullName: 'Attacker Overwrite' }));
  assert.equal(update.status, 404, JSON.stringify(update.body));

  const remove = await agent
    .delete(`/api/profile/addresses/${foreignAddressId}`)
    .set('X-CSRF-Token', csrf);
  assert.equal(remove.status, 404, JSON.stringify(remove.body));

  const victimAfter = await User.findById(victim._id).lean();
  assert.equal(victimAfter.addresses.length, 1);
  assert.equal(victimAfter.addresses[0].recipient, 'Victim Address');

  const attackerAfter = await User.findById(attacker._id).lean();
  assert.equal(attackerAfter.addresses.length, 0);

  const ownAddress = await agent
    .post('/api/profile/addresses')
    .set('X-CSRF-Token', csrf)
    .send(addressPayload({ fullName: 'Attacker Own Address' }));
  assert.equal(ownAddress.status, 201, JSON.stringify(ownAddress.body));
});

test('T7-4-2 IDOR: dat hang bang addressId cua user khac bi chan 404', async (t) => {
  if (skipIfUnavailable(t)) return;

  const victim = await seedUser('customer', {
    addresses: [embeddedAddress('Victim Checkout Address')],
  });
  const attacker = await seedUser('customer');
  const { product, sku } = await seedProduct('idor-address');
  await seedCart(attacker._id, product, sku);

  const foreignAddressId = String(victim.addresses[0]._id);
  const placed = await request(app)
    .post('/api/orders')
    .set('Cookie', cookieFor(attacker))
    .send({ addressId: foreignAddressId, paymentMethod: 'cod' });

  assert.equal(placed.status, 404, JSON.stringify(placed.body));
  assert.equal(await Order.countDocuments({ user: attacker._id }), 0);

  const productAfter = await Product.findById(product._id).lean();
  assert.equal(productAfter.variants[0].stock, 5);
});

test('T7-4-2 XSS dia chi: payload duoc escape khi render /account', async (t) => {
  if (skipIfUnavailable(t)) return;

  const user = await seedUser('customer');
  const { agent, csrf } = await loginAgent(user);

  const added = await agent
    .post('/api/profile/addresses')
    .set('X-CSRF-Token', csrf)
    .send(addressPayload({ fullName: XSS_PAYLOAD, detail: XSS_PAYLOAD }));
  assert.equal(added.status, 201, JSON.stringify(added.body));

  const page = await agent.get('/account?tab=addresses');
  assert.equal(page.status, 200);
  assert.equal(page.text.includes(XSS_PAYLOAD), false);
  assert.equal(page.text.includes('<img src=x'), false);
  assert.match(page.text, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('T7-4-2 XSS danh gia: khong co route ghi/chi payload eval duoc', async (t) => {
  if (skipIfUnavailable(t)) return;

  const user = await seedUser('customer');
  const { product } = await seedProduct('review-xss');
  const review = await Review.create({
    user: user._id,
    product: product._id,
    order: new mongoose.Types.ObjectId(),
    rating: 5,
    comment: XSS_PAYLOAD,
    isApproved: true,
  });
  created.reviews.push(review._id);

  const createAttempt = await request(app)
    .post('/api/reviews')
    .set('Cookie', cookieFor(user))
    .send({ product: String(product._id), rating: 5, comment: XSS_PAYLOAD });
  assert.equal(createAttempt.status, 404, JSON.stringify(createAttempt.body));

  const updateAttempt = await request(app)
    .put(`/api/reviews/${review._id}`)
    .set('Cookie', cookieFor(user))
    .send({ comment: XSS_PAYLOAD });
  assert.equal(updateAttempt.status, 404, JSON.stringify(updateAttempt.body));

  const deleteAttempt = await request(app)
    .delete(`/api/reviews/${review._id}`)
    .set('Cookie', cookieFor(user));
  assert.equal(deleteAttempt.status, 404, JSON.stringify(deleteAttempt.body));

  const page = await request(app).get(`/products/${product.slug}`);
  assert.equal(page.status, 200);
  assert.equal(page.text.includes(XSS_PAYLOAD), false);
  assert.equal(page.text.includes('<img src=x'), false);

  const stored = await Review.findById(review._id).lean();
  assert.equal(stored.comment, XSS_PAYLOAD);
});

test('T7-4-2 CSRF: thieu/sai token va Origin khong duoc phep deu bi chan 403', async (t) => {
  if (skipIfUnavailable(t)) return;

  const user = await seedUser('customer');
  const { agent, csrf } = await loginAgent(user);

  const missing = await withCsrfEnforcement(() =>
    agent.post('/api/profile/addresses').send(addressPayload({ fullName: 'No CSRF' })),
  );
  assert.equal(missing.status, 403, JSON.stringify(missing.body));

  const wrong = await withCsrfEnforcement(() =>
    agent
      .post('/api/profile/addresses')
      .set('X-CSRF-Token', 'sai-token')
      .send(addressPayload({ fullName: 'Wrong CSRF' })),
  );
  assert.equal(wrong.status, 403, JSON.stringify(wrong.body));

  const badOrigin = await withCsrfEnforcement(() =>
    agent
      .post('/api/profile/addresses')
      .set('X-CSRF-Token', csrf)
      .set('Origin', 'http://evil.example')
      .send(addressPayload({ fullName: 'Bad Origin' })),
  );
  assert.equal(badOrigin.status, 403, JSON.stringify(badOrigin.body));

  const allowed = await withCsrfEnforcement(() =>
    agent
      .post('/api/profile/addresses')
      .set('X-CSRF-Token', csrf)
      .set('Origin', 'http://localhost:3000')
      .send(addressPayload({ fullName: 'Allowed CSRF' })),
  );
  assert.equal(allowed.status, 201, JSON.stringify(allowed.body));

  const stored = await User.findById(user._id).lean();
  assert.equal(stored.addresses.length, 1);
  assert.equal(stored.addresses[0].recipient, 'Allowed CSRF');
});

test('T7-4-2 RBAC: guest/customer/token tu khai admin bi chan, admin duoc phep', async (t) => {
  if (skipIfUnavailable(t)) return;

  const customer = await seedUser('customer');
  const admin = await seedUser('admin');

  const guestApi = await request(app).get('/api/admin/access-check');
  assert.equal(guestApi.status, 401);
  const customerApi = await request(app)
    .get('/api/admin/access-check')
    .set('Cookie', cookieFor(customer));
  assert.equal(customerApi.status, 403);
  const forgedApi = await request(app)
    .get('/api/admin/access-check')
    .set('Cookie', cookieFor(customer, 'admin'));
  assert.equal(forgedApi.status, 403);
  const adminApi = await request(app)
    .get('/api/admin/access-check')
    .set('Cookie', cookieFor(admin));
  assert.equal(adminApi.status, 200);

  const guestPage = await request(app).get('/admin');
  assert.equal(guestPage.status, 302);
  assert.equal(guestPage.headers.location, '/login?next=/admin');
  const customerPage = await request(app)
    .get('/admin')
    .set('Cookie', cookieFor(customer));
  assert.equal(customerPage.status, 403);
  const adminPage = await request(app)
    .get('/admin')
    .set('Cookie', cookieFor(admin));
  assert.equal(adminPage.status, 200);
});
