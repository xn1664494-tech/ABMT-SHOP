const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const newman = require('newman');
const app = require('../src/server');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
process.env.JWT_SECRET = JWT_SECRET;
const ISSUER = 'abmt-shop';
const AUDIENCE = 'abmt-shop-client';

const signToken = (sub, role, ver = 0) =>
  jwt.sign({ sub, role, ver }, JWT_SECRET, { issuer: ISSUER, audience: AUDIENCE });

const COLLECTIONS = [
  {
    name: 'Category',
    collection: require('../postman/Category.postman_collection.json'),
  },
  {
    name: 'Product',
    collection: require('../postman/Product.postman_collection.json'),
  },
  {
    name: 'QueryHelper',
    collection: require('../postman/QueryHelper.postman_collection.json'),
  },
  {
    name: 'ProductFilter',
    collection: require('../postman/ProductFilter.postman_collection.json'),
  },
  {
    name: 'ProductPagination',
    collection: require('../postman/ProductPagination.postman_collection.json'),
  },
  {
    name: 'Cart',
    collection: require('../postman/Cart.postman_collection.json'),
  },
];

const runCollection = (collection, environment) =>
  new Promise((resolve) => {
    newman.run({ collection, environment, iterationCount: 1 }, (err, summary) => {
      resolve({ err, summary });
    });
  });

(async () => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;

  await mongoose.connect(uri);
  const Category = require('../src/model/Category');
  const Product = require('../src/model/Products');
  const User = require('../src/model/User');
  await Category.init();
  await Product.init();
  await User.init();

  // Seed san pham co dinh cho collection Cart (gia/variant/sku dung cho assert).
  const cartCategory = await Category.create({
    name: 'Cart Postman Category',
    slug: 'cart-postman-category',
  });
  const cartProduct = await Product.create({
    name: 'Ao Cart Postman',
    slug: 'ao-cart-postman',
    category: cartCategory._id,
    basePrice: 199000,
    variants: [
      { size: 'M', color: 'Den', sku: 'SP-AO-950-M-DEN', stock: 10, price: 199000 },
    ],
    isActive: true,
  });
  const cartVariant = cartProduct.variants[0];

  // Tao thuc te admin va customer user trong DB de authenticate (main) lay duoc.
  // Mat khau duoc hash de collection Cart co the dang nhap bang email/password.
  const passwordHash = await bcrypt.hash('password123', 10);
  const adminUser = await User.create({
    name: 'Admin Test',
    email: 'postman.admin@test.com',
    password: passwordHash,
    role: 'admin',
  });
  const customerUser = await User.create({
    name: 'Customer Test',
    email: 'postman.customer@test.com',
    password: passwordHash,
    role: 'customer',
  });

  const server = app.listen(3099);
  await new Promise((resolve) => server.once('listening', resolve));
  console.log('[postman-test] Server chay tai http://localhost:3099');

  const adminToken = signToken(adminUser._id.toString(), 'admin');
  const customerToken = signToken(customerUser._id.toString(), 'customer');

  const environment = {
    id: 'env-product-test',
    name: 'Category + Product Test Env',
    values: [
      { key: 'baseUrl', value: 'http://localhost:3099', enabled: true },
      { key: 'adminToken', value: adminToken, enabled: true },
      { key: 'customerToken', value: customerToken, enabled: true },
      { key: 'cartProductId', value: cartProduct._id.toString(), enabled: true },
      {
        key: 'cartProductPrice',
        value: String(cartVariant.price != null ? cartVariant.price : cartProduct.basePrice),
        enabled: true,
      },
      { key: 'cartSku', value: cartVariant.sku, enabled: true },
    ],
  };

  let failed = false;
  let totalAssertionsAll = 0;
  let failedAssertionsAll = 0;
  let failedRequestsAll = 0;

  for (const { name, collection } of COLLECTIONS) {
    console.log(`[postman-test][${name}] Chay newman...`);
    const { err, summary } = await runCollection(collection, environment);

    if (err) {
      console.error(`[postman-test][${name}] Newman loi:`, err.message);
      failed = true;
      continue;
    }

    const run = summary.run || {};
    const stats = run.stats || {};
    const totalAssertions = (stats.assertions && stats.assertions.total) || 0;
    const failedAssertions = (stats.assertions && stats.assertions.failed) || 0;
    const failedRequests = (stats.requests && stats.requests.failed) || 0;

    totalAssertionsAll += totalAssertions;
    failedAssertionsAll += failedAssertions;
    failedRequestsAll += failedRequests;

    console.log(
      `[postman-test][${name}] Ket qua: ${totalAssertions - failedAssertions}/${totalAssertions} assertions, ${failedRequests} yeu cau that bai`,
    );

    if (run.failures && run.failures.length > 0) {
      run.failures.forEach((failure) => {
        console.log(
          `[postman-test][${name}] THAT BAI: ${
            failure.source && failure.source.name ? failure.source.name : 'request'
          } | ${failure.error && failure.error.message ? failure.error.message : failure.error}`,
        );
      });
    }

    if (failedAssertions > 0 || failedRequests > 0) failed = true;
  }

  console.log(
    `[postman-test] TONG: ${totalAssertionsAll - failedAssertionsAll}/${totalAssertionsAll} assertions, ${failedRequestsAll} yeu cau that bai`,
  );

  server.close();
  mongoose.disconnect();
  mongod.stop();
  process.exit(failed ? 1 : 0);
})();
