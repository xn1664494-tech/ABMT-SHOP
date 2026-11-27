# PR-5 / T6-1-3 — Overdue Orders + Restock

Branch: `feat/T6-1-3-overdue-orders` (base `3be4ea6`, đã gồm PR-2 state machine + PR-4 admin API).

## 1. Scope

Chỉ thay đổi các file được phép:

- `src/model/Order.js`
- `src/services/CheckoutService.js`
- `src/services/OrderCancellationService.js`
- `src/jobs/cancelOverdueOrders.js` (mới)
- `scripts/run-overdue-orders.js` (mới)
- `scripts/migrate-order-expires-at.js` (mới)
- `test/cancel-overdue-orders.test.js` (mới)
- `docs/reports/PR5_T6-1-3_OVERDUE_ORDERS.md` (file này)

KHÔNG sửa `orderStateMachine.js`, `admin.route.js`, `adminOrderController.js`, `auditEvent.js`, `cart.route.js`, `CartService.js`, `authController.js`. Không merge/cherry-pick/rebase/reset/clean/force push.

## 2. Schema changes (`Order.js`)

- Thêm `expiresAt: { type: Date, default: null }` cạnh `stockRestoredAt`.
- Thêm index compound `{ status: 1, paymentStatus: 1, expiresAt: 1 }`.
  - Không trùng 2 index cũ `{ user:1, createdAt:1 }` và `{ status:1, createdAt:1 }` (index unique `code` cũng giữ nguyên).
  - **Không dùng `sparse`**: nếu sparse, document legacy thiếu `expiresAt` bị loại khỏi index; sau khi backfill chúng cần được job/index quan sát thống nhất. Non-sparse cũng index giá trị `null`, giúp query và migration có cùng một tập document.
- Giữ nguyên `status`, `ORDER_STATUS_FLOW`, `canTransition`, `PAYMENT_STATUSES`.
- Thêm static dùng chung: `PENDING_TTL_MINUTES = Number(process.env.ORDER_PENDING_TTL_MINUTES) || 30`.
- `statusHistorySchema` thêm field additive `actorRole: { type: String, trim: true, default: '' }` để đóng limitation của PR-2 (PR-2 đã gửi `actorRole` trong payload nhưng schema cũ bỏ field này). `by`, `note`, `at` và thứ tự/ý nghĩa cũ không đổi; entry cũ không bị sửa dữ liệu.

## 3. TTL config

- Mặc định 30 phút. Biến `ORDER_PENDING_TTL_MINUTES` (phút) được đọc một lần lúc load schema; giá trị không phải số dương/0 rơi về 30.
- Checkout gán `expiresAt = Date.now() + PENDING_TTL_MINUTES * 60 * 1000` cho đơn `pending`/`unpaid`.
- Migration dùng cùng static: `expiresAt = createdAt + PENDING_TTL_MINUTES * 60 * 1000`.
- Thứ tự trong `CheckoutService` giữ nguyên: trừ kho → tạo order → xoá/pull cart → compensation (xoá order pending + hoàn kho). Không refactor.

## 4. Cancellation contract

`cancelOrder({ ..., expectedPaymentStatus = null })`:

- Customer/admin: rule cũ hoàn toàn; `expectedPaymentStatus` bị bỏ qua (không check sớm, không đưa vào CAS).
- System + có `expectedPaymentStatus`:
  - Check sớm `order.paymentStatus === expectedPaymentStatus`, sai → `409 ORDER_PAYMENT_CONFLICT`.
  - CAS filter: `{ _id, status: from, stockRestoredAt: null, paymentStatus: expectedPaymentStatus }`.
- Bổ sung an toàn: actor `system` không bao giờ hủy đơn không còn `unpaid` (kể cả caller quên truyền expected). Job luôn truyền `'unpaid'`.
- `restoreStock` không bị viết lại; chỉ gọi từ cancellation service sau khi CAS thành công.
- `statusHistory` entry của lần hủy có thêm `actorRole` (additive).

## 5. Job / runner / migration contract

### Job `src/jobs/cancelOverdueOrders.js`

Export `cancelOverdueOrders({ now = new Date(), batchSize = 100 } = {})` (kèm helper `findOverdueOrders`, `overdueFilter`).

Query:

```js
{
  status: 'pending',
  paymentStatus: 'unpaid',
  expiresAt: { $lte: now },
  $or: [{ stockRestoredAt: null }, { stockRestoredAt: { $exists: false } }],
}
```

Mỗi đơn gọi `cancelOrder({ orderId, actorRole: 'system', actorId: null, expectedPaymentStatus: 'unpaid', note: 'Huy don qua han' })`.

Summary: `{ found, cancelled, skipped, failed, errors }`. Conflict (`ORDER_NOT_FOUND`, `ORDER_INVALID_TRANSITION`, `ORDER_PAYMENT_CONFLICT`, `ORDER_STATUS_CONFLICT`) → `skipped`; lỗi khác → `failed` + `errors`. Log chỉ gồm id/code/reason ngắn, không log token/cookie/secret/MONGODB_URI.

### Runner `scripts/run-overdue-orders.js`

- `--dry-run`: chỉ query/đếm, KHÔNG gọi hủy; in `found` và `cancelled/skipped/failed = 0`.
- Không cờ: chạy thật.
- `--batch=N` (mặc định 100).
- Cron đề xuất: `*/5 * * * *` chạy `node scripts/run-overdue-orders.js`. Không dùng `setInterval` trong `app.js`, không thêm dependency, không tự gọi migration.
- Kết nối DB nằm trong `main()` và chỉ xảy ra khi chạy CLI; test gọi `runCli` với dependency inject nên không connect.

### Migration `scripts/migrate-order-expires-at.js`

- Mặc định DRY-RUN; chỉ ghi khi truyền cờ xác nhận rõ ràng `--apply`.
- Đối tượng: `status:'pending'`, `paymentStatus:'unpaid'`, `$or:[{expiresAt:null},{expiresAt:{$exists:false}}]`.
- `updateOne` mang CAS legacy filter để không ghi đè đơn đã có TTL hoặc đã đổi trạng thái.
- In `timThay / duKienCapNhat / daCapNhat / boQua`.
- Không tự chạy lúc khởi động server; audit này KHÔNG chạy migration thật và KHÔNG connect DB.

## 6. Concurrency / double-restock evidence

- CAS filter luôn có `stockRestoredAt: null` (trong MongoDB cũng khớp field bị thiếu), nên marker do worker trước ghi sẽ chặn worker sau.
- CAS lặp `status: from` và `paymentStatus: 'unpaid'` để chặn race đổi trạng thái/thanh toán giữa `findById` và `findOneAndUpdate`.
- Test DB-free chứng minh:
  - Chạy job 2 lần: lần 2 `found = 0`, tổng restore stock vẫn đúng 1 lần.
  - Hai worker cùng nhận một snapshot: tổng `cancelled = 1`, `skipped = 1`, CAS xảy ra 2 lần nhưng restore stock chỉ 1 lần.
  - Race thanh toán sau query: `ORDER_PAYMENT_CONFLICT`, không CAS, không hoàn kho.

## 7. Tests

Lệnh chạy (worktree pr5, dùng `NODE_PATH` vì worktree không có `node_modules`):

```powershell
$env:NODE_PATH='D:\ABMT_Shop\ABMT-SHOP\node_modules'
node --test test/cancel-overdue-orders.test.js
node --test test/order.cancel.test.js test/order.model.test.js test/checkout.stock.test.js test/order.state-machine.test.js test/admin.order-status.test.js
```

| Bộ test | total | pass | fail | skipped | exit code |
| --- | ---: | ---: | ---: | ---: | ---: |
| Focused `cancel-overdue-orders.test.js` | 18 | 18 | 0 | 0 | 0 |
| Regression 5 file | 43 | 43 | 0 | 0 | 0 |

Test dùng `installFakeModel` từ `test/support/fakeCartModels.js` + fake Order/Product model cục bộ mô phỏng `find(...).limit(...)`, `lean()`, `findById`, `findOneAndUpdate` CAS có `paymentStatus`/`stockRestoredAt`. Không gọi `mongoose.connect`, không đọc `.env`, không đọc/in secret.

## 8. Limitations

- TTL chỉ áp dụng cho đơn mới; đơn legacy cần chạy migration có `--apply` ở môi trường có DB (không thực hiện trong audit này).
- Job xử lý tối đa `batchSize` đơn mỗi lần; dùng cron nhiều lần để tiêu hóa backlog.
- `expiresAt` là hạn giữ kho, không phải TTL index của MongoDB (không tự xoá document).
- PR-2 comment trong `orderStateMachine.js` còn nói schema chưa có `actorRole`; file này nằm ngoài scope nên giữ nguyên, nhưng schema đã có field ở PR-5.
