# PR-3 — T6-1-2 AUDIT LOG

- **Task ID:** T6-1-2 (audit log)
- **Branch:** `feat/T6-1-2-audit-log` (base `main` @ `79d9920`)
- **Trạng thái:** PASS — chưa merge, chưa rebase/cherry-pick/reset/force push
- **Phạm vi:** chỉ worktree `D:\ABMT_Shop\ABMT-SHOP-pr3`

## 1. Scope

| File | Thay đổi |
|---|---|
| `src/services/auditEvent.js` | Thêm `AUDIT_ACTIONS.ADMIN_ORDER_STATUS_CHANGED = 'admin.order.status.changed'`, `TARGET_TYPES.ORDER = 'Order'`; giữ nguyên constants cũ và **giữ nguyên 7 field** của `buildAuditEvent` (không thêm `timestamp`). |
| `src/model/AuditLog.js` (mới) | Document append-only, không soft-delete, không API update/delete. |
| `src/services/auditLogService.js` (mới) | `writeAuditLog`, `installAuditLogPublisher`, `listAuditLogs`, sanitize sâu. |
| `src/validators/auditLogValidator.js` (mới) | Zod schema cho query GET (chỉ `page`, `limit`, 4 filter; strict). |
| `src/controllers/auditLogController.js` (mới) | `list` → `sendResponse(res, 200, true, ...)`. |
| `src/routes/admin.route.js` | Thêm GET `/api/admin/audit-logs` (read-only, không CSRF). |
| `src/app.js` | Gọi `installAuditLogPublisher()` **chỉ khi** `process.env.NODE_ENV !== 'test'`. |
| `test/audit-log.test.js` (mới) | 9 test DB-free. |
| `docs/reports/PR3_T6-1-2_Audit_LOG.md` (mới) | Báo cáo này. |

Không đụng `src/services/orderStateMachine.js`, không đụng route/status đơn hàng của PR-2, không sửa `src/services/adminUserService.js` (điểm cắm `publishAuditEvent` của T5-1-3 đã đúng và giữ nguyên).

## 2. Contract lưu trữ (8 field)

`AuditLog` lưu đúng: `actorId`, `actorRole`, `action`, `targetType`, `targetId`, `before`, `after`, `timestamp`.

- Kiểu: 5 field đầu là `String` (bắt buộc); `before`/`after` là `Mixed` (mặc định `{}`); `timestamp` là `Date` với `default: Date.now`.
- `timestamps: false` để không tạo thêm `createdAt`/`updatedAt` cạnh `timestamp`; mọi field đều `immutable: true`.
- Index: `{ action: 1, timestamp: -1 }`, `{ actorId: 1, timestamp: -1 }`, `{ targetType: 1, targetId: 1, timestamp: -1 }`, `{ timestamp: -1 }`.
- Không plugin soft-delete; service/route chỉ cócreate + list, không update/delete.

`buildAuditEvent` vẫn trả đúng 7 key; `timestamp` chỉ được gán khi ghi vào `AuditLog`.

## 3. Sanitize

`writeAuditLog(event)` sao chép sâu rồi xoá **mọi key** khớp `/password|token|secret|cookie|authorization|reset/i` (case-insensitive, áp dụng cả key viết hoa kiểu `AUTHOrization`, `Set-Cookie`, `csrfToken`, `resetPasswordTokenHash`, `passwordHash`). Áp dụng đệ quy cho `before`, `after`, object lồng và array; vòng lặp bị cắt. `timestamp` luôn bị ghi đè bằng `new Date()` (bỏ timestamp do caller truyền vào). Event nguồn không bị mutate.

## 4. Publisher wiring

- `installAuditLogPublisher()` gọi `setAuditPublisher(writeAuditLog)`.
- `src/app.js` gọi hàm này **chỉ khi `process.env.NODE_ENV !== 'test'`** → toàn bộ suite DB-free hiện tại (fake User/Cart model, không connect DB) không bị rơi vào model `AuditLog` thật. Test của PR-3 tự cài publisher bằng fake model được cài vào `require.cache` trước khi require app/service.
- `adminUserService.updateUserRole` giữ nguyên: role-change phát đúng 1 event; đường thất bại (user không tồn tại) và idempotent (role không đổi) không phát event.

## 5. API

`GET /api/admin/audit-logs?actorId=&action=&targetType=&targetId=&page=&limit=`

- Middleware: `authenticate` → `authorize('admin')` → `validate(auditLogsQuerySchema, 'query')` → controller. **Không có `csrfProtection`** (GET read-only). Guest 401, customer 403.
- `listAuditLogs`: phân trang qua `buildPagination` (`page` mặc định 1, `limit` mặc định 20 / tối đa 100), filter so khớp chính xác 4 field, sort `{ timestamp: -1, _id: -1 }`, trả `{ items, pagination }`.
- Response item là whitelist 9 key (`id` + 8 field storage), không lộ `_id`/`__v`.
- Không có POST/PATCH/PUT/DELETE cho audit log (kiểm tra bằng mini-app mount riêng admin router).

## 6. Test evidence

Chạy trong worktree PR-3 sau `npm ci --ignore-scripts --no-audit --no-fund` (worktree ban đầu không có `node_modules`; lệnh này chỉ tạo thư mục ignored, không đổi file tracked). Không chạy test có `mongoose.connect`, không đọc `.env` thật hay secret nào.

| Lệnh | Kết quả | Exit code |
|---|---|---|
| `node --test test/audit-log.test.js` | 9 tests, 9 pass, 0 fail, 0 skip | 0 |
| `node --test test/admin.audit-event.test.js test/admin.users.test.js test/auth.rbac.test.js` | 36 tests, 36 pass, 0 fail, 0 skip | 0 |
| `node --check` cho 8 file JS đã đổi/thêm | pass | 0 |

Các dòng `[ERROR 401]`, `[ERROR 403]`, `[ERROR 404]` trong log là assertion âm tính mong đợi (errorHandler ghi log), không phải test fail.

## 7. Giới hạn / bàn giao

- Không có integration test với MongoDB thật theo yêu cầu ("không chạy test có mongoose.connect/.env thật"); index được khai báo ở schema nhưng chưa đo bằng `explain()` trên DB thật.
- Không chạy full `npm test` / integration suite; phạm vi verification đúng theo lệnh được giao (focused + 3 file regression).
- Append-only được đảm bảo ở tầng app (immutable schema + không route/service update/delete); quyền ghi trực tiếp trên DB vẫn là trách nhiệm vận hành DB.
- **Không merge** vào `main` hay nhánh khác; PR-2 giữ nguyên để reviewer ghép sau.
