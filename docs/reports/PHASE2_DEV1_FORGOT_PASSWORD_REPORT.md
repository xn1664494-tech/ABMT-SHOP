# PHASE 2 DEV 1 — FORGOT PASSWORD REPORT (T4-1-2)

- **Ngày:** 2026-11-19
- **Branch:** `feat/forgot-password` · **PR #41** → `feature/post-phase2-hardening`
- **Contract:** `PHASE2_DEV1_FORGOT_PASSWORD_CONTRACT.md` (viết trước khi implement)
- **CI check-run:** SUCCESS — run `44434686829` (commit `fccf1fc`)

---

## 1. Kết luận

T4-1-2 đã có đủ 3 vế: **rate limit + CSRF + quên/đặt lại mật khẩu**. Trạng thái task chuyển từ **PARTIAL** sang **PASS**. Không gửi email thật theo lựa chọn "token + log"; production trả phản hồi chung, không lộ token.

---

## 2. Điểm contract đã thực hiện

| Yêu cầu | Thực hiện |
|---|---|
| Không lộ tài khoản | `POST /forgot-password` luôn 202 + message chung cho mọi email hợp lệ |
| Token không lưu thô | `crypto.randomBytes(32)` → hex; DB chỉ lưu `sha256(token)` |
| Hạn | `resetPasswordExpires`, mặc định 15 phút (`RESET_PASSWORD_TTL_MS`) |
| Ghi đè token cũ | Mỗi yêu cầu mới `$set` hash + expiry mới |
| Dùng một lần | `findOneAndUpdate` với điều kiện hash + expiry > now + user active; `$unset` field reset sau khi đổi |
| Hash mật khẩu | bcrypt 10 rounds (dùng chung `BCRYPT_ROUNDS` của authService) |
| Thu hồi session | `$inc tokenVersion` + xoá auth cookie |
| Mặc định an toàn | Field reset `select: false`, bị xoá trong `toJSON`; production không trả `data.resetToken` |
| Validation | Zod strict: email hợp lệ, token 64 hex, mật khẩu ≥8 có chữ + số |
| Rate limit | Dùng chung `authLimiter` |

Log chỉ ghi `[forgot-password] reset token issued` / `[reset-password] password changed` — **không** log token, hash hay email.

---

## 3. Files thay đổi

- `src/model/User.js` — field reset (select:false) + toJSON strip.
- `src/services/resetPasswordService.js` — phát hành / tiêu thụ token (mới).
- `src/services/authService.js` — export `BCRYPT_ROUNDS` dùng chung.
- `src/validators/authValidator.js` — `forgotPasswordSchema`, `resetPasswordSchema`.
- `src/controllers/authController.js` — `forgotPassword`, `resetPassword`.
- `src/routes/auth.route.js` — 2 route mới dưới `/api/auth`.
- `.env.example` — `RESET_PASSWORD_TTL_MS`.
- `package.json` — `test:integration` thêm file test mới.
- `test/integration/forgot-password.integration.test.js` — 13 case MongoDB thật (mới).

---

## 4. Verification

| Bộ test | Kết quả |
|---|---|
| Focused `node --test test/integration/forgot-password.integration.test.js` | **13/13 pass** |
| `npm test` | **186/186 pass** |
| `npm run test:integration` | **45/45 pass** (32 cũ + 13 mới) |
| `npm run test:jest` | **3 suite / 8 test pass** |
| GitHub Actions (PR #41, run `44434686829`) | **success** — mọi step gồm integration 45 test xanh |

Các case bao phủ: validation, chống enumeration, production giấu token, hash không lưu thô, ghi đè token, token sai/hết hạn/yếu, đổi mật khẩu thành công, replay bị chặn, login cũ fail / mới pass, thu hồi access token cũ.

---

## 5. Còn lại

- R7 review chéo (con người) vẫn chưa có — CI check-run không thay thế approval.
- R9 staging/V3 vẫn **NOT VERIFIED**.
- PR #21 (`main ← feature/post-phase2-hardening`) vẫn mở, chờ user.
- Gửi email thật/SMTP là việc riêng, không nằm trong scope đã duyệt.
