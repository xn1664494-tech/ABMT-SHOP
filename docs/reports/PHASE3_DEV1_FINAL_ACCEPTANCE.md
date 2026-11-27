# PHASE 3 DEV 1 — FINAL ACCEPTANCE

| Item | Giá trị |
|---|---|
| Ngày | 2026-11-27 |
| Baseline code | `main` @ `86ebf370590c621b9eba0780d9a7357032b2b566` (sau PR #99–#106) |
| Phạm vi chốt | **Closure + contract**: không viết lại 6 task; khóa acceptance bằng Postman collection + test evidence |
| Quyết định audit | **Chấp nhận fail-open + ghi limitation**; không làm durable outbox trong phase này |
| PR closure | `docs/phase3-dev1-closure` → PR được tạo từ nhánh này |
| Kết luận | **Phase 3 Dev 1: 6/6 task DONE**; phần còn lại là backlog hạ tầng/compliance, không phải gap code Dev 1 |

> Tài liệu này là điểm chốt nghiệm thu. Nó không thay thế các báo cáo PR #99–#106; nó gom kết quả và tách rõ phần đã xong khỏi phần chờ Lead/hạ tầng.

---

## 1. Task matrix — 6/6 DONE

| Task | WBS DoD | Bằng chứng code trên `main` | PR | Trạng thái |
|---|---|---|---|---|
| **T5-1-1** Gộp giỏ hàng | Giỏ không mất sau đăng nhập | `authController.login` gọi `CartService.resolveCartForRequest({ mergeOnConflict: 'clamp' })` ngay sau `loginUser`; `POST /api/cart/merge` có `authenticate + csrfProtection`; contract SKU/cookie/idempotency nằm ở Cart API | #104 | **DONE** |
| **T5-1-2** Máy trạng thái đơn | Chuyến sai thứ tự bị từ chối | `Order.ORDER_STATUS_FLOW`, `Order.canTransition`, `src/services/orderStateMachine.js` (CAS + role guard + `statusHistory`) | #100 | **DONE** |
| **T5-1-3** API Admin người dùng | Có kiểm tra tự hạ quyền | `GET /api/admin/users`, `PATCH /api/admin/users/:userId/role`; whitelist field, chặn self-downgrade, idempotent `changed=false`; audit action `admin.user.role.changed` | có sẵn trên `main`, tái sử dụng | **DONE** |
| **T6-1-1** Quản lý đơn | Đúng quyền, đúng trạng thái | `PATCH /api/admin/orders/:orderId/status`: admin + CSRF + validate → state machine → audit; `POST /api/orders/:orderId/cancel` cho customer/system | #102, #103 | **DONE** |
| **T6-1-2** Audit log | Log đầy đủ | `AuditLog` append-only; `auditEvent.js` publisher fail-open; `GET /api/admin/audit-logs` admin-only, phân trang/filter, sanitize secret; action `system.order.expired` | #101, #106 | **DONE** (với limitation §4) |
| **T6-1-3** Tác vụ định kỳ | Đơn quá hạn được hoàn kho | `src/jobs/cancelOverdueOrders.js`: CAS pending/unpaid → cancelled, `stockRestoredAt`, hoàn kho, audit `system.order.expired` | #103, #106 | **DONE** (code; cron là ops §5) |

---

## 2. Contract được khóa trong PR closure

Collection Postman mới/cập nhật:

| Collection | Endpoint/action | Assertions chính |
|---|---|---|
| `postman/AdminUsers.postman_collection.json` | `GET /api/admin/users`, `PATCH /api/admin/users/:userId/role` | 401/403, 400 validate, không lộ password, self-downgrade 403, `changed=true/false` |
| `postman/AdminOrders.postman_collection.json` | `PATCH /api/admin/orders/:orderId/status` | 401/403, 400 status `pending`, 409 sai flow, `pending→confirmed→shipping`, `statusHistory.actorRole=admin` |
| `postman/AdminAuditLogs.postman_collection.json` | `GET /api/admin/audit-logs` | 401/403, 400 query, filter exact, actor/target/before/after/timestamp, không lộ secret, `system.order.expired` truy vấn được, không có route DELETE |
| `postman/Cart.postman_collection.json` | `POST /api/auth/login` + `GET /api/cart` | Giỏ guest có `cartSku` ngay sau login **mà không gọi `/api/cart/merge`**; `/api/cart/merge` sau đó vẫn idempotent |
| `postman/OrderCancel.postman_collection.json` | `POST /api/orders/:id/cancel` | 401 guest, owner hủy pending → 200 + `stockRestoredAt`, hủy lại → 409 |

`scripts/run-postman-test.js` đăng ký 3 collection mới và seed sẵn 1 order `pending` + environment `adminUserId`, `adminOrderId`. Runner vẫn dùng `MongoMemoryServer` riêng; không đụng DB thật.

### 2.1 Audit action contract

| Action | Target | Trigger | Before → After |
|---|---|---|---|
| `admin.user.role.changed` | `User` | `PATCH /api/admin/users/:userId/role` khi `changed=true` | `{ role }` |
| `admin.order.status.changed` | `Order` | `PATCH /api/admin/orders/:orderId/status` sau CAS thành công | `{ status }` |
| `system.order.expired` | `Order` | Job quá hạn sau cancel + restock thành công | `{ status, paymentStatus }` |

Publisher là **fail-open**: lỗi ghi AuditLog được log JSON (`scope=audit`, metadata only) và không làm mutation đã thành công trả 500. Đây là lựa chọn đã approved; xem limitation ở §4.

---

## 3. Bằng chứng test PR closure

| Command | Kết quả | Exit |
|---|---|---|
| `node --check scripts/run-postman-test.js` + parse 4 file JSON collection | Syntax/JSON hợp lệ | 0 |
| `NODE_ENV=development npm run test:postman` **(lần đầu)** | **263/264 assertions**, 1 failed (audit order event mong `before=pending` nhưng bản ghi mới nhất là `confirmed→shipping`) | 1 |
| `NODE_ENV=development npm run test:postman` **(sau fix assertion)** | **264/264 assertions — 0 failed request, 0 failed assertion** | 0 |
| `npm test` | **359 tests — 353 pass — 0 fail — 6 skipped — exit 0**. 6 skip là `test.skip` có sẵn trong `test/category.api.test.js` (5) và `test/product.api.test.js` (1), **không tính là PASS** | 0 |

Chi tiết newman lần cuối: Category 38/38, Product 44/44, QueryHelper 36/36, ProductFilter 40/40, ProductPagination 27/27, Cart 21/21, AdminUsers 24/24, AdminOrders 11/11, AdminAuditLogs 16/16, OrderCancel 7/7.

Ghi chú: `npm ci` chạy để cài đúng devDependency đã khai báo (`mongodb-memory-server`, `newman`) — **không thêm package mới**, `package.json`/`package-lock.json` không đổi. Không chạy integration/DB thật, migration `--apply`, cron hay đọc secret/Mongo URI.

Bằng chứng lịch sử trên `main` trước closure: regression 269/269, CI `45976351087` SUCCESS 12/12 step.

---

## 4. Limitation được chấp nhận

- Audit **không có outbox/retry**: nếu AuditLog downtime lâu, event có thể mất vĩnh viễn. Business mutation vẫn thành công theo thiết kế fail-open + log. Nếu compliance yêu cầu “không được mất audit”, mở backlog riêng và chốt policy trước khi thêm model/worker.
- `src/middleware/rateLimiters.js` vẫn dùng `MemoryStore`: giới hạn không chia sẻ giữa instances/restart. Đây là T7-1-3, cần approve dependency/store — không phải gap của 6 task Dev 1.

Không dùng `test.skip` làm bằng chứng PASS. Không chạy DB thật, migration `--apply`, cron thật, không đọc `.env`/secret/Mongo URI.

---

## 5. Backlog tách riêng (không chặn Dev 1)

| Hạng mục | Cần Lead/hạ tầng | Trạng thái |
|---|---|---|
| Audit outbox/retry | Chốt compliance; nếu bắt buộc thì approve model + worker + retry policy | **Backlog — limitation đã chấp nhận** |
| T7-1-3 shared rate-limit store | Chọn Redis/Mongo + approve dependency + wire `authLimiter`, test lại | **Backlog** |
| Cron `*/5 * * * *` cho `scripts/run-overdue-orders.js` | Cấp phép hạ tầng; không tự chạy tại máy | **Ops — runbook** |
| Migration `expiresAt --apply` | Dry-run → approve/backup → apply trong môi trường có DB | **Ops — runbook** |

Xem `docs/reports/DEV1_OPS_RUNBOOK_HANDOFF.md`.

---

## 6. Kết luận nghiệm thu

Phase 3 Dev 1 **hoàn tất về code và contract**: 6/6 task có implementation, test và PR riêng; CI trên `main` xanh; regression DB-free xanh; collection Postman phủ luồng mới. Phần còn lại nằm ngoài definition of done của Dev 1 và được chuyển thành backlog có quyết định rõ ràng.
