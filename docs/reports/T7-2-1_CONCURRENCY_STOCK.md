# T7-2-1 — Test đồng thời kho (concurrency stock)

- **Task ID:** T7-2-1
- **Phase:** Phase 4
- **Dev:** Dev 2 — Backend Business & Database
- **Ngày:** 2026-11-28
- **Nhánh:** `test/T7-2-1-concurrency-stock` (từ `origin/main` mới nhất)
- **Trạng thái:** DONE — chờ review chéo
- **Thời gian ước tính:** 8h, ưu tiên Cao

---

## 1. Yêu cầu & DoD

| Yêu cầu | DoD | Kết quả |
|---|---|---|
| Biến thể còn đúng 1 sản phẩm, gửi nhiều request cùng lúc | Mỗi vòng seed 1 variant `stock = 1`, bắn đồng thời N request | Đạt |
| Chỉ 1 đơn thành công | Đúng `1 × 201` trong mỗi vòng | Đạt |
| Tồn kho cuối bằng 0 | `variants[0].stock === 0` sau mỗi vòng, không âm | Đạt |
| Chụp kết quả thật | `results.json`, `results.html`, `terminal.log` được sinh từ lần chạy thật | Đạt |

Không assert theo thời gian phản hồi; số liệu ms trong bảng chỉ để tham khảo.

---

## 2. Môi trường chạy minh chứng

| Hạng mục | Giá trị |
|---|---|
| Loại MongoDB | MongoDB Atlas |
| Phiên bản | `8.0.39-patch-a3d00565977` |
| Topology | Replica set |
| Tên replica set | `atlas-xcbpo5-shard-0` |
| Node.js | `v24.18.0` |
| Cấu hình chạy | `N = 20` request đồng thời × `3` vòng |
| Lệnh | `npm run test:concurrency:evidence` |
| Chế độ CSRF | `NODE_ENV=test` (middleware CSRF được bỏ qua như các integration test khác) |

> Artifacts **không** chứa URI, host hay thông tin đăng nhập; script sanitize mọi log/lỗi trước khi ghi file.

---

## 3. Cơ chế đang được kiểm chứng

- `decrementStock` dùng CAS trên đúng `(_id, variants.sku, variants.stock >= qty, isDeleted:false)` với `$inc: {'variants.$.stock': -qty}` — `src/services/ProductsServices.js:100-131`.
- `createOrder` trừ kho → tạo đơn → xóa giỏ; lỗi thì hoàn kho/xóa đơn pending — `src/services/CheckoutService.js:7-65`.
- Route `POST /api/orders` có pre-check tồn kho (`src/routes/order.route.js:150`) nhưng quyết định cuối cùng là CAS, nên nhiều request cùng đọc thấy `stock=1` vẫn chỉ 1 request trừ được kho.

---

## 4. Kết quả chạy thật

| Vòng | Request | `201` | `409` | Tồn kho sau | Số đơn trong DB | avg / max (ms) | DoD |
|---:|---:|---:|---:|---:|---:|---:|:---:|
| 1 | 20 | 1 | 19 | 0 | 1 | 666 / 843 | PASS |
| 2 | 20 | 1 | 19 | 0 | 1 | 411 / 596 | PASS |
| 3 | 20 | 1 | 19 | 0 | 1 | 243 / 469 | PASS |

- Tất cả 19 request thất bại trả `409` với message có SKU hoặc "Không đủ tồn kho" — không có oversell, không có tồn kho âm.
- Kết luận script: `PASS`.

Minh chứng:
- [`results.json`](artifacts/T7-2-1/results.json) — dữ liệu thô từng request.
- [`results.html`](artifacts/T7-2-1/results.html) — bảng kết quả để chụp màn hình.
- [`terminal.log`](artifacts/T7-2-1/terminal.log) — log terminal của lần chạy.

---

## 5. Test tự động trong CI

File `test/integration/concurrency.stock.integration.test.js`:

- `IT-T7-2-1: nhieu user tranh 1 san pham...` — N user riêng, N giỏ riêng, `Promise.all` N `POST /api/orders`; mặc định `CONCURRENCY_REQUESTS=10`, `CONCURRENCY_ROUNDS=3`; assert `1 × 201`, `N-1 × 409`, stock `0`, đúng 1 đơn.
- `IT-T7-2-1: cung user, nhieu request dong thoi...` — cùng user/cùng giỏ; assert đúng 1 đơn, stock `0`, giỏ được xóa; các request lỗi chỉ `400/409`.
- File được đưa vào `npm run test:integration` và có script riêng `npm run test:concurrency`.
- URI lấy từ `MONGODB_URI_TEST` trong `.env.test` (tương thích tên cũ `TEST_MONGODB_URI`); thiếu biến → ném lỗi, không fallback im lặng về localhost/MemoryServer.

---

## 6. Vệ sinh dữ liệu & bảo mật

- Script dọn toàn bộ user/category/product/cart/order do chính lần chạy tạo trong khối `finally` — kể cả khi có lỗi giữa chừng.
- Không fallback sang `mongodb-memory-server`; không kết nối được DB test → in lỗi sanitized và `process.exit(1)`.
- Artifacts và báo cáo này chỉ ghi loại DB, phiên bản, topology/replica set — không ghi URI hay credential.

---

## 7. Kiểm chứng

| Lệnh | Kết quả |
|---|---|
| `npm run test:concurrency:evidence` | PASS — 3/3 vòng, mỗi vòng `201=1`, `409=19`, `stock=0`, `orders=1` |
| `npm run test:concurrency` | 2 tests, **2 pass, 0 fail, 0 skipped** |
| `npm run test:integration` | 62 tests, 54 pass, 0 fail, 8 skipped (8 test thuộc file khác; file concurrency **0 skipped**) |
| `npm test` | 371 tests, 365 pass, 0 fail, 6 skipped |

> Số test bị skip của `concurrency.stock.integration.test.js` trong lần kiểm chứng cuối: **0**.

---

## 8. Liên kết

- [`T1-4-3_DOCS_INDEX.md`](T1-4-3_DOCS_INDEX.md) — mục lục tài liệu (đã thêm dòng trỏ báo cáo này).
- [`CHECKOUT_STOCK.md`](CHECKOUT_STOCK.md) — nền tảng CAS + compensation cho checkout.
- [`T5-2-1_STOCK_CHECK.md`](T5-2-1_STOCK_CHECK.md) — kiểm tra tồn kho theo SKU ở giỏ hàng.

**Reviewer:** ____________________  **Ngày review:** ____________________
