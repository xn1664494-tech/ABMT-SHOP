# CHECKOUT & KHO — KHÔNG BÁN VƯỢT KHO

- **Phạm vi:** Checkout service — trừ kho nguyên tử có điều kiện trên đúng biến thể; lỗi thì hoàn lại.
- **Liên quan:** T5-2-1 (merge/cart), T5-1-2 (code fix), T5-2-3 (cart modes).
- **Dev:** Dev 2 — Backend Business & Database.
- **Nhánh:** `fix/checkout-stock-atomic`.
- **Trạng thái:** DONE — chờ review.

## 1. Vấn đề phát hiện

1. `src/services/ProductsServices.js` (cũ): `decrementStock` hoàn kho bằng vòng lặp trên **toàn bộ `items`** khi có dòng lỗi → cộng lại cả dòng chưa trừ và dòng đang lỗi, tạo tồn kho ảo.
2. `src/routes/order.route.js` (cũ): tự CAS trừ kho ngay trong route, nhân bản 4 block rollback; **không có compensation** nếu `Order.create` hoặc cart update lỗi; không kiểm tra `matchedCount/deletedCount`.
3. Hai nguồn trừ kho cùng tồn tại: route inline và `decrementStock` đã export (Dev 1 dự kiến dùng cho T6-1-1/T6-1-3).

## 2. Cách sửa

| Nội dung | Vị trí |
|---|---|
| CAS đúng `(_id, variants.sku, variants.stock >= qty, isDeleted:false)`, `$inc` âm; guard `qty` nguyên dương | `src/services/ProductsServices.js:100` |
| Tự hoàn **chỉ các dòng đã trừ** rồi ném `409` kèm SKU | `src/services/ProductsServices.js:100-137` |
| `restoreStock(items)` dùng chung cho rollback checkout và cancel flow; caller chặn double-restore bằng `Order.stockRestoredAt` | `src/services/ProductsServices.js:139` |
| `createOrder` — điều phối trừ kho → tạo đơn → xóa/pull cart, có `try/catch` compensation | `src/services/CheckoutService.js:7` |
| Kiểm tra `matchedCount/deletedCount` của cart → 409 nếu giỏ đã thay đổi | `src/services/CheckoutService.js:43`, `:49` |
| Lỗi sau khi có đơn → xóa đơn `status:'pending'` rồi hoàn kho | `src/services/CheckoutService.js:57` |
| Route giữ validation + giá từ DB, gọi service; bỏ rollback/CAS nhân bản | `src/routes/order.route.js:135-189`, `:174` |
| `variant.price ?? basePrice` (giữ giá 0 hợp lệ) | `src/routes/order.route.js:153` |

**Cơ chế:** compensation (không dùng `withTransaction`). Dev/test chạy MongoDB standalone nên transaction đa tài liệu không dùng được; CAS từng dòng + hoàn kho có kiểm soát đáp ứng tiêu chí "không bán vượt kho".

Luồng thành công: `decrementStock` → `Order.create` → `$pull`/`deleteOne` cart → `201`.
Luồng lỗi: CAS fail → service đã tự hoàn dòng trước đó; lỗi sau CAS → `restoreStock` toàn bộ dòng đã trừ; lỗi sau khi tạo đơn → xóa đơn pending rồi hoàn kho.

## 3. Test & minh chứng

| Lệnh | Kết quả |
|---|---|
| `npm test` (đã thêm `test/checkout.stock.test.js`) | 329 tests, 274 pass, 0 fail, 55 skipped |
| `npm run test:integration` (đã thêm `test/integration/checkout.stock.integration.test.js`) | 48 tests, 4 pass, 0 fail, 44 skipped — **3/3 case checkout stock pass** (fallback `MongoMemoryServer` khi không có `TEST_MONGODB_URI`) |
| `npm run test:postman` | 204/204 assertions, 0 request fail (Cart 19/19) |

Case unit (`test/checkout.stock.test.js`, 6/6):
- CAS đúng variant; dòng sau lỗi chỉ hoàn dòng đã trừ, không đụng dòng chưa trừ.
- Thành công: 1 lần `$inc` âm, tạo đơn, xóa giỏ.
- `Order.create` lỗi: hoàn kho, không xóa giỏ.
- Cart update lỗi: xóa đơn pending + hoàn kho, trả 409.
- CAS lỗi: không tạo đơn, không hoàn thừa.
- `qty <= 0`: chặn 400 trước khi ghi DB.

Case integration (`test/integration/checkout.stock.integration.test.js`, 3/3):
- 2 request đồng thời cùng variant tồn 1 → đúng **1×201 + 1×409**, tồn cuối 0, chỉ 1 đơn.
- Đặt SKU hết hàng trong khi SKU khác còn 5 → 409 đúng SKU, tồn SKU kia giữ nguyên, không tạo đơn.
- Force `Order.create` lỗi → tồn về 1, không có đơn, giỏ còn nguyên.

## 4. Ghi chú

- Response `POST /api/orders` giữ nguyên shape (`success/message/data.id/code/total/status`).
- `restoreStock` vẫn nhận `Array<{productId, variantSku, qty}>` đúng contract Dev 1 chờ ở `docs/design/PHASE3_DEV1_T6-1-3_...`; marker `stockRestoredAt` trên `Order` dành cho luồng hủy đơn, không đụng trong checkout.
- Không đổi scope T5-1-2 state machine (`src/services/orderStateMachine.js` chưa tồn tại trên `main`).
