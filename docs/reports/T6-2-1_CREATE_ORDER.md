# T6-2-1 — TẠO ORDER (SNAPSHOT + XÓA GIỎ + HỦY HOÀN KHO)

- **Task ID:** T6-2-1
- **Dev:** Dev 2 — Backend Business & Database.
- **Nhánh:** `feat/t6-2-1-create-order` (base `origin/main` = `c9b8ee1`, đã gồm PR #91 checkout/stock).
- **Trạng thái:** DONE — chờ review.

## 1. Mã nguồn

| Nội dung | Vị trí |
|---|---|
| Snapshot `name`, `images[0]`, `variant.price ?? basePrice` theo từng dòng | `src/routes/order.route.js:153-167` |
| Lưu snapshot vào `Order.items`, không đọc lại Product khi xem đơn | `src/services/CheckoutService.js:21-34` |
| Đặt cả giỏ → `Cart.deleteOne({user})`; đặt 1 `item` → `$pull` đúng dòng | `src/services/CheckoutService.js:39-52` |
| Route hủy đơn: `POST /api/orders/:id/cancel`, `authenticate` + `csrfProtection` | `src/routes/order.route.js:204-239` |
| Guard quyền: customer owner `pending`; admin `pending|confirmed`; system `pending` | `src/services/OrderCancellationService.js:19-29`, `:44-56` |
| Một CAS `pending|confirmed → cancelled` **đồng thời** set `stockRestoredAt` + `$push statusHistory` | `src/services/OrderCancellationService.js:62-79` |
| Gọi `restoreStock` đúng 1 lần sau CAS thắng | `src/services/OrderCancellationService.js:93` |
| Restore lỗi → giữ marker, log, trả `ORDER_RESTOCK_FAILED` (500) để xử lý tay, không double-restock | `src/services/OrderCancellationService.js:95-102` |

Error code theo spec T5-1-2: `ORDER_NOT_OWNER` (403), `ORDER_FORBIDDEN_ROLE` (403), `ORDER_INVALID_TRANSITION` (409), `ORDER_STATUS_CONFLICT` (409), `ORDER_RESTOCK_FAILED` (500).

## 2. Quyết định

- Không dùng transaction đa tài liệu; dùng CAS trên `Order` + marker `stockRestoredAt` (`src/model/Order.js:250`) để chặn double-restock.
- Chưa có `src/services/orderStateMachine.js` trên main → service dùng tạm `Order.canTransition` + ma trận quyền nội bộ; khi Dev 1 merge state machine thì thay guard bằng `assertTransition`.
- `statusHistory.by` vẫn là ObjectId actor; actor `system` lưu `null` + note "Hủy đơn bởi hệ thống" cho đến khi chốt kiểu `Mixed`.
- Response `POST /api/orders`, `GET /api/orders/:id` giữ nguyên; endpoint hủy trả `{id, code, status, stockRestoredAt}`.

## 3. Test & minh chứng

| Lệnh | Kết quả |
|---|---|
| `npm test` (đã thêm `test/order.cancel.test.js`) | 335 tests, 280 pass, 0 fail, 55 skipped |
| `npm run test:integration` (đã thêm `test/integration/create-order.integration.test.js`) | 52 tests, 8 pass, 0 fail, 44 skipped — **4/4 case T6-2-1 pass** (fallback `MongoMemoryServer` khi không có `TEST_MONGODB_URI`) |
| `npm run test:postman` | 204/204 assertions, 0 request fail |

Unit (`test/order.cancel.test.js`, 6/6): CAS có `status` + `stockRestoredAt:null`; owner pending OK; non-owner 403; customer confirmed 403; admin confirmed OK; terminal 409; CAS null 409; restore lỗi giữ marker.

Integration (`test/integration/create-order.integration.test.js`, 4/4):
- Đặt đơn → đổi tên/ảnh/giá sản phẩm → `GET /api/orders/:id` vẫn trả snapshot cũ; cart bị xóa hoàn toàn.
- Đặt 1 `item` → cart còn dòng kia; chỉ variant được đặt trừ kho.
- Owner hủy pending → 200, stock về cũ, `stockRestoredAt` có giá trị, history 2 entries; hủy lại → 409, stock không đổi.
- Customer hủy `confirmed` → 403; admin hủy đơn `confirmed` của user khác → 200, stock hoàn lại.

## 4. Ghi chú

- Phạm vi T6-1-3 (job quá hạn/TTL `expiresAt`) không nằm trong task này; service hủy đã sẵn sàng để job gọi sau này.
- `restoreStock` giữ contract `Array<{productId, variantSku, qty}>` của T6-1-3; không đổi chữ ký.
