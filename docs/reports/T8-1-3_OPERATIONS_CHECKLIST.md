# T8-1-3 — Checklist vận hành (in/đánh dấu được)

Đây là bản rút gọn của [`T8-1-3_OPERATIONS_RUNBOOK.md`](T8-1-3_OPERATIONS_RUNBOOK.md). Các ô **không được tự đánh dấu** bởi PR docs-only; người vận hành điền sau khi thực tế kiểm tra.

---

## A. Trước deploy

- [ ] Commit cần deploy đã là HEAD của `main` và PR tương ứng đã được phê duyệt/merge.
- [ ] CI `API test gates` **PASS** trên đúng commit đó.
- [ ] Đã có backup DB / kế hoạch rollback; khoảng thời gian deploy đã báo team.
- [ ] Secret có trong secret manager: `MONGODB_URI`, `JWT_SECRET`, `CARRIER_WEBHOOK_SECRET` (và `SMS_OTP_SECRET` nếu dùng OTP).
- [ ] Không có secret/connection string nào nằm trong Git hay file báo cáo.
- [ ] Atlas Network Access đã cho phép IP host deploy.
- [ ] `NODE_ENV` đúng môi trường; quyết định `TRUST_PROXY` đã rõ (bật chỉ khi sau proxy tin cậy).
- [ ] `APP_ORIGIN` đã chứa domain sẽ dùng (nhiều origin phân cách bằng `,`).
- [ ] Không chạy migration/seed/cron trong đợt deploy này (trừ khi có phê duyệt riêng).

## B. Deploy

- [ ] `npm ci` (hoặc `npm install`) thành công, không đổi lockfile ngoài ý muốn.
- [ ] `npm run check:env` ✔ — chỉ báo `SET/MISSING`, không in giá trị.
- [ ] `npm start` (hoặc process manager) khởi động; log có `MongoDB Connected: <host>`.
- [ ] Không có dòng `Khong the ket noi MongoDB` / `MongoDB error:` trong log khởi động.
- [ ] `autoIndex=false` ở production đã được tính tới (xem mục C / runbook §7.6).

## C. Smoke sau deploy

| Check | Lệnh | Kỳ vọng | Kết quả |
|---|---|---|---|
| Trang chủ | `curl -s -o /dev/null -w '%{http_code}\n' "$BASE/"` | `200` | ☐ |
| API products | `curl -s -o /dev/null -w '%{http_code}\n' "$BASE/api/products"` | `200` + JSON phân trang | ☐ |
| CSRF token | `curl -s -o /dev/null -w '%{http_code}\n' "$BASE/api/auth/csrf"` | `200` + cookie `csrfToken` | ☐ |
| Cookie production | kiểm tra `Set-Cookie` | có `Secure`, `HttpOnly` đúng chính sách | ☐ |
| Index (nếu có schema/index mới) | `db.<collection>.getIndexes()` | index mới tồn tại | ☐ |

> Không có endpoint `/health` — không dùng path đó làm tín hiệu deploy thành công.

## D. Xử lý sự cố — phân loại nhanh

| Triệu chứng | Mục runbook | Đã kiểm tra |
|---|---|---|
| Process exit / lỗi kết nối DB | §7.1 | ☐ |
| 403 sau đổi domain / thiếu CSRF | §7.2 | ☐ |
| Cookie sai `Secure` / IP sai sau proxy | §7.3 | ☐ |
| Webhook 401 / 429 / 400 / 409 | §7.4 | ☐ |
| Admin `shipping` 400 thiếu `carrier`/`trackingCode` | §7.5 | ☐ |
| Truy vấn chậm, thiếu index | §7.6 | ☐ |
| Log lộ OTP (`SMS_PROVIDER=console`) | §7.7 | ☐ |
| Log `scope=audit` | §7.8 | ☐ |
| Đơn không tự `completed` | §7.9 | ☐ |
| Đơn quá hạn không bị hủy | §7.10 | ☐ |
| Rate limit không chia sẻ giữa instance | §7.11 | ☐ |
| Danh mục/Mega Menu cũ do cache | §7.12 | ☐ |
| CI fail `E11000` do SKU random | §7.13 | ☐ |
| Jest `Missing required sub-document 'driver'` | §7.14 | ☐ |

Nguyên tắc: **đo → đối chiếu cấu hình → sửa tối thiểu → smoke lại → ghi log**. Không dán secret/token vào ticket.

## E. Rollback

- [ ] Giữ lại artifact phiên bản trước; deploy lại phiên bản đó (không xóa dữ liệu).
- [ ] Nếu lỗi do env: sửa trong secret manager rồi restart; không sửa code lúc đang sự cố.
- [ ] Nếu lỗi do index/schema: rollback code, giữ DB nguyên; đánh giá riêng.
- [ ] Ghi rõ lý do, commit đang chạy, người phê duyệt và kết quả smoke sau rollback.

## F. Cổng phê duyệt (không tự động)

| Việc | Trạng thái |
|---|---|
| Chạy job quá hạn / migration `--apply` | **NOT RUN** — chờ Lead + backup + dry-run (handoff §1–2) |
| Bật cron thật | **NOT RUN** — không thêm cron trong T8-1-3 |
| Thêm dependency/store dùng chung cho rate limit | **NOT RUN** — chờ phê duyệt riêng |
| Outbox/retry cho audit | **NOT RUN** — backlog riêng |
| Tích hợp SMS provider thật | **NOT RUN** — backlog riêng |
