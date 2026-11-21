const { performance } = require('node:perf_hooks');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Product = require('../src/model/Products');
const {
  PRODUCT_LIST_FIELDS,
  buildSort,
} = require('../src/utils/productFilter');
const { toPublicProductListItem } = require('../src/utils/productSerializer');

const TOTAL_DOCS = Number(process.env.BENCH_N || 10000);
const WARMUP_RUNS = Number(process.env.BENCH_WARMUP || 10);
const MEASURED_RUNS = Number(process.env.BENCH_RUNS || 50);
const PAGE_LIMIT = 20;

const FILTER = { isActive: true, isDeleted: false };
const SORT = buildSort('newest');

let mongod;

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
};

const summarize = (values) => ({
  mean: values.reduce((sum, value) => sum + value, 0) / values.length,
  median: percentile(values, 50),
  p95: percentile(values, 95),
});

const measure = async (fn) => {
  for (let i = 0; i < WARMUP_RUNS; i += 1) {
    await fn();
  }

  const times = [];
  let lastResult = null;

  for (let i = 0; i < MEASURED_RUNS; i += 1) {
    const start = performance.now();
    lastResult = await fn();
    times.push(performance.now() - start);
  }

  return {
    stats: summarize(times),
    jsonBytes: Buffer.byteLength(JSON.stringify(lastResult), 'utf8'),
  };
};

const seed = async () => {
  const Category = require('../src/model/Category');
  await Category.init();
  await Product.init();

  const category = await Category.create({ name: 'benchmark-category' });
  const now = Date.now();
  const variantsPerDoc = 2;

  const docs = Array.from({ length: TOTAL_DOCS }, (_, index) => {
    const sequence = String((index % 999) + 1).padStart(3, '0');
    const size = `M${index % 10}`;
    const colorBase = Math.floor(index / 10) % 10;

    return {
      name: `Benchmark Product ${index}`,
      slug: `benchmark-product-${index}`,
      description: `Mo ta dai cho benchmark ${index} `.padEnd(1000, 'x'),
      category: category._id,
      images: ['https://cdn.example.com/product.jpg'],
      basePrice: 100000 + index,
      variants: Array.from({ length: variantsPerDoc }, (_, variantIndex) => ({
        size,
        color: `C${variantIndex}${colorBase}`,
        sku: `SP-AO-${sequence}-${size}-C${variantIndex}${colorBase}`,
        stock: (index + variantIndex) % 4,
        price: 100000 + index,
      })),
      isActive: index % 10 !== 0,
      isDeleted: false,
      deletedAt: null,
      createdAt: new Date(now - index * 1000),
      updatedAt: new Date(now - index * 1000),
    };
  });

  // Dùng collection thô để seed nhanh; dữ liệu vẫn đúng schema đọc.
  await Product.collection.insertMany(docs, { ordered: false });
};

const explainPlan = async (query) => {
  const explain = await query.explain('executionStats');
  const stats = explain.executionStats;
  const plan = JSON.stringify(explain.executionStats.executionStages || {});
  return {
    indexName: (plan.match(/"indexName":"([^"]+)"/) || [])[1] || '-',
    hasSort: plan.includes('"stage":"SORT"'),
    hasCollscan: plan.includes('"stage":"COLLSCAN"'),
    totalKeysExamined: stats.totalKeysExamined,
    totalDocsExamined: stats.totalDocsExamined,
    nReturned: stats.nReturned,
    executionTimeMillis: stats.executionTimeMillis,
  };
};

const printRow = (label, result) => {
  console.log(
    [
      label.padEnd(34),
      `${result.stats.mean.toFixed(2)} ms`.padStart(12),
      `${result.stats.median.toFixed(2)} ms`.padStart(12),
      `${result.stats.p95.toFixed(2)} ms`.padStart(12),
      `${(result.jsonBytes / 1024).toFixed(1)} KB`.padStart(12),
    ].join(' | '),
  );
};

const printExplain = (label, plan) => {
  console.log(
    [
      label.padEnd(34),
      String(plan.indexName).padEnd(46),
      String(plan.hasSort).padStart(7),
      String(plan.hasCollscan).padStart(11),
      String(plan.totalKeysExamined).padStart(8),
      String(plan.totalDocsExamined).padStart(9),
      String(plan.executionTimeMillis).padStart(10),
    ].join(' | '),
  );
};

const run = async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await seed();

  console.log(`\nBenchmark GET /api/products — ${TOTAL_DOCS} documents, limit ${PAGE_LIMIT}`);
  console.log(`Warm-up ${WARMUP_RUNS} vòng, đo ${MEASURED_RUNS} vòng (mean/median/p95)\n`);

  const before = await measure(() =>
    Product.find(FILTER).sort(SORT).limit(PAGE_LIMIT),
  );
  const after = await measure(async () => {
    const docs = await Product.find(FILTER)
      .sort(SORT)
      .limit(PAGE_LIMIT)
      .select(PRODUCT_LIST_FIELDS)
      .lean();
    return docs.map(toPublicProductListItem);
  });

  console.log('Thời gian & payload:');
  console.log('Cách đo'.padEnd(34), 'Mean'.padStart(12), 'Median'.padStart(12), 'p95'.padStart(12), 'JSON'.padStart(12));
  printRow('Trước (full doc, không lean)', before);
  printRow('Sau (projection + lean)', after);

  console.log('\nExplain (executionStats):');
  console.log('Kế hoạch'.padEnd(34), 'Index'.padEnd(46), 'SORT'.padStart(7), 'COLLSCAN'.padStart(11), 'Keys'.padStart(8), 'Docs'.padStart(9), 'ms'.padStart(10));

  const oldExplain = await explainPlan(
    Product.find(FILTER).sort(SORT).limit(PAGE_LIMIT).select(PRODUCT_LIST_FIELDS).hint({
      isActive: 1,
      isDeleted: 1,
    }),
  );
  const newExplain = await explainPlan(
    Product.find(FILTER).sort(SORT).limit(PAGE_LIMIT).select(PRODUCT_LIST_FIELDS),
  );

  printExplain('Trước (hint index cũ)', oldExplain);
  printExplain('Sau (index compound mới)', newExplain);

  await mongoose.disconnect();
  await mongod.stop();
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  if (mongod) await mongod.stop().catch(() => {});
  process.exitCode = 1;
});
