# PHASE 3 DEV 1 — KICKOFF / READY-TO-START PACK (2026-11-26)

> Tài liệu tổng hợp các quyết định Dev 1 đã chốt, đối chiếu với code thực tế, để bạn có thể bắt đầu Phase 3 Dev 1 mà không đụng file của Dev 2. **Không thay đổi code production** trong branch này; chỉ cập nhật tài liệu/contract.

| Item | Giá trị |
|---|---|
| Ngày | 2026-11-26 |
| Snapshot | `main` @ `45d5668aa83f706489225b150cd23f8b61be899b` (= `origin/main`) |
| Branch này | `feat/phase3-dev1-kickoff-2026-11-26` |
| Branch docs trước | `docs/phase3-dev1-design-contracts-2026-11-26` @ `faa8a24` — **đã merge vào main** qua PR #78 (`45d5668`) |
| Audit gốc | `docs/reports/PHASE3_DEV1_READINESS_AUDIT_AFTER_MAIN_PULL_2026-11-26.md` (baseline `4503220`) |

---

## 1. Trạng thái 7 câu đã chốt

| # | Chốt của Dev 1 | Tình trạng thực tế trên main |
|---|---|---|
| 1 | Dev 2 là owner duy nhất `cart.route.js`, `Cart.js`, `order.route.js` | Đồng ý. Dev 1 không sửa 3 file này khi chưa có uỷ quyền/PR từ Dev 2 |
| 2 | Giữ `PUT /api/cart/items/:id {qty}`; FE không đổi; identity dùng `sku` | `cart.js:177-178` đã `.put(...,{qty})`; `cart.route.js:157,161` đã `router.put` + `qty`. **Method/body đã khớp.** Lỗi còn lại: `:171,:211` tra cứu `_id` trong khi `Cart.js:40` để `_id:false` → **Dev 2 sửa 2 dòng** |
| 3 | Dev 2 viết merge trong `cart.route.js`; Dev 1 chỉ review | Hành vi chốt: cộng dồn qty + check stock + lấy giá DB + `mergedAt/mergedFrom` + clear cookie sau save |
| 4 | Dev 2 tách `decrementStock/restoreStock` trong `ProductsServices.js` | Chưa có. ⚠️ Câu này vẫn mâu thuẫn: Dev 2 owns `order.route.js` nhưng bản chốt ghi "Dev 1 import dùng trong `order.route.js`" → cần uỷ quyền rõ hoặc Dev 2 tự sửa |
| 5 | T6-2-2 đi qua `assertTransition`; actor `admin/system/scheduler` | Đã ghi vào spec T5-1-2; chưa có service (chỉ static `canTransition` tại `Order.js:315`) |
| 6 | TTL 2h, unpaid-only, paid không hủy, dryRun, UTC, ưu tiên external scheduler | Đã ghi vào spec T6-1-3; owner hoàn kho + dependency cron vẫn chờ Dev 2 |
| 7 | Review/merge 2 branch Dev 1 | **Đã xong**: `45ab020` (PR #77) và `88a8e91` (PR #76) đều là ancestor của `45d5668`. Không cần làm lại |

---

## 2. Ma trận quyền sửa file

| File | Owner | Dev 1 được làm gì ngay |
|---|---|---|
| `src/public/js/cart.js` | Dev 1/UI | **Không cần sửa** — đã `PUT {qty}` |
| `src/routes/cart.route.js` | **Dev 2** | Chỉ review; không sửa identity/merge/cookie |
| `src/model/Cart.js` | **Dev 2** | Không sửa |
| `src/model/Order.js` | **Dev 2** | Không sửa (kể cả thêm `expiresAt`) khi chưa duyệt |
| `src/routes/order.route.js` | **Dev 2** | Không sửa; chỉ import service trong file mới nếu Dev 2 uỷ quyền |
| `src/model/Products.js`, `src/services/ProductsServices.js` | **Dev 2** | Không sửa; chỉ import `decrementStock/restoreStock` sau khi Dev 2 export |
| `src/app.js` | Dev 1 + Dev 2 | Chỉ cherry-pick riêng `c309879` sau khi Dev 2 chốt; không merge cả branch diverge ~55 file |
| `src/services/orderStateMachine.js` **(mới)** | **Dev 1** | ✅ Có thể tạo + test DB-free |
| `test/order.state-machine.test.js` **(mới)** | **Dev 1** | ✅ Có thể tạo |
| `src/services/cancelOverdueOrders.js` **(mới)** | Dev 1 | ⏳ Chờ policy/owner hoàn kho chốt |
| `src/public/js/login.js` | Dev 1 | ⏳ Thêm trigger `POST /api/cart/merge` **sau khi** Dev 2 tạo endpoint |

---

## 3. Cái gì sẵn sàng để bắt đầu, cái gì còn chặn

### ✅ Có thể bắt đầu ngay (an toàn, file mới)

1. **T5-1-2 — state machine service** (theo `PHASE3_DEV1_T5-1-2_ORDER_STATE_MACHINE_SPEC_2026-11-26.md`):
   - Tạo `src/services/orderStateMachine.js`: `canTransition`, `assertTransition`, `buildStatusHistoryEntry`, `createStatusUpdate`.
   - Tạo `test/order.state-machine.test.js` (DB-free, fake model).
   - Không đụng `Order.js`; actor chốt `admin/system/scheduler`; ma trận chi tiết ghi `OPEN` trong spec.
2. **Review contract cart** với Dev 2: gửi lại đúng 2 dòng cần đổi (`cart.route.js:171,:211` → `item.sku`) và endpoint `POST /api/cart/merge`.
3. **Chuẩn bị policy T6-1-3** dạng tài liệu (đã có). Chưa code job.

### ⛔ Chặn bởi Dev 2 (chưa thể code)

| Việc | Dev 2 phải giao trước |
|---|---|
| T5-1-1 trigger sau login | `POST /api/cart/merge` + `authenticate` + `csrfProtection`, fix identity `sku`, set cookie `cartId`, idempotency `mergedAt/mergedFrom` trong `cart.route.js` |
| Mount `currentUser` | Cherry-pick riêng `c309879` hoặc phương án thay thế |
| T6-1-1 / stock | `decrementStock(items)`, `restoreStock(items)` export từ `ProductsServices.js`; uỷ quyền hoặc tự sửa `order.route.js`; chốt `stockRestoredAt` |
| T6-1-3 | Chốt đầu mối hoàn kho, auth endpoint system, dependency cron (nếu in-process) |

---

## 4. Lệnh kiểm tra baseline (chỉ đọc + test DB-free)

```powershell
git status --short --branch
git rev-parse HEAD
git merge-base --is-ancestor 45ab020 HEAD
git merge-base --is-ancestor 88a8e91 HEAD
git merge-base --is-ancestor c309879 HEAD
```

Kỳ vọng: `HEAD = 45d5668`; hai lệnh đầu `0`; lệnh cuối `1`.

Test DB-free (24 file, đã xác minh dùng fake model / không connect DB):

```powershell
$env:NODE_ENV='test'; $env:MONGODB_URI=''
node --test test/auth.register.test.js test/auth.login.test.js test/auth.refresh-logout.test.js test/auth.rbac.test.js test/auth.csrf.test.js test/auth.profile.test.js test/auth.rate-limit.test.js test/auth.admin-route.test.js test/auth.change-password.test.js test/profile.view.test.js test/admin.users.test.js test/admin.audit-event.test.js test/error-handler.test.js test/trust-proxy.test.js test/user.model.test.js test/category.model.test.js test/product.model.test.js test/order.model.test.js test/cart.model.test.js test/review.model.test.js test/product.validator.test.js test/product.filter.test.js test/product.pagination.test.js test/integration/rate-limit.integration.test.js
```

**Không chạy**: `npm test`, `test:all`, `test:integration`, `test:api`, `test:postman`, `test:seed-verify`, hoặc file có `deleteMany`/`mongoose.connect`/`mongodb-memory-server`.

---

## 5. Đề xuất thứ tự làm trên branch này

| Bước | Việc | File | Điều kiện |
|---|---|---|---|
| 0 | Giữ nguyên branch `feat/phase3-dev1-kickoff-2026-11-26` làm base | — | Đã push |
| 1 | Implement T5-1-2 state machine | `src/services/orderStateMachine.js`, `test/order.state-machine.test.js` (mới) | Bạn ra lệnh "implement" — không đụng file Dev 2 |
| 2 | Chờ Dev 2 giao `POST /api/cart/merge` + sku fix + cookie | `cart.route.js` (Dev 2 sửa) | Dev 2 push |
| 3 | Thêm trigger sau login | `src/public/js/login.js` (Dev 1) | Bước 2 xong |
| 4 | T6-1-1 | Route/controller **mới** hoặc `order.route.js` sau uỷ quyền | T5-1-2 + stock service + owner restock |
| 5 | T6-1-2 | AuditLog model/service/route mới | T5-1-3 đã merge ✅ + T6-1-1 |
| 6 | T6-1-3 | `cancelOverdueOrders.js` mới | Policy + owner hoàn kho chốt |

---

## 6. Trạng thái working tree

- Branch này được tạo từ `main` @ `45d5668` (đã gồm 3 tài liệu design).
- File staged cũ `src/controllers/authController.js` và 8 mục untracked vẫn giữ nguyên, **không bị commit**.
- Không thay đổi code production, không merge, không cài package, không đọc `.env`, không chạy test DB.
