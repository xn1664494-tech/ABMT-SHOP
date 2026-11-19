const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateCreateProduct,
  validateUpdateProduct,
} = require('../src/validators/productValidator');

const CATEGORY_ID = '507f1f77bcf86cd799439011';

const variant = (overrides = {}) => ({
  size: 'M',
  color: 'Đen',
  colorCode: '#111111',
  sku: 'SP-AO-901-M-DEN',
  stock: 10,
  ...overrides,
});

const base = (overrides = {}) => ({
  name: 'Áo Thun Basic',
  category: CATEGORY_ID,
  basePrice: 199000,
  images: ['https://cdn.example.com/ao.jpg'],
  variants: [variant()],
  ...overrides,
});

const expectValidationError = (fn) => {
  try {
    fn();
  } catch (error) {
    assert.equal(error.statusCode, 400);
    assert.ok(Array.isArray(error.details));
    return error;
  }
  assert.fail('du lieu phai bi tu choi');
};

const hasField = (error, field) =>
  error.details.some((detail) => detail.field === field);

test('T3-2-2: validate create chuan hoa du lieu hop le', () => {
  const data = validateCreateProduct(
    base({
      name: '  Áo Thun Basic  ',
      variants: [
        variant({ size: 'm', sku: 'sp-ao-901-m-den', stock: undefined }),
      ],
    }),
  );

  assert.equal(data.name, 'Áo Thun Basic');
  assert.equal(data.images.length, 1);
  assert.equal(data.variants[0].size, 'M');
  assert.equal(data.variants[0].sku, 'SP-AO-901-M-DEN');
  assert.equal(data.variants[0].stock, 0);
  assert.equal(data.variants[0].price, null);
});

test('T3-2-2: thieu truong bat buoc cua Product', () => {
  const error = expectValidationError(() =>
    validateCreateProduct({ variants: [variant()] }),
  );

  assert.ok(hasField(error, 'name'));
  assert.ok(hasField(error, 'category'));
  assert.ok(hasField(error, 'basePrice'));
});

test('T3-2-2: basePrice phai la so nguyen khong am', () => {
  assert.ok(
    hasField(expectValidationError(() => validateCreateProduct(base({ basePrice: -1 }))), 'basePrice'),
  );
  assert.ok(
    hasField(
      expectValidationError(() => validateCreateProduct(base({ basePrice: 1000.5 }))),
      'basePrice',
    ),
  );
});

test('T3-2-2: images phai la URL http/https hop le', () => {
  assert.ok(
    hasField(
      expectValidationError(() =>
        validateCreateProduct(base({ images: ['khong-phai-url'] })),
      ),
      'images',
    ),
  );

  assert.ok(
    hasField(
      expectValidationError(() =>
        validateCreateProduct(base({ images: 'https://cdn.example.com/a.jpg' })),
      ),
      'images',
    ),
  );
});

test('T3-2-2: san pham phai co it nhat mot bien the', () => {
  assert.ok(
    hasField(expectValidationError(() => validateCreateProduct(base({ variants: [] }))), 'variants'),
  );

  assert.ok(
    hasField(
      expectValidationError(() => validateCreateProduct(base({ variants: undefined }))),
      'variants',
    ),
  );
});

test('T3-2-2: size, color, sku cua bien the la bat buoc', () => {
  const error = expectValidationError(() =>
    validateCreateProduct(
      base({
        variants: [variant({ size: '', color: '', sku: '' })],
      }),
    ),
  );

  assert.ok(hasField(error, 'variants.0.size'));
  assert.ok(hasField(error, 'variants.0.color'));
  assert.ok(hasField(error, 'variants.0.sku'));
});

test('T3-2-2: ton kho va gia bien the phai la so nguyen khong am', () => {
  const stockError = expectValidationError(() =>
    validateCreateProduct(base({ variants: [variant({ stock: -1 })] })),
  );
  assert.ok(hasField(stockError, 'variants.0.stock'));

  const decimalStock = expectValidationError(() =>
    validateCreateProduct(base({ variants: [variant({ stock: 1.5 })] })),
  );
  assert.ok(hasField(decimalStock, 'variants.0.stock'));

  const priceError = expectValidationError(() =>
    validateCreateProduct(base({ variants: [variant({ price: -1000 })] })),
  );
  assert.ok(hasField(priceError, 'variants.0.price'));
});

test('T3-2-2: SKU sai dinh dang bi tu choi', () => {
  const error = expectValidationError(() =>
    validateCreateProduct(
      base({ variants: [variant({ sku: 'SP-XX-001-M-DEN' })] }),
    ),
  );

  assert.ok(hasField(error, 'variants.0.sku'));
});

test('T3-2-2: colorCode phai co dang #RRGGBB', () => {
  const error = expectValidationError(() =>
    validateCreateProduct(
      base({ variants: [variant({ colorCode: '111111' })] }),
    ),
  );

  assert.ok(hasField(error, 'variants.0.colorCode'));
});

test('T3-2-2: chan trung cap Size-Mau (khong phan biet hoa thuong)', () => {
  const error = expectValidationError(() =>
    validateCreateProduct(
      base({
        variants: [
          variant({ size: 'm', color: 'Đen', sku: 'SP-AO-901-M-DEN' }),
          variant({ size: 'M', color: 'đen', sku: 'SP-AO-902-M-DEN' }),
        ],
      }),
    ),
  );

  assert.ok(hasField(error, 'variants'));
  const detail = error.details.find((item) => item.field === 'variants');
  assert.match(detail.message, /trùng lặp/i);
});

test('T3-2-2: chan trung SKU trong cung san pham', () => {
  const error = expectValidationError(() =>
    validateCreateProduct(
      base({
        variants: [
          variant({ size: 'M', sku: 'SP-AO-901-M-DEN' }),
          variant({ size: 'L', sku: 'SP-AO-901-M-DEN' }),
        ],
      }),
    ),
  );

  assert.ok(hasField(error, 'variants'));
  const detail = error.details.find((item) => item.field === 'variants');
  assert.match(detail.message, /SKU/i);
});

test('T3-2-2: validate update tu choi body rong hoac chi co field la', () => {
  assert.ok(hasField(expectValidationError(() => validateUpdateProduct({})), 'body'));
  assert.ok(
    hasField(
      expectValidationError(() => validateUpdateProduct({ unknown: true })),
      'body',
    ),
  );
});

test('T3-2-2: validate update chi lay field duoc phep', () => {
  const data = validateUpdateProduct({
    basePrice: 250000,
    isActive: false,
    role: 'admin',
    slug: 'tu-chen-slug',
  });

  assert.deepEqual(data, { basePrice: 250000, isActive: false });
});

test('T3-2-2: validate update van chan trung Size-Mau khi thay variants', () => {
  const error = expectValidationError(() =>
    validateUpdateProduct({
      variants: [
        variant({ size: 'M', color: 'Đen', sku: 'SP-AO-901-M-DEN' }),
        variant({ size: 'M', color: 'Đen', sku: 'SP-AO-902-M-DEN' }),
      ],
    }),
  );

  assert.ok(hasField(error, 'variants'));
});
