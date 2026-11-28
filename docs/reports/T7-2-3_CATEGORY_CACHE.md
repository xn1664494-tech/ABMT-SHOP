# T7-2-3 — Cache cây danh mục / Mega Menu

- **Task ID:** T7-2-3
- **Phase:** Phase 4
- **Dev:** Dev 2 — Backend Business & Database
- **Ngày:** 2026-11-28
- **Nhánh:** `perf/T7-2-3-category-cache` (từ `origin/main` `91a8b5a`, sau PR #121)
- **Trạng thái:** DONE — chờ review chéo
- **Phạm vi:** cache dùng chung 1 snapshot cho `GET /api/categories/tree` và Mega Menu; **không sửa** `src/views/**/*.ejs`.

---

## 1. Yêu cầu & DoD

| Yêu cầu | DoD | Kết quả |
|---|---|---|
| Cache khối ít đổi | Dùng chung 1 snapshot, TTL, single-flight, invalidate khi admin sửa danh mục | Đạt |
| Đo thời gian phản hồi trước/sau | Cùng seed, cùng môi trường Atlas, có số mean/median/p95 | Đạt |
| Giữ hành vi `isVisible` | API tree vẫn trả hidden category; Mega Menu vẫn loại hidden category | Đạt |
| Test chống tái phát | Test cache query, invalidate, single-flight, lỗi DB, `isVisible` | Đạt |
| Không đụng view Dev 3/Dev 4 | `git status --short` không có `src/views/**` | Đạt |

---

## 2. Môi trường chạy minh chứng

| Hạng mục | Giá trị |
|---|---|
| Loại MongoDB | MongoDB Atlas |
| Database | `abmt_shop_test` |
| Phiên bản | `8.0.39-patch-a3d00565977` |
| Node.js | `v24.18.0` |
| Warm runs | 50 lần/endpoint |
| Lệnh before | `npm run evidence:category-cache -- --label=before` |
| Lệnh after | `npm run evidence:category-cache -- --label=after` |
| Chế độ CSRF | `NODE_ENV=test` |

> Artifacts không chứa URI/host/credential. Script seed deterministic theo hash, đo bằng hook `mongoose.set('debug', ...)`, rồi cleanup trong khối `finally`.

### fix DNS cục bộ

`dns.getServers()` trả `127.0.0.1`; `dns.resolveSrv()` cho SRV của Atlas bị `ECONNREFUSED`. `scripts/dns-fix.js` chỉ đặt resolver public (`8.8.8.8`, `1.1.1.1`) khi URI test là `mongodb.net` **và** resolver hiện tại là loopback. Không đổi `.env.test`, không đổi DB, không dùng MemoryServer.

---

## 3. Kết quả before/after

| Endpoint | Cold before | Cold after | Warm mean before/after | Warm median before/after | Warm p95 before/after | Warm read queries before/after |
|---|---:|---:|---:|---:|---:|---:|
| `GET /api/categories/tree` | 47.269 ms | 38.235 ms | 36.24 / **2.138 ms** | 36.043 / **2.043 ms** | 38.613 / **2.716 ms** | 1 / **0** |
| `GET /login` (Mega Menu) | 447.474 ms | 435.974 ms | 4.473 / 4.597 ms | 4.359 / 4.329 ms | 6.567 / 6.29 ms | 0 / 0 |
| `GET /health` (nav middleware) | 2.876 ms | 35.781 ms | 2.217 / 1.814 ms | 1.947 / 1.75 ms | 3.249 / 2.182 ms | 0 / 0 |

- `GET /api/categories/tree`: warm mean giảm **94.1%**, warm p95 giảm **93.0%**, read query warm từ 1 xuống 0.
- `GET /login`: trước T7-2-3 Mega Menu **đã có cache 60s riêng** (`src/middleware/navCategories.js`), nên warm time gần như không đổi. Lợi ích ở lần này là gom về 1 snapshot, single-flight và invalidate thống nhất.
- `GET /health` chỉ là scenario phụ để isolate middleware. Cold after cao hơn vì script chủ động invalidate snapshot ngay trước mỗi scenario; cold before vẫn đang hit cache Mega Menu từ scenario `/login`. Chỉ dùng số warm để so sánh.
- Cold `/login` bao gồm `createIndex` lúc khởi tạo model trong lần request đầu; tiêu chí chính là **warm latency + số read query**.

Minh chứng:
- [`before.json`](artifacts/T7-2-3/before.json)
- [`after.json`](artifacts/T7-2-3/after.json)
- [`summary.txt`](artifacts/T7-2-3/summary.txt)
- [`terminal-before.txt`](artifacts/T7-2-3/terminal-before.txt)
- [`terminal-after.txt`](artifacts/T7-2-3/terminal-after.txt)

---

## 4. Thiết kế cache

| File | Thay đổi |
|---|---|
| `src/services/categoryCacheService.js` | Mới: snapshot chung `Category.find({isDeleted:false}).sort(order,name,createdAt).select(_id name slug parentId order isVisible createdAt updatedAt).lean()`; TTL `CATEGORY_CACHE_TTL_MS` mặc định 60s; single-flight; generation counter để invalidate an toàn khi đang load; không cache lỗi DB. |
| `src/services/categoryService.js` | `tree()` build từ snapshot thay vì query riêng; `create/update/softDelete` gọi `invalidateCategoryCache()` sau `save()` thành công. |
| `src/middleware/navCategories.js` | Bỏ cache module-level cũ; build nav roots từ snapshot chung; vẫn filter `isVisible !== false`, `MAX_CHILDREN = 8`, fallback `[]` khi DB lỗi. |
| `src/utils/categorySerializer.js` | Giữ nguyên; API tree vẫn trả `id/parentId/order/children`, không lộ `_id/isDeleted/isVisible`. |
| `scripts/dns-fix.js` | Mới: fix resolver SRV cho Atlas trên máy có DNS loopback. |
| `scripts/category-cache-evidence.js` | Mới: script đo before/after, seed/cleanup deterministic, sanitize artifact. |
| `package.json` | Thêm `evidence:category-cache`; preload `dns-fix.js` cho các script test/evidence cần Atlas. |
| `test/integration/catalog.integration.test.js`, `test/integration/checkout.integration.test.js` | Đọc `MONGODB_URI_TEST` trước `TEST_MONGODB_URI` để chạy thật trên Atlas thay vì fallback localhost. |

### Hành vi `isVisible`

- API tree: snapshot vẫn lấy cả category `isVisible:false`; `toPublicCategory` không trả field này → hidden category vẫn xuất hiện trong tree như trước cache.
- Mega Menu: `buildNavCategories()` lọc `category.isVisible !== false` trước khi map parent → hidden root và hidden child vẫn bị loại như trước cache.
- Assertion nằm ở `test/category.cache.test.js`.

---

## 5. Test tự động

| File | Nội dung |
|---|---|
| `test/category.cache.test.js` | 1 query cho lần đầu, 0 query cho lần sau; invalidate query lại; concurrent chỉ load 1 snapshot; query lỗi không bị cache; update gọi invalidate; API tree giữ hidden category; Mega Menu loại hidden category; không lộ field nội bộ. |
| `test/category.api.test.js` | Vẫn pass sau cache: create/update/softDelete/tree/list không lộ field nội bộ. |
| `test/nav-sanitize.test.js` | Vẫn pass: output Mega Menu tiếp tục escape HTML/safeHref. |
| `test/query.n-plus-one.test.js` | Vẫn pass: T7-2-2 không bị ảnh hưởng; `ProductsServices` không dùng snapshot cache. |

---

## 6. Kiểm chứng

| Lệnh | Kết quả |
|---|---|
| `npm test` | 396 tests, 390 pass, 0 fail, 6 skipped |
| `npm run test:integration` | 69 tests, 69 pass, 0 fail, 0 skipped |
| `npm run test:seed-verify` | 6 tests, 6 pass, 0 fail, 0 skipped |
| `git diff --check` | OK |

---

## 7. Rủi ro & giới hạn

- **Multi-process:** cache là in-process/module-level. Mỗi process/instance giữ snapshot riêng. Sau admin update, instance nhận request invalidation được clear ngay; các instance khác vẫn có thể trả dữ liệu cũ **tối đa 60s** theo TTL.
- **Ghi trực tiếp DB:** seed script, `repairCategories.js`, mongo shell, job chạy ngoài app không gọi `invalidateCategoryCache()`. Các instance chỉ tự cập nhật khi TTL hết hạn hoặc có admin mutation đi qua `categoryService`.
- **Không dùng Redis/pub-sub** trong T7-2-3; nếu cần consistency mạnh hơn giữa nhiều instance, cân nhắc distributed invalidation ở task sau.
- **DB error:** không cache lỗi; `/health` và HTML fallback `navCategories=[]` như cũ; API tree vẫn trả lỗi qua error handler.
- **Payload nhỏ:** snapshot dùng projection nên rủi ro bộ nhớ thấp với tập danh mục hiện tại; nếu số danh mục tăng lớn, cân nhắc cache theo root thay vì toàn cây.

---

## 8. Vệ sinh & bảo mật

- Evidence script dọn category do chính lần chạy tạo, kể cả khi lỗi giữa chừng.
- Không ghi URI/host/credential vào artifact hoặc báo cáo.
- Không fallback im lặng sang DB production hoặc local cho evidence; script yêu cầu provider Atlas và DB name chứa `test`.
- Không sửa view, không đổi hành vi CAS/rollback tồn kho.

---

## 9. Liên kết

- [`docs/reports/T1-4-3_DOCS_INDEX.md`](T1-4-3_DOCS_INDEX.md)
- [`docs/reports/T7-2-2_QUERY_OPTIMIZATION.md`](T7-2-2_QUERY_OPTIMIZATION.md)
- [`docs/reports/artifacts/T7-2-3/summary.txt`](artifacts/T7-2-3/summary.txt)
