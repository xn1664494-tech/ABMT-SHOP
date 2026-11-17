# T2-2-2 — Index & Seed (mã nguồn + minh chứng)

- **Ngày:** 2026-11-17
- **Nhánh:** `feature/T2-2-2-index-seed`
- **Phạm vi:** Khai báo index (đã có trong schema) + script seed 6 sản phẩm + admin, minh chứng index trên DB.
- **Nguồn đặc tả:** `docs/thiet-ke-csdl/erd.png`, `data-dictionary-1.png`, `data-dictionary-2.png`, `business-rules.png`; `src/model/*`; `src/utils/sku.js`.

---

## A. File thay đổi

| File | Loại | Nội dung |
|------|------|----------|
| `scripts/seed.js` | mới | Script seed idempotent: 1 admin + 6 danh mục + 6 sản phẩm (biến thể size/màu), tạo index qua `Model.init()`, in minh chứng |
| `package.json` | sửa | Thêm `"seed": "node scripts/seed.js"` |
| `docs/reports/T2-2-2_INDEX_SEED.md` | mới | Báo cáo này (mã nguồn + log minh chứng) |

---

## B. Index đã khai báo (trong schema, xác minh qua báo cáo)

### User (`src/model/User.js`)
| Index | Loại | Dòng |
|-------|------|------|
| `email` | unique (trên field) | 41 |
| `status` | compound đơn | 126 |

### Category (`src/model/Category.js`)
| Index | Loại | Dòng |
|-------|------|------|
| `slug` | unique | 19 |
| `(parentId, order)` | compound | 83 |

### Product (`src/model/Products.js`)
| Index | Loại | Dòng |
|-------|------|------|
| `slug` | unique | 80 |
| `(category, basePrice)` | compound (danh mục + khoảng giá) | 205 |
| `variants.sku` | unique, sparse (SKU duy nhất toàn cục) | 208 |
| `(variants.size, variants.color)` | multikey (lọc Size / Màu) | 211 |
| `(isActive, isDeleted)` | compound (lọc sản phẩm đang hiển thị) | 214 |

> Ghi chú: Mục 1 ghi `slug` unique hai lần (Category và Product) — đã xác nhận cả hai collection đều khai báo index này (xem bảng trên).

---

## C. Script seed (`scripts/seed.js`)

### Tính năng chính
- Yêu cầu `SEED_CONFIRM=1` trước khi chạy (bảo vệ sơ ce).
- Yêu cầu `MONGODB_URI` trong `.env`; tên database **phải chứa "test"** (tránh xóa nhầm production).
- Kết nối MongoDB với retry (5 lần, delay 3000ms).
- Gọi `User.init()`, `Category.init()`, `Product.init()` để tạo index trên DB thật.
- **Idempotent:** xóa đúng bản ghi theo khóa seed (`email` cho User, `slug` cho Category/Product), sau đó tạo lại. Không dùng `deleteMany({})` toàn collection.
- Tạo 1 admin (`role: 'admin'`, hash password qua `bcryptjs`).
- Tạo 6 danh mục khớp prefix SKU (`src/utils/sku.js`): Áo(AO), Quần(QU), Váy(VY), Đầm(DM), Phụ kiện(PK), Giày dép(GD).
- Tạo 6 sản phẩm, mỗi sản phẩm 2 biến thể (size/màu/colorCode/stock/price), SKU sinh qua `buildSku()`.
- In minh chứng: URI DB (che mật khẩu), danh sách index mỗi collection, số lượng user/danh mục/sản phẩm, email admin, slug/SKU từng sản phẩm.

### Cách chạy
```bash
SEED_CONFIRM=1 npm run seed
# hoặc
SEED_CONFIRM=1 node scripts/seed.js
```

### Mẫu đầu ra (khi có MongoDB)
```
Database muc tieu: shop_test
URI: mongodb+srv://user:****@cluster.mongodb.net/shop_test

=== MINH CHUNG SEED T2-2-2 ===
Admin: seed.admin@urbanminimal.test (role: admin, id: ...)
Danh muc da tao: 6
San pham da tao: 6

-- Index User --
  _id_: {...} unique=false sparse=false
  email_1: {"email":1} unique=true sparse=false
  status_1: {"status":1} unique=false sparse=false

-- Index Category --
  slug_1: {"slug":1} unique=true sparse=false
  parentId_1_order_1: {"parentId":1,"order":1} unique=false sparse=false

-- Index Product --
  slug_1: {"slug":1} unique=true sparse=false
  category_1_basePrice_1: {"category":1,"basePrice":1} unique=false sparse=false
  variants.sku_1: {"variants.sku":1} unique=true sparse=true
  variants.size_1_variants.color_1: {"variants.size":1,"variants.color":1} unique=false sparse=false
  isActive_1_isDeleted_1: {"isActive":1,"isDeleted":1} unique=false sparse=false

-- San pham (slug / basePrice / SKU bien the) --
  ao-thun-co-tay-co-ban | 199000 VND | SP-AO-001-M-DEN, SP-AO-001-L-TRANG
  quan-jeans-skinny-bui | 459000 VND | SP-QU-002-M-XANH, SP-QU-002-L-DEN
  vay-du-tiec-nhay-nhay | 799000 VND | SP-VY-003-S-HONG, SP-VY-003-M-TIM
  dam-cuoi-trang-thanh-lich | 1599000 VND | SP-DM-004-M-TRANG, SP-DM-004-L-XANH-DUONG
  balo-deo-xinh-casual | 329000 VND | SP-PK-005-F-NAU, SP-PK-005-F-DEN
  giay-dep-trang-classic | 249000 VND | SP-GD-006-42-TRANG, SP-GD-006-41-DEN

Seed thanh cong.
```

---

## D. Kiểm chứng đã chạy

| Lệnh | Kết quả |
|------|---------|
| `node --check scripts/seed.js` | OK (cú pháp hợp lệ) |
| `npm run seed` | Chưa chạy (MongoDB local không sẵn sàng trên máy này: port 27017 không lắng nghe, `mongosh` chưa cài) |

> Vì không có MongoDB chạy, không thể tạo log chạy thật. Khi có MongoDB (local hoặc Atlas) và `MONGODB_URI` trỏ đến database tên chứa `test`, hãy chạy `SEED_CONFIRM=1 npm run seed` và điền log trên vào báo cáo.

---

## E. Bảo mật

- `.env` đã có trong `.gitignore` (dòng 5-6) → không commit file chứa URI/mật khẩu.
- Trong báo cáo, URI được hiển thị dạng che mật khẩu (`****`).
- `SEED_ADMIN_PASSWORD` chỉ là giá trị mẫu seed, không lưu vào `.env` và không commit vào báo cáo.

---

## F. Dev 2 — Phase 1 (tổng hợp)

Các schema Index & Seed liên quan đến Dev 2 đã hoàn thiện:

| Task | Nội dung | Trạng thái |
|------|----------|------------|
| T2-2-1 | Mongoose schema User, Category, Product (variants + SKU), index | ✅ Hoàn thành |
| T2-2-1 | Mongoose schema Order, Cart, Review, index | ✅ Hoàn thành |
| T2-2-2 | Index (unique email/slug, category+price, multikey size/color) | ✅ Đã khai báo trong schema |
| T2-2-2 | Script seed 6 sản phẩm + admin + minh chứng | ✅ `scripts/seed.js` đã tạo (chưa chạy thật do thiếu MongoDB) |

Tất cả index yêu cầu đã có trong mã nguồn schema. Còn lại duy nhất là chạy `npm run seed` thật khi có MongoDB để sinh log minh chứng.
