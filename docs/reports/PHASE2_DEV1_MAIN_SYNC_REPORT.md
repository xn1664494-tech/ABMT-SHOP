# PHASE 2 DEV 1 — MAIN SYNC REPORT

- **Branch:** `chore/sync-main-into-post-phase2-hardening`
- **PR:** #26 (merge commit `7d55116`, parents `7d888d9` + `13fe39c`)
- **Nguồn sync:** `origin/main` @ `66f3224`
- **Target trước sync:** `7d888d9`
- **Target sau sync:** `7d55116` → sau đó `491f9a4` (V1) → `7985e9e` (V4) → `f6fbc23` (V2)
- **Ngày:** 2026-11-19
- **Nguyên tắc:** merge commit (không squash), không rebase/reset, không đụng `main`.

---

## 1. Vì sao phải sync

`main` đi trước target 17 commit (Category API, model Order/Cart/Review, seed script, `/health`, Postman collection, docs). Trước sync, PR #21 (`feature/post-phase2-hardening → main`) ở trạng thái `dirty` vì hai nhánh đã rẽ.

---

## 2. Conflict và cách resolve

| File | Loại | Cách resolve | Kiểm chứng |
|---|---|---|---|
| `package.json` | content | `test` = **hợp nhất** danh sách test Dev 1 (auth.admin-route, auth.change-password, error-handler, trust-proxy) + Dev 2 (category.model, product.model, order.model, cart.model, review.model, category.api). Giữ `seed`, `test:postman`, `test:seed-verify`, `test:api`. | 18 file test chạy được |
| `src/routes/index.js` | content | Giữ **cả** `/admin` (Dev 1) và `/categories` (Dev 2) | route list 39 route |
| `src/middleware/errorHandler.js` | content | Giữ bản hardening PR5: JSON cho `/api`, HTML error page, 500 production không lộ message/stack, `details` chỉ cho non-5xx + map lỗi Mongoose/JWT/SyntaxError từ main | 8/8 test error-handler xanh |
| `src/app.js` | auto | Giữ `configureTrustProxy` (opt-in `TRUST_PROXY`) + `/health` + `notFound` + view engine | smoke test |
| `src/model/Products.js` | auto | Lấy nguyên bản Dev 2 | không sửa tay |

---

## 3. Lỗi tích hợp phát hiện thêm (đã sửa)

**`src/server.js` tự tạo Express app riêng** (từ `main`), không dùng `src/app.js`. Hệ quả: khi `npm start`, toàn bộ hardening của Dev 1 **không chạy** — không `/health`, không trust proxy, không trang lỗi, không 404 handler, không route `/`.

Đo trước/sau (smoke test, `NODE_ENV=test`):

| Request | `src/server.js` (trước) | `src/app.js` | `src/server.js` (sau fix) |
|---|---|---|---|
| `GET /health` | 404 | 200 JSON | **200 JSON** |
| `GET /` (trang chủ) | 404 | render EJS | render EJS |
| `GET /api/does-not-exist` | 404 HTML | 404 **JSON** | 404 **JSON** |
| `GET /missing.html` | 404 HTML | 404 error page | 404 error page |

Sửa: `src/server.js` chỉ `require('./app')` + `connectDB()` khi chạy trực tiếp → một nguồn app duy nhất cho runtime và test.

---

## 4. Bằng chứng sau sync (target `7d55116`)

| Lệnh | Kết quả |
|---|---|
| `npm test` | 181 test: **165 pass / 16 fail / 0 skip** |
| `npm run test:integration` | **20/20 pass** (DB `abmt_shop_test`) |
| `npm run test:jest` | 3 suites / 8 test pass |

### 4.1. 16 test fail — nguyên nhân, phạm vi

Toàn bộ 16 fail nằm trong **một file duy nhất**: `test/category.api.test.js` (Dev 2).

Đã chứng minh **không phải regression của merge** bằng cách chạy đúng file đó trên worktree `origin/main` (`66f3224`): fail y hệt.

Hai lỗi thiết kế test (đã phân tích, **không sửa** vì ngoài scope Dev 1):

1. `const { default: request } = require('supertest')` — supertest là CJS function, không có `.default` → `TypeError: request is not a function`.
2. Dùng `t.context.parentId` / `t.context.childId` như biến chia sẻ giữa các test `node:test`; `t.context` là **per-test**, nên các test phụ thuộc nhau đều nhận `undefined`.

Patch đề xuất cho Dev 2:

```js
const request = require('supertest');
// ...
let parentId; // module-level thay cho t.context
```

---

## 5. Rủi ro còn lại sau sync

| # | Rủi ro | Mức | Ghi chú |
|---|---|---|---|
| S1 | `test/category.api.test.js` đỏ (16 test) | **P0 cho CI** | thuộc Dev 2, đã có root cause + patch |
| S2 | Route ghi Category **không có CSRF** | **P1 bảo mật** | `POST/PUT/PATCH/DELETE /api/categories` dùng cookie auth nhưng thiếu `csrfProtection` → xem `PHASE2_DEV1_CATEGORY_VERIFICATION.md` |
| S3 | `catalog/checkout.integration.test.js` còn đọc `TEST_MONGODB_URI` + default localhost | P2 | V4 mới chuẩn hoá file của Dev 1 |
| S4 | Không có CI | P1 quy trình | 0 check-run trên repo |

---

## 6. Kết luận

| Hạng mục | Trạng thái |
|---|---|
| Merge `main` vào nhánh tích hợp | **PASS** (`7d55116`) |
| Không mất route/hardening của Dev 1 | **PASS** (smoke + test) |
| Không mất code Dev 2 | **PASS** (Category/Order/Cart/Review + seed chạy được) |
| Regression Dev 1 | **KHÔNG** (165 pass phần Dev 1 + Dev 2 model/api) |
| CI xanh | **CHƯA** — 16 test Dev 2 pre-existing |
