# T7-1-3 — Checklist rà soát cấu hình bảo mật

| Mục | Giá trị |
|---|---|
| Mã WBS | `T7-1-3` / `4.7.03` — Rà soát cấu hình |
| Phạm vi WBS | Rà soát **rate limit**, **kích thước body**, **cờ cookie**; viết checklist bảo mật cho báo cáo |
| Nghiệm thu | Checklist trong báo cáo |
| Base | `origin/main` = `9544e76b614bfd5923a969d5633e0424f6b432c6` |

---

## 1. Rate limit

| Hạng mục | Cấu hình hiện có | Đánh giá | Hành động T7-1-3 |
|---|---|---|---|
| `authLimiter` | `windowMs` = `AUTH_RATE_LIMIT_WINDOW_MS` hoặc 15 phút; `limit` = `AUTH_RATE_LIMIT_MAX` hoặc 20; `standardHeaders: 'draft-8'`, `legacyHeaders: false`; handler trả 429 JSON thống nhất | Đạt | Giữ nguyên; test integration `IT-RATE-LIMIT` đã chặn 429 |
| Phạm vi áp dụng | `register`, `login`, `refresh`, `logout`, `forgot-password`, `reset-password` (`auth.route.js`), `profile.route.js` | Đạt | Không mở rộng (tránh khóa nhầm luồng hợp lệ) |
| `addressLimiter` | 60.000ms / 120 request, áp cho `GET /api/address/*`; 429 JSON | Đạt | Giữ nguyên |
| Store | `express-rate-limit` dùng **MemoryStore mặc định** — bộ đếm chỉ trong 1 process, mất khi restart, không chia sẻ giữa instance | **Limitation** | **Chấp nhận và ghi rõ.** Không đổi sang Redis/Mongo: cần dependency/hạ tầng và phê duyệt riêng; đây không phải distributed rate limiting. Cần xử lý ở T8 khi deploy multi-instance |

---

## 2. Kích thước body

| Hạng mục | Trước | Sau | Bằng chứng |
|---|---|---|---|
| `express.json()` | Dùng default ngầm (100kb) | `express.json({ limit: BODY_LIMIT })`, `BODY_LIMIT = '100kb'` | Test quét mã nguồn + test hành vi |
| `express.urlencoded()` | Dùng default ngầm (100kb) | `express.urlencoded({ extended: true, limit: BODY_LIMIT })` | Test quét mã nguồn + test hành vi |
| Lỗi vượt ngưỡng | `errorHandler` không map `entity.too.large` → rơi xuống **500** | Map `err.type === 'entity.too.large' \|\| err.status === 413` → `ErrorResponse('Payload too large', 413)` | 2 test: JSON và form >100kb đều trả 413, body `{success:false}`, không lộ stack |
| Ngưỡng nhỏ hơn giới hạn | — | Vẫn parse bình thường (400 validation, **không** bị 413 nhầm) | 1 test |

**Quyết định:** giữ **100kb** — đúng default hiện tại nên không đổi contract API; field lớn nhất là `description` (tối đa 2.000 ký tự) nên ngưỡng này thoải mái. Việc khai báo tường minh chỉ để cấu hình nhìn thấy được và kiểm chứng được bằng test.

---

## 3. Cờ cookie

| Cookie | HttpOnly | Secure | SameSite | Path | Khác | Đánh giá |
|---|---|---|---|---|---|---|
| `accessToken` | ✅ | `NODE_ENV === 'production'` | `Strict` | `/` | — | Đạt |
| `refreshToken` | ✅ | `NODE_ENV === 'production'` | `Strict` | `/api/auth` | Chỉ gửi tới endpoint auth, giảm bề mặt tấn công | Đạt |
| `cartId` | ✅ | `NODE_ENV === 'production'` | `Lax` | `/` | `maxAge` 30 ngày | Đạt (Lax cần thiết để giỏ khách sống qua luồng chuyển trang) |
| `csrfToken` | ❌ **cố ý** | `NODE_ENV === 'production'` | `Strict` | `/` | Kèm origin allowlist `APP_ORIGIN` (default `http://localhost:3000`) + header `x-csrf-token` | **Ngoại lệ chấp nhận**: frontend phải đọc token để gửi lại header; bảo vệ bằng SameSite=Strict + origin check |

**Quyết định:** không đổi cờ nào. Chỉ ghi nhận ngoại lệ CSRF vào checklist và kiểm chứng bằng test (`GET /api/auth/csrf` → cookie có `SameSite=Strict`, không có `HttpOnly`).

---

## 4. Cấu hình liên quan đã chốt ở task trước (không làm lại)

| Hạng mục | Trạng thái | Tham chiếu |
|---|---|---|
| Trust proxy | Chỉ bật khi có env `TRUST_PROXY` tường minh; không tin `X-Forwarded-For` từ client trực tiếp | T7-1-1 |
| Security headers / CSP nonce | Helmet + nonce mọi request, đặt trước static/routes | T7-1-1, PR #109 |
| Output encoding EJS | Mọi raw `<%- %>` đã phân loại; `renderMega` escape + whitelist href | T7-1-2, PR #112 |
| 500 production | Trả thông báo chung, không lộ message/stack | T5 error hardening |

---

## 5. Tóm tắt trạng thái checklist

| # | Hạng mục | Kết luận |
|---|---|---|
| 1 | Rate limit auth & address | **OK** |
| 2 | Rate limit store đa instance | **Limitation được chấp nhận** (MemoryStore; cần T8/approve riêng) |
| 3 | Body limit json/urlencoded tường minh 100kb | **Đã sửa** |
| 4 | Lỗi body > limit trả 413 (không 500) | **Đã sửa + test** |
| 5 | Cookie access/refresh/cart | **OK** |
| 6 | Cookie CSRF HttpOnly=false | **Ngoại lệ có chủ đích, đã ghi nhận** |
| 7 | Trust proxy / CSP / EJS output | **OK** (task trước) |

Không có hạng mục nào bị bỏ qua để đạt kết quả; mọi limitation đều được ghi rõ lý do ở trên.
