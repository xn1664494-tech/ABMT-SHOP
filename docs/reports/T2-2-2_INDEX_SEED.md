# T2-2-2 — Index & Seed (mã nguồn + minh chứng)

- **Ngày:** 2026-11-17
- **Nhánh:** `feature/T2-2-2-index-seed`
- **Phạm vi:** Khai báo index (trong schema) + script seed 6 sản phẩm + admin, minh chứng index trên DB thật (Atlas).
- **Nguồn đặc tả:** `docs/thiet-ke-csdl/erd.png`, `data-dictionary-1.png`, `data-dictionary-2.png`, `business-rules.png`; `src/model/*`; `src/utils/sku.js`.

---

## A. File thay đổi

| File | Loại | Nội dung |
|------|------|----------|
| `scripts/seed.js` | mới | Script seed idempotent: 1 admin + 6 danh mục + 6 sản phẩm (biến thể size/màu), tạo index qua `Model.init()`, in minh chứng |
| `package.json` | sửa | Thêm `"seed": "node scripts/seed.js"` và `"test:seed-verify": "node --test test/index.seed.verify.test.js"` |
| `test/index.seed.verify.test.js` | mới | Test tự động verify index trên User, Category, Product + kiểm tra số lượng seed |
| `docs/reports/T2-2-2_INDEX_SEED.md` | mới | Báo cáo này (mã nguồn + log minh chứng thực) |

---

## B. Index đã khai báo (trong schema, đã tạo trên DB thật)

### User (`src/model/User.js`)
| Index | Loại | Schema dòng | DB thật |
|-------|------|-------------|---------|
| `email` | unique | 41 | ✅ `email_1` unique: true |
| `status` | compound đơn | 126 | ✅ `status_1` |

### Category (`src/model/Category.js`)
| Index | Loại | Schema dòng | DB thật |
|-------|------|-------------|---------|
| `slug` | unique | 19 | ✅ `slug_1` unique: true |
| `(parentId, order)` | compound | 83 | ✅ `parentId_1_order_1` |

### Product (`src/model/Products.js`)
| Index | Loại | Schema dòng | DB thật |
|-------|------|-------------|---------|
| `slug` | unique | 80 | ✅ `slug_1` unique: true |
| `(category, basePrice)` | compound (danh mục + khoảng giá) | 205 | ✅ `category_1_basePrice_1` |
| `variants.sku` | unique, sparse (SKU duy nhất toàn cục) | 208 | ✅ `variants.sku_1` unique: true, sparse: true |
| `(variants.size, variants.color)` | multikey (lọc Size / Màu) | 211 | ✅ `variants.size_1_variants.color_1` |
| `(isActive, isDeleted)` | compound (lọc sản phẩm đang hiển thị) | 214 | ✅ `isActive_1_isDeleted_1` |

> Ghi chú: `slug` unique đã xác nhận trên cả hai collection Category và Product. `variants.sku_1` đúng có cờ `unique: true` và `sparse: true` trên DB thật.

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
```powershell
$env:SEED_CONFIRM="1"; npm run seed
# hoặc
SEED_CONFIRM=1 node scripts/seed.js
```

### Log chạy thực (Atlas, DB `abmt_shop_test`)

```
◇ injected env (2) from .env
Database muc tieu: abmt_shop_test
URI: mongodb+srv://<user>:<password>@cluster0.9zab9pj.mongodb.net/abmt_shop_test

=== MINH CHUNG SEED T2-2-2 ===
Admin: seed.admin@urbanminimal.test (role: admin, id: 6afbb346c560e424477e29fc)
Danh muc da tao: 6
San pham da tao: 6

-- Index User --
  _id_: {"_id":1} unique=false sparse=false
  email_1: {"email":1} unique=true sparse=false
  status_1: {"status":1} unique=false sparse=false

-- Index Category --
  _id_: {"_id":1} unique=false sparse=false
  slug_1: {"slug":1} unique=true sparse=false
  parentId_1_order_1: {"parentId":1,"order":1} unique=false sparse=false

-- Index Product --
  _id_: {"_id":1} unique=false sparse=false
  slug_1: {"slug":1} unique=true sparse=false
  category_1_basePrice_1: {"category":1,"basePrice":1} unique=false sparse=false
  variants.sku_1: {"variants.sku":1} unique=true sparse=true
  variants.size_1_variants.color_1: {"variants.size":1,"variants.color":1} unique=false sparse=false
  isActive_1_isDeleted_1: {"isActive":1,"isDeleted":1} unique=false sparse=false

-- San pham (slug / basePrice / SKU bien the) --
  ao-thun-co-tay-co-ban | 199000 VND | SP-AO-001-M-DEN, SP-AO-002-L-TRANG
  quan-jeans-skinny-bui | 459000 VND | SP-QU-001-M-XANH, SP-QU-002-L-DEN
  vay-du-tiec-nhay-nhay | 799000 VND | SP-VY-001-S-HONG, SP-VY-002-M-TIM
  dam-cuoi-trang-thanh-lich | 1599000 VND | SP-DM-001-M-TRANG, SP-DM-002-L-XANHDUONG
  balo-deo-xinh-casual | 329000 VND | SP-PK-001-F-NAU, SP-PK-002-F-DEN
  giay-dep-trang-classic | 249000 VND | SP-GD-001-42-TRANG, SP-GD-002-41-DEN

Seed thanh cong.
```

> Ghi hạn: URI đã được che mật khẩu bằng `<user>:<password>`. Mật khẩu thật không được ghi vào báo cáo và không commit vào repository.

---

## D. Test verify index tự động (`test/index.seed.verify.test.js`)

Test file chạy trên MongoDB thật (tự skip nếu không có DB hoặc tên DB không chứa `"test"`):

- `VERIFY-INDEX: User` — kiểm tra `email_1` unique, `status_1`.
- `VERIFY-INDEX: Category` — kiểm tra `slug_1` unique, `parentId_1_order_1`.
- `VERIFY-INDEX: Product` — kiểm tra `slug_1` unique, `category_1_basePrice_1`, `variants.sku_1` unique+sparse, `variants.size_1_variants.color_1`, `isActive_1_isDeleted_1`.
- `VERIFY-SEED: so luong du lieu seed` — kiểm tra ít nhất 1 admin, đúng 6 danh mục, đúng 6 sản phẩm.

Cách chạy:
```powershell
$env:SEED_CONFIRM="1"; npm run seed   # seed trước (để có dữ liệu)
npm run test:seed-verify               # verify index + số lượng
```

---

## E. Bảo mật

- `.env` đã có trong `.gitignore` (dòng 5-6) → không commit file chứa URI/mật khẩu. Xác nhận `git status` không thấy `.env` trước khi commit.
- Trong báo cáo, URI được hiển thị dạng che mật khẩu (`<user>:<password>`).
- `SEED_ADMIN_PASSWORD` chỉ là giá trị mẫu seed, không lưu vào `.env` và không commit vào báo cáo.
- Atlas cần bật Network Access cho IP máy khách trước khi kết nối.

---

## F. Dev 2 — Phase 1 (tổng hợp hoàn thành)

| Task | Nội dung | Trạng thái |
|------|----------|------------|
| T2-2-1 | Schema User (email unique, status index, role, tokenVersion, addresses) | ✅ Hoàn thành |
| T2-2-1 | Schema Category (slug unique, parentId+order, soft-delete) | ✅ Hoàn thành |
| T2-2-1 | Schema Product (slug unique, category+basePrice, variants.sku sparse unique, variants.size+color multikey, isActive+isDeleted) | ✅ Hoàn thành |
| T2-2-1 | Schema Order (code unique, user+createdAt, status+createdAt, snapshot items) | ✅ Hoàn thành |
| T2-2-1 | Schema Cart (user/sessionId partial unique, expiresAt TTL) | ✅ Hoàn thành |
| T2-2-1 | Schema Review (user+product unique, product+isApproved+createdAt) | ✅ Hoàn thành |
| T2-2-2 | Script seed 1 admin + 6 danh mục + 6 sản phẩm, idempotent, in minh chứng | ✅ Hoàn thành (chạy thật trên Atlas) |
| T2-2-2 | Test verify index tự động | ✅ Hoàn thành |
| T2-2-2 | Báo cáo minh chứng index + seed (log thực từ Atlas) | ✅ Hoàn thành |

Tất cả index yêu cầu đã được khai báo trong schema và xác minh trên DB thật (Atlas). Tất cả dữ liệu seed đã được tạo và verify.
