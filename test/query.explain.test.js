const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const User = require('../src/model/User');
const Category = require('../src/model/Category');
const Product = require('../src/model/Products');
const Order = require('../src/model/Order');
const PhoneVerification = require('../src/model/PhoneVerification');

const MARKER = 't722explain';
const COUNT = 120;

let mongod;
let user;
let categories;
let outsiderCategory;

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

const stagesOf = (explain) =>
  collectStages(explain.executionStats && explain.executionStats.executionStages);

const stageNames = (explain) =>
  [...new Set(stagesOf(explain).map((stage) => stage.stage).filter(Boolean))];

const indexNames = (explain) =>
  [
    ...new Set(
      stagesOf(explain)
        .map((stage) => stage.indexName)
        .filter((name) => typeof name === 'string'),
    ),
  ];

const assertUsesIndex = (explain, expectedName) => {
  const names = stageNames(explain);
  assert.ok(
    names.some((name) => /^(IXSCAN|IXSEEK)$/i.test(name)),
    `khong co IXSCAN: ${names.join(',')}`,
  );
  assert.ok(!names.some((name) => /COLLSCAN/i.test(name)), `co COLLSCAN: ${names.join(',')}`);
  if (expectedName) {
    assert.ok(
      indexNames(explain).some((name) => name.includes(expectedName)),
      `khong dung index ${expectedName}: ${indexNames(explain).join(',')}`,
    );
  }
};

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all([
    User.init(),
    Category.init(),
    Product.init(),
    Order.init(),
    PhoneVerification.init(),
  ]);

  const root = await Category.create({ name: `${MARKER} Root` });
  const childA = await Category.create({
    name: `${MARKER} Child A`,
    parentId: root._id,
  });
  const childB = await Category.create({
    name: `${MARKER} Child B`,
    parentId: root._id,
  });
  categories = [childA._id, childB._id];
  outsiderCategory = await Category.create({
    name: `${MARKER} Outsider`,
    parentId: root._id,
  });

  user = await User.create({
    name: `${MARKER} User`,
    email: `${MARKER}-0@example.test`,
    password: 'hashed-password-not-used',
    role: 'customer',
    status: 'active',
    phone: '0912345678',
    phoneVerified: true,
    phoneVerifiedAt: new Date(),
  });

  const users = Array.from({ length: COUNT }, (_, index) => ({
    name: `${MARKER} User ${index}`,
    email: `${MARKER}-${index + 1}@example.test`,
    password: 'hashed-password-not-used',
    role: index % 10 === 0 ? 'admin' : 'customer',
    status: 'active',
    isDeleted: false,
    createdAt: new Date(Date.now() - index * 60000),
  }));
  await User.insertMany(users);

  await Product.insertMany(
    Array.from({ length: COUNT }, (_, index) => ({
      name: `${MARKER} Product ${index}`,
      slug: `${MARKER}-product-${index}`,
      category: index % 10 === 0 ? categories[index % 2] : outsiderCategory._id,
      basePrice: 100000 + index,
      images: ['https://cdn.example.com/t722.jpg'],
      isActive: true,
      isDeleted: false,
      variants: [
        {
          size: 'M',
          color: 'Den',
          sku: `SP-AO-${String(700 + index).padStart(3, '0')}-M-DEN`,
          stock: 5,
          price: 100000 + index,
        },
      ],
      createdAt: new Date(Date.now() - index * 60000),
    })),
  );

  await PhoneVerification.insertMany(
    Array.from({ length: COUNT }, (_, index) => ({
      user: user._id,
      phone: '0912345678',
      codeHash: `${MARKER}-hash-${index}`,
      expiresAt: new Date(Date.now() + 60000),
      createdAt: new Date(Date.now() - index * 60000),
    })),
  );

  const statuses = ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'];
  await Order.insertMany(
    Array.from({ length: COUNT }, (_, index) => {
      const status = statuses[index % statuses.length];
      return {
        user,
        status,
        statusHistory: [{ status, at: new Date(), by: user._id }],
        items: [
          {
            product: new mongoose.Types.ObjectId(),
            name: `${MARKER} Item`,
            image: 'https://cdn.example.com/t722.jpg',
            sku: 'SP-AO-700-M-DEN',
            size: 'M',
            color: 'Den',
            unitPrice: 100000,
            qty: 1,
            lineTotal: 100000,
          },
        ],
        shippingAddress: {
          fullName: `${MARKER} User`,
          phone: '0912345678',
          province: 'Ha Noi',
          district: 'Cau Giay',
          ward: 'Dich Vong',
          detail: '1 Nguyen Trai',
        },
        paymentMethod: 'cod',
        subtotal: 100000,
        shippingFee: 0,
        discount: 0,
        total: 100000,
        createdAt: new Date(Date.now() - index * 60000),
      };
    }),
  );
});

test.after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

test('T7-2-2: Order.schema khai bao index moi', () => {
  const indexes = Order.schema.indexes();
  assert.ok(
    indexes.some(([fields]) => fields.createdAt === -1 && fields._id === -1),
    'thieu index (createdAt, _id)',
  );
  assert.ok(
    indexes.some(([fields]) => fields.user === 1 && fields.status === 1),
    'thieu index (user, status)',
  );
});

test('T7-2-2: admin order list khong COLLSCAN va khong SORT', async () => {
  const explain = await Order.find({})
    .sort({ createdAt: -1 })
    .limit(100)
    .explain('executionStats');

  assertUsesIndex(explain, 'createdAt_-1__id_-1');
  assert.ok(!stageNames(explain).includes('SORT'));
});

test('T7-2-2: status count theo user dung IXSCAN', async () => {
  const explain = await Order.aggregate([
    { $match: { user: user._id } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]).explain('executionStats');

  assertUsesIndex(explain);
});

test('T7-2-2: admin user list khong COLLSCAN va khong SORT', async () => {
  const explain = await User.find({ isDeleted: false })
    .sort({ createdAt: -1, _id: -1 })
    .limit(20)
    .explain('executionStats');

  assertUsesIndex(explain, 'isDeleted_1_createdAt_-1__id_-1');
  assert.ok(!stageNames(explain).includes('SORT'));
});

test('T7-2-2: PhoneVerification latest khong COLLSCAN va khong SORT', async () => {
  const explain = await PhoneVerification.findOne({ user: user._id })
    .sort({ createdAt: -1 })
    .explain('executionStats');

  assertUsesIndex(explain, 'user_1_createdAt_-1');
  assert.ok(!stageNames(explain).includes('SORT'));
});

test('T7-2-2: product category list dung IXSCAN va khong COLLSCAN', async () => {
  const explain = await Product.find({
    category: { $in: categories },
    isActive: true,
    isDeleted: false,
  })
    .sort({ createdAt: -1, _id: -1 })
    .limit(20)
    .explain('executionStats');

  assertUsesIndex(explain, 'category_1_isActive_1_isDeleted_1_createdAt_-1__id_-1');
});
