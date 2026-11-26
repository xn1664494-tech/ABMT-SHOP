# T6-4-1 — VIEW ORDER

- **Task ID:** T6-4-1 (WBS 3.6.10)
- **Nguồn:** `docs/ABMT_Phan_chia_cong_viec.xlsx`, sheet `02_WBS`, dòng 71
- **Phase:** Phase 3 – Nghiệp vụ thương mại; Dev 4, Reviewer Dev 3
- **Tuần:** 6
- **Sản phẩm:** `View đơn hàng (file EJS)`
- **Tiêu chí WBS:** Đơn của tôi: danh sách + chi tiết + nút Hủy chỉ hiện khi hợp lệ
- **DoD:** View đúng trạng thái
- **Phụ thuộc:** T6-1-1 — đã có model/flow trạng thái trong source
- **Nhánh:** `feature/T6-4-1-view-order-fix`
- **Trạng thái:** PASS
- **File phân việc:** giữ nguyên, không cập nhật theo yêu cầu

## 1. Kết quả

Đạt DoD “View đúng trạng thái”. Trang danh sách, chi tiết và trang quản trị đã dùng chung nhãn trạng thái từ `orderPresentation`; nút Hủy chỉ render khi `canCancelOrder` cho phép. `npm test` hiện **0 fail**.

| Tiêu chí | Trạng thái | Bằng chứng |
|---|---|---|
| Danh sách đơn đúng nhãn trạng thái | PASS | `src/views/pages/orders.ejs:66-76`; `test/order.view.test.js:161-179` |
| Chi tiết đúng trạng thái/lịch sử/tiền XSS | PASS | `src/views/pages/order-detail.ejs:51,65-66,99,154-166`; `test/order.view.test.js:181-207` |
| Nút Hủy chỉ hiện khi hợp lệ | PASS | `src/routes/index.js:60-106`; `src/views/pages/order-detail.ejs:174-176`; `test/order.view.test.js:209-238` |
| Admin xem/hủy đơn của khách | PASS | `src/routes/index.js:675-720`; `test/order.view.test.js:227-238` |

## 2. Thay đổi

| File | Nội dung |
|---|---|
| `src/routes/index.js:60-106` | `buildOrderDetail` bổ sung `discount` để render dấu âm và `at` trong `statusHistory` để sort; giữ nguyên các label đã format `₫`. |
| `src/routes/index.js:242-267` | Route `/account/orders/:code` cũng render qua `buildOrderDetail`, cùng shape với `/orders/:id`, nên template không phải xử lý 2 dạng dữ liệu. |
| `src/views/pages/order-detail.ejs:14-34` | Bỏ các bảng label/helper trùng lặp; đọc `order.shipping`, lấy lịch sử từ `statusLabel`/`atLabel`, fallback vẫn dùng label từ route. |
| `src/views/pages/order-detail.ejs:51,65-66,99,102,154-166` | Render `statusLabel`, `data-status-label`, `data-history-status`, `unitPriceLabel`, `lineTotalLabel`, `subtotalLabel`, `shippingFeeLabel`, `discountLabel`, `totalLabel`. |
| `src/views/pages/order-detail.ejs:174-176,183-185` | Thêm nút `data-action="cancel-order"` theo `order.canCancel`; load `api.js`, `ui.js`, `orders.js` để nút hoạt động. |

Không đổi model/service/API hủy đơn; chỉ đồng bộ view với contract presentation có sẵn.

## 3. Bảo mật

- Mọi field do DB/user truyền vào vẫn render qua `<%= %>`: mã đơn, ghi chú, tên sản phẩm, URL ảnh, địa chỉ và lịch sử.
- Quyền xem chi tiết vẫn do route `/orders/:id` kiểm tra chủ đơn/admin (`src/routes/index.js:675-720`); route `/account/orders/:code` vẫn lọc theo `currentUser.id`.
- Nút Hủy chỉ render khi `canCancelOrder` trả `true`; API hủy vẫn tự kiểm tra quyền/CSRF.

## 4. Verification

| Lệnh | Kết quả |
|---|---|
| `node --check src/routes/index.js` | Pass |
| EJS compile `src/views/**/*.ejs` | 26/26 pass |
| `node --test test/order.view.test.js` | 6 tests, 6 pass, 0 fail, 0 skip |
| `npm test` | 352 tests, 345 pass, 0 fail, 7 skip |
| `npm run test:integration` | 60 tests, 52 pass, 0 fail, 8 skip |

7 skip trong `npm test` là skip có sẵn; 8 skip integration là test MongoDB test không kết nối được. Các dòng `[ERROR 401/403/404/409/500]` trong log là assertion âm tính mong đợi, không phải test fail.

## 5. Reproduction

```powershell
git checkout feature/T6-4-1-view-order-fix
node --check src/routes/index.js
node --test test/order.view.test.js
npm test
npm run test:integration
```

Không có script lint/typecheck trong `package.json`.

## 6. Bàn giao Dev 3

Review trọng tâm: route `/account/orders/:code` đã dùng chung `buildOrderDetail`, template đã consume label `₫` thay vì tự format `đ`, và nút Hủy trong chi tiết đã có JS xử lý. Không gộp thay đổi vào nhánh T6-4-3.
