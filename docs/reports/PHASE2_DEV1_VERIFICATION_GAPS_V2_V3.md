# PHASE 2 DEV 1 — VERIFICATION GAPS V2 & V3

---

## V2 — Integration MongoDB thật cho đổi mật khẩu

**Trạng thái: ĐÃ ĐÓNG (CLOSED)** — branch `test/V2-change-password-integration`, PR **#29**, merge `f6fbc23`.

### Nguyên nhân gap
`test/auth.change-password.test.js` (10 case) chạy trên **fake User model**, chưa chứng minh:
- ghi thật vào MongoDB,
- `tokenVersion` thật sự tăng,
- token cũ thật sự bị thu hồi.

### Bộ test mới
`test/integration/change-password.integration.test.js` — 12 case trên MongoDB thật (`abmt_shop_test`):

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 1 | Không đăng nhập | 401 | PASS |
| 2 | Thiếu CSRF | 403 | PASS |
| 3 | CSRF sai | 403 | PASS |
| 4 | Sai mật khẩu hiện tại | 401 + DB không đổi (`password`, `tokenVersion=0`) | PASS |
| 5 | Mật khẩu mới yếu | 400 + DB không đổi | PASS |
| 6 | Mật khẩu mới trùng cũ | 400 | PASS |
| 7 | Đổi thành công | 200 + xoá cookie `accessToken`/`refreshToken` | PASS |
| 8 | Lưu DB | hash bcrypt, không chứa plaintext, `tokenVersion=1` | PASS |
| 9 | Đăng nhập lại | mật khẩu cũ 401, mật khẩu mới 200 | PASS |
| 10 | Access token cũ | 401 (`Phien dang nhap da bi thu hoi`) | PASS |
| 11 | Refresh token cũ | 401 (`Refresh token da bi thu hoi`) | PASS |
| 12 | User khác | không bị ảnh hưởng (`tokenVersion=0`) | PASS |

**Bằng chứng:** `npm run test:integration` → **32/32 pass** (20 cũ + 12 mới), 0 skip.

---

## V3 — Staging / hạ tầng thật

**Trạng thái: NOT VERIFIED (blocked — không có môi trường)**

Repo không có môi trường staging, không có reverse proxy, không có CI. Vì vậy các hạng mục sau **không thể** kết luận PASS:

| # | Hạng mục | Trạng thái | Cách verify khi có staging |
|---|---|---|---|
| V3-1 | Trust proxy sau reverse proxy thật (`X-Forwarded-For`, `X-Forwarded-Proto`) | NOT VERIFIED | deploy `TRUST_PROXY=1`, gửi request qua proxy, kiểm `req.ip` |
| V3-2 | Cookie `Secure` khi `NODE_ENV=production` qua HTTPS | NOT VERIFIED | kiểm header `Set-Cookie` |
| V3-3 | Rate limit theo IP client thật (không phải IP proxy) | NOT VERIFIED | bắn 429 qua proxy với nhiều IP |
| V3-4 | `/health` sau khi deploy | NOT VERIFIED | `GET /health` → 200 `{status:"ok"}` |
| V3-5 | Trang lỗi 500 production không lộ nội bộ | PARTIAL (đã test ở mức app, chưa ở mức deployment) | gây lỗi 500 trên staging, xem HTML/JSON |
| V3-6 | Bảo mật header / TLS termination | NOT VERIFIED | kiểm tra tại proxy |

### Checklist bàn giao cho người vận hành

1. Deploy với `NODE_ENV=production`, `TRUST_PROXY=<số hop>`, `APP_ORIGIN=https://<domain>`.
2. Gửi request **qua** proxy kèm `X-Forwarded-For: 203.0.113.7` → log `req.ip` = `203.0.113.7`.
3. Gửi request **trực tiếp** (không qua proxy) kèm `X-Forwarded-For` giả → `req.ip` phải là IP kết nối.
4. Kiểm `Set-Cookie` có `Secure` + `HttpOnly` + `SameSite`.
5. Bắn login sai liên tục từ 1 IP → 429; từ IP khác → không bị chặn.
6. `GET /health` → 200.
7. Gây 1 lỗi 500 (ví dụ tắt DB) → trang lỗi chỉ hiển thị thông báo chung.

> Không được ghi V3 là PASS cho tới khi có log/evidence thật từ staging.
