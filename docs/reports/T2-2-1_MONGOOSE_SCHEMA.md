# T2-2-1 — Mongoose Schema: User, Category, Product

- **Ngày:** 2026-11-17
- **Nhánh:** `feature/T2-2-1-mongoose-schema`
- **Phạm vi:** Mongoose schema cho `User`, `Category`, `Product` (variants + SKU), ràng buộc, message lỗi, index, tài liệu và test.
- **Nguồn đặc tả:**
  - `docs/thiet-ke-csdl/erd.png`, `erd.svg`
  - `docs/thiet-ke-csdl/data-dictionary-1.png`, `data-dictionary-2.png`
  - `docs/thiet-ke-csdl/data-rules.png`, `business-rules.png`
  - `docs/reports/POST_PHASE2_HARDENING_REPORT.md`

---

## A. File thay đổi

| File | Loại | Nội dung |
|---|---|---|
| `src/model/User.js` | giữ nguyên | Đã khớp data dictionary, có test từ trước |
| `src/model/Category.js` | mới | Schema danh mục cây cha/con, soft-delete |
| `src/model/Products.js` | viết lại | Chuẩn hóa theo data dictionary, variants + SKU |
| `src/utils/sku.js` | mới | Regex SKU, bảng prefix, hàm `buildSku()` |
| `test/category.model.test.js` | mới | Unit test Category |
| `test/product.model.test.js` | mới | Unit test Product/Variant |
| `test/integration/catalog.integration.test.js` | mới | Integration test MongoDB thật (tự skip nếu thiếu DB) |
| `package.json` | sửa | Bổ sung test model + integration catalog |

---

## B. User (giữ nguyên)

Schema `src/model/User.js` đã đáp ứng data dictionary và không thay đổi trong task này:

| Trường | Kiểu / ràng buộc | Message / ghi chú |
|---|---|---|
| `name` | String, required, trim, max 80 | `Ten khong duoc de trong` |
| `email` | String, required, unique, lowercase, trim, regex | `Email khong hop le` |
| `password` | String, required, `select: false` | Hash bcrypt, không trả ra ngoài |
| `role` | enum `customer` / `admin`, default `customer` | `Role khong hop le` |
| `phone` | String, trim, regex `(0\|\+84)` + 9–10 số | Tùy chọn |
| `addresses` | `[Address]`, tối đa 3 | Chưa có đặc tả chi tiết field con |
| `isDeleted` / `deletedAt` | Boolean false / Date null | Soft-delete |
| `status` | enum `active` / `blocked`, default `active` | Mở rộng Phase 2 |
| `tokenVersion` | Number, default 0, min 0 | Mở rộng Phase 2 |
| `createdAt` / `updatedAt` | timestamps | Tự động |

Index: `email` unique, `status`.
`toJSON`: trả `id`, ẩn `_id`, `__v`, `password`, `passwordHash`, `isDeleted`.

---

## C. Category (`src/model/Category.js`)

| Trường | Kiểu / ràng buộc | Message lỗi |
|---|---|---|
| `name` | String, required, trim, max 80 | `Tên danh mục là bắt buộc` / `Tên danh mục tối đa 80 ký tự` |
| `slug` | String, required, unique, lowercase, trim; tự sinh từ `name` | `Slug danh mục là bắt buộc` |
| `parentId` | ObjectId ref `Category`, default `null`; chặn tự làm cha | `Danh mục không thể là cha của chính nó` |
| `order` | Number, default 0, int ≥ 0 | `Thứ tự không được âm` / `Thứ tự phải là số nguyên` |
| `isDeleted` | Boolean, default `false` | Soft-delete |
| `deletedAt` | Date, default `null` | |
| `createdAt` / `updatedAt` | timestamps | |

Index:

| Index | Loại | Mục đích |
|---|---|---|
| `slug` | unique | URL thân thiện, chống trùng |
| `(parentId, order)` | compound | Duyệt cây danh mục theo thứ tự |

`toJSON`: trả `id`, ẩn `_id`, `__v`, `isDeleted`, `deletedAt`.

---

## D. Product & ProductVariant (`src/model/Products.js`)

### Product

| Trường | Kiểu / ràng buộc | Message lỗi |
|---|---|---|
| `name` | String, required, trim, max 120 | `Tên sản phẩm là bắt buộc` / `Tên sản phẩm tối đa 120 ký tự` |
| `slug` | String, required, unique, lowercase, trim; tự sinh từ `name` | `Slug sản phẩm là bắt buộc` |
| `description` | String, trim, max 2000, default `''` | `Mô tả sản phẩm tối đa 2000 ký tự` |
| `category` | ObjectId ref `Category`, required | `Danh mục sản phẩm là bắt buộc` |
| `images` | `[String]`, default `[]`, mỗi phần tử là URL http/https | `Ảnh phải là URL hợp lệ (http/https)` |
| `basePrice` | Number, required, int ≥ 0 (VND) | `Giá cơ bản là bắt buộc` / `Giá cơ bản không được âm` / `Giá cơ bản phải là số nguyên (VND)` |
| `variants` | `[ProductVariant]`, ít nhất 1 | `Sản phẩm phải có ít nhất một biến thể` |
| `isActive` | Boolean, default `true` | Ẩn/hiện sản phẩm |
| `isDeleted` / `deletedAt` | Boolean false / Date null | Soft-delete |
| `createdAt` / `updatedAt` | timestamps | |

### ProductVariant (nhúng)

| Trường | Kiểu / ràng buộc | Message lỗi |
|---|---|---|
| `size` | String, required, trim, uppercase | `Kích cỡ (size) là bắt buộc` |
| `color` | String, required, trim | `Màu sắc (color) là bắt buộc` |
| `colorCode` | String, trim, regex `^#[0-9A-Fa-f]{6}$` | `Mã màu phải có dạng #RRGGBB` |
| `sku` | String, required, trim, uppercase, regex SKU | `SKU là bắt buộc` / `SKU không đúng định dạng SP-{CAT}-{NNN}-{SIZE}-{COLOR}` |
| `stock` | Number, default 0, int ≥ 0 | `Tồn kho không được âm` / `Tồn kho phải là số nguyên` |
| `price` | Number, default `null`, int ≥ 0 | `Giá biến thể không được âm` / `Giá biến thể phải là số nguyên (VND)`; `null` = dùng `basePrice` |

Ràng buộc tầng ứng dụng (Mongoose `pre('validate')`):

- Không trùng cặp `size + color` trong cùng một sản phẩm.
- Không trùng `sku` trong cùng một sản phẩm.
- SKU duy nhất toàn cục được ép bằng unique index.

Index:

| Index | Loại | Mục đích |
|---|---|---|
| `slug` | unique | URL sản phẩm |
| `(category, basePrice)` | compound | Lọc danh mục + khoảng giá |
| `variants.sku` | unique, sparse | SKU duy nhất toàn cục |
| `(variants.size, variants.color)` | multikey | Lọc Size / Màu |
| `(isActive, isDeleted)` | compound | Lọc sản phẩm đang hiển thị |

Virtual: `totalStock`, `inStock`.
`toJSON`: trả `id`, ẩn `_id`, `__v`, `isDeleted`, `deletedAt`.

---

## E. SKU (`src/utils/sku.js`)

- Format: `SP-{CAT}-{NNN}-{SIZE}-{COLOR}`, in hoa, không dấu.
- Regex đã chốt:
  `^SP-(AO|QU|VY|DM|PK|GD|TN)-\d{3}-[A-Z0-9]{1,5}-[A-Z0-9]{1,10}$`
- Prefix: `AO` (Áo), `QU` (Quần), `VY` (Váy), `DM` (Đầm), `PK` (Phụ kiện), `GD` (Giày dép), `TN` (Túi xách).
- `buildSku({ prefix, sequence, size, color })` chuẩn hóa bỏ dấu → uppercase → zero-pad 3 chữ số.
- Ví dụ: `buildSku({ prefix: 'AO', sequence: 1, size: 'M', color: 'Đen' })` → `SP-AO-001-M-DEN`.

### Ghi chú cần team chốt

Data rules ghi “001–999, vượt 999 mở rộng 4 chữ số” nhưng regex mẫu chỉ có `\d{3}`. Task này bám đúng regex đã chốt (`\d{3}`). Nếu cần mở rộng 4 chữ số, phải cập nhật lại regex và test SKU.

---

## F. Quy tắc dữ liệu đã áp dụng

- **Soft-delete:** `User`, `Category`, `Product` dùng `isDeleted` / `deletedAt`; truy vấn mặc định phải lọc `isDeleted: false`.
- **Timestamps:** `createdAt` / `updatedAt` tự động.
- **toJSON:** trả `id`, ẩn `__v`, `isDeleted`, `deletedAt` (và `password` với User).
- **Snapshot:** sản phẩm chỉ lưu dữ liệu hiện tại; `Order.items` sẽ snapshot sau (task khác).
- **Chặn xóa cứng:** Category còn Product/danh mục con, User còn Order là ràng buộc tầng service, chưa thể ép ở schema.
- **Address:** `User.addresses` tối đa 3 nhưng field con chưa có đặc tả riêng; giữ nguyên như báo cáo hardening.

---

## G. Kiểm chứng

```bash
node --check src/model/User.js
node --check src/model/Category.js
node --check src/model/Products.js
node --check src/utils/sku.js
npm test                 # unit test, gồm category/product model
npm run test:integration # MongoDB test local, tự skip nếu không kết nối được
```

Kết quả chạy ngày 2026-11-17:

| Lệnh | Kết quả |
|---|---|
| `node --check` các file model/util/test | OK |
| `npm test` | 98 pass / 0 fail / 0 skip |
| `npm run test:integration` | 1 pass / 0 fail / 14 skip (máy chưa có MongoDB test local) |

- `test/category.model.test.js`: field/default/slug/self-parent/index/toJSON.
- `test/product.model.test.js`: field/default/slug/giá/biến thể/SKU/trùng lặp/index/toJSON/virtual.
- `test/integration/catalog.integration.test.js`: tạo Category/Product thật, kiểm tra index và unique SKU toàn cục; tự skip nếu không có MongoDB test. Cần chạy lại khi có MongoDB local để xác nhận index/unique trên DB thật.
