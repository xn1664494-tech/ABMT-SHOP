const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env.test'), quiet: true });

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'query-evidence-jwt-secret-at-least-32-chars';
process.env.JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
process.env.APP_ORIGIN = process.env.APP_ORIGIN || 'http://localhost:3000';
process.env.AUTH_RATE_LIMIT_MAX = process.env.AUTH_RATE_LIMIT_MAX || '10000';

const mongoose = require('mongoose');
const request = require('supertest');

const LEGACY_TEST_URI = process.env.TEST_MONGODB_URI;
const TEST_URI = process.env.MONGODB_URI_TEST || LEGACY_TEST_URI;
const LABEL = process.argv.includes('--label=after') ? 'after' : 'before';

const idFor = (key) =>
  new mongoose.Types.ObjectId(
    crypto.createHash('md5').update(`T7-2-2:${key}`).digest('hex').slice(0, 24),
  );

const ARTIFACT_DIR = path.resolve(__dirname, '../docs/reports/artifacts/T7-2-2');
const BEFORE_JSON = path.join(ARTIFACT_DIR, 'before.json');
const AFTER_JSON = path.join(ARTIFACT_DIR, 'after.json');
const SUMMARY_TXT = path.join(ARTIFACT_DIR, 'summary.txt');

const CUSTOMER_ID = idFor('user:customer');
const ADMIN_ID = idFor('user:admin');
const ROOT_CATEGORY_ID = idFor('category:root');
const CHILD_A_CATEGORY_ID = idFor('category:child-a');
const CHILD_B_CATEGORY_ID = idFor('category:child-b');
const PRODUCT_IDS = Array.from({ length: 5 }, (_, index) => idFor(`product:${index}`));
const USER_CART_ID = idFor('cart:user');
const GUEST_CART_ID = idFor('cart:guest');
const GUEST_SESSION = 't722-evidence-guest-session';
const USER_IDS = [CUSTOMER_ID, ADMIN_ID];
const CATEGORY_IDS = [ROOT_CATEGORY_ID, CHILD_A_CATEGORY_ID, CHILD_B_CATEGORY_ID];
const ORDER_IDS = Array.from({ length: 7 }, (_, index) => idFor(`order:${index}`));

const READ_METHODS = new Set([
  'find',
  'findOne',
  'findOneAndDelete',
  'count',
  'countDocuments',
  'estimatedDocumentCount',
  'distinct',
  'aggregate',
]);
const WRITE_METHODS = new Set([
  'insertOne',
  'insertMany',
  'updateOne',
  'updateMany',
  'deleteOne',
  'deleteMany',
  'findOneAndUpdate',
  'findOneAndReplace',
  'replaceOne',
  'save',
  'bulkWrite',
]);

let counting = false;
let counts = {};
const terminalLines = [];

const log = (line = '') => {
  terminalLines.push(line);
  console.log(line);
};

const sanitize = (value) => {
  let text = String(value === undefined || value === null ? '' : value);
  if (TEST_URI) text = text.split(TEST_URI).join('<redacted-uri>');
  text = text.replace(/mongodb(\+srv)?:\/\/[^\s"'`]+/gi, '<redacted-uri>');
  text = text.replace(/\b(?:password|passwd|pwd)=([^\s&"']+)/gi, 'password=<redacted>');
  return text;
};

const databaseNameOf = (uri) => {
  try {
    const withoutParams = uri.split('?')[0];
    const afterScheme = withoutParams.replace(/^mongodb(\+srv)?:\/\//, '');
    const afterAt = afterScheme.includes('@')
      ? afterScheme.slice(afterScheme.lastIndexOf('@') + 1)
      : afterScheme;
    const slash = afterAt.indexOf('/');
    return slash >= 0 ? afterAt.slice(slash + 1) : '';
  } catch {
    return '';
  }
};

const providerOf = (uri) => {
  if (/mongodb\.net/i.test(uri)) return 'MongoDB Atlas';
  if (/127\.0\.0\.1|localhost/i.test(uri)) return 'self-hosted (localhost)';
  return 'self-hosted';
};

const skuFor = (index) => `SP-AO-${String(901 + index).padStart(3, '0')}-M-DEN`;

const address = () => ({
  fullName: 'Nguyen Van A',
  phone: '0912345678',
  province: 'Ha Noi',
  district: 'Cau Giay',
  ward: 'Dich Vong',
  detail: '1 Nguyen Trai',
});

const writeArtifact = (file, content) => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
};

const writeJson = (file, data) =>
  writeArtifact(file, `${JSON.stringify(data, null, 2)}\n`);

const writeTerminalLog = () => {
  if (!terminalLines.length) return;
  writeArtifact(path.join(ARTIFACT_DIR, `terminal-${LABEL}.txt`), `${terminalLines.join('\n')}\n`);
};

const methodOf = (key) => key.slice(key.lastIndexOf('.') + 1);

const sumMethods = (bucket, methods) =>
  Object.entries(bucket).reduce(
    (total, [key, value]) => total + (methods.has(methodOf(key)) ? value : 0),
    0,
  );

const scenario = async (name, fn) => {
  counts = {};
  counting = true;
  const startedAt = Date.now();
  let response = null;
  let error = null;

  try {
    response = await fn();
  } catch (caught) {
    error = caught;
  } finally {
    counting = false;
  }

  const snapshot = JSON.parse(JSON.stringify(counts));
  return {
    name,
    status: response ? response.status : 'ERR',
    ms: Date.now() - startedAt,
    readQueries: sumMethods(snapshot, READ_METHODS),
    writeQueries: sumMethods(snapshot, WRITE_METHODS),
    totalQueries: Object.values(snapshot).reduce((total, value) => total + value, 0),
    byMethod: snapshot,
    ...(error ? { error: sanitize(error.message) } : {}),
  };
};

const collectStages = (node, acc = []) => {
  if (!node) return acc;
  if (Array.isArray(node)) {
    for (const item of node) collectStages(item, acc);
    return acc;
  }
  if (typeof node !== 'object') return acc;
  if (node.stage) acc.push(node);

  for (const key of [
    'inputStage',
    'inputStages',
    'queryPlan',
    'winningPlan',
    'executionStages',
    'shards',
  ]) {
    if (node[key]) collectStages(node[key], acc);
  }
  return acc;
};

const summarizeExplain = (name, explain) => {
  const stats = explain.executionStats || {};
  const stages = collectStages(stats.executionStages);
  const names = [...new Set(stages.map((stage) => stage.stage).filter(Boolean))];
  const indexes = [
    ...new Set(
      stages
        .map((stage) => stage.indexName)
        .filter((value) => typeof value === 'string' && value !== '_id_'),
    ),
  ];

  return {
    name,
    stages: names,
    winningIndex: indexes[0] || stages.find((stage) => stage.indexName)?.indexName || null,
    indexNames: indexes,
    hasCollscan: names.some((stage) => /COLLSCAN/i.test(stage)),
    hasSort: names.some((stage) => /SORT/i.test(stage)),
    totalKeysExamined: stats.totalKeysExamined ?? null,
    totalDocsExamined: stats.totalDocsExamined ?? null,
    nReturned: stats.nReturned ?? null,
    executionTimeMillis: stats.executionTimeMillis ?? null,
  };
};

const runExplain = async (name, buildExplain) => {
  try {
    return summarizeExplain(name, await buildExplain());
  } catch (error) {
    return { name, error: sanitize(error.message) };
  }
};

const getCsrf = async () => {
  const response = await request(app).get('/api/auth/csrf');
  const cookie = (response.headers['set-cookie'] || [])
    .map((item) => item.split(';')[0])
    .find((item) => item.startsWith('csrfToken='));
  return { token: response.body?.data?.csrfToken, cookie };
};

const cookieFor = (user, csrf = null) =>
  [
    `accessToken=${signAccessToken({
      _id: user._id,
      role: user.role,
      tokenVersion: user.tokenVersion,
    })}`,
    csrf && csrf.cookie,
  ]
    .filter(Boolean)
    .join('; ');

const cleanup = async () => {
  const Order = require('../src/model/Order');
  const Cart = require('../src/model/Cart');
  const PhoneVerification = require('../src/model/PhoneVerification');
  const Product = require('../src/model/Products');
  const Category = require('../src/model/Category');
  const User = require('../src/model/User');

  await Order.deleteMany({ _id: { $in: ORDER_IDS } });
  await Order.deleteMany({ user: { $in: USER_IDS } });
  await Cart.deleteMany({
    $or: [{ _id: { $in: [USER_CART_ID, GUEST_CART_ID] } }, { sessionId: GUEST_SESSION }],
  });
  await Cart.deleteMany({ user: { $in: USER_IDS } });
  await PhoneVerification.deleteMany({ user: { $in: USER_IDS } });
  await Product.deleteMany({ _id: { $in: PRODUCT_IDS } });
  await Category.deleteMany({ _id: { $in: CATEGORY_IDS } });
  await User.deleteMany({ _id: { $in: USER_IDS } });
};

const seed = async () => {
  const User = require('../src/model/User');
  const Category = require('../src/model/Category');
  const Product = require('../src/model/Products');
  const Cart = require('../src/model/Cart');
  const PhoneVerification = require('../src/model/PhoneVerification');
  const Order = require('../src/model/Order');

  const customer = await User.create({
    _id: CUSTOMER_ID,
    name: 'T7-2-2 Customer',
    email: 't722-customer@example.test',
    password: 'hashed-password-not-used',
    role: 'customer',
    status: 'active',
    phone: '0912345678',
    phoneVerified: true,
    phoneVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
  });

  const admin = await User.create({
    _id: ADMIN_ID,
    name: 'T7-2-2 Admin',
    email: 't722-admin@example.test',
    password: 'hashed-password-not-used',
    role: 'admin',
    status: 'active',
    phone: '0912345678',
    phoneVerified: true,
    phoneVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
  });

  await Category.create([
    {
      _id: ROOT_CATEGORY_ID,
      name: 'T722 Nam Root',
      slug: 't722-nam-root',
      isVisible: true,
    },
    {
      _id: CHILD_A_CATEGORY_ID,
      name: 'T722 Ao Nam',
      slug: 't722-ao-nam',
      parentId: ROOT_CATEGORY_ID,
      isVisible: true,
    },
    {
      _id: CHILD_B_CATEGORY_ID,
      name: 'T722 Quan Nam',
      slug: 't722-quan-nam',
      parentId: ROOT_CATEGORY_ID,
      isVisible: true,
    },
  ]);

  await Product.create(
    PRODUCT_IDS.map((productId, index) => ({
      _id: productId,
      name: `T7-2-2 Product ${index}`,
      slug: `t722-product-${index}`,
      category: index % 2 === 0 ? CHILD_A_CATEGORY_ID : CHILD_B_CATEGORY_ID,
      basePrice: 300000 + index * 10000,
      images: ['https://cdn.example.com/t722.jpg'],
      description: 'San pham phuc vu evidence T7-2-2',
      isActive: true,
      isDeleted: false,
      variants: [
        {
          size: 'M',
          color: 'Den',
          sku: skuFor(index),
          stock: 20,
          price: 300000 + index * 10000,
        },
      ],
    })),
  );

  const cartItems = PRODUCT_IDS.map((productId, index) => ({
    product: productId,
    sku: skuFor(index),
    size: 'M',
    color: 'Den',
    qty: 1,
    unitPrice: 300000 + index * 10000,
  }));

  await Cart.create({
    _id: USER_CART_ID,
    user: CUSTOMER_ID,
    items: cartItems.map((item) => ({ ...item })),
  });
  await Cart.create({
    _id: GUEST_CART_ID,
    sessionId: GUEST_SESSION,
    items: cartItems.map((item) => ({ ...item })),
    expiresAt: new Date(Date.now() + 86400000),
  });

  await PhoneVerification.create(
    [1, 2, 3].map((value) => ({
      user: CUSTOMER_ID,
      phone: '0912345678',
      codeHash: `hash-${value}`,
      expiresAt: new Date(Date.now() + value * 60000),
      createdAt: new Date(Date.now() - value * 60000),
    })),
  );

  const statuses = ['pending', 'pending', 'confirmed', 'shipping', 'delivered', 'delivered', 'cancelled'];
  await Order.create(
    ORDER_IDS.map((orderId, index) => ({
      _id: orderId,
      user: CUSTOMER_ID,
      code: undefined,
      status: statuses[index],
      statusHistory: [
        { status: statuses[index], at: new Date(Date.now() - index * 60000), by: CUSTOMER_ID },
      ],
      items: [
        {
          product: PRODUCT_IDS[index % PRODUCT_IDS.length],
          name: `T7-2-2 Product ${index}`,
          image: 'https://cdn.example.com/t722.jpg',
          sku: skuFor(index % PRODUCT_IDS.length),
          size: 'M',
          color: 'Den',
          unitPrice: 300000,
          qty: 1,
          lineTotal: 300000,
        },
      ],
      shippingAddress: address(),
      paymentMethod: 'cod',
      paymentStatus: statuses[index] === 'delivered' ? 'paid' : 'unpaid',
      subtotal: 300000,
      shippingFee: 0,
      discount: 0,
      total: 300000,
      createdAt: new Date(Date.now() - index * 3600000),
    })),
  );

  return { customer, admin };
};

const buildSummary = (report) => {
  const beforeMap = new Map(report.before.endpoints.map((item) => [item.name, item]));
  const endpointLines = [
    '| Endpoint | Read before | Read after | Write before | Write after | Total before | Total after |',
    '|---|---:|---:|---:|---:|---:|---:|',
  ];

  for (const after of report.after.endpoints) {
    const before = beforeMap.get(after.name);
    endpointLines.push(
      `| ${after.name} | ${before?.readQueries ?? '-'} | ${after.readQueries} | ${before?.writeQueries ?? '-'} | ${after.writeQueries} | ${before?.totalQueries ?? '-'} | ${after.totalQueries} |`,
    );
  }

  const explainBefore = new Map(report.before.explains.map((item) => [item.name, item]));
  const explainLines = [
    '',
    '| Explain | Index before | Index after | COLLSCAN before/after | SORT before/after |',
    '|---|---|---|---|---|',
  ];

  for (const after of report.after.explains) {
    const before = explainBefore.get(after.name);
    explainLines.push(
      `| ${after.name} | ${before?.winningIndex || '-'} | ${after.winningIndex || '-'} | ${before?.hasCollscan ?? '-'}/${after.hasCollscan} | ${before?.hasSort ?? '-'}/${after.hasSort} |`,
    );
  }

  return [
    `T7-2-2 query optimization evidence (${LABEL})`,
    `Provider: ${report.environment.provider}`,
    `Database: ${report.environment.databaseName}`,
    `MongoDB: ${report.environment.mongoVersion}`,
    `Node: ${report.environment.nodeVersion}`,
    '',
    ...endpointLines,
    '',
    ...explainLines,
    '',
    'Artifacts khong chua URI hoac credentials.',
  ].join('\n');
};

let app;
let signAccessToken;
let User;
let Category;
let Product;
let Order;
let PhoneVerification;

const main = async () => {
  if (!TEST_URI) throw new Error('Thieu MONGODB_URI_TEST / TEST_MONGODB_URI');

  const dbName = databaseNameOf(TEST_URI);
  if (!dbName || !/test/i.test(dbName)) {
    throw new Error('MONGODB_URI_TEST phai tro toi database co ten chua "test"');
  }

  app = require('../src/app');
  User = require('../src/model/User');
  Category = require('../src/model/Category');
  Product = require('../src/model/Products');
  Order = require('../src/model/Order');
  PhoneVerification = require('../src/model/PhoneVerification');
  ({ signAccessToken } = require('../src/services/tokenService'));

  await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 10000 });
  await Promise.all([
    User.init(),
    Category.init(),
    Product.init(),
    Order.init(),
    PhoneVerification.init(),
  ]);

  await cleanup();
  const { customer, admin } = await seed();

  const customerCookie = cookieFor(customer);
  const adminCookie = cookieFor(admin);
  const csrf = await getCsrf();
  const customerCookieWithCsrf = cookieFor(customer, csrf);
  const customerCookieWithGuestCart = `${customerCookieWithCsrf}; cartId=${GUEST_SESSION}`;

  log(`T7-2-2 evidence ${LABEL}`);
  log(`Provider: ${providerOf(TEST_URI)}`);
  log(`Database: ${dbName}`);
  log(`MongoDB: ${(await mongoose.connection.db.admin().serverInfo()).version}`);
  log(`Node: ${process.version}`);

  mongoose.set('debug', (collection, method) => {
    if (!counting) return;
    const key = `${collection}.${method}`;
    counts[key] = (counts[key] || 0) + 1;
  });

  const endpoints = [];

  endpoints.push(
    await scenario('GET /api/cart (5 items)', () =>
      request(app).get('/api/cart').set('Cookie', customerCookie).expect(200),
    ),
  );

  endpoints.push(
    await scenario('POST /api/cart/merge (5 guest items)', () =>
      request(app)
        .post('/api/cart/merge')
        .set('Cookie', customerCookieWithGuestCart)
        .set('X-CSRF-Token', csrf.token || '')
        .send({})
        .expect(200),
    ),
  );

  endpoints.push(
    await scenario('GET /account?tab=orders', () =>
      request(app).get('/account?tab=orders').set('Cookie', customerCookie).expect(200),
    ),
  );

  endpoints.push(
    await scenario('GET /admin/orders', () =>
      request(app).get('/admin/orders').set('Cookie', adminCookie).expect(200),
    ),
  );

  endpoints.push(
    await scenario('GET /admin/users', () =>
      request(app).get('/admin/users').set('Cookie', adminCookie).expect(200),
    ),
  );

  endpoints.push(
    await scenario('GET /api/products?category=t722-nam-root', () =>
      request(app)
        .get('/api/products?category=t722-nam-root&limit=20')
        .expect(200),
    ),
  );

  endpoints.push(
    await scenario('POST /api/orders (5 items)', () =>
      request(app)
        .post('/api/orders')
        .set('Cookie', customerCookieWithCsrf)
        .set('X-CSRF-Token', csrf.token || '')
        .send({ address: address(), paymentMethod: 'cod' })
        .expect(201),
    ),
  );

  for (const item of endpoints) {
    log(
      `${item.name}: read=${item.readQueries} write=${item.writeQueries} total=${item.totalQueries} status=${item.status} ms=${item.ms}`,
    );
  }

  const explains = [];
  explains.push(
    await runExplain('Order.find({}).sort(createdAt)', () =>
      Order.find({}).sort({ createdAt: -1 }).limit(100).explain('executionStats'),
    ),
  );
  explains.push(
    await runExplain('Order.aggregate(status by user)', () =>
      Order.aggregate([
        { $match: { user: CUSTOMER_ID } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]).explain('executionStats'),
    ),
  );
  explains.push(
    await runExplain('User.admin list sort createdAt', () =>
      User.find({ isDeleted: false })
        .sort({ createdAt: -1, _id: -1 })
        .limit(20)
        .explain('executionStats'),
    ),
  );
  explains.push(
    await runExplain('PhoneVerification.latest by user', () =>
      PhoneVerification.findOne({ user: CUSTOMER_ID })
        .sort({ createdAt: -1 })
        .explain('executionStats'),
    ),
  );
  explains.push(
    await runExplain('Product.category list sort createdAt', () =>
      Product.find({
        category: { $in: [CHILD_A_CATEGORY_ID, CHILD_B_CATEGORY_ID] },
        isActive: true,
        isDeleted: false,
      })
        .sort({ createdAt: -1, _id: -1 })
        .limit(20)
        .explain('executionStats'),
    ),
  );

  for (const item of explains) {
    log(
      `EXPLAIN ${item.name}: index=${item.winningIndex || '-'} collscan=${item.hasCollscan ?? '-'} sort=${item.hasSort ?? '-'}`,
    );
  }

  const serverInfo = await mongoose.connection.db.admin().serverInfo();
  const report = {
    label: LABEL,
    generatedAt: new Date().toISOString(),
    environment: {
      provider: providerOf(TEST_URI),
      databaseName: dbName,
      mongoVersion: serverInfo.version,
      nodeVersion: process.version,
      topology:
        mongoose.connection.client && mongoose.connection.client.topology
          ? mongoose.connection.client.topology.description
          : null,
    },
    seed: {
      users: 2,
      categories: 3,
      products: PRODUCT_IDS.length,
      carts: 2,
      orders: ORDER_IDS.length,
      phoneVerifications: 3,
      deterministicIds: true,
    },
    endpoints,
    explains,
  };

  writeJson(LABEL === 'before' ? BEFORE_JSON : AFTER_JSON, report);

  if (LABEL === 'after' && fs.existsSync(BEFORE_JSON)) {
    const before = JSON.parse(fs.readFileSync(BEFORE_JSON, 'utf8'));
    writeArtifact(SUMMARY_TXT, `${buildSummary({ before, after: report, environment: report.environment })}\n`);
    log(`Da ghi ${path.relative(process.cwd(), SUMMARY_TXT)}`);
  }

  if (endpoints.some((item) => item.status === 'ERR')) {
    throw new Error('Co endpoint evidence bi loi; xem artifact de biet chi tiet');
  }
};

main()
  .catch((error) => {
    log(`ERROR: ${sanitize(error.message)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanup();
    } catch (error) {
      log(`CLEANUP ERROR: ${sanitize(error.message)}`);
      process.exitCode = 1;
    }
    try {
      if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    } catch (error) {
      log(`DISCONNECT ERROR: ${sanitize(error.message)}`);
      process.exitCode = 1;
    }
    writeTerminalLog();
  });
