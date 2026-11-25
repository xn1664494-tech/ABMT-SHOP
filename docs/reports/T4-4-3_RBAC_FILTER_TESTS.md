# T4-4-3 — Test RBAC & lọc

- **Ngày:** 2026-11-25
- **Phạm vi:** xác nhận phân quyền admin trên route sản phẩm và hành vi lọc biến thể của `buildFilter`.
- **Trạng thái:** **PASS** (30/30 test unit/RBAC + 28/28 test API product; không có hồi quy mới).
- **Branch:** `test/T4-4-3-rbac-filter`.

---

## 1. Đối tượng kiểm thử

| Thành phần | Vai trò | Kết luận |
|---|---|---|
| `src/middleware/requireAdmin.js:3-8` | Chặn mọi `req.user.role !== 'admin'` bằng `403` | Giữ nguyên; đã có test trực tiếp |
| `src/routes/products.route.js:18-21` | `authenticate → requireAdmin → csrfProtection` cho POST/PUT/PATCH/DELETE | Giữ nguyên; 401 do `authenticate`, 403 do `requireAdmin` |
| `src/utils/productFilter.js:84-152` | Dựng filter Mongo: category, price, keyword, `$elemMatch` cho size/color/stock | Giữ nguyên; bổ sung test các nhánh còn thiếu |
| `test/product.api.test.js:547-592` | “M + Đỏ” chỉ khớp cùng một biến thể, không ghép M-Xanh với S-Đỏ | Đã có sẵn; chỉ thêm assert cho chữ thường |

Role luôn lấy lại từ DB trong `authenticate` (`src/middleware/authenticate.js:47-59`), không tin `role` do client khai trong token.

---

## 2. Thay đổi

| File | Thay đổi |
|---|---|
| `test/auth.rbac.test.js:178-206` | Thêm 2 test mini-app cho `requireAdmin`: thiếu `req.user` → 403, customer → 403, admin → 200 |
| `test/product.filter.test.js:145-183` | Thêm 4 test: chỉ `size`, `inStock=false`, array lấy phần tử đầu, gộp nhiều lỗi vào `details` |
| `test/product.api.test.js:674-710` | Thêm 3 test DELETE: guest → 401, customer → 403, token tự khai `role: admin` nhưng DB customer → 403 |
| `test/product.api.test.js:587-594` | Assert bổ sung: query viết thường `m + đỏ` cũng loại trừ sản phẩm split/out-of-stock |
| `docs/reports/T4-4-3_RBAC_FILTER_TESTS.md` | Báo cáo này |
| `docs/ABMT_Phan_chia_cong_viec.xlsx` | `02_WBS!Q49` → `Da xong`, `R49` → `100` |

Không sửa logic `requireAdmin.js` hay `productFilter.js`; không thêm file test mới vào `package.json` (cả 3 file đã nằm trong `npm test`).

---

## 3. Ma trận tiêu chí

| Tiêu chí | Test | Kết quả |
|---|---|---|
| Chưa đăng nhập xoá sản phẩm → 401 | `test/product.api.test.js:674` | PASS |
| Customer xoá sản phẩm → 403 | `test/product.api.test.js:683` | PASS |
| Token tự khai role admin không vượt quyền | `test/product.api.test.js:695` | PASS |
| `requireAdmin` chặn thiếu user/customer, mở admin | `test/auth.rbac.test.js:178`, `:189` | PASS |
| Lọc “M + Đỏ” không ra M-Xanh/S-Đỏ | `test/product.api.test.js:547`, assert mới `:591` | PASS |
| Biến thể M-Đỏ hết hàng không được khớp | `test/product.api.test.js:571-585` | PASS |
| Filter không đụng `isActive`/`isDeleted` | `test/product.filter.test.js:27`, `:156` | PASS |

---

## 4. Kiểm thử

| Lệnh | Kết quả |
|---|---|
| `node --test test/auth.rbac.test.js test/product.filter.test.js` | **30/30 pass** |
| `node --test test/product.api.test.js` | **28/28 pass**, 0 skipped |
| `npm test` | **271 tests, 254 pass, 17 fail, 0 skipped** |

17 lỗi của `npm test` vẫn nằm hoàn toàn ở `test/category.api.test.js` (có sẵn trên `main`, nhận `401` thay vì mã kỳ vọng). Không phải hồi quy của T4-4-3.

---

## 5. Cập nhật tiến độ

Workbook `docs/ABMT_Phan_chia_cong_viec.xlsx`:

- `02_WBS!Q49` → `Da xong`
- `02_WBS!R49` → `100`

`06_Phụ thuộc` không có hàng T4-4-3 (bảng nhảy từ T4-4-2 sang T5-1-1), nên không sửa thêm ô nào tại sheet đó.

---

## 6. Tái hiện

```bash
node --test test/auth.rbac.test.js test/product.filter.test.js
node --test test/product.api.test.js
npm test
```
