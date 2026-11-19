# Contract — Quên / đặt lại mật khẩu (T4-1-2)

- **Trạng thái:** intended contract, implemented in branch `feat/forgot-password`.
- **Auth:** không cần đăng nhập. Rate limit dùng chung `authLimiter`.
- **CSRF:** không áp dụng (không dùng cookie auth để xác thực request). token đặt lại nằm trong body.
- **DB:** `users`, các field mới `resetPasswordTokenHash`, `resetPasswordExpires` (đều `select: false`, không bao giờ trả ra JSON).

---

## `POST /api/auth/forgot-password`

Request:
```json
{ "email": "user@example.com" }
```

Response (mọi trường hợp email hợp lệ, kể cả email không tồn tại):
```json
{
  "success": true,
  "message": "Neu email ton tai, huong dan dat lai mat khau da duoc gui"
}
```
- Status: **202 Accepted**.
- Không tiết lộ email có tồn tại hay không (chống enumeration).
- Khi tồn tại user active: tạo token ngẫu nhiên 32 byte (hex), lưu **hash SHA-256** + `expires = now + RESET_PASSWORD_TTL_MS` (mặc định 15 phút), ghi đè token cũ.
- Khi `NODE_ENV !== 'production'`: response có thêm `data.resetToken` và `data.expiresAt` để dev/test không cần email provider. **Production không trả token.**
- Log sự kiện không kèm token, email hay hash.

Validation: email phải hợp lệ, tối đa 254 ký tự, không nhận field ngoài `email` → 400.

---

## `POST /api/auth/reset-password`

Request:
```json
{ "token": "<64 hex chars>", "newPassword": "Moi12345" }
```

Response thành công:
```json
{ "success": true, "message": "Dat lai mat khau thanh cong" }
```
- Status: **200**.
- Hash mật khẩu mới bằng bcrypt (10 rounds).
- Cập nhật **nguyên tử**: chỉ khớp khi `resetPasswordTokenHash` đúng, `resetPasswordExpires > now`, user còn active/chưa xoá.
- Xoá field reset (`$unset`) → token **dùng một lần**.
- Tăng `tokenVersion` → mọi access/refresh token cũ bị thu hồi; controller xoá auth cookie.
- Token sai/hết hạn/đã dùng → **400**, message chung: `Token dat lai mat khau khong hop le hoac da het han`.
- Validation: token đúng định dạng 64 hex, mật khẩu mới theo `passwordSchema` (≥8 ký tự, có chữ và số, ≤72) → 400.

---

## Biến môi trường mới

| Biến | Mặc định | Mô tả |
|---|---|---|
| `RESET_PASSWORD_TTL_MS` | `900000` | Thời hạn token đặt lại (ms). Giá trị không hợp lệ → dùng mặc định. |

Không gửi email thật. Tích hợp SMTP/email provider là việc riêng, không nằm trong scope này.
