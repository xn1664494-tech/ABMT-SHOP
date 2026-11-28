const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env.test'), quiet: true });

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-jwt-secret-at-least-32-chars';
process.env.JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
process.env.APP_ORIGIN = process.env.APP_ORIGIN || 'http://localhost:3000';
process.env.AUTH_RATE_LIMIT_MAX = process.env.AUTH_RATE_LIMIT_MAX || '10000';

const mongoose = require('mongoose');
const request = require('supertest');

const LEGACY_TEST_URI = process.env.TEST_MONGODB_URI;
const TEST_URI = process.env.MONGODB_URI_TEST || LEGACY_TEST_URI;

const REQUESTS = (() => {
  const value = parseInt(process.env.CONCURRENCY_REQUESTS, 10);
  return Number.isInteger(value) && value > 0 ? value : 20;
})();

const ROUNDS = (() => {
  const value = parseInt(process.env.CONCURRENCY_ROUNDS, 10);
  return Number.isInteger(value) && value > 0 ? value : 3;
})();

const RUN_ID = `evidence-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const ARTIFACT_DIR = path.resolve(__dirname, '../docs/reports/artifacts/T7-2-1');
const RESULTS_JSON = path.join(ARTIFACT_DIR, 'results.json');
const RESULTS_HTML = path.join(ARTIFACT_DIR, 'results.html');
const TERMINAL_LOG = path.join(ARTIFACT_DIR, 'terminal.log');

const created = { users: [], categories: [], products: [], carts: [] };
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

const fail = (message) => {
  log(`ERROR: ${sanitize(message)}`);
  writeTerminalLog();
  process.exit(1);
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
  } catch (error) {
    return '';
  }
};

const providerOf = (uri) => {
  if (/mongodb\.net/i.test(uri)) return 'MongoDB Atlas';
  if (/127\.0\.0\.1|localhost/i.test(uri)) return 'self-hosted (localhost)';
  return 'self-hosted';
};

const address = () => ({
  fullName: 'Nguyen Van A',
  phone: '0912345678',
  province: 'Ha Noi',
  district: 'Cau Giay',
  ward: 'Dich Vong',
  detail: '1 Nguyen Trai',
});

const timed = async (fn) => {
  const start = Date.now();
  try {
    const response = await fn();
    return { status: response.status, ms: Date.now() - start, response };
  } catch (error) {
    return { status: 'ERR', ms: Date.now() - start, error };
  }
};

const writeTerminalLog = () => {
  try {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    fs.writeFileSync(TERMINAL_LOG, `${terminalLines.join('\n')}\n`, 'utf8');
  } catch (error) {
    console.error(`Khong ghi duoc terminal.log: ${sanitize(error.message)}`);
  }
};

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const renderHtml = (report) => {
  const rows = report.rounds
    .map(
      (round) => `<tr>
        <td>${round.round}</td>
        <td>${round.requests}</td>
        <td class="ok">${round.successCount}</td>
        <td class="bad">${round.conflictCount}</td>
        <td>${round.stockAfter}</td>
        <td>${round.orderCount}</td>
        <td>${round.timings.avgMs} / ${round.timings.maxMs}</td>
        <td>${round.verdict === 'PASS' ? '<span class="pass">PASS</span>' : '<span class="fail">FAIL</span>'}</td>
      </tr>`,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>T7-2-1 - Concurrency stock evidence</title>
<style>
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 32px; color: #1f2933; }
  h1 { margin: 0 0 4px; font-size: 22px; }
  .meta { color: #52606d; font-size: 14px; margin-bottom: 20px; }
  table { border-collapse: collapse; width: 100%; max-width: 920px; }
  th, td { border: 1px solid #d9e2ec; padding: 8px 10px; text-align: left; font-size: 14px; }
  th { background: #f0f4f8; }
  .ok { color: #0b7a3b; font-weight: 600; }
  .bad { color: #a4262c; font-weight: 600; }
  .pass { color: #0b7a3b; font-weight: 700; }
  .fail { color: #a4262c; font-weight: 700; }
  .box { max-width: 920px; background: #f8fafc; border: 1px solid #e1e8ed; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 14px; }
  code { background: #eef2f6; padding: 1px 5px; border-radius: 4px; }
</style>
</head>
<body>
  <h1>ABMT SHOP - T7-2-1 Test dong thoi kho</h1>
  <div class="meta">Sinh luc: ${escapeHtml(report.generatedAt)} | Nguon: chay that tren MongoDB (khong co URI/credential trong file nay)</div>
  <div class="box">
    <div><strong>Task:</strong> T7-2-1 - Test dong thoi kho (Dev 2 - Phase 4)</div>
    <div><strong>MongoDB:</strong> ${escapeHtml(report.environment.provider)} | ${escapeHtml(report.environment.topology)} | phien ban ${escapeHtml(report.environment.mongoVersion)} | replica set: ${escapeHtml(report.environment.replicaSet || 'khong co')}</div>
    <div><strong>Node:</strong> ${escapeHtml(report.environment.nodeVersion)} | <strong>Cau hinh:</strong> ${report.config.requests} request dong thoi x ${report.config.rounds} vong</div>
    <div><strong>Ket luan DoD:</strong> ${report.verdict === 'PASS' ? '<span class="pass">PASS</span>' : '<span class="fail">FAIL</span>'}</div>
  </div>
  <table>
    <thead>
      <tr><th>Vong</th><th>Request</th><th>201</th><th>409</th><th>Ton kho sau</th><th>So don</th><th>avg/max (ms)</th><th>Ket qua</th></tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  <p class="meta">Thoi gian chi de tham khao, khong dung lam dieu kien assert.</p>
</body>
</html>
`;
};

const seedUsers = async (User, count, label) => {
  const docs = await User.create(
    Array.from({ length: count }, (_, index) => ({
      name: `Concurrency ${label} ${index + 1} ${RUN_ID}`,
      email: `concurrency-${RUN_ID}-${label}-${index + 1}@example.com`,
      password: 'hashed-password-not-used',
      phone: '0912345678',
      phoneVerified: true,
      role: 'customer',
      status: 'active',
    })),
  );
  created.users.push(...docs.map((doc) => doc._id));
  return docs;
};

const seedProduct = async (Category, Product, suffix, stock) => {
  const category = await Category.create({ name: `Concurrency ${RUN_ID} ${suffix}` });
  created.categories.push(category._id);

  const sku = `SP-AO-${Math.floor(Math.random() * 900) + 100}-M-DEN`;
  const product = await Product.create({
    name: `Concurrency ${RUN_ID} ${suffix}`,
    category: category._id,
    basePrice: 199000,
    images: ['https://example.com/concurrency.jpg'],
    variants: [{ sku, size: 'M', color: 'DEN', stock, price: 199000 }],
  });
  created.products.push(product._id);
  return { product, sku };
};

const seedCarts = async (Cart, users, product, sku) => {
  const carts = await Cart.insertMany(
    users.map((user) => ({
      user: user._id,
      items: [
        {
          product: product._id,
          sku,
          size: 'M',
          color: 'DEN',
          qty: 1,
          unitPrice: 199000,
        },
      ],
    })),
  );
  created.carts.push(...carts.map((cart) => cart._id));
  return carts;
};

const cleanup = async (models) => {
  const { User, Category, Product, Order, Cart } = models;
  try {
    await Order.deleteMany({ user: { $in: created.users } });
    await Cart.deleteMany({ _id: { $in: created.carts } });
    await Product.deleteMany({ _id: { $in: created.products } });
    await Category.deleteMany({ _id: { $in: created.categories } });
    await User.deleteMany({ _id: { $in: created.users } });
  } catch (error) {
    log(`WARN: don dep du lieu test that bai: ${sanitize(error.message)}`);
  }
};

async function main() {
  if (!TEST_URI) {
    fail('Thieu MONGODB_URI_TEST trong .env.test. Khong tu chuyen sang MemoryServer.');
  }

  const dbName = databaseNameOf(TEST_URI);
  if (!dbName || !dbName.toLowerCase().includes('test')) {
    fail('MONGODB_URI_TEST phai tro toi database co ten chua "test".');
  }

  let app;
  let models;
  try {
    app = require('../src/app');
    models = {
      User: require('../src/model/User'),
      Category: require('../src/model/Category'),
      Product: require('../src/model/Products'),
      Order: require('../src/model/Order'),
      Cart: require('../src/model/Cart'),
    };
  } catch (error) {
    fail(`Khong nap duoc ung dung: ${sanitize(error.message)}`);
  }

  const { signAccessToken } = require('../src/services/tokenService');

  try {
    await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 10000 });
  } catch (error) {
    fail(`Khong ket noi duoc MongoDB test (${sanitize(error.name)}). Khong tu chuyen sang MemoryServer.`);
  }

  const environment = {
    provider: providerOf(TEST_URI),
    topology: 'unknown',
    mongoVersion: 'unknown',
    replicaSet: null,
    nodeVersion: process.version,
  };

  const report = {
    task: 'T7-2-1',
    name: 'Test dong thoi kho',
    generatedAt: new Date().toISOString(),
    environment,
    config: { requests: REQUESTS, rounds: ROUNDS },
    rounds: [],
    verdict: 'FAIL',
  };

  try {
    const admin = mongoose.connection.db.admin();
    const buildInfo = await admin.command({ buildInfo: 1 });
    environment.mongoVersion = buildInfo.version || 'unknown';

    let hello = null;
    try {
      hello = await admin.command({ hello: 1 });
    } catch (error) {
      hello = await admin.command({ isMaster: 1 });
    }
    if (hello && hello.msg === 'isdbgrid') {
      environment.topology = 'sharded';
    } else if (hello && hello.setName) {
      environment.topology = 'replicaSet';
      environment.replicaSet = hello.setName;
    } else {
      environment.topology = 'standalone';
    }
  } catch (error) {
    log(`WARN: khong doc duoc thong tin MongoDB: ${sanitize(error.message)}`);
  }

  log('=== ABMT SHOP - T7-2-1 Test dong thoi kho ===');
  log(`MongoDB: ${environment.provider} | ${environment.topology} | v${environment.mongoVersion} | replicaSet=${environment.replicaSet || 'none'}`);
  log(`Node: ${environment.nodeVersion}`);
  log(`Cau hinh: ${REQUESTS} request dong thoi x ${ROUNDS} vong`);
  log('');

  const { User, Category, Product, Order, Cart } = models;
  let allPassed = true;

  try {
    await Promise.all([
      User.init(),
      Category.init(),
      Product.init(),
      Order.init(),
      Cart.init(),
    ]);

    for (let round = 0; round < ROUNDS; round += 1) {
      const { product, sku } = await seedProduct(Category, Product, `multi-user-${round + 1}`, 1);
      const users = await seedUsers(User, REQUESTS, `multi-${round + 1}`);
      await seedCarts(Cart, users, product, sku);

      const results = await Promise.all(
        users.map((user) =>
          timed(() =>
            request(app)
              .post('/api/orders')
              .set('Cookie', [
                `accessToken=${signAccessToken({
                  _id: user._id,
                  role: user.role,
                  tokenVersion: user.tokenVersion,
                })}`,
              ])
              .send({ address: address(), paymentMethod: 'cod' }),
          ),
        ),
      );

      const statuses = results.map((entry) => entry.status);
      const times = results.map((entry) => entry.ms);
      const successCount = statuses.filter((status) => status === 201).length;
      const conflictCount = statuses.filter((status) => status === 409).length;

      const fresh = await Product.findById(product._id).lean();
      const stockAfter = fresh && fresh.variants[0] ? fresh.variants[0].stock : null;
      const orderCount = await Order.countDocuments({
        user: { $in: users.map((user) => user._id) },
      });

      const verdict =
        successCount === 1 &&
        conflictCount === REQUESTS - 1 &&
        stockAfter === 0 &&
        orderCount === 1
          ? 'PASS'
          : 'FAIL';
      if (verdict !== 'PASS') allPassed = false;

      const roundReport = {
        round: round + 1,
        requests: REQUESTS,
        successCount,
        conflictCount,
        statuses,
        stockAfter,
        orderCount,
        timings: {
          minMs: Math.min(...times),
          maxMs: Math.max(...times),
          avgMs: Math.round(times.reduce((sum, value) => sum + value, 0) / times.length),
        },
        samples: results.map((entry, index) => ({ index, status: entry.status, ms: entry.ms })),
        verdict,
      };
      report.rounds.push(roundReport);

      log(
        `Vong ${round + 1}: request=${REQUESTS} 201=${successCount} 409=${conflictCount} ` +
          `stock=${stockAfter} orders=${orderCount} avg=${roundReport.timings.avgMs}ms max=${roundReport.timings.maxMs}ms -> ${verdict}`,
      );
      roundReport.samples
        .slice(0, 5)
        .forEach((sample) =>
          log(`  sample#${sample.index} status=${sample.status} ms=${sample.ms}`),
        );
    }
  } catch (error) {
    allPassed = false;
    log(`ERROR: ${sanitize(error.stack || error.message)}`);
  } finally {
    await cleanup(models);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }

  report.verdict = allPassed ? 'PASS' : 'FAIL';

  const roundLines = report.rounds.map(
    (round) =>
      `  vong ${round.round}: 201=${round.successCount} 409=${round.conflictCount} ` +
      `stock=${round.stockAfter} orders=${round.orderCount} -> ${round.verdict}`,
  );

  log('');
  log(`KET LUAN: ${report.verdict}`);
  roundLines.forEach((line) => log(line));

  try {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    fs.writeFileSync(RESULTS_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    fs.writeFileSync(RESULTS_HTML, renderHtml(report), 'utf8');
    writeTerminalLog();
    log('');
    log(`Da ghi: ${path.relative(process.cwd(), RESULTS_JSON)}`);
    log(`Da ghi: ${path.relative(process.cwd(), RESULTS_HTML)}`);
    log(`Da ghi: ${path.relative(process.cwd(), TERMINAL_LOG)}`);
  } catch (error) {
    console.error(`Khong ghi duoc artifacts: ${sanitize(error.message)}`);
    process.exit(1);
  }

  if (!allPassed) process.exit(1);
}

main().catch((error) => {
  fail(`Loi khong mong doi: ${sanitize(error.stack || error.message)}`);
});
