# T7-2-2 — Tối ưu truy vấn P0

- **Task ID:** T7-2-2
- **Phase:** Phase 4
- **Dev:** Dev 2 — Backend Business & Database
- **Ngày:** 2026-11-28
- **Nhánh:** `perf/T7-2-2-query-optimization` (từ `main` `25cde1b`)
- **Trạng thái:** DONE — chờ review chéo
- **Phạm vi:** chỉ P0; P1 (home/catalog) để PR riêng; **không sửa** `src/views/**/*.ejs`; **không đổi** CAS trong `decrementStock`.

---

## 1. Yêu cầu & DoD

| Yêu cầu | DoD | Kết quả |
|---|---|---|
| Giảm N+1 ở cart/checkout/order/admin/category | Before/after cùng seed trên MongoDB Atlas, đếm query theo method | Đạt |
| Có bằng chứng `explain()` trước/sau | Bảng explain trong artifact; COLLSCAN/SORT được ghi rõ | Đạt |
| Test tự động chống tái phát N+1 | Test đếm query và test explain nằm trong `npm test` | Đạt |
| Index phục vụ sort/lọc chính | Index khai báo ở schema, verify bằng `npm run test:seed-verify` | Đạt |
| Không đụng view Dev 3/Dev 4 | `git status --short` không có `src/views/**` | Đạt |

Số ms trong bảng chỉ để tham khảo; tiêu chí chính là **số truy vấn**.

---

## 2. Môi trường chạy minh chứng

| Hạng mục | Giá trị |
|---|---|
| Loại MongoDB | MongoDB Atlas |
| Database | `abmt_shop_test` |
| Phiên bản | `8.0.39-patch-a3d00565977` |
| Node.js | `v24.18.0` |
| Lệnh before | `node scripts\query-optimization-evidence.js --label=before` |
| Lệnh after | `node scripts\query-optimization-evidence.js --label=after` |
| Script npm | `npm run evidence:query-optimization -- --label=after` |
| Chế độ CSRF | `NODE_ENV=test` |

> Artifacts không chứa URI/host/credential. Script seed dữ liệu deterministic theo hash, đo bằng hook `mongoose.set('debug', ...)`, rồi cleanup trong khối `finally`.

---

## 3. Kết quả số truy vấn

| Endpoint | Read before | Read after | Write before | Write after | Total before | Total after |
|---|---:|---:|---:|---:|---:|---:|
| `GET /api/cart (5 items)` | 7 | 3 | 0 | 0 | 7 | 3 |
| `POST /api/cart/merge (5 guest items)` | 9 | 5 | 2 | 2 | 11 | 7 |
| `GET /account?tab=orders` | 10 | 6 | 0 | 0 | 10 | 6 |
| `GET /admin/orders` | 7 | 3 | 0 | 0 | 7 | 3 |
| `GET /admin/users` | 3 | 3 | 0 | 0 | 3 | 3 |
| `GET /api/products?category=t722-nam-root` | 6 | 4 | 0 | 0 | 6 | 4 |
| `POST /api/orders (5 items)` | 7 | 3 | 7 | 7 | 14 | 10 |

Thay đổi theo method:

| Endpoint | Trước | Sau |
|---|---|---|
| `GET /api/cart` | `products.findOne × 5` | `products.find × 1` |
| `POST /api/cart/merge` | `products.findOne × 5` | `products.find × 1` |
| `GET /account?tab=orders` | `orders.countDocuments × 6` | `orders.aggregate × 1` + `orders.countDocuments × 1` |
| `GET /admin/orders` | `orders.countDocuments × 5` | `orders.aggregate × 1` |
| `GET /api/products?category=...` | `categories.find × 3` | `categories.find × 1` |
| `POST /api/orders` | `products.findOne × 5` | `products.find × 1` |

`GET /admin/users` giữ nguyên 3 query vì luồng này đã dùng `countDocuments + find` hợp lý; không ép thêm aggregate.

---

## 4. Kết quả `explain()`

| Truy vấn | Index before | Index after | COLLSCAN before/after | SORT before/after |
|---|---|---|---|---|
| `Order.find({}).sort(createdAt)` | `-` | `createdAt_-1__id_-1` | `true/false` | `true/false` |
| `Order.aggregate(status by user)` | `-` | `user_1_status_1` | `false/false` | `false/false` |
| `User.admin list sort createdAt` | `-` | `isDeleted_1_createdAt_-1__id_-1` | `true/false` | `true/false` |
| `PhoneVerification.latest by user` | `user_1` | `user_1_createdAt_-1` | `false/false` | `true/false` |
| `Product.category list sort createdAt` | `isActive_1_isDeleted_1_createdAt_-1__id_-1` | `category_1_isActive_1_isDeleted_1_createdAt_-1__id_-1` | `false/false` | `false/true` |

Ghi chú: với filter category có `$in` 2 nhánh, planner Atlas chọn index theo category và vẫn có `SORT` trong sample này; đổi lại index dẫn đầu category giúp thu hẹp tập doc trước khi sort. Không có COLLSCAN.

Minh chứng:
- [`before.json`](artifacts/T7-2-2/before.json)
- [`after.json`](artifacts/T7-2-2/after.json)
- [`summary.txt`](artifacts/T7-2-2/summary.txt)
- [`terminal-before.txt`](artifacts/T7-2-2/terminal-before.txt)
- [`terminal-after.txt`](artifacts/T7-2-2/terminal-after.txt)

---

## 5. Thay đổi code P0

| File | Thay đổi |
|---|---|
| `src/utils/categoryTree.js` | Thêm `buildChildrenMap`, `collectDescendantIds` (trả root + descendants). |
| `src/services/ProductsServices.js` | `resolveCategoryIds` tải toàn bộ category active bằng 1 `Category.find(...).select('_id parentId').lean()`. |
| `src/services/categoryService.js` | `getDescendantIds` dùng 1 query rồi `.slice(1)`; so sánh `String(...)` trong `hasCircularReference`. |
| `src/services/CartService.js` | Thêm `loadProductsByIds`; `refreshItemPrices` và `mergeGuestIntoUser` dùng map thay vì `findById` từng item. |
| `src/routes/order.route.js` | Batch `Product.find({ _id: { $in: productIds } })` với `PRODUCT_ORDER_LOOKUP_FIELDS`; danh sách đơn dùng `ORDER_SUMMARY_FIELDS`. |
| `src/services/orderStatsService.js` | Mới: `countOrdersByStatus` dùng 1 `aggregate`, export `ORDER_STATUS_KEYS`. |
| `src/routes/index.js` | Account/admin order counts dùng `orderStats.countOrdersByStatus()`; danh sách đơn dùng projection. |
| `src/services/adminService.js` | Recent orders dùng `ORDER_RECENT_FIELDS`. |
| `src/utils/orderFields.js` | Mới: `ORDER_SUMMARY_FIELDS`, `ORDER_RECENT_FIELDS`. |
| `src/model/Order.js` | Thêm index `{createdAt:-1,_id:-1}`, `{user:1,status:1}`. |
| `src/model/User.js` | Thêm index `{isDeleted:1,createdAt:-1,_id:-1}`. |
| `src/model/PhoneVerification.js` | Thêm index `{user:1,createdAt:-1}`. |
| `src/model/Products.js` | Thêm index `{category:1,isActive:1,isDeleted:1,createdAt:-1,_id:-1}`. |
| `test/support/fakeCartModels.js`, `test/admin.view.test.js` | Fake model hỗ trợ `find().select().lean()` và `Order.aggregate` để khớp API Mongoose thật. |
| `scripts/seed.js` | Idempotent theo cả product slug sinh từ tên + SKU, tránh E11000 khi chạy lại seed trên DB test. |

---

## 6. Test tự động

| File | Nội dung |
|---|---|
| `test/query.n-plus-one.test.js` | Đếm query: 5 sản phẩm chỉ 1 `products.find`; category tree 1 `categories.find`; status count 1 `orders.aggregate`; `POST /api/orders` không gọi `Product.findById`. |
| `test/query.explain.test.js` | Assert schema index và explain trên MemoryServer: không COLLSCAN, không SORT cho order/user/phone, IXSCAN cho product category. |
| `test/order.model.test.js` | Bổ sung assertion index mới của `Order`. |
| `test/index.seed.verify.test.js` | Verify index thật trên DB test; ưu tiên `MONGODB_URI_TEST`, tương thích `TEST_MONGODB_URI`. |
| `package.json` | Thêm 2 test file vào `npm test`; thêm script `evidence:query-optimization`. |

---

## 7. Kiểm chứng

| Lệnh | Kết quả |
|---|---|
| `npm test` | 389 tests, 383 pass, 0 fail, 6 skipped |
| `npm run test:integration` | 62 tests, 54 pass, 0 fail, 8 skipped |
| `npm run test:seed-verify` | 6 tests, 6 pass, 0 fail, 0 skipped |

---

## 8. Vệ sinh & bảo mật

- Evidence script dọn user/category/product/cart/order/phoneVerification do chính lần chạy tạo, kể cả khi lỗi giữa chừng.
- Không ghi URI/credential vào artifact hoặc báo cáo.
- Không fallback im lặng sang DB production; evidence yêu cầu DB name chứa `test`.
- Không sửa view, không đổi hành vi CAS/rollback tồn kho.

---

## 9. Liên kết

- [`T1-4-3_DOCS_INDEX.md`](T1-4-3_DOCS_INDEX.md) — mục lục tài liệu (đã thêm dòng trỏ báo cáo này).
- [`T4-2-3_QUERY_OPTIMIZATION.md`](T4-2-3_QUERY_OPTIMIZATION.md) — nền tảng index/phân trang danh sách sản phẩm.
- [`T7-2-1_CONCURRENCY_STOCK.md`](T7-2-1_CONCURRENCY_STOCK.md) — CAS tồn kho không đổi ở task này.

**Reviewer:** ____________________  **Ngày review:** ____________________
