# PR-1 — T4-1-2 PHASE 2 SECURITY HARDENING

| Item | Giá trị |
|---|---|
| Branch | `fix/T4-1-2-csrf-forgot-reset` |
| Base | `main` @ `79d9920135ad8970074d75968a2c76659814e3b5` |
| Ngày | 2026-11-27 |
| Trạng thái | COMPLETED |

---

## 1. Scope đã thực hiện

### 1.1 CSRF cho forgot-password / reset-password

`src/routes/auth.route.js`:

```js
router.post('/forgot-password', authLimiter, csrfProtection, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', authLimiter, csrfProtection, validate(resetPasswordSchema), resetPassword);
```

Thứ tự middleware giữ nguyên pattern của register/login/refresh/logout: `authLimiter → csrfProtection → validate → controller`.

### 1.2 Rate limiter

`src/middleware/rateLimiters.js`: giữ `MemoryStore` mặc định của `express-rate-limit`, **không thêm dependency mới**. Chỉ bổ sung comment ghi rõ giới hạn:

- Bộ đếm chỉ có hiệu lực trong một process/node.
- Restart hoặc multi-instance làm mất/không chia sẻ giới hạn.
- **Không tuyên bố distributed rate limiting.** Cần store dùng chung ở T7-1-3.

### 1.3 Production Secure cookie test

`test/auth.login.test.js`: thay `test.skip` bằng test chạy thật.

- Chuyển `NODE_ENV=production` trong try/finally, khôi phục ngay sau.
- Vì production bật CSRF, test lấy token từ `GET /api/auth/csrf`, gửi lại qua `Cookie: csrfToken=...` + `X-CSRF-Token`.
- Assert cookie `accessToken` có `Secure`, `HttpOnly`, `SameSite=Strict`.
- Không dùng `test.skip` để né acceptance.

### 1.4 Token response assertions

`test/auth.login.test.js`: bổ sung test xác nhận response body không chứa `accessToken`, `refreshToken`, `resetToken` hay field `token`.

### 1.5 CSRF tests mới

`test/auth.csrf.test.js`: bổ sung 4 test dùng helper `withCsrfEnforced` (`NODE_ENV=development` trong phạm vi request):

- forgot-password thiếu CSRF → 403.
- forgot-password có CSRF hợp lệ → 202.
- reset-password thiếu CSRF → 403.
- reset-password có CSRF → không bị 403 (đi tiếp validate/service).

### 1.6 Staged whitespace edit

Staged edit có sẵn trên `main` tại `src/controllers/authController.js` (xoá một dòng trắng trong `forgotPassword`) được giữ nguyên và đưa vào commit PR-1, đúng chỉ đạo Lead. Không đưa sang PR-6.

---

## 2. Test evidence

### Focused

```powershell
node --test test/auth.csrf.test.js test/auth.login.test.js `
  test/auth.forgot-password-rate-limit.test.js test/auth.rate-limit.test.js `
  test/auth.register.test.js test/auth.refresh-logout.test.js
```

Kết quả: `tests 44 — pass 44 — fail 0 — skipped 0 — cancelled 0 — todo 0`, exit code `0`.

### Full DB-free regression (25 file)

```powershell
node --test test/auth.register.test.js test/auth.login.test.js test/auth.refresh-logout.test.js `
  test/auth.rbac.test.js test/auth.csrf.test.js test/auth.profile.test.js `
  test/auth.rate-limit.test.js test/auth.forgot-password-rate-limit.test.js `
  test/auth.admin-route.test.js test/auth.change-password.test.js test/profile.view.test.js `
  test/admin.users.test.js test/admin.audit-event.test.js test/user.model.test.js `
  test/error-handler.test.js test/trust-proxy.test.js test/cart.merge.test.js `
  test/cart.api.test.js test/cart.view.test.js test/order.cancel.test.js `
  test/order.view.test.js test/checkout.stock.test.js test/admin.view.test.js `
  test/order.model.test.js test/cart.model.test.js
```

Kết quả: `tests 213 — pass 213 — fail 0 — skipped 0 — cancelled 0 — todo 0 — ~103s`, exit code `0`.

### Không chạy

- `test/integration/*` và mọi test có `mongoose.connect` / `TEST_URI` / `deleteMany` / `dropDatabase` / `.env` thật → **NOT VERIFIED** theo ràng buộc prompt.
- Không đọc/in secret, token, Mongo URI.

---

## 3. Acceptance review

| Yêu cầu | Kết quả |
|---|---|
| Thiếu CSRF forgot-password trả 403 | ✅ |
| Thiếu CSRF reset-password trả 403 | ✅ |
| Token hợp lệ được xử lý bình thường | ✅ |
| Không có bypass production | ✅ CSRF chạy ở `NODE_ENV=production`‑path test; helper test dùng `development` chỉ để bật enforcement |
| Login/logout/refresh không hỏng | ✅ regression 213 pass |
| Response body không chứa token | ✅ |
| Secure cookie production được verify | ✅ test active, không skip |
| Staged whitespace edit được giữ | ✅ |
| Không thêm dependency | ✅ |
| Không tuyên bố distributed rate limiting | ✅ ghi rõ limitation |
| Không merge vào main | ✅ |

---

## 4. Kết luận

PR-1 hoàn thành. Phase 2 Dev 1 chuyển từ **COMPLETE WITH LIMITATIONS** sang **FULL COMPLETE** về mặt CSRF/test, với một limitation hạ tầng đã ghi rõ: rate limiter vẫn là `MemoryStore` và chỉ phù hợp một instance cho đến khi làm T7-1-3.
