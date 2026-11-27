# PR-2 / T5-1-2 — Order State Machine

## Scope

- Branch: `feat/T5-1-2-order-state-machine` (base `main` @ `79d9920`).
- Worktree: `D:\ABMT_Shop\ABMT-SHOP-pr2`.
- Files added:
  - `src/services/orderStateMachine.js`
  - `test/order.state-machine.test.js`
  - `docs/reports/PR2_T5-1-2_ORDER_STATE_MACHINE.md`
- Không sửa `src/model/Order.js`; không merge/rebase/cherry-pick/reset/clean/force push.
- Không chạy test có `mongoose.connect` hoặc `.env` thật. Test dùng fake model cài qua `installFakeModel` (`test/support/fakeCartModels.js`) và chỉ mượn static `canTransition` / `ORDER_STATUS_FLOW` thật của `Order`.

## Contract

```js
const { transitionOrderStatus } = require('../src/services/orderStateMachine');

const { order, from } = await transitionOrderStatus({
  orderId,
  to,          // 'confirmed' | 'shipping' | 'delivered' | 'cancelled'
  actorRole,   // 'admin' | 'customer' | 'system'
  actorId,     // ObjectId hoặc string; không hợp lệ -> history.by = null
  note,        // tuỳ chọn, được prefix bằng marker role
});
```

- `order`: document đơn hàng **sau CAS** (kết quả `findOneAndUpdate` với `{ new: true, runValidators: true }`).
- `from`: trạng thái **trước chuyển**, đọc từ `Order.findById(orderId)` trước CAS.
- PR-4 dùng cặp `from` (before) và `order.status` (after) để build audit event.
- Flow không định nghĩa lại: service đọc `Order.ORDER_STATUS_FLOW` và gọi `Order.canTransition(from, to)`.

### Role rules

| actorRole | Transitions được phép |
| --- | --- |
| `admin` | `pending→confirmed`, `confirmed→shipping`, `shipping→delivered`, `pending→cancelled`, `confirmed→cancelled` |
| `customer` | `pending→cancelled` |
| `system` | `pending→cancelled` |
| khác | không được phép |

Mọi transition khác (skip, backward, terminal, unknown status) bị từ chối.

### CAS

```js
Order.findOneAndUpdate(
  { _id: orderId, status: from },
  { $set: { status: to }, $push: { statusHistory: historyEntry } },
  { new: true, runValidators: true }
);
```

Nếu trả `null` → `409 ORDER_STATUS_CONFLICT`; không có history entry nào được ghi vào DB.

### Error codes

| Code | HTTP | Trigger |
| --- | --- | --- |
| `ORDER_NOT_FOUND` | 404 | `Order.findById(orderId)` trả `null` |
| `ORDER_INVALID_TRANSITION` | 409 | Không có trong `ORDER_STATUS_FLOW` / `canTransition` |
| `ORDER_FORBIDDEN_ROLE` | 403 | Flow hợp lệ nhưng vai trò không được phép (kiểm tra trước CAS) |
| `ORDER_STATUS_CONFLICT` | 409 | CAS không khớp `{ _id, status: from }` |

`actorRole` được kiểm tra trước bước ghi: lỗi 403/409 invalid transition không sinh bất kỳ lời gọi `findOneAndUpdate` nào.

## Limitation: `actorRole` trong history

`statusHistorySchema` hiện chỉ có `status`, `at`, `by`, `note` và **chưa có field `actorRole`**. PR-2 không được sửa `Order.js`, nên:

- Payload `$push.statusHistory` **có chứa** `actorRole`.
- `note` luôn được prefix bằng marker ổn định `[role:<actorRole>]` (ví dụ `[role:admin] xac nhan don`), để giữ thông tin role ngay cả khi Mongoose bỏ field lạ khi lưu.
- Test kiểm tra cả hai: `payload.actorRole` và `note` chứa role marker.
- PR-5 sẽ thêm field riêng `actorRole` vào schema khi được phép sửa `Order.js`; sau đó mới bỏ marker nếu muốn.

## Test evidence

> Worktree pr2 chưa có `node_modules`; dùng `NODE_PATH` trỏ tới dependency đã cài sẵn (read-only). Không tạo/sửa file trong worktree gốc.

### Focused

Command:

```powershell
$env:NODE_PATH='D:\ABMT_Shop\ABMT-SHOP\node_modules'; node --test test/order.state-machine.test.js
```

| Metric | Value |
| --- | --- |
| Total | 8 |
| Pass | 8 |
| Fail | 0 |
| Skipped | 0 |
| Cancelled | 0 |
| Exit code | 0 |

Coverage: static flow được reuse; 5 chiều admin hợp lệ; 8 ca skip/backward/unknown → 409 và không CAS; customer/system chỉ `pending→cancelled`, 7 ca bị chặn → 403; order không tồn tại → 404; CAS null → 409 và giữ nguyên history; 2 request concurrent chỉ 1 thắng; history có `by`/`note`/`at`, role marker và `actorRole` trong payload (kể cả `actorId` không hợp lệ → `by: null`).

### Regression

Command:

```powershell
$env:NODE_PATH='D:\ABMT_Shop\ABMT-SHOP\node_modules'; node --test test/order.model.test.js test/order.cancel.test.js
```

| Metric | Value |
| --- | --- |
| Total | 21 |
| Pass | 21 |
| Fail | 0 |
| Skipped | 0 |
| Cancelled | 0 |
| Exit code | 0 |

## Confirmation

- `src/model/Order.js` **không bị sửa** (diff chỉ có 3 file mới liệt kê ở phần Scope).
- **Không merge**, không rebase/cherry-pick/reset/clean, không force push.
- Chỉ `git add` đúng các file của PR-2, commit và push lên `feat/T5-1-2-order-state-machine`.
