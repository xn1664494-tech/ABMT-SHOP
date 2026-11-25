# T4-4-2 — View Profile

- **Ngày:** 2026-11-25
- **Phạm vi:** trang hồ sơ cá nhân xem/sửa thông tin và đổi mật khẩu, dùng lại API `T4-1-3`.
- **Trạng thái:** **PASS** (2/2 test view; toàn bộ auth/profile không có hồi quy).
- **Branch:** `feature/T4-4-2-view-profile`.

---

## 1. API sử dụng lại

| Thao tác trên view | Endpoint | Hành vi |
|---|---|---|
| Tải dữ liệu | `GET /api/profile/me` (`src/routes/profile.route.js:18`) | Trả `data.user` từ `toPublicUser` — không có password/hash |
| Lưu tên/email | `PATCH /api/profile/me` (`profile.route.js:19-25`) | `authenticate` + CSRF + Zod, chỉ whitelist `name`, `email` |
| Đổi mật khẩu | `PATCH /api/profile/me/password` (`profile.route.js:26-32`) | `authenticate` + CSRF + Zod; tăng `tokenVersion`, xoá auth cookie |

Client dùng `src/public/js/api.js`: tự đính kèm `X-CSRF-Token` cho mọi request không phải GET/HEAD và tự retry 1 lần khi CSRF hết hạn.

---

## 2. Thay đổi

| File | Thay đổi |
|---|---|
| `src/routes/index.js` | Thêm `GET /profile`: chưa đăng nhập → `302 /login?next=/profile`; có đăng nhập → `Cache-Control: no-store`, render `pages/profile` với `{ id, name, role }` từ `currentUser` |
| `src/views/pages/profile.ejs` | View mới: tóm tắt hồ sơ, form `#profileForm`, form `#passwordForm` có toggle hiện mật khẩu, nút đăng xuất dùng lại `account.js` |
| `src/public/js/profile.js` | Load profile qua API, điền form, validate khớp Zod, PATCH cập nhật/đổi mật khẩu, xử lý 401 và lỗi field |
| `src/views/pages/account.ejs` | Menu “Thông tin” chuyển từ anchor `#profile` sang `/profile` |
| `test/profile.view.test.js` | Test redirect guest + test render cho user đã đăng nhập (escape XSS, không lộ password/hash, `no-store`) |
| `test/support/fakeUserModel.js` | Thêm `lean()` vào query giả để middleware `currentUser` chạy được trong test view |
| `package.json` | Đưa `test/profile.view.test.js` vào lệnh `npm test` |

Không sửa logic API, không thêm file test API mới, không đổi luồng `/account` hiện có.

---

## 3. Bảo mật

- Route trang kiểm tra `res.locals.currentUser` trước khi render; guest bị chuyển về login với `next` an toàn.
- Dữ liệu user đưa vào EJS bằng `<%= %>` và vào DOM bằng `textContent` → chặn XSS (đã có test với tên chứa `<img onerror>`).
- `Cache-Control: no-store` trên trang chứa thông tin cá nhân.
- Không render `password`, `passwordHash`, `resetPasswordTokenHash` hay access/refresh token ra HTML.
- Sau đổi mật khẩu thành công, API xoá cookie; view hiện toast rồi chuyển về `/login` để đăng nhập lại bằng mật khẩu mới.

---

## 4. Kiểm thử

| Lệnh | Kết quả |
|---|---|
| `node --test test/profile.view.test.js` | **2/2 pass** |
| `npm test` | **262 tests, 245 pass, 17 fail** |

17 lỗi của `npm test` nằm hoàn toàn ở `test/category.api.test.js` (có sẵn trên `main`, nhận `401` thay vì mã kỳ vọng). Không phải hồi quy của T4-4-2.

---

## 5. Cập nhật tiến độ

Workbook `docs/ABMT_Phan_chia_cong_viec.xlsx`:

- `02_WBS!Q48` → `Da xong`
- `02_WBS!R48` → `100`
- `06_Phụ thuộc!G22` → `Da xong`

---

## 6. Tái hiện

```bash
node --test test/profile.view.test.js
npm test
```
