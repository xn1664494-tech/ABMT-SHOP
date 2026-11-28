const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');

require('./dns-fix');

const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env.test'), quiet: true });

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'category-cache-evidence-jwt-secret-32';
process.env.JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
process.env.APP_ORIGIN = process.env.APP_ORIGIN || 'http://localhost:3000';
process.env.AUTH_RATE_LIMIT_MAX = process.env.AUTH_RATE_LIMIT_MAX || '10000';

const mongoose = require('mongoose');
const request = require('supertest');
const Category = require('../src/model/Category');

const LEGACY_TEST_URI = process.env.TEST_MONGODB_URI;
const TEST_URI = process.env.MONGODB_URI_TEST || LEGACY_TEST_URI;
const LABEL = process.argv.includes('--label=after') ? 'after' : 'before';
const RUNS = Number(process.env.CACHE_BENCH_RUNS || 50);
const ARTIFACT_DIR = path.resolve(__dirname, '../docs/reports/artifacts/T7-2-3');
const BEFORE_JSON = path.join(ARTIFACT_DIR, 'before.json');
const AFTER_JSON = path.join(ARTIFACT_DIR, 'after.json');
const SUMMARY_TXT = path.join(ARTIFACT_DIR, 'summary.txt');

const READ_METHODS = new Set([
  'find',
  'findOne',
  'count',
  'countDocuments',
  'estimatedDocumentCount',
  'distinct',
  'aggregate',
]);

let cacheService = null;
try {
  cacheService = require('../src/services/categoryCacheService');
} catch {
  cacheService = null;
}

let counting = false;
let counts = {};
const terminalLines = [];

const idFor = (key) =>
  new mongoose.Types.ObjectId(
    crypto.createHash('md5').update(`T7-2-3:${key}`).digest('hex').slice(0, 24),
  );

const ROOT_NAM = idFor('root:nam');
const ROOT_NU = idFor('root:nu');
const ROOT_HIDDEN = idFor('root:hidden');
const CHILD_IDS = Array.from({ length: 8 }, (_, index) => idFor(`child:nam:${index}`));
const HIDDEN_CHILD_ID = idFor('child:hidden');
const ALL_IDS = [ROOT_NAM, ROOT_NU, ROOT_HIDDEN, ...CHILD_IDS, HIDDEN_CHILD_ID];

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

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
};

const round = (value) => Number(value.toFixed(3));

const summarize = (values) => ({
  mean: round(values.reduce((sum, value) => sum + value, 0) / values.length),
  median: round(percentile(values, 50)),
  p95: round(percentile(values, 95)),
});

const methodOf = (key) => key.slice(key.lastIndexOf('.') + 1);

const sumReadQueries = (bucket) =>
  Object.entries(bucket).reduce(
    (total, [key, value]) => total + (READ_METHODS.has(methodOf(key)) ? value : 0),
    0,
  );

const doc = (id, name, slug, parentId, order, isVisible, index) => ({
  _id: id,
  name,
  slug,
  parentId,
  order,
  isVisible,
  isDeleted: false,
  deletedAt: null,
  createdAt: new Date(Date.UTC(2026, 10, 28, 0, 0, index)),
  updatedAt: new Date(Date.UTC(2026, 10, 28, 0, 0, index)),
  __v: 0,
});

const seed = async () => {
  const docs = [
    doc(ROOT_NAM, 'T7-2-3 Nam', 't723-nam', null, 1, true, 0),
    doc(ROOT_NU, 'T7-2-3 Nu', 't723-nu', null, 2, true, 1),
    doc(ROOT_HIDDEN, 'T7-2-3 Hidden Root', 't723-hidden-root', null, 3, false, 2),
    ...CHILD_IDS.map((id, index) =>
      doc(id, `T7-2-3 Nam Child ${index}`, `t723-nam-child-${index}`, ROOT_NAM, index + 1, true, 10 + index),
    ),
    doc(HIDDEN_CHILD_ID, 'T7-2-3 Hidden Child', 't723-hidden-child', ROOT_NAM, 99, false, 30),
  ];

  await Category.init();
  await Category.deleteMany({ _id: { $in: ALL_IDS } });
  await Category.collection.insertMany(docs, { ordered: false });
};

const cleanup = async () => {
  if (mongoose.connection.readyState === 1) {
    await Category.deleteMany({ _id: { $in: ALL_IDS } });
  }
};

const scenarioOnce = async (fn) => {
  counts = {};
  counting = true;
  const startedAt = performance.now();
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
  const body = response ? response.text || JSON.stringify(response.body) : '';
  return {
    status: response ? response.status : 'ERR',
    ms: round(performance.now() - startedAt),
    readQueries: sumReadQueries(snapshot),
    totalQueries: Object.values(snapshot).reduce((total, value) => total + value, 0),
    byMethod: snapshot,
    bytes: Buffer.byteLength(body, 'utf8'),
    ...(error ? { error: sanitize(error.message) } : {}),
  };
};

const measure = async (name, fn) => {
  const cold = await scenarioOnce(fn);
  const times = [];
  const reads = [];
  let warmStatus = 'ERR';
  let warmError = cold.error;

  for (let index = 0; index < RUNS; index += 1) {
    const result = await scenarioOnce(fn);
    times.push(result.ms);
    reads.push(result.readQueries);
    warmStatus = result.status;
    warmError = result.error || warmError;
  }

  const warmStats = summarize(times);
  const result = {
    name,
    status: cold.status === 200 && warmStatus === 200 ? 200 : 'ERR',
    cold: {
      ms: cold.ms,
      readQueries: cold.readQueries,
      totalQueries: cold.totalQueries,
      byMethod: cold.byMethod,
    },
    warm: {
      runs: RUNS,
      ...warmStats,
      readQueriesMean: round(reads.reduce((sum, value) => sum + value, 0) / reads.length),
      readQueriesMax: Math.max(...reads),
    },
    bytes: cold.bytes,
    ...(warmError ? { error: warmError } : {}),
  };

  log(
    [
      name.padEnd(28),
      `${result.cold.ms} ms`.padStart(12),
      `${result.warm.mean} ms`.padStart(12),
      `${result.warm.median} ms`.padStart(12),
      `${result.warm.p95} ms`.padStart(12),
      String(result.cold.readQueries).padStart(7),
      String(result.warm.readQueriesMean).padStart(9),
    ].join(' | '),
  );

  return result;
};

const writeArtifact = (file, content) => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
};

const writeJson = (file, data) => writeArtifact(file, `${JSON.stringify(data, null, 2)}\n`);

const writeTerminalLog = () => {
  if (terminalLines.length) {
    writeArtifact(path.join(ARTIFACT_DIR, `terminal-${LABEL}.txt`), `${terminalLines.join('\n')}\n`);
  }
};

const writeSummary = () => {
  if (!fs.existsSync(BEFORE_JSON) || !fs.existsSync(AFTER_JSON)) return;

  const before = JSON.parse(fs.readFileSync(BEFORE_JSON, 'utf8'));
  const after = JSON.parse(fs.readFileSync(AFTER_JSON, 'utf8'));
  const lines = [
    'T7-2-3 category cache — before/after',
    `Warm runs: ${before.environment.warmRuns} per endpoint`,
    '',
    'Endpoint | Cold ms before/after | Warm mean ms before/after | Warm p95 ms before/after | Warm read queries before/after',
  ];

  for (const scenario of before.scenarios) {
    const match = after.scenarios.find((item) => item.name === scenario.name);
    if (!match) continue;
    lines.push(
      [
        scenario.name,
        `${scenario.cold.ms}/${match.cold.ms}`,
        `${scenario.warm.mean}/${match.warm.mean}`,
        `${scenario.warm.p95}/${match.warm.p95}`,
        `${scenario.warm.readQueriesMean}/${match.warm.readQueriesMean}`,
      ].join(' | '),
    );
  }

  lines.push('');
  writeArtifact(SUMMARY_TXT, `${lines.join('\n')}\n`);
};

const invalidate = () => {
  if (cacheService && typeof cacheService.invalidateCategoryCache === 'function') {
    cacheService.invalidateCategoryCache();
  }
};

const run = async () => {
  if (!TEST_URI) throw new Error('Missing MONGODB_URI_TEST');

  const dbName = databaseNameOf(TEST_URI);
  if (!dbName || !dbName.toLowerCase().includes('test')) {
    throw new Error('Database name must contain "test"');
  }
  if (!/mongodb\.net/i.test(TEST_URI)) {
    throw new Error('T7-2-3 evidence requires MongoDB Atlas');
  }

  await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 15000 });
  await seed();

  const app = require('../src/server');

  log(`T7-2-3 evidence ${LABEL}`);
  log(`Provider: ${providerOf(TEST_URI)}`);
  log(`Database: ${dbName}`);
  log(`MongoDB: ${(await mongoose.connection.db.admin().serverInfo()).version}`);
  log(`Node: ${process.version}`);
  log(`Warm runs: ${RUNS}`);
  log('Cache module: ' + (cacheService ? 'present' : 'absent (baseline)'));
  log('');
  log('Endpoint | Cold | Warm mean | Warm median | Warm p95 | Cold reads | Warm reads');

  mongoose.set('debug', (collection, method) => {
    if (!counting) return;
    const key = `${collection}.${method}`;
    counts[key] = (counts[key] || 0) + 1;
  });

  const scenarios = [];

  invalidate();
  scenarios.push(await measure('GET /login (Mega Menu)', () => request(app).get('/login')));

  invalidate();
  scenarios.push(await measure('GET /api/categories/tree', () => request(app).get('/api/categories/tree')));

  invalidate();
  scenarios.push(await measure('GET /health (nav middleware)', () => request(app).get('/health')));

  writeJson(path.join(ARTIFACT_DIR, `${LABEL}.json`), {
    label: LABEL,
    generatedAt: new Date().toISOString(),
    environment: {
      provider: providerOf(TEST_URI),
      dbName,
      mongodbVersion: (await mongoose.connection.db.admin().serverInfo()).version,
      node: process.version,
      warmRuns: RUNS,
      cacheModulePresent: Boolean(cacheService),
    },
    scenarios,
  });
  writeTerminalLog();
  writeSummary();

  const failed = scenarios.find((scenario) => scenario.status !== 200 || scenario.error);
  if (failed) {
    console.error(sanitize(failed.error || `${failed.name} returned ${failed.status}`));
    process.exitCode = 1;
  }
};

run()
  .catch((error) => {
    console.error(sanitize(error.message));
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup().catch(() => {});
    await mongoose.disconnect().catch(() => {});
    writeTerminalLog();
  });
