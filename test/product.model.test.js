const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Product = require('../src/model/Products');

const categoryId = () => new mongoose.Types.ObjectId();

const variant = (overrides = {}) => ({
  size: 'M',
  color: 'Đen',
  colorCode: '#111111',
  sku: 'SP-AO-001-M-DEN',
  stock: 10,
  ...overrides,
});

const base = (overrides = {}) =>
  new Product({
    name: 'Áo Thun Basic',
    category: categoryId(),
    basePrice: 199000,
    variants: [variant()],
    ...overrides,
  });

const errorsOf = async (doc) => {
  const error = await doc.validate().catch((err) => err);
  assert.ok(error, 'du lieu phai bi tu choi');
  return error.errors;
};

test('T2-2-1: Product khai bao day du field va default', () => {
  assert.equal(Product.modelName, 'Product');

  for (const field of [
    'name',
    'slug',
    'description',
    'category',
    'images',
    'basePrice',
    'variants',
    'isActive',
    'isDeleted',
    'deletedAt',
    'createdAt',
    'updatedAt',
  ]) {
    assert.ok(Product.schema.path(field), `thieu field ${field}`);
  }

  assert.equal(Product.schema.path('isActive').defaultValue, true);
  assert.equal(Product.schema.path('isDeleted').defaultValue, false);
  assert.equal(Product.schema.path('deletedAt').defaultValue, null);
});

test('T2-2-1: Variant khai bao day du field theo data dictionary', () => {
  const variantPath = Product.schema.path('variants');

  for (const field of [
    'size',
    'color',
    'colorCode',
    'sku',
    'stock',
    'price',
  ]) {
    assert.ok(
      variantPath.schema.path(field),
      `thieu field variants.${field}`,
    );
  }

  assert.equal(variantPath.schema.path('stock').defaultValue, 0);
  assert.equal(variantPath.schema.path('price').defaultValue, null);
});

test('T2-2-1: slug duoc sinh tu name va bo dau', async () => {
  const doc = base({ name: 'Đầm Dự Tiệc' });

  await doc.validate();
  assert.equal(doc.slug, 'dam-du-tiec');
});

test('T2-2-1: cac field bat buoc cua Product', async () => {
  const missingName = await errorsOf(
    new Product({ category: categoryId(), basePrice: 1, variants: [variant()] }),
  );
  assert.ok(missingName.name);

  const missingCategory = await errorsOf(
    new Product({ name: 'Ao', basePrice: 1, variants: [variant()] }),
  );
  assert.ok(missingCategory.category);

  const missingPrice = await errorsOf(
    new Product({
      name: 'Ao',
      category: categoryId(),
      variants: [variant()],
    }),
  );
  assert.ok(missingPrice.basePrice);
});

test('T2-2-1: basePrice phai la so nguyen khong am', async () => {
  const negative = await errorsOf(base({ basePrice: -1 }));
  assert.ok(negative.basePrice);

  const decimal = await errorsOf(base({ basePrice: 1000.5 }));
  assert.ok(decimal.basePrice);
});

test('T2-2-1: images phai la URL hop le', async () => {
  const errors = await errorsOf(base({ images: ['khong-phai-url'] }));
  assert.ok(errors.images);
});

test('T2-2-1: san pham phai co it nhat mot bien the', async () => {
  const missing = await errorsOf(
    new Product({ name: 'Ao', category: categoryId(), basePrice: 1000 }),
  );
  assert.ok(missing.variants);

  const empty = await errorsOf(
    new Product({
      name: 'Ao',
      category: categoryId(),
      basePrice: 1000,
      variants: [],
    }),
  );
  assert.ok(empty.variants);
});

test('T2-2-1: size, color, sku cua bien the la bat buoc', async () => {
  const errors = await errorsOf(
    base({ variants: [variant({ size: undefined, color: undefined, sku: undefined })] }),
  );

  assert.ok(errors['variants.0.size']);
  assert.ok(errors['variants.0.color']);
  assert.ok(errors['variants.0.sku']);
});

test('T2-2-1: SKU dung dinh dang duoc chap nhan va tu viet hoa', async () => {
  const doc = base({ variants: [variant({ sku: 'sp-qu-014-l-trang' })] });

  await doc.validate();
  assert.equal(doc.variants[0].sku, 'SP-QU-014-L-TRANG');
});

test('T2-2-1: SKU sai dinh dang bi tu choi', async () => {
  for (const sku of [
    'SP-XX-001-M-DEN',
    'SP-AO-01-M-DEN',
    'SP-AO-001-M',
    'AO-001-M-DEN',
  ]) {
    const errors = await errorsOf(base({ variants: [variant({ sku })] }));
    assert.ok(errors['variants.0.sku'], `SKU ${sku} phai bi tu choi`);
  }
});

test('T2-2-1: mau ma colorCode phai co dang #RRGGBB', async () => {
  const errors = await errorsOf(
    base({ variants: [variant({ colorCode: '111111' })] }),
  );
  assert.ok(errors['variants.0.colorCode']);
});

test('T2-2-1: stock phai la so nguyen khong am', async () => {
  const negative = await errorsOf(
    base({ variants: [variant({ stock: -1 })] }),
  );
  assert.ok(negative['variants.0.stock']);

  const decimal = await errorsOf(
    base({ variants: [variant({ stock: 1.5 })] }),
  );
  assert.ok(decimal['variants.0.stock']);
});

test('T2-2-1: price bien the null hoac so nguyen khong am', async () => {
  const fallback = base({ variants: [variant({ price: null })] });
  await fallback.validate();
  assert.equal(fallback.variants[0].price, null);

  const errors = await errorsOf(
    base({ variants: [variant({ price: -1 })] }),
  );
  assert.ok(errors['variants.0.price']);
});

test('T2-2-1: chan trung cap size + color trong cung san pham', async () => {
  const errors = await errorsOf(
    base({
      variants: [
        variant({ sku: 'SP-AO-001-M-DEN' }),
        variant({ sku: 'SP-AO-002-M-DEN' }),
      ],
    }),
  );

  assert.ok(errors.variants);
  assert.match(errors.variants.message, /trùng lặp/i);
});

test('T2-2-1: chan trung SKU trong cung san pham', async () => {
  const errors = await errorsOf(
    base({
      variants: [
        variant({ size: 'M' }),
        variant({ size: 'L', sku: 'SP-AO-001-M-DEN' }),
      ],
    }),
  );

  assert.ok(errors.variants);
  assert.match(errors.variants.message, /SKU/i);
});

test('T2-2-1: Product co day du index theo data dictionary', () => {
  const indexes = Product.schema.indexes();

  assert.ok(
    indexes.some(([fields, options]) => fields.slug === 1 && options.unique),
    'thieu index unique cho slug',
  );
  assert.ok(
    indexes.some(
      ([fields]) => fields.category === 1 && fields.basePrice === 1,
    ),
    'thieu index (category, basePrice)',
  );
  assert.ok(
    indexes.some(
      ([fields, options]) =>
        fields['variants.sku'] === 1 && options.unique && options.sparse,
    ),
    'thieu index unique sparse cho variants.sku',
  );
  assert.ok(
    indexes.some(
      ([fields]) =>
        fields['variants.size'] === 1 && fields['variants.color'] === 1,
    ),
    'thieu index (variants.size, variants.color)',
  );
  assert.ok(
    indexes.some(
      ([fields]) => fields.isActive === 1 && fields.isDeleted === 1,
    ),
    'thieu index (isActive, isDeleted)',
  );
});

test('T2-2-1: virtual totalStock va inStock', () => {
  const doc = base({
    variants: [
      variant({ stock: 3 }),
      variant({ size: 'L', sku: 'SP-AO-002-L-DEN', stock: 4 }),
    ],
  });

  assert.equal(doc.totalStock, 7);
  assert.equal(doc.inStock, true);
});

test('T2-2-1: toJSON an _id, isDeleted, deletedAt va giu id', async () => {
  const doc = base();
  await doc.validate();
  const json = doc.toJSON();

  assert.equal(json._id, undefined);
  assert.equal(json.isDeleted, undefined);
  assert.equal(json.deletedAt, undefined);
  assert.equal(json.__v, undefined);
  assert.ok(json.id);
  assert.equal(json.slug, 'ao-thun-basic');
  assert.equal(json.variants[0].sku, 'SP-AO-001-M-DEN');
});

test.after(() => {
  mongoose.deleteModel(/Product/);
});
