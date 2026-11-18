const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const newman = require('newman');
const app = require('../src/server');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
process.env.JWT_SECRET = JWT_SECRET;
const ISSUER = 'abmt-shop';
const AUDIENCE = 'abmt-shop-client';

const signToken = (sub, role, ver = 0) =>
  jwt.sign({ sub, role, ver }, JWT_SECRET, { issuer: ISSUER, audience: AUDIENCE });

(async () => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;

  await mongoose.connect(uri);
  const Category = require('../src/model/Category');
  const User = require('../src/model/User');
  await Category.init();
  await User.init();

  // Tao thuc te admin va customer user trong DB de authenticate (main) lay duoc
  const adminUser = await User.create({
    name: 'Admin Test',
    email: 'postman.admin@test.com',
    password: 'password123',
    role: 'admin',
  });
  const customerUser = await User.create({
    name: 'Customer Test',
    email: 'postman.customer@test.com',
    password: 'password123',
    role: 'customer',
  });

  const server = app.listen(3099);
  await new Promise((resolve) => server.once('listening', resolve));
  console.log('[postman-test] Server chay tai http://localhost:3099');

  const adminToken = signToken(adminUser._id.toString(), 'admin');
  const customerToken = signToken(customerUser._id.toString(), 'customer');

  const collection = require('../postman/Category.postman_collection.json');
  const environment = {
    id: 'env-category-test',
    name: 'Category Test Env',
    values: [
      { key: 'baseUrl', value: 'http://localhost:3099', enabled: true },
      { key: 'adminToken', value: adminToken, enabled: true },
      { key: 'customerToken', value: customerToken, enabled: true },
    ],
  };

  console.log('[postman-test] Chay newman...');
  newman.run(
    { collection, environment, iterationCount: 1 },
    (err, summary) => {
      let failed = false;
      if (err) {
        console.error('[postman-test] Newman loi:', err.message);
        failed = true;
      } else {
        const run = summary.run || {};
        const stats = run.stats || {};
        const totalAssertions = (stats.assertions && stats.assertions.total) || 0;
        const failedAssertions = (stats.assertions && stats.assertions.failed) || 0;
        const passedAssertions = totalAssertions - failedAssertions;
        const failedRequests = (stats.requests && stats.requests.failed) || 0;
        console.log(
          `[postman-test] Ket qua: ${passedAssertions}/${totalAssertions} assertions, ${failedRequests} yeu cau that bai, ${failedAssertions} yeu cau kiem tra that bai`,
        );
        if (run.failures && run.failures.length > 0) {
          run.failures.forEach((f) => {
            console.log(
              `[postman-test] THAT BAI: ${f.test && f.test.name ? f.test.name : f.test} | ${f.error && f.error.message ? f.error.message : f.error}`,
            );
          });
        }
        if (failedAssertions > 0 || failedRequests > 0) failed = true;
      }
      server.close();
      mongoose.disconnect();
      mongod.stop();
      process.exit(failed ? 1 : 0);
    },
  );
})();
