# PHASE 2 DEV 1 — CATEGORY VERIFICATION (T2-2-1 dependency)

- **Phạm vi:** xác minh 12 hạng mục dependency Category/Product sau khi sync `main` — **không** nhận ownership T2-2-1 (vẫn thuộc Dev 2).
- **Target:** `f6fbc23` (đã gồm `main` @ `66f3224`)
- **DB:** `abmt_shop_test` (guard: tên DB phải chứa `test`)
- **Ngày:** 2026-11-19
- **Cách chạy:** script verify tạm (không commit) gọi HTTP thật qua `supertest` + truy vấn Mongoose thật; seed chạy bằng `SEED_CONFIRM=1 MONGODB_URI=<test>`.

---

## 1. Kết quả 16 điểm kiểm tra

| # | Hạng mục | Kết quả | Bằng chứng |
|---|---|---|---|
| 0 | Guard DB test | **PASS** | `db=abmt_shop_test` |
| 1 | Category schema tồn tại | **PASS** | paths: `name, slug, parentId, order, isDeleted, deletedAt` |
| 2 | Slug unique + tự sinh slugify | **PASS** | index `slug` unique = true; `"Áo Thun"` → `cv-...-ao-thun` |
| 2b | Trùng slug bị từ chối | **PASS** | HTTP 409 |
| 3 | Parent/child + index `{parentId, order}` | **PASS** | child 201, `parentId` khớp, index tồn tại |
| 3b | Chặn self-parent | **PASS** | PATCH `parentId = chính nó` → 400 "không thể là cha của chính nó" |
| 3c | Chặn vòng lặp cha/con | **PASS** | PATCH A.parent = B (B là con của A) → 400 "vòng lặp cha/con" |
| 4 | API `/tree` trả cây | **PASS** | 200, root có `children` chứa child |
| 5 | CRUD list/detail/update | **PASS** | 200/200/200, `order` cập nhật đúng |
| 6 | RBAC | **PASS** | không auth 401 · customer 403 · admin 201 |
| 7 | **CSRF trên route ghi** | **FAIL** | POST/PATCH/DELETE không có `csrfProtection` → request không có CSRF token vẫn 201 |
| 8 | Product ref Category required | **PASS** | thiếu `category` → `ValidationError` |
| 8b | Index `{category, basePrice}` | **PASS** | index tồn tại |
| 9 | Populate Category từ Product | **PASS** | `populated.category.name` có giá trị |
| 10 | Soft-delete | **PASS** | DELETE 200, ẩn khỏi list, DB còn `isDeleted=true` + `deletedAt` |
| 11 | Response ẩn field nội bộ | **PASS** | không có `isDeleted`/`deletedAt`/`__v` |
| 12 | Soft-delete cha không mất con | **PASS** | con vẫn truy vấn được theo `parentId` |
| 13 | Seed script (6 category + 6 product + index) | **PASS** | `node scripts/seed.js` OK; `npm run test:seed-verify` **4/4 pass** (khi trỏ DB test) |

**Tổng: 17/18 PASS, 1 FAIL (CSRF).**

---

## 2. Phát hiện bảo mật: thiếu CSRF trên route ghi Category

`src/routes/category.route.js`:

```js
router.post('/', authenticate, requireAdmin, CategoryController.create);
router.put('/:id', authenticate, requireAdmin, CategoryController.update);
router.patch('/:id', authenticate, requireAdmin, CategoryController.update);
router.delete('/:id', authenticate, requireAdmin, CategoryController.softDelete);
```

- Auth dùng **cookie `HttpOnly`** (giống toàn hệ thống) ⇒ route ghi **cần** CSRF double-submit.
- Các route ghi khác của Dev 1 (`/api/profile/me*`) đều có `csrfProtection`.
- Bằng chứng: `POST /api/categories` với cookie admin hợp lệ nhưng **không** có `X-CSRF-Token` → **201 Created**.

**Khuyến nghị (Dev 2):**

```js
const { csrfProtection } = require('../middleware/csrf');
router.post('/', authenticate, csrfProtection, requireAdmin, CategoryController.create);
// tương tự cho PUT, PATCH, DELETE
```

Mức độ: **P1** (CSRF ghi dữ liệu danh mục; ảnh hưởng toàn hệ thống vì `main` sẽ deploy chung).

---

## 3. Ghi chú khác

- Route ghi Category dùng `requireAdmin` (middleware của `main`), không dùng `authorize('admin')` của Dev 1 — **hai convention song song**, không xung đột hành vi nhưng nên thống nhất ở Phase 3.
- `test/category.api.test.js` (16 test) hỏng do lỗi test, không phải do API — xem `PHASE2_DEV1_MAIN_SYNC_REPORT.md` §4.1.
- Dữ liệu seed hiện còn trong `abmt_shop_test` (6 category, 6 product, 1 admin seed). Không ảnh hưởng integration test (mỗi test tự tạo/ xoá theo prefix riêng) — đã chạy lại 32/32 sau seed.

---

## 4. Kết luận

| Hạng mục | Trạng thái |
|---|---|
| Dependency Category/Product của Dev 1 | **VERIFIED** (17/18) |
| CSRF route ghi Category | **FAIL — chuyển Dev 2** |
| T2-2-1 (ownership Dev 2) | **vẫn không phải PASS của Dev 1** |
