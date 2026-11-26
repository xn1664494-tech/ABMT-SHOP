# T6-4-3 — TEST CHECKOUT/ORDER

- **Task ID:** T6-4-3 (WBS 3.6.12)
- **Nguồn:** `docs/ABMT_Phan_chia_cong_viec.xlsx`, sheet `02_WBS`, dòng 73
- **Phase:** Phase 3 – Nghiệp vụ thương mại; Dev 4, Reviewer Dev 3
- **Tuần:** 6
- **Sản phẩm:** `Test Checkout/Order (test + báo cáo)`
- **Tiêu chí WBS:** Giá snapshot, hủy đơn hoàn kho, IDOR đơn của người khác
- **DoD:** Test xanh
- **Phụ thuộc:** T6-2-2 — đã hoàn thành (`docs/reports/T6-2-2_DASHBOARD.md`)
- **Nhánh:** `feature/T6-4-3-test-checkout-order`
- **Trạng thái:** PASS (phạm vi T6-4-3); `npm test` còn 3 fail cũ thuộc T6-4-1
- **File phân việc:** giữ nguyên, không cập nhật theo yêu cầu

## 1. Kết quả

Đạt 3/3 tiêu chí WBS của T6-4-3. Không đổi source application; chỉ bổ sung test, script chạy suite và sửa 3 test CSRF có sẵn để integration suite hết fail.

| Tiêu chí | Trạng thái | Bằng chứng |
|---|---|---|
| Giá snapshot | PASS | `test/integration/checkout.order.integration.test.js:196`: bỏ qua `unitPrice/qty` giả từ client, lấy `249000` từ DB, lưu `name/image`, fallback `basePrice` khi `price=null`; giữ nguyên snapshot sau khi mutate product |
| Hủy đơn hoàn kho | PASS | `test/integration/checkout.order.integration.test.js:247`: stock `3 → 1 → 3`, `status='cancelled'`, có `stockRestoredAt`, ghi `statusHistory`, hủy lại `409` và stock không đổi |
| IDOR đơn người khác | PASS | `test/integration/checkout.order.integration.test.js:281`: user khác GET/cancel `403`, danh sách không lộ đơn, admin GET/cancel `200`, invalid id `400`, missing id `404` |

## 2. Thay đổi

| File | Nội dung |
|---|---|
| `test/integration/checkout.order.integration.test.js` | File mới: 3 test integration dùng MongoDB memory fallback; helper tạo user/cart/product/order, cookie access token, SKU hợp lệ `SP-AO-NNN-SIZE-COLOR` |
| `package.json:11` | Thêm `test/integration/checkout.order.integration.test.js` vào script `test:integration` trước `dashboard.integration.test.js` |
| `test/integration/change-password.integration.test.js` | Thêm helper `withCsrfEnforcement`; V2-2/V2-3 bật CSRF đúng request cần kiểm tra để nhận `403` thay vì `200` |
| `test/integration/mongodb.integration.test.js` | Thêm helper `withCsrfEnforcement`; IT-CSRF bật CSRF đúng request refresh để nhận `403` thay vì `200` |
| `docs/reports/T6-4-3_CHECKOUT_ORDER_TESTS.md` | Báo cáo nghiệm thu này |

Không sửa source application. Việc sửa 2 file integration CSRF là để dọn 3 fail có sẵn phát hiện khi chạy `npm run test:integration`; không phải lỗi từ test mới T6-4-3.

## 3. Ma trận assertion chính

| Hành vi | Assertion |
|---|---|
| `POST /api/orders` với `items[{unitPrice:1,qty:99}]` | Lưu `unitPrice=249000`, `qty=2`, `lineTotal=498000`, `subtotal=498000`, `total=528000` |
| Product `price=null`, `basePrice=199000` | Order dùng `unitPrice=199000`, `total=229000` |
| Mutate product sau khi đặt | Snapshot `name`, `image`, `unitPrice` trong order không đổi |
| `POST /api/orders/:id/cancel` lần 1 | `200`, `status='cancelled'`, `stockRestoredAt` truthy, stock hoàn lại đúng 1 lần |
| `POST /api/orders/:id/cancel` lần 2 | `409`, stock giữ nguyên |
| User khác `GET` / cancel đơn | `403`, `GET /api/orders` không chứa đơn đó |
| Admin `GET` / cancel đơn | `200`, stock được hoàn |
| Id sai định dạng / id không tồn tại | `400` / `404` |

## 4. Verification

| Lệnh | Kết quả |
|---|---|
| `node --check test/integration/checkout.order.integration.test.js; if ($?) { node --test test/integration/checkout.order.integration.test.js }` | Syntax OK; 3 tests, 3 pass, 0 fail, 0 skip |
| `node --test test/integration/change-password.integration.test.js` | 12 tests, 12 pass, 0 fail, 0 skip |
| `node --test test/integration/mongodb.integration.test.js` | 11 tests, 11 pass, 0 fail, 0 skip |
| `npm run test:integration` | 60 tests, 52 pass, 0 fail, 8 skip |
| `npm test` | 352 tests, 342 pass, 3 fail, 7 skip |

8 skip trong `npm run test:integration` là các test cũ tự skip khi không có MongoDB test URI. 3 fail trong `npm test` là 3 test `test/order.view.test.js` của T6-4-1 (`chi tiet hien dung status...`, `don pending hien nut huy...`, `admin xem don cua khach...`): template `src/views/pages/order-detail.ejs` chưa có `data-status-label`, `data-history-status`, `data-action="cancel-order"` và vẫn render `đ` thay vì `₫`. Đây là lỗi cũ ngoài phạm vi T6-4-3, không phát sinh bởi commit này; nên mở task riêng nếu muốn `npm test` tuyệt đối xanh.

Các dòng `[ERROR 403]`, `[ERROR 409]`, `[ERROR 400]`, `[ERROR 404]` trong log integration là assert âm tính mong đợi, không phải test fail.

## 5. Reproduction

```powershell
git checkout feature/T6-4-3-test-checkout-order
node --check test/integration/checkout.order.integration.test.js
node --test test/integration/checkout.order.integration.test.js
npm run test:integration
npm test
```

Không có script lint/typecheck trong `package.json`.

## 6. Bàn giao Dev 3

Reviewer nên chạy riêng `node --test test/integration/checkout.order.integration.test.js` để thấy đủ 3 tiêu chí WBS, sau đó `npm run test:integration` để xác nhận integration suite 0 fail. Khi review `npm test`, chỉ đối chiếu 3 fail T6-4-1 đã ghi rõ ở mục 4; không nên gộp sửa template T6-4-1 vào task test checkout/order này.
