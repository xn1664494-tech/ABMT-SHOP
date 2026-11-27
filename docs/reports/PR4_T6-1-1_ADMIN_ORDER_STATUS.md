# PR-4 / T6-1-1 — Admin Order Status API

## Scope

- Branch: `feat/T6-1-1-admin-order-status`, base `feat/T5-1-2-order-state-machine` @ `8a8d8248ca120417475d19d9e0a232cd5bbaa37c`.
- Worktree: `D:\ABMT_Shop\ABMT-SHOP-pr4`.
- Files changed/added:
  - `src/routes/admin.route.js` (thêm route, giữ nguyên các route cũ)
  - `src/controllers/adminOrderController.js` (mới)
  - `src/validators/adminOrderValidator.js` (mới)
  - `test/admin.order-status.test.js` (mới)
  - `docs/reports/PR4_T6-1-1_ADMIN_ORDER_STATUS.md` (mới)
- Không merge, cherry-pick, rebase, reset/clean, force push; không `git add .`.
- Không sửa `src/services/orderStateMachine.js`, `src/services/auditEvent.js`, `src/model/Order.js`.
- Không refactor / sửa logic cancellation hiện có (`POST /api/orders/:id/cancel`, `OrderCancellationService.js`, `order.route.js`).

## Endpoint & middleware order

`PATCH /api/admin/orders/:orderId/status`

```js
router.patch(
  '/orders/:orderId/status',
  authenticate,
  authorize('admin'),
  csrfProtection,
  validate(updateOrderStatusSchema),
  AdminOrderController.updateStatus,
);
```

Thứ tự được kiểm chứng bằng hành vi: guest → 401 (auth trước), customer → 403 (authorize trước CSRF/validate), thiếu CSRF → 403 dù body sai (CSRF trước validate), body sai → 400 (validate trước controller).

Body (Zod, `.strict()`): `status` ∈ `['confirmed','shipping','delivered','cancelled']`; `note` tuỳ chọn, string tối đa 500 ký tự. Dùng helper `validate` có sẵn (`src/middleware/validate.js`), ghi đè `req.body` bằng dữ liệu đã parse.

## Controller contract

```js
const actorId = req.user._id || req.user.id;

const { order, from } = await transitionOrderStatus({
  orderId: req.params.orderId,
  to: req.body.status,
  actorRole: 'admin',
  actorId,
  note: req.body.note,
});

// CHỈ sau khi transition thành công:
const event = buildAuditEvent({
  actorId,
  actorRole: 'admin',
  action: 'admin.order.status.changed',
  targetType: 'Order',
  targetId: req.params.orderId,
  before: { status: from },
  after: { status: order.status },
});
await publishAuditEvent(event);

return sendResponse(res, 200, true, 'Cap nhat trang thai don hang thanh cong', { order });
```

Transition thất bại (404/409) throw trước khi tới bước audit → **không publish event**. State machine được gọi lại nguyên vẹn từ `../services/orderStateMachine`; PR-4 không tự viết lại flow/role rule/CAS.

### Audit contract dùng literal string (tránh conflict với PR-3)

Branch này **chưa có PR-3**, nên `src/services/auditEvent.js` mới chỉ có `AUDIT_ACTIONS.ADMIN_ROLE_CHANGED` và `TARGET_TYPES.USER`. PR-4 dùng literal `'admin.order.status.changed'` và `'Order'` thay vì import constant chưa tồn tại. Khi PR-3 merge, sẽ thay bằng `AUDIT_ACTIONS.ADMIN_ORDER_STATUS_CHANGED` và `TARGET_TYPES.ORDER` (giá trị không đổi) — không sửa auditEvent.js ở PR này.

## Test evidence

> Worktree không có `node_modules`; dùng `NODE_PATH` trỏ tới dependency đã cài sẵn ở worktree gốc (read-only). Không chạy test DB thật / `.env` thật. Test cài fake User (`test/support/fakeUserModel.js`) và fake Order (`installFakeModel` trong `test/support/fakeCartModels.js`), mượn static thật `canTransition` / `ORDER_STATUS_FLOW` của `Order`. Dùng `setAuditPublisher` để capture event và reset về no-op sau mỗi test.

### Focused

Command:

```powershell
$env:NODE_PATH='D:\ABMT_Shop\ABMT-SHOP\node_modules'; node --test test/admin.order-status.test.js
```

| Metric | Value |
| --- | --- |
| Total | 8 |
| Pass | 8 |
| Fail | 0 |
| Skipped | 0 |
| Cancelled | 0 |
| Exit code | 0 |

Coverage: guest 401; customer 403; admin `pending→confirmed` 200 với response đúng, CAS filter đúng, đúng 1 audit event (7 field, `before.status='pending'`, `after.status='confirmed'`, literal action/targetType, actorId từ `req.user`); `pending→shipping` 409 không audit; order không tồn tại 404 không audit; CAS null 409 không audit; status/field sai 400 không audit; thiếu CSRF 403 (chứng minh CSRF đứng trước validate).

### Regression

Command:

```powershell
$env:NODE_PATH='D:\ABMT_Shop\ABMT-SHOP\node_modules'; node --test test/order.cancel.test.js test/admin.audit-event.test.js test/auth.rbac.test.js
```

| Metric | Value |
| --- | --- |
| Total | 21 |
| Pass | 21 |
| Fail | 0 |
| Skipped | 0 |
| Cancelled | 0 |
| Exit code | 0 |

Bao gồm regression `test/order.cancel.test.js` (6 test) chứng minh customer cancel cũ không hỏng, cùng audit-event contract và RBAC.

### Supplementary

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

## Limitation

- Chỉ kiểm chứng ở mức HTTP với fake model (DB-free); chưa chạy integration với MongoDB thật theo đúng yêu cầu.
- Audit publisher vẫn là no-op mặc định của T5-1-3; PR-4 chỉ capture event trong test, chưa ghi `AuditLog` (thuộc T6-1-2/PR-3).
- `note` được state machine prefix `[role:admin]` trong `statusHistory`; audit event chỉ chứa before/after status theo contract yêu cầu.
