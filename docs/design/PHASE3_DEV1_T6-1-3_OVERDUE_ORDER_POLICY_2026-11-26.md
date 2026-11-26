# T6-1-3 — OVERDUE ORDER POLICY (DESIGN ONLY)

> **Trạng thái: ĐỀ XUẤT / CHỜ DEV 2 CHỐT POLICY + OWNER HOÀN KHO.** Tài liệu này là thiết kế chính sách và runner, **không phải implementation**. Không thêm dependency, không sửa CI, không đụng DB thật, không merge.

| Item | Giá trị |
|---|---|
| Ngày | 2026-11-26 |
| Snapshot đối chiếu | `main` @ `67be29ab8dc1c478039c644c02cc8d38aaf8268e` |
| Owner WBS | Dev 1 (reviewer: Dev 2) |
| Dependency | T6-1-1 → T6-1-3; dùng lại T5-1-2 (`assertTransition`) |
| File dự kiến (mới) | `src/services/cancelOverdueOrders.js`, `test/cancel-overdue-orders.test.js` |
| File hiện có có thể đụng | `src/model/Order.js` (additive `expiresAt`), `src/model/Products.js` / `ProductsServices.js` (restock) — **cần Dev 2 duyệt** |

---

## 1. Baseline đã verify trên `main` @ `67be29a`

- `src/model/Order.js:158-250` — **không có** `expiresAt` / `paymentDueAt`. `expiresAt` chỉ có ở `Cart.js:63-65,93-97,136-137` (TTL giỏ guest 30 ngày) và `resetPasswordService.js:36-50`.
- `src/model/Order.js:193-200` — `paymentStatus` mặc định `unpaid`; enum `unpaid|paid|refunded`.
- `src/routes/order.route.js:158-175` — trừ kho có điều kiện theo variant (`stock >= qty`, `$inc -qty`), `modifiedCount === 0 → 409`; compensation thủ công khi lỗi.
- **Không có** `restoreStock` khi hủy, không có transaction (`withTransaction|startSession` rỗng trong `src`).
- **Không có** `node-cron`/`cron`, không có `src/jobs/`, không có `cancelOverdueOrders`, không có `schedule:` trong `.github/workflows/api-test-gates.yml`.
- `src/services/auditEvent.js` đã tồn tại trên main (từ T5-1-3) nhưng publisher mặc định vẫn là **no-op** — thuộc T6-1-2, không phải job này.
- `package.json:9` script `test` đã có `admin.users.test.js`, `admin.audit-event.test.js`; `devDependencies` đã khai báo `newman` (không liên quan job).

Kết luận: mọi thứ của T6-1-3 hiện **chưa tồn tại**; thiết kế dưới đây là contract đề xuất.

---

## 2. Policy đề xuất (để Dev 2 duyệt)

| Quyết định | Đề xuất Dev 1 | Trạng thái |
|---|---|---|
| Field hết hạn | `Order.expiresAt: Date|null`, chỉ set lúc tạo khi `status='pending' && paymentStatus='unpaid'`; clear khi `confirmed` hoặc `paid` | ⏳ Cần duyệt (đụng `Order.js` của Dev 2) |
| TTL | `ORDER_PENDING_TTL_MS`, mặc định **2 giờ**, cho phép override bằng env; lưu UTC ISO | ⏳ Dev 2 chốt số |
| Điều kiện chọn đơn | `status:'pending'`, `paymentStatus:'unpaid'`, `expiresAt: { $lte: now }` | ⏳ Chốt |
| Đơn đã thanh toán | `paid` / `refunded` **không bao giờ** tự hủy | ✅ Đề xuất cố định |
| Trạng thái đích | `cancelled` qua service T5-1-2, actorRole `system`, append `statusHistory.by='system'` | ⏳ Chốt kiểu `by` (xem spec T5-1-2) |
| Hoàn kho | Chỉ hoàn nếu đơn thực sự đã trừ kho lúc tạo; ghi marker `stockRestoredAt` trên Order | ⏳ **Cần chốt đầu mối**: Dev 1 T6-1-3 hay Dev 2 T6-2-2 |
| Chống double-restock | CAS trên Order (`status: 'pending' → 'cancelled'`) + marker `stockRestoredAt`; chỉ request thắng CAS được hoàn kho | ⏳ Chốt |
| Idempotency / lock | Không dùng in-memory lock làm cơ chế duy nhất; dùng atomic CAS trên DB để an toàn multi-instance | ✅ Đề xuất cố định |
| Dry run | `dryRun=true` mặc định khi chạy tay; scheduled job phải set rõ `DRY_RUN=false`. Dry run chỉ log danh sách đơn, **không mutate** | ⏳ Chốt |
| Timezone | Mọi timestamp lưu/ghi log ở UTC ISO (`2026-11-26T...Z`); log có thể thêm giờ local để đọc nhưng không dùng để so sánh | ✅ Đề xuất cố định |
| Hạ tầng chạy | Xem mục 3 — chưa chọn | ⏳ Cần quyết định |

---

## 3. Cơ chế chạy (3 phương án)

| Phương án | Cách | Ưu | Nhược | Đề xuất |
|---|---|---|---|---|
| A. In-process cron | Thêm `node-cron`, chạy job trong `src/server.js` | Đơn giản, không sửa CI | Thêm dependency (cần duyệt); chạy trên mọi instance → cần CAS chống trùng | Khả thi nếu deploy 1 instance |
| B. External scheduler → API | Endpoint admin/system `POST /api/admin/jobs/cancel-overdue-orders`, scheduler bên ngoài gọi kèm token + CSRF | Không thêm dep, không sửa CI; dễ dry-run | Cần định nghĩa auth riêng cho `system` (không phải user thật) | **Ưu tiên** nếu không muốn sửa CI/package |
| C. GitHub Actions `schedule` | Thêm `schedule:` vào workflow | Không cần server chạy job | **Hiện bị loại**: yêu cầu sửa CI (nằm ngoài phạm vị được phép) | Không chọn lúc này |

**Khuyến nghị:** B, với endpoint được bảo vệ bằng `authenticate` + `authorize('admin')` hoặc một service-token riêng do Dev 2 chốt; luôn nhận `{ dryRun, limit, now? }` và trả `{ scanned, cancelled, restocked, skipped, failed, durationMs }`.

---

## 4. Contract runner đề xuất

Module mới `src/services/cancelOverdueOrders.js` (chưa tồn tại):

```text
cancelOverdueOrders({ now = new Date(), dryRun = true, limit = 100 }) ->
  { scanned, cancelled, restocked, skipped: [{ orderId, reason }], failed: [{ orderId, code }], durationMs }
```

Thuật toán (mỗi đơn, tuần tự hoặc có giới hạn concurrency):

1. Query ứng viên: `status:'pending'`, `paymentStatus:'unpaid'`, `expiresAt: {$lte: now}`, `limit`.
2. Nếu `dryRun`: chỉ đếm/log, **return early**, không ghi.
3. Với mỗi đơn: gọi `assertTransition` từ T5-1-2 với `from='pending'`, `to='cancelled'`, `actorRole='system'`.
4. CAS: `Order.findOneAndUpdate({ _id, status:'pending' }, { $set:{status:'cancelled'}, $push:{statusHistory:entry} })`. Thất bại → `skipped: ORDER_STATUS_CONFLICT`, không hoàn kho.
5. Nếu CAS thắng và đơn có marker "đã trừ kho": gọi **một** hàm `restoreStock(items)` do Dev 2 export; set `stockRestoredAt` bằng CAS có điều kiện `stockRestoredAt: null`.
6. Lỗi từng đơn không dừng cả batch; ghi `failed` và tiếp tục; log tổng hợp.

**Không** tự gọi `auditEvent` ở job này nếu T6-1-2 chưa implement publisher thật; chỉ emit event nếu contract audit đã sẵn sàng.

---

## 5. test plan

| Case | Kỳ vọng |
|---|---|
| Đơn `pending/unpaid/expiresAt quá hạn`, `dryRun=true` | `cancelled=0`, không có ghi DB |
| Đơn `pending/paid`, quá hạn | `skipped=PAID_NOT_ELIGIBLE` |
| Đơn `confirmed/unpaid`, quá hạn | không được chọn |
| Đơn `cancelled` có `stockRestoredAt` | không hoàn kho lần 2 |
| CAS thất bại (giả lập modifyCount=0) | `skipped=ORDER_STATUS_CONFLICT`, `restocked=0` |
| `expiresAt > now` | không được chọn |
| `limit` | không xử lý quá `limit` đơn |

Chạy dự kiến: `node --test test/cancel-overdue-orders.test.js` với fake model (DB-free) + một integration test dùng DB riêng **do Dev 2 cung cấp URI**, không đụng DB dùng chung.

---

## 6. Quyết định cần Dev 2 trả lời

1. Có chấp nhận thêm `Order.expiresAt` (additive) và marker `stockRestoredAt` / `overdueClaimedAt` không?
2. TTL có đúng 2h không; giá trị env tên gì; có cần cấu hình theo phương thức thanh toán (`bank_transfer` vs `cod`) không?
3. Ai là đầu mối hoàn kho duy nhất: T6-1-3 (Dev 1) hay T6-2-2 (Dev 2)? Ai export `restoreStock`?
4. Chọn phương án A/B/C ở mục 3; nếu B, chốt cơ chế auth cho `system`.
5. `statusHistory.by` lưu `'system'` như thế nào (liên quan spec T5-1-2)?
6. Có cần transaction bao cả CAS đơn + hoàn kho, hay chấp nhận CAS + marker rồi retry ở run sau?

---

## 7. Điều kiện sang implementation

- T6-1-1 xong và có route/caller thật.
- T5-1-2 có `assertTransition` chạy được.
- Mục 6 được trả lời đủ; nếu chưa, chỉ giữ tài liệu này, không code job.

---

## 8. Dev 1 đã chốt (2026-11-26)

| Chốt | Giá trị |
|---|---|
| TTL | **2 giờ = 7.200.000 ms** (`ORDER_PENDING_TTL_MS`) |
| Điều kiện hủy | Chỉ `status='pending'` **và** `paymentStatus='unpaid'` và `expiresAt <= now` |
| Paid/refunded | **Không bao giờ** tự hủy |
| dryRun | Chỉ log, **không mutate**; scheduled job phải set rõ `DRY_RUN=false` |
| Thời gian | UTC ISO; không dùng giờ local để so sánh |
| Cron | **Ưu tiên external scheduler** gọi endpoint có secret (tránh thêm dep); nếu in-process `node-cron` thì cần phê duyệt dependency |
| Actor | `system`/scheduler, đi qua `assertTransition` của T5-1-2 |
| Chưa chốt | Đầu mối hoàn kho duy nhất (Dev 1 T6-1-3 vs Dev 2 T6-2-2), marker `stockRestoredAt`, auth của endpoint system, transaction hay CAS+retry |

=> Chỉ giữ tài liệu này cho đến khi Dev 2 trả lời mục 6; Dev 1 không thêm dependency, không sửa CI, không đụng `Products.js`.
