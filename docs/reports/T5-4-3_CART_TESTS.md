# T5-4-3 — TEST CART

- **Task ID:** T5-4-3 (WBS 3.5.12)
- **Nguồn:** `docs/ABMT_Phan_chia_cong_viec.xlsx`, sheet `02_WBS`, dòng 61
- **Phase:** Phase 3 – Nghiệp vụ thương mại; Dev 4, Reviewer Dev 3
- **Tuần:** 5
- **Sản phẩm:** `Test Cart (test + báo cáo)`
- **Tiêu chí WBS:** Giá lấy từ DB, vượt tồn kho bị chặn, gộp giỏ khi đăng nhập
- **DoD:** Test xanh
- **Phụ thuộc:** T4-4-3 — đã hoàn thành
- **Nhánh:** `feature/T5-4-3-cart-tests`
- **Trạng thái:** PASS
- **File phân việc:** giữ nguyên, không cập nhật theo yêu cầu

## 1. Kết quả

Đạt DoD `Test xanh` cho cả 3 tiêu chí. Không đổi source application; chỉ bổ sung test và báo cáo này.

| Tiêu chí | Trạng thái | Bằng chứng |
|---|---|---|
| Giá lấy từ DB | PASS | `test/cart.api.test.js:99`; `test/cart.view.test.js:43` |
| Vượt tồn kho bị chặn | PASS | `test/cart.api.test.js:122`, `test/cart.api.test.js:135`; source `src/routes/cart.route.js:112-128` |
| Gộp giỏ khi đăng nhập | PASS | `test/cart.merge.test.js:89`, `test/cart.merge.test.js:119`, `test/cart.merge.test.js:149`; source `src/routes/cart.route.js:229-270`, `src/routes/index.js:146-170` |

## 2. Thay đổi

| File | Nội dung |
|---|---|
| `test/cart.api.test.js` | Thêm fixture variant có `size`/`color`/`price`; thêm 3 test `POST /api/cart/items`: lấy giá DB, chặn vượt tồn, chặn cộng dồn vượt tồn |
| `test/cart.view.test.js` | Bổ sung assert đơn giá, thành tiền, tạm tính, phí ship, tổng cộng trên trang giỏ |
| `test/cart.merge.test.js` | File mới: fake User/Cart, access token cookie, test `/api/cart/merge` và `/cart` khi gộp giỏ guest vào user |
| `docs/reports/T5-4-3_CART_TESTS.md` | Báo cáo nghiệm thu này |

Không sửa `package.json`. `npm test` vẫn chỉ chạy `cart.model.test.js` trong nhóm cart; vì vậy dùng lệnh suite riêng ở mục 4 để có bằng chứng đầy đủ cho T5-4-3.

## 3. Ma trận assertion chính

| Hành vi | Assertion |
|---|---|
| `POST /api/cart/items` | Bỏ qua `unitPrice: 1` từ client; lưu `199000` từ `variant.price` (`basePrice` fixture `150000` để phân biệt) |
| `POST /api/cart/items` với `qty: 9` | `409`, cart không thêm item |
| `POST` cộng dồn `4 + 2 > stock 5` | `409`, qty cũ vẫn giữ `4` |
| `/cart` populated | `199.000₫` / `398.000₫` / `30.000₫` / `428.000₫` hiển thị đúng |
| `GET /api/cart/merge` có user cart | Giữ SKU cũ, thêm SKU mới, không nhân đôi SKU trùng; xóa cart guest; clear cookie `cartId` |
| `GET /api/cart/merge` chưa có user cart | Tạo user cart từ cart guest; chỉ còn 1 cart sau merge |
| `GET /api/cart/merge` chưa đăng nhập | `401`, không đổi dữ liệu |
| `GET /cart` đã đăng nhập | Render cả SKU từ user cart và guest cart; guest cart bị xóa |

## 4. Verification

| Lệnh | Kết quả |
|---|---|
| `node --test test/cart.model.test.js test/cart.view.test.js test/cart.api.test.js test/cart.merge.test.js` | 23 tests, 23 pass, 0 fail, 0 skip |
| `npm test` | 301 tests, 294 pass, 0 fail, 7 skip |

7 skip trong `npm test` là các skip CSRF có sẵn; không có test fail. Test cart dùng fake model nên không phụ thuộc MongoDB thật.

## 5. Reproduction

```powershell
git checkout feature/T5-4-3-cart-tests
node --test test/cart.model.test.js test/cart.view.test.js test/cart.api.test.js test/cart.merge.test.js
npm test
```

Không có script lint/typecheck trong `package.json`.

## 6. Bàn giao Dev 3

Reviewer nên chạy lệnh suite cart riêng ở mục 4 để thấy đủ 3 tiêu chí WBS. Nếu sau này muốn `npm test` bao phủ luồng cart/view/merge theo mặc định, mở task riêng để cập nhật `package.json:9`.
