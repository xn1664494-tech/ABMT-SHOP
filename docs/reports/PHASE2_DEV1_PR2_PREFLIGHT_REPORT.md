# PHASE 2 DEV 1 — PR2 PREFLIGHT REPORT (T4-1-3 CHANGE PASSWORD)

- **Ngày:** 2026-11-18
- **Phạm vi:** Preflight PR2 trước khi tạo Pull Request.
- **Trạng thái file:** untracked, **chưa commit, chưa push** theo yêu cầu.
- **Không tạo PR, không merge, không sync `main`.**

---

## 1. Executive summary

| Hạng mục | Giá trị |
|---|---|
| Trạng thái PR2 | **READY WITH CAVEATS** |
| Base branch | `feature/post-phase2-hardening` |
| Base SHA | `952b2f31cb1669e653eaf5ec9acd343377acfb04` |
| Head branch | `feature/T4-1-3-change-password` |
| Head SHA | `e8e5af354e228747b92da20a72d8b9c6d1482723` |
| Commit khác biệt | **1** (`e8e5af3 feat(profile): add secure password change API`) |
| File thay đổi | **7** |
| Additions / deletions | **+346 / −8** |
| PR1 lặp lại | **Không** |
| Secret thật | **Không phát hiện** |

Caveat chính: chưa có integration test MongoDB thật riêng cho đổi mật khẩu (verification gap **V2**); test PR2 dùng fake User model.

---

## 2. Git verification

### 2.1. Ancestry

| Kiểm tra | Kết quả |
|---|---|
| `e8e5af3` là ancestor của `origin/feature/T4-1-3-change-password` | **exit 0** |
| `e8e5af3` là ancestor của `origin/feature/post-phase2-hardening` | **exit 1 — chưa merge** |
| `origin/target..origin/head` | Chỉ `e8e5af3` |
| `origin/head..origin/target` | Chỉ `952b2f3` (merge PR1) |

Kết luận: PR2 chưa được merge; branch head chỉ chứa đúng 1 commit của T4-1-3.

### 2.2. Branch local/remote

| Branch | Local SHA | Remote SHA |
|---|---|---|
| `feature/post-phase2-hardening` | `952b2f3` | `952b2f3` |
| `feature/T4-1-3-change-password` | `e8e5af3` | `e8e5af3` |
| `feature/T2-2-1-category-dependency-review` | `26b0ac9` | `26b0ac9` |
| `feature/T5-error-page-hardening` | `6e9063a` | `6e9063a` |
| `feature/T4-1-2-trust-proxy-hardening` | `5527481` | `5527481` |
| `docs/phase2-dev1-readme` | `223a330` | `223a330` |

Local integration target đã được fast-forward từ `aa2f414` → `952b2f3`.

### 2.3. Diff summary

```
 package.json                         |   2 +-
 src/controllers/profileController.js |  23 +++-
 src/routes/profile.route.js          |  16 ++-
 src/services/profileService.js       |  47 ++++++-
 src/validators/authValidator.js      |  26 +++-
 test/auth.change-password.test.js    | 234 +++++++++++++++++++++++++++++++++++
 test/support/fakeUserModel.js        |   6 +-
 7 files changed, 346 insertions(+), 8 deletions(-)
```

Name-status:

```
M package.json
M src/controllers/profileController.js
M src/routes/profile.route.js
M src/services/profileService.js
M src/validators/authValidator.js
A test/auth.change-password.test.js
M test/support/fakeUserModel.js
```

Không có `src/routes/admin.route.js`, `test/auth.admin-route.test.js` hay `src/routes/index.js` trong diff → không lặp PR1. Không có `.env`/credential.

---

## 3. Code review

### 3.1. Endpoint và middleware

`PATCH /api/profile/me/password` trong `src/routes/profile.route.js`:

```js
router.patch(
  '/me/password',
  authenticate,
  csrfProtection,
  validate(changePasswordSchema),
  changeMyPassword,
);
```

Đúng thứ tự: **authenticate → CSRF → validation → controller**.

### 3.2. Validation

`changePasswordSchema` trong `src/validators/authValidator.js`:

- `currentPassword`: string, bắt buộc, min 1.
- `newPassword`: dùng `passwordSchema` hiện có (8–72 ký tự, có chữ và số).
- `.strict()`: từ chối field ngoài scope (`role`, `status`, `passwordHash`...).
- `.refine()`: mật khẩu mới phải khác mật khẩu hiện tại.

### 3.3. Bcrypt

`src/services/profileService.js`:

- `bcrypt.compare(currentPassword, user.password)` để xác minh mật khẩu cũ.
- `bcrypt.hash(newPassword, BCRYPT_ROUNDS)` với `BCRYPT_ROUNDS = 10`, thống nhất với `authService`.
- Không lưu plaintext.

### 3.4. tokenVersion và cập nhật DB

```js
const updated = await User.findOneAndUpdate(
  { _id: userId, isDeleted: false },
  { $set: { password: passwordHash }, $inc: { tokenVersion: 1 } },
  { returnDocument: 'after', runValidators: true },
);
```

- Tăng `tokenVersion` nguyên tử.
- Không cập nhật nếu user đã soft-delete trong lúc xử lý.
- Không trả hash ra ngoài.

### 3.5. Cookie và token invalidation

- Controller gọi `clearAuthCookies(res)` → xóa access + refresh cookie.
- `authenticate` so sánh `payload.ver` với `user.tokenVersion`; tokenVersion tăng → access token cũ bị 401.
- `refreshSession` yêu cầu `tokenVersion: payload.ver` khớp; refresh token cũ sẽ bị từ chối 401 theo thiết kế hiện tại.
- **Caveat:** test PR2 chỉ kiểm tra access token cũ bị thu hồi; chưa có test riêng cho refresh token cũ (sẽ bổ sung ở V2).

### 3.6. Response security

- Thành công: `200 { success: true, message: ... }`, không trả user/password/hash/token.
- Sai mật khẩu hiện tại: 401 với thông báo chung.
- User không tồn tại/soft-delete: 404.
- Không lộ chi tiết nội bộ.

### 3.7. Ảnh hưởng chức năng khác

- Chỉ thêm export `changePassword`/`changeMyPassword`; không sửa hành vi login/refresh/logout/profile hiện có.
- `package.json` chỉ thêm test file vào script `test`.
- `test/support/fakeUserModel.js` chỉ bổ sung hỗ trợ `$set` trong `findOneAndUpdate` và `findById` trả query có `select` — phục vụ test, không ảnh hưởng production.

---

## 4. Test report

Chạy trên head PR2 `e8e5af3` (không phải trên target, vì code PR2 chưa merge).

| Lệnh | Kết quả | Database | Fake model |
|---|---|---|---|
| `node --test test/auth.change-password.test.js` | **10 pass / 0 fail / 0 skip** | Không dùng DB | **Có** |
| `npm test` | **96 pass / 0 fail / 0 skip** | Không dùng DB | Có ở HTTP test |
| `npm run test:integration` | **12 pass / 0 fail / 0 skip** | `abmt_shop_test` (đã xác minh tên DB only) | Không |

### EACCES

- Trong lần điều tra PR1 trước đó có lỗi `listen EACCES: permission denied 127.0.0.1`.
- Trong lần chạy PR2 này **không tái hiện**; toàn bộ test chạy thành công.
- Đây vẫn là rủi ro môi trường (Windows port exclusion `50000–50059`), không phải lỗi logic PR2.

### Chưa xác minh

- Đổi mật khẩu trên MongoDB thật (V2) — **NOT VERIFIED**.
- Refresh token cũ bị từ chối sau đổi mật khẩu — có cơ chế code, **chưa có test riêng**.
- Jest — **NOT VERIFIED** (lỗi driver đã biết).

---

## 5. Security review

| Hạng mục | Kết quả |
|---|---|
| Secret scan diff PR2 | Chỉ có test-only constants trong `test/auth.change-password.test.js` (JWT test secret, mật khẩu test). Không có credential/URI thật. |
| `.env`/URI trong diff | Không |
| Password/hash trong response | Không |
| Authentication | Có (`authenticate`) |
| CSRF | Có (`csrfProtection`); test 403 khi thiếu/sai token |
| Input validation | Có (Zod strict, password policy, new ≠ current) |
| User enumeration | Sai mật khẩu trả thông báo chung |
| Token revocation | Access qua tokenVersion; refresh theo thiết kế tokenVersion |

---

## 6. PR title

```text
feat(auth): implement change password endpoint (T4-1-3)
```

---

## 7. PR description (copy-paste)

```markdown
## Summary
Thêm API đổi mật khẩu cho user đang đăng nhập: `PATCH /api/profile/me/password`.
Xác minh mật khẩu hiện tại, hash mật khẩu mới bằng bcrypt, tăng `tokenVersion` để thu hồi token cũ và xoá auth cookies.

## Changes
- `src/routes/profile.route.js`: route mới với `authenticate`, `csrfProtection`, `validate(changePasswordSchema)`.
- `src/validators/authValidator.js`: `changePasswordSchema` (strict, password policy, new ≠ current).
- `src/services/profileService.js`: `changePassword` dùng bcrypt compare/hash, `$inc tokenVersion`, điều kiện `isDeleted: false`.
- `src/controllers/profileController.js`: `changeMyPassword`, trả 200 và xoá cookie.
- `test/auth.change-password.test.js`: 10 test HTTP.
- `test/support/fakeUserModel.js`: hỗ trợ `$set`/`select` cho test.
- `package.json`: thêm test file vào `npm test`.

## API
`PATCH /api/profile/me/password`

Body:
```json
{ "currentPassword": "...", "newPassword": "..." }
```

## Security behavior
- 401 khi chưa đăng nhập / sai mật khẩu hiện tại / token cũ bị thu hồi.
- 403 khi thiếu hoặc sai CSRF token.
- 400 khi input không hợp lệ, trùng mật khẩu cũ, hoặc có field ngoài scope.
- 200 khi thành công; không trả password/hash.
- `tokenVersion` tăng; access token cũ bị từ chối; refresh token cũ bị từ chối theo cơ chế hiện tại.
- Auth cookies bị xoá.

## Tests
- `node --test test/auth.change-password.test.js`: 10 pass.
- `npm test`: 96 pass / 0 fail.
- `npm run test:integration`: 12 pass / 0 fail trên `abmt_shop_test`.
- HTTP test dùng fake User model, chưa phải MongoDB thật.

## Known limitations
- Chưa có integration test MongoDB thật cho đổi mật khẩu (theo dõi ở V2).
- Chưa có test riêng cho refresh token cũ sau đổi mật khẩu.
- Chưa hỗ trợ `confirmPassword` (theo convention hiện tại).

## Related task
T4-1-3 — Profile API / đổi mật khẩu (WBS).
```

---

## 8. Reviewer checklist

- [ ] Base đúng `feature/post-phase2-hardening` @ `952b2f3`; head đúng `feature/T4-1-3-change-password` @ `e8e5af3`.
- [ ] Diff GitHub đúng 7 file, +346/−8; không lặp PR1.
- [ ] Route có đủ `authenticate`, `csrfProtection`, `validate`.
- [ ] `currentPassword` được xác minh bằng bcrypt.
- [ ] `newPassword` được hash bằng bcrypt (rounds 10).
- [ ] `tokenVersion` tăng sau khi đổi.
- [ ] Access token cũ bị từ chối; refresh token cũ bị từ chối theo thiết kế.
- [ ] Cookie auth được xoá.
- [ ] Response không chứa password/hash.
- [ ] Không có field ngoài scope được chấp nhận.
- [ ] Test 10/10, 96/96, integration 12/12 có bằng chứng thực tế.
- [ ] Không có secret/URI/`.env` trong diff.
- [ ] Không squash merge; dùng merge commit/fast-forward.

---

## 9. Quyết định

**READY WITH CAVEATS — có thể tạo PR2.**

- Không cần sửa code trước khi tạo PR.
- Caveat cần reviewer/Lead chấp nhận:
  1. PR2 test dùng fake User model; MongoDB thật cho đổi mật khẩu là V2, chưa PASS.
  2. Refresh token cũ bị từ chối theo code/thiết kế nhưng chưa có test riêng trong PR2.
  3. EACCES từng xuất hiện ở lần điều tra trước; lần này test xanh, nhưng môi trường cần theo dõi.
- Không tạo PR tự động. Không merge. Không sync `main`.

---

## 10. Trạng thái các PR còn lại (không thay đổi)

| Thứ tự | Task | Branch | SHA |
|---|---|---|---|
| PR2 | T4-1-3 Change Password | `feature/T4-1-3-change-password` | `e8e5af3` |
| PR4 | T2-2-1 Category dependency review | `feature/T2-2-1-category-dependency-review` | `26b0ac9` |
| PR5 | T5 Error hardening | `feature/T5-error-page-hardening` | `6e9063a` |
| PR6 | T4-1-2 Trust proxy | `feature/T4-1-2-trust-proxy-hardening` | `5527481` |
| PR7 | README + completion report | `docs/phase2-dev1-readme` | `223a330` |

T2-2-1 vẫn **BLOCKED** cho Dev 1 verification. Trust proxy staging vẫn **NOT VERIFIED**.
