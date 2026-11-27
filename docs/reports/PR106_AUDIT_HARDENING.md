# PR #106 — Audit hardening (fail-open + system expiry)

| Item | Giá trị |
|---|---|
| Branch | `fix/audit-hardening` |
| Base | `main` @ `fd32a8ecb3c37f6cbfb9e094dfa14b8ba48baa0a` |
| Ngày | 2026-11-27 |
| Quyết định đã chọn | **Fail-open + log** khi ghi audit thất bại |
| Regression DB-free | **269 tests — 269 pass — 0 fail — 0 skip — exit 0** |

---

## 1. Vấn đề

Ba điểm còn mở sau 6 PR (#99–#104) và PR #105:

1. `publishAuditEvent` là `await publisher(event)` không có `try/catch`. Với publisher thật (AuditLog), nếu ghi log lỗi thì API trả 500 **sau khi mutation đã thành công** (`adminOrderController.updateStatus`, `adminUserService.updateUserRole`). Client retry sẽ gặp conflict/duplicate.
2. Job hủy đơn quá hạn (PR-5) ghi dữ liệu (`status=cancelled`, hoàn kho) nhưng **không phát audit event** — lỗ hổng truy vết.
3. Còn literal string và comment stale (`PR-4 chưa có PR-3`, `no-op`, v.v.) trong code đã merge.

---

## 2. Cách sửa

| File | Thay đổi |
|---|---|
| `src/services/auditEvent.js` | Thêm `AUDIT_ACTIONS.SYSTEM_ORDER_EXPIRED`. Bọc `publishAuditEvent` bằng `try/catch`: khi publisher lỗi, ghi 1 dòng JSON có cấu trúc rồi trả `undefined`; không ném lỗi. Log gồm `level`, `scope`, `action`, `targetType`, `targetId`, `actorId`, `actorRole`, `message` (tối đa 200 ký tự). **Không log `before/after`** để tránh lộ dữ liệu nhạy cảm. |
| `src/controllers/adminOrderController.js` | Dùng `AUDIT_ACTIONS.ADMIN_ORDER_STATUS_CHANGED` / `TARGET_TYPES.ORDER` thay literal; xóa comment stale. `await publishAuditEvent` vẫn giữ nhưng đã an toàn. |
| `src/services/adminUserService.js` | Chỉ cập nhật comment stale thành mô tả fail-open; không đổi logic. |
| `src/jobs/cancelOverdueOrders.js` | Sau CAS cancel + hoàn kho thành công, phát `system.order.expired` với `actorId/actorRole = 'system'`, `before = { status: 'pending', paymentStatus: 'unpaid' }`, `after = { status: 'cancelled', stockRestoredAt }`. Audit publish lỗi **không** tăng `summary.failed`. |
| `src/services/orderStateMachine.js` | Dọn comment stale về `actorRole`/PR; không đổi hành vi. |

### 2.1 Hành vi fail-open

- Business mutation (đổi trạng thái/role, hủy đơn quá hạn) vẫn trả thành công nếu DB ghi thành công.
- Lỗi audit được log qua `console.error` dạng JSON một dòng, ví dụ:

```json
{"level":"error","scope":"audit","action":"admin.order.status.changed","targetType":"Order","targetId":"...","actorId":"...","actorRole":"admin","message":"audit down"}
```

- Chưa làm outbox/retry — để backlog riêng (xem mục 5). Đây là giới hạn được chấp nhận theo lựa chọn fail-open.

---

## 3. Test evidence

### DB-free (chạy tại máy)

```
node --test test/admin.audit-event.test.js test/admin.order-status.test.js \
  test/cancel-overdue-orders.test.js test/admin.users.test.js test/audit-log.test.js
ℹ tests 63
ℹ pass 63
ℹ fail 0
ℹ skipped 0
EXIT=0
```

```
node --test <30 file DB-free>
ℹ tests 269
ℹ pass 269
ℹ fail 0
ℹ skipped 0
ℹ duration_ms 106243.6901
EXIT=0
```

`node --check` trên 8 file JS changed → tất cả exit 0.

### Test mới

| File | Ca test |
|---|---|
| `test/admin.audit-event.test.js` | `AUDIT_ACTIONS` có `system.order.expired`; publisher lỗi → `doesNotReject` + log structured đúng field. |
| `test/admin.order-status.test.js` | Publisher lỗi vẫn trả 200, status vẫn `confirmed`, có 1 dòng log audit. |
| `test/cancel-overdue-orders.test.js` | Đơn quá hạn phát đúng 1 event `system.order.expired` (actor/target/before/after); publisher lỗi không làm job fail. |

### Integration / Jest

Không chạy DB thật tại máy (không có `TEST_MONGODB_URI` riêng). GitHub Actions job `Seed + unit + integration + jest` là nơi verify sau khi push.

---

## 4. Phạm vi / ràng buộc

- Không đổi schema/model, không đổi workflow CI, không thêm dependency, không đổi assertion logic cũ.
- Không dùng `test.skip`; không đọc `.env`, secret, Mongo URI thật, token, password; không chạy migration `--apply`.
- `git add` đích danh các file changed; không rebase/force/reset/clean/`git add .`.
- Tôn trọng thay đổi local chưa commit của báo cáo PR #105 — không stage vào PR này.

---

## 5. Backlog (chưa làm trong PR này)

1. **Audit outbox/retry**: ghi event vào collection/queue riêng rồi retry, để fail-open không đồng nghĩa mất audit vĩnh viễn.
2. **Ops handoff**: cron `*/5 * * * *`, migration `expiresAt --apply`, shared rate-limit store — xem `docs/reports/DEV1_OPS_RUNBOOK_HANDOFF.md`.
