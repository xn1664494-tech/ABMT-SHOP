# T5-4-1 — VIEW CART

- **Task ID:** T5-4-1 (WBS 3.5.10)
- **Phase:** Phase 3 – Nghiệp vụ thương mại, Dev 4 (Reviewer: Dev 3)
- **Nguồn:** `docs/ABMT_Phan_chia_cong_viec.xlsx`, sheet `02_WBS`, dòng 59
- **DoD:** View hoàn chỉnh — danh sách dòng, tổng tiền, nút thanh toán
- **Nhánh:** `feature/T5-4-1-view-cart`
- **Trạng thái:** DONE — chờ Dev 3 review
- **File phân việc:** giữ nguyên, không cập nhật theo yêu cầu

## 1. Thay đổi chính

| File | Thay đổi |
|---|---|
| `src/views/pages/cart.ejs:45-95` | Hiện tên/link/ảnh sản phẩm thay vì chỉ SKU; giữ SKU, size, màu, đơn giá, qty control có `max` theo tồn kho, thành tiền, tóm tắt và nút thanh toán; escape dữ liệu bằng `<%= %>`. |
| `src/routes/index.js:137-192` | `/cart` set `Cache-Control: no-store`, sửa luồng convert giỏ guest khi đăng nhập (truy vấn lại theo `user`), normalize item id, populate `name slug images variants` trước khi render. |
| `src/public/css/app.css:1125-1126` | Thêm kiểu cho link tên sản phẩm trong dòng giỏ. |
| `src/public/js/cart.js:178` | Đổi `PATCH ... { quantity }` thành `PUT ... { qty }` khớp API. |
| `src/public/js/product-detail.js:186-202` | Đồng bộ badge navbar dùng `.header-cart-badge` sau khi thêm vào giỏ. |

## 2. Sửa dependency chặn (T5-2-1 / T5-3-1)

| Vấn đề | Cách xử lý |
|---|---|
| Cart item khai báo `_id: false` nhưng API/JS dùng `_id` để update/xóa | `src/model/Cart.js:40` bật `_id: true`; `src/utils/cartItems.js:3` cấp `_id` cho dòng cũ thiếu khi đọc. |
| Client gọi `PATCH` với `quantity`, server chỉ có `PUT` với `qty` | Client đổi sang `PUT` + `qty`; API giữ một contract duy nhất. |
| `/api/cart` chạy trước middleware `currentUser` nên luôn thấy guest, `/merge` trả 401 | `src/routes/api.js:11` mount `currentUser` riêng cho `/cart`, không đổi thứ tự global của `src/app.js`. |
| API tạo giỏ guest nhưng không set cookie `cartId` | `src/routes/cart.route.js:14-52` set cookie 30 ngày, `HttpOnly`, `SameSite=Lax`. |
| Ghi giỏ dùng cookie nhưng chưa có CSRF | `src/routes/cart.route.js:89,159,201` áp `csrfProtection` cho POST/PUT/DELETE; `api.js` đã tự gắn header. |
| Convert guest cart khi login truy vấn lại bằng `sessionId` sau khi đã set null | `src/routes/index.js:150-151` truy vấn lại theo `user`. |

## 3. Bảo mật

- Mọi giá trị từ DB/product được render qua `<%= %>`; test chèn `<img onerror>` xác nhận đã escape.
- URL ảnh lấy từ field `images` đã được Product schema validate `http/https`; fallback là placeholder local.
- Trang giỏ là dữ liệu riêng của người dùng → `Cache-Control: no-store`.
- CSRF áp cho các thao tác ghi giỏ; không log token hay dữ liệu nhạy cảm.

## 4. Test

| Lệnh | Kết quả |
|---|---|
| `node --check` cho các JS/EJS-frame đổi | Pass |
| `node --test test/cart.model.test.js test/cart.view.test.js test/cart.api.test.js` | 16/16 pass |
| `npm test` | 277 tests, 265 pass, 0 fail, 12 skip (skip có sẵn) |
| `npm run test:integration` | 45 tests, 34 pass, 3 fail, 8 skip |
| `npm run test:jest` | 3 suites, 8 tests pass |

Test mới:

- `test/cart.view.test.js`: giỏ rỗng ẩn khối thanh toán và `no-store`; giỏ có sản phẩm hiện tên/link/ảnh/SKU/giá/tổng, `max` tồn kho và escape XSS.
- `test/cart.api.test.js`: `PUT /api/cart/items/:id` với `{ qty }` cập nhật đúng; vượt tồn kho trả 409; xóa theo item `_id` trả giỏ rỗng.
- `test/cart.model.test.js`: mỗi dòng giỏ có `_id`.
- Fake model dùng chung tại `test/support/fakeCartModels.js`, không cần MongoDB thật.

### Lỗi integration có sẵn

3 fail trong `npm run test:integration` là CSRF test của `change-password` và `refresh` nhận `200` thay vì `403` vì `src/middleware/csrf.js:68-70` bỏ qua kiểm tra khi `NODE_ENV=test`. Các file này và `csrf.js` **không thay đổi** trong nhánh này (`git diff origin/main -- ...` rỗng). 8 test Mongo bị skip do không kết nối được MongoDB test. Jest có warning teardown do Mongo handle mở, không làm fail suite.

## 5. Reproduction

```powershell
node --test test/cart.model.test.js test/cart.view.test.js test/cart.api.test.js
npm test
npm run test:integration
npm run test:jest
```

## 6. Bàn giao Dev 3

Review trọng tâm: luồng convert giỏ guest khi login, contract `PUT/qty`, item `_id` và CSRF trên API giỏ; sau đó verify `/cart` trên browser với giỏ guest và giỏ user.
