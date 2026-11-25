# T3-4-3 — Test Auth

- **Ngày:** 2026-11-25
- **Phạm vi:** xác nhận bộ test xác thực trên `main`, bổ sung assertion chống lộ hash, ghi nhận quyết định với branch `test_auth`.
- **Trạng thái:** **PASS** (84/84 test auth).
- **Branch:** `test/T3-4-3-auth-tests`.

---

## 1. Hiện trạng trên `main`

`main` (`b8911c2`) đã có 9 file `test/auth.*.test.js`, tất cả đều được đưa vào lệnh `npm test` (`package.json:9`).

| File | Phạm vi phủ |
|---|---|
| `test/auth.register.test.js` | Đăng ký 201, hash bcrypt, trùng email 409, validate 400, role/lowercase, không lộ password/hash |
| `test/auth.login.test.js` | Đăng nhập 200, cookie `HttpOnly`/`SameSite`/`Secure`, 401 cùng thông báo, khóa tài khoản, hết hạn/sai token, thiếu `JWT_SECRET` |
| `test/auth.refresh-logout.test.js` | Refresh xoay vòng, thu hồi, CSRF, logout idempotent |
| `test/auth.rbac.test.js` | RBAC và IDOR |
| `test/auth.csrf.test.js` | Endpoint CSRF, thiếu/sai CSRF, Origin |
| `test/auth.profile.test.js` | Đọc/cập nhật profile |
| `test/auth.rate-limit.test.js` | Rate limit endpoint auth (429) |
| `test/auth.admin-route.test.js` | Route admin thật: 401/403/200, token tự khai role không được tin |
| `test/auth.change-password.test.js` | Đổi mật khẩu: CSRF, 401/400, hash mới, tăng `tokenVersion`, thu hồi token cũ |

---

## 2. Đối chiếu commit `9986b97` (`origin/test_auth`)

Commit `9986b97` chỉ thêm `tests/auth.test.js` (Jest + MongoDB thật) với 5 case. Cả 5 case đã được phủ trên `main`:

| Case trong `9986b97` | File/test trên `main` |
|---|---|
| Đăng ký trùng email trả 409 | `test/auth.register.test.js:79` |
| Sai mật khẩu 401, không cấp cookie | `test/auth.login.test.js:101` |
| Email không tồn tại cùng thông báo với sai mật khẩu | `test/auth.login.test.js:91` |
| Cookie `accessToken` có `HttpOnly` và `SameSite=Strict` | `test/auth.login.test.js:40` |
| Phản hồi không lộ password/hash | `test/auth.register.test.js:53`, `test/auth.login.test.js:40` |

**Quyết định: không merge / không cherry-pick `9986b97`.**

Lý do:

- `origin/test_auth` chỉ hơn `main` 1 commit nhưng lạc hậu gần 90 commit; `git diff --name-status main origin/test_auth` cho thấy branch này xóa hầu hết source và test hiện tại.
- Commit dùng Jest + `tests/setup.js` (kết nối DB thật), trong khi bộ auth hiện tại dùng `node:test` + `test/support/fakeUserModel.js` (không ghi DB thật).
- Thông báo lỗi kỳ vọng trong commit cũ (`Email hoặc mật khẩu không đúng`) đã khác thông báo hiện hành (`Email hoac mat khau khong chinh xac`); merge vào sẽ tạo test fail giả.

---

## 3. Thay đổi trong branch này

| File | Thay đổi |
|---|---|
| `test/auth.register.test.js:64` | Thêm assert phản hồi đăng ký không chứa chuỗi hash bcrypt (`$2a/b/y$...`) |
| `test/auth.login.test.js:52` | Thêm assert tương tự cho phản hồi đăng nhập |
| `docs/reports/T3-4-3_AUTH_TESTS.md` | Báo cáo đối chiếu và kết quả kiểm thử |
| `docs/ABMT_Phan_chia_cong_viec.xlsx` | `02_WBS!Q37` = `Da xong`, `02_WBS!R37` = `100`, `06_Phụ thuộc!G15` = `Da xong` |

Không tạo file test mới và không sửa `package.json`: 9 file hiện có đã là nguồn sự thật cho T3-4-3.

---

## 4. Kết quả kiểm thử

| Lệnh | Kết quả |
|---|---|
| `node --test` với 9 file `test/auth.*.test.js` | **84/84 pass, 0 fail** |
| `npm test` | **260 tests, 243 pass, 17 fail** |

17 lỗi của `npm test` nằm hoàn toàn ở `test/category.api.test.js` (nhận `401` thay vì `403/201/400/409/200/...`). Đây là lỗi có sẵn trên `main` trước khi thực hiện T3-4-3, không phải hồi quy của auth và nằm ngoài phạm vi task này.

---

## 5. Tái hiện

```bash
node --test test/auth.register.test.js test/auth.login.test.js test/auth.refresh-logout.test.js test/auth.rbac.test.js test/auth.csrf.test.js test/auth.profile.test.js test/auth.rate-limit.test.js test/auth.admin-route.test.js test/auth.change-password.test.js
npm test
```
