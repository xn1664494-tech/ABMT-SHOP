const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

dotenv.config({ path: path.resolve(__dirname, '../.env.test'), quiet: true });

const request = require('supertest');
const app = require('../src/server');
const Category = require('../src/model/Category');
const Product = require('../src/model/Products');
const User = require('../src/model/User');

const agent = request.agent(app);

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
process.env.JWT_SECRET = JWT_SECRET;
const ISSUER = 'abmt-shop';
const AUDIENCE = 'abmt-shop-client';

const TEST_URI =
  process.env.MONGODB_URI_TEST ||
  process.env.TEST_MONGODB_URI ||
  'mongodb://127.0.0.1:27017/abmt_shop_product_test';

const MARKER = 'prodapitest';
const SKU = (sequence, size = 'M', color = 'DEN') =>
  `SP-AO-${sequence}-${size}-${color}`;

const IMAGE = 'https://cdn.example.com/product.jpg';

let available = false;
let skipReason = '';
let adminToken = null;
let customerToken = null;
let csrfToken = null;
let categoryId = null;
let categorySlug = null;
let productId = null;
let inactiveProductId = null;

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });
const csrfHeader = () => ({ 'X-CSRF-Token': csrfToken });

const skipIfUnavailable = (t) => {
  if (!available) {
    t.skip(skipReason);
    return true;
  }
  return false;
};

const cleanup = async () => {
  if (!available) return;
  await Product.deleteMany({ name: { $regex: `^${MARKER}` } });
  await Category.deleteMany({ name: { $regex: `^${MARKER}` } });
  await User.deleteMany({ email: { $regex: `^${MARKER}` } });
};

const createBody = (overrides = {}) => ({
  name: `${MARKER} Product One`,
  description: 'San pham kiem thu API Product',
  category: categoryId,
  images: [IMAGE],
  basePrice: 199000,
  variants: [
    {
      size: 'M',
      color: 'Đen',
      colorCode: '#111111',
      sku: SKU(990, 'M', 'DEN'),
      stock: 10,
      price: 199000,
    },
    {
      size: 'L',
      color: 'Trắng',
      colorCode: '#FFFFFF',
      sku: SKU(990, 'L', 'TRANG'),
      stock: 5,
    },
  ],
  ...overrides,
});

const postProduct = (body, token = adminToken, withCsrf = true) => {
  const req = agent
    .post('/api/products')
    .set(authHeader(token))
    .send(body);

  if (withCsrf) req.set(csrfHeader());
  return req;
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
    skipReason = 'TEST_MONGODB_URI phai tro toi database co ten chua "test"';
    return;
  }

  try {
    await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 3000 });
    await User.init();
    await Category.init();
    await Product.init();

    await Product.deleteMany({ name: { $regex: `^${MARKER}` } });
    await Category.deleteMany({ name: { $regex: `^${MARKER}` } });
    await User.deleteMany({ email: { $regex: `^${MARKER}` } });

    const adminUser = await User.create({
      name: 'Admin Product Test',
      email: `${MARKER}.admin@test.com`,
      password: 'password123',
      role: 'admin',
    });
    const customerUser = await User.create({
      name: 'Customer Product Test',
      email: `${MARKER}.customer@test.com`,
      password: 'password123',
      role: 'customer',
    });

    const signFor = (user) =>
      jwt.sign(
        { sub: String(user._id), role: user.role, ver: user.tokenVersion || 0 },
        JWT_SECRET,
        { expiresIn: '15m', issuer: ISSUER, audience: AUDIENCE },
      );

    adminToken = signFor(adminUser);
    customerToken = signFor(customerUser);

    const category = await Category.create({ name: `${MARKER} Ao` });
    categoryId = category._id.toString();
    categorySlug = category.slug;

    const csrfRes = await agent.get('/api/auth/csrf');
    csrfToken = csrfRes.body.data.csrfToken;

    available = true;
  } catch (error) {
    skipReason = `Khong ket noi duoc MongoDB test (${error.name})`;
  }
});

test.after(async () => {
  await cleanup();
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

test('GET /api/products - danh sach cong khai', async (t) => {
  if (skipIfUnavailable(t)) return;

  const res = await agent.get('/api/products');

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.data));
});

test('POST /api/products chua dang nhap tra 401', async (t) => {
  if (skipIfUnavailable(t)) return;

  const res = await agent.post('/api/products').send(createBody());

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
});

test('POST /api/products vai khach tra 403', async (t) => {
  if (skipIfUnavailable(t)) return;

  const res = await postProduct(createBody(), customerToken);

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
});

test('POST /api/products thieu CSRF tra 403', async (t) => {
  if (skipIfUnavailable(t)) return;

  const res = await postProduct(createBody(), adminToken, false);

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
});

test('POST /api/products thieu truong bat buoc tra 400', async (t) => {
  if (skipIfUnavailable(t)) return;

  const res = await postProduct({ name: `${MARKER} Missing` });

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.ok(Array.isArray(res.body.details));
});

test('POST /api/products id danh muc sai dinh dang tra 400', async (t) => {
  if (skipIfUnavailable(t)) return;

  const res = await postProduct(createBody({ category: 'not-an-object-id' }));

  assert.equal(res.statusCode, 400);
  assert.ok(res.body.details.some((item) => item.field === 'category'));
});

test('POST /api/products danh muc khong ton tai tra 404', async (t) => {
  if (skipIfUnavailable(t)) return;

  const res = await postProduct(
    createBody({
      category: new mongoose.Types.ObjectId().toString(),
      variants: [
        {
          size: 'M',
          color: 'Đen',
          sku: SKU(991, 'M', 'DEN'),
          stock: 1,
        },
      ],
    }),
  );

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.success, false);
});

test('POST /api/products ton kho am tra 400', async (t) => {
  if (skipIfUnavailable(t)) return;

  const res = await postProduct(
    createBody({
      variants: [
        {
          size: 'M',
          color: 'Đen',
          sku: SKU(992, 'M', 'DEN'),
          stock: -1,
        },
      ],
    }),
  );

  assert.equal(res.statusCode, 400);
  assert.ok(
    res.body.details.some((item) => item.field === 'variants.0.stock'),
  );
});

test('POST /api/products anh khong phai URL tra 400', async (t) => {
  if (skipIfUnavailable(t)) return;

  const res = await postProduct(createBody({ images: ['anh-nhi-phan'] }));

  assert.equal(res.statusCode, 400);
  assert.ok(res.body.details.some((item) => item.field === 'images'));
});

test('POST /api/products trung cap Size-Mau tra 400', async (t) => {
  if (skipIfUnavailable(t)) return;

  const res = await postProduct(
    createBody({
      variants: [
        {
          size: 'M',
          color: 'Đen',
          sku: SKU(993, 'M', 'DEN'),
          stock: 1,
        },
        {
          size: 'M',
          color: 'Đen',
          sku: SKU(994, 'M', 'DEN'),
          stock: 2,
        },
      ],
    }),
  );

  assert.equal(res.statusCode, 400);
  assert.ok(res.body.details.some((item) => item.field === 'variants'));
});

test('POST /api/products SKU sai dinh dang tra 400', async (t) => {
  if (skipIfUnavailable(t)) return;

  const res = await postProduct(
    createBody({
      variants: [
        {
          size: 'M',
          color: 'Đen',
          sku: 'SP-XX-001-M-DEN',
          stock: 1,
        },
      ],
    }),
  );

  assert.equal(res.statusCode, 400);
  assert.ok(
    res.body.details.some((item) => item.field === 'variants.0.sku'),
  );
});

test('POST /api/products admin tao thanh cong', async (t) => {
  if (skipIfUnavailable(t)) return;

  const res = await postProduct(createBody());

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data.id);
  assert.ok(res.body.data.slug);
  assert.equal(res.body.data.basePrice, 199000);
  assert.equal(res.body.data.variants.length, 2);
  assert.equal(res.body.data.totalStock, 15);
  assert.equal(res.body.data.isDeleted, undefined);
  productId = res.body.data.id;
});

test('POST /api/products ten trung tra 409', async (t) => {
  if (skipIfUnavailable(t)) return;

  const res = await postProduct(
    createBody({
      variants: [
        {
          size: 'M',
          color: 'Đen',
          sku: SKU(995, 'M', 'DEN'),
          stock: 1,
        },
      ],
    }),
  );

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.success, false);
});

test('POST /api/products SKU trung toan cuc tra 409', async (t) => {
  if (skipIfUnavailable(t)) return;

  const res = await postProduct(
    createBody({
      name: `${MARKER} Product Duplicate Sku`,
      variants: [
        {
          size: 'M',
          color: 'Đen',
          sku: SKU(990, 'M', 'DEN'),
          stock: 1,
        },
      ],
    }),
  );

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.success, false);
});

test('GET /api/products tra san pham vua tao', async (t) => {
  if (skipIfUnavailable(t)) return;

  const res = await agent.get('/api/products');

  assert.equal(res.statusCode, 200);
  assert.ok(res.body.data.some((item) => item.id === productId));
});

test('GET /api/products/:id tra chi tiet', async (t) => {
  if (skipIfUnavailable(t)) return;

  const res = await agent.get(`/api/products/${productId}`);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.id, productId);
});

test('GET /api/products an san pham inactive voi khach', async (t) => {
  if (skipIfUnavailable(t)) return;

  const createRes = await postProduct(
    createBody({
      name: `${MARKER} Product Inactive`,
      isActive: false,
      variants: [
        {
          size: 'F',
          color: 'Đen',
          sku: SKU(996, 'F', 'DEN'),
          stock: 3,
        },
      ],
    }),
  );

  assert.equal(createRes.statusCode, 201);
  inactiveProductId = createRes.body.data.id;

  const listRes = await agent.get('/api/products');
  assert.ok(!listRes.body.data.some((item) => item.id === inactiveProductId));

  const detailRes = await agent.get(`/api/products/${inactiveProductId}`);
  assert.equal(detailRes.statusCode, 404);

  const adminList = await agent
    .get('/api/products?includeInactive=true')
    .set(authHeader(adminToken));
  assert.ok(adminList.body.data.some((item) => item.id === inactiveProductId));

  const adminDetail = await agent
    .get(`/api/products/${inactiveProductId}?includeInactive=true`)
    .set(authHeader(adminToken));
  assert.equal(adminDetail.statusCode, 200);
});

test('PUT /api/products/:id cap nhat ten, slug va gia', async (t) => {
  if (skipIfUnavailable(t)) return;

  const res = await agent
    .put(`/api/products/${productId}`)
    .set(authHeader(adminToken))
    .set(csrfHeader())
    .send({ name: `${MARKER} Product One Updated`, basePrice: 250000 });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.name, `${MARKER} Product One Updated`);
  assert.equal(res.body.data.basePrice, 250000);
  assert.notEqual(res.body.data.slug, 'prodapitest-product-one');
});

test('PATCH /api/products/:id cap nhat ton kho', async (t) => {
  if (skipIfUnavailable(t)) return;

  const res = await agent
    .patch(`/api/products/${productId}`)
    .set(authHeader(adminToken))
    .set(csrfHeader())
    .send({
      variants: [
        {
          size: 'M',
          color: 'Đen',
          colorCode: '#111111',
          sku: SKU(990, 'M', 'DEN'),
          stock: 7,
          price: 250000,
        },
        {
          size: 'L',
          color: 'Trắng',
          colorCode: '#FFFFFF',
          sku: SKU(990, 'L', 'TRANG'),
          stock: 5,
        },
      ],
    });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.totalStock, 12);
  assert.equal(res.body.data.variants[0].stock, 7);
});

test('PUT /api/products/:id trung cap Size-Mau tra 400', async (t) => {
  if (skipIfUnavailable(t)) return;

  const res = await agent
    .put(`/api/products/${productId}`)
    .set(authHeader(adminToken))
    .set(csrfHeader())
    .send({
      variants: [
        {
          size: 'M',
          color: 'Đen',
          sku: SKU(990, 'M', 'DEN'),
          stock: 1,
        },
        {
          size: 'm',
          color: 'đen',
          sku: SKU(997, 'M', 'DEN'),
          stock: 1,
        },
      ],
    });

  assert.equal(res.statusCode, 400);
  assert.ok(res.body.details.some((item) => item.field === 'variants'));
});

test('PUT /api/products/:id body rong tra 400', async (t) => {
  if (skipIfUnavailable(t)) return;

  const res = await agent
    .put(`/api/products/${productId}`)
    .set(authHeader(adminToken))
    .set(csrfHeader())
    .send({});

  assert.equal(res.statusCode, 400);
});

test('GET /api/products/:id sai dinh dang tra 400 va khong ton tai tra 404', async (t) => {
  if (skipIfUnavailable(t)) return;

  const invalid = await agent.get('/api/products/not-a-valid-id');
  assert.equal(invalid.statusCode, 400);

  const missing = await agent.get(
    `/api/products/${new mongoose.Types.ObjectId()}`,
  );
  assert.equal(missing.statusCode, 404);
});

test('GET /api/products loc size+color chi khop cung mot bien the', async (t) => {
  if (skipIfUnavailable(t)) return;

  const makeProduct = (name, basePrice, variants) =>
    Product.create({
      name: `${MARKER} ${name}`,
      description: 'San pham kiem thu bo loc',
      category: categoryId,
      basePrice,
      variants,
    });

  // P1: co bien the M - Do con hang -> phai khop.
  const match = await makeProduct('Filter Match M Do', 300000, [
    { size: 'M', color: 'Đỏ', sku: SKU(970, 'M', 'DO'), stock: 5 },
    { size: 'L', color: 'Xanh', sku: SKU(970, 'L', 'XANH'), stock: 5 },
  ]);

  // P2: chi co M-Xanh va S-Do (khong cung bien the) -> khong duoc khop.
  const split = await makeProduct('Filter Split M Xanh S Do', 310000, [
    { size: 'M', color: 'Xanh', sku: SKU(971, 'M', 'XANH'), stock: 5 },
    { size: 'S', color: 'Đỏ', sku: SKU(971, 'S', 'DO'), stock: 5 },
  ]);

  // P3: co M-Do nhung het hang -> khong duoc khop.
  const outOfStock = await makeProduct('Filter Out Of Stock', 320000, [
    { size: 'M', color: 'Đỏ', sku: SKU(972, 'M', 'DO'), stock: 0 },
    { size: 'L', color: 'Xanh', sku: SKU(972, 'L', 'XANH'), stock: 0 },
  ]);

  const res = await agent
    .get('/api/products')
    .query({ size: 'M', color: 'Đỏ' });

  assert.equal(res.statusCode, 200);
  const ids = res.body.data.map((item) => item.id);
  assert.ok(ids.includes(match.id));
  assert.ok(!ids.includes(split.id), 'khong duoc ghep M cua bien the nay voi Do cua bien the khac');
  assert.ok(!ids.includes(outOfStock.id), 'bien the M-Do het hang khong duoc khop');

  const lowerCase = await agent
    .get('/api/products')
    .query({ size: 'm', color: 'đỏ' });
  assert.equal(lowerCase.statusCode, 200);
  assert.ok(lowerCase.body.data.some((item) => item.id === match.id));
});

test('GET /api/products loc theo category, khoang gia, keyword, inStock', async (t) => {
  if (skipIfUnavailable(t)) return;

  const otherCategory = await Category.create({
    name: `${MARKER} Filter Other`,
  });
  await Product.create({
    name: `${MARKER} Filter Other Category`,
    category: otherCategory._id,
    basePrice: 200000,
    variants: [
      { size: 'M', color: 'Đỏ', sku: SKU(973, 'M', 'DO'), stock: 5 },
    ],
  });

  const byCategoryId = await agent
    .get('/api/products')
    .query({ category: categoryId, keyword: MARKER });
  assert.equal(byCategoryId.statusCode, 200);
  assert.ok(byCategoryId.body.data.length > 0);
  assert.ok(
    byCategoryId.body.data.every(
      (item) => String(item.category) === String(categoryId),
    ),
  );

  const byCategorySlug = await agent
    .get('/api/products')
    .query({ category: categorySlug });
  assert.equal(byCategorySlug.statusCode, 200);
  assert.ok(byCategorySlug.body.data.some((item) => item.slug.startsWith(MARKER)));

  const byPrice = await agent
    .get('/api/products')
    .query({ category: categoryId, minPrice: 305000, maxPrice: 315000 });
  assert.deepEqual(
    byPrice.body.data.map((item) => item.basePrice),
    [310000],
  );

  const byKeyword = await agent
    .get('/api/products')
    .query({ category: categoryId, keyword: `${MARKER} Filter Split` });
  assert.equal(byKeyword.body.data.length, 1);
  assert.equal(byKeyword.body.data[0].basePrice, 310000);

  const escapedKeyword = await agent
    .get('/api/products')
    .query({ keyword: `${MARKER} Filter Match M.*Do` });
  assert.equal(escapedKeyword.body.data.length, 0);

  const inStock = await agent
    .get('/api/products')
    .query({ category: categoryId, inStock: 'true' });
  assert.ok(inStock.body.data.length > 0);
  assert.ok(
    inStock.body.data.every((item) =>
      item.variants.some((variant) => variant.stock > 0),
    ),
  );

  const invalid = await agent
    .get('/api/products')
    .query({ minPrice: 500000, maxPrice: 100000 });
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.body.success, false);

  await otherCategory.deleteOne();
});

test('DELETE /api/products/:id xoa mem thanh cong', async (t) => {
  if (skipIfUnavailable(t)) return;

  const res = await agent
    .delete(`/api/products/${productId}`)
    .set(authHeader(adminToken))
    .set(csrfHeader());

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);

  const publicDetail = await agent.get(`/api/products/${productId}`);
  assert.equal(publicDetail.statusCode, 404);

  const publicList = await agent.get('/api/products');
  assert.ok(!publicList.body.data.some((item) => item.id === productId));

  const adminList = await agent
    .get('/api/products?includeDeleted=true')
    .set(authHeader(adminToken));
  assert.ok(adminList.body.data.some((item) => item.id === productId));

  const adminDetail = await agent
    .get(`/api/products/${productId}?includeDeleted=true`)
    .set(authHeader(adminToken));
  assert.equal(adminDetail.statusCode, 200);

  const again = await agent
    .delete(`/api/products/${productId}`)
    .set(authHeader(adminToken))
    .set(csrfHeader());
  assert.equal(again.statusCode, 404);
});
