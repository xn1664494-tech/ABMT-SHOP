# PHASE 2 DEV 1 — WBS SCOPE MAPPING

- **Task ID:** SCOPE-WBS (Phần 6 của master prompt)
- **Repository:** `D:\ABMT_Shop\ABMT-SHOP`
- **Nguồn WBS:** `docs/ABMT_Phan_chia_cong_viec.xlsx`, sheet `02_WBS` (97 dòng, 96 task) và sheet `09_Kiểm thử & DoD` — đọc trực tiếp bằng giải nén OOXML, **không dựa vào báo cáo cũ**.
- **Code tham chiếu:** `feature/post-phase2-hardening` @ `952b2f3`
- **Loại:** audit read-only. Không sửa code, không sửa WBS, không commit.
- **Trạng thái:** đề xuất phân loại — **PENDING APPROVAL** ở mục 6 (vì thay đổi cách tính % hoàn thành).

---

## 1. Trích WBS gốc (nguyên văn, cột Phase / Dev / Công việc)

| Task ID | Phase (WBS) | Dev | Công việc chính | Công việc chi tiết |
|---|---|---|---|---|
| T2-1-1 | **Phase 1 – Nền tảng** | Dev 1 | Nền tảng ứng dụng | `app.js`: Helmet, giới hạn body, cookie-parser, session (kho bền trên MongoDB), compression, static cache |
| T2-1-2 | **Phase 1 – Nền tảng** | Dev 1 | Xử lý lỗi | Error Handler tập trung: lớp AppError, trang `error.ejs` cho giao diện, JSON lỗi cho `/api`; xử lý 404 |
| T2-1-3 | **Phase 1 – Nền tảng** | Dev 1 | Validate & CSRF | Middleware `validate(schema)` dùng Zod; tra cứu và chọn thư viện CSRF còn được hỗ trợ |
| T2-2-1 | **Phase 1 – Nền tảng** | Dev 2 | Mongoose Schema | Schema User, Category, Product (variants + SKU), kèm ràng buộc và message lỗi |
| T3-1-1 | **Phase 2 – CRUD, Auth, Catalog** | Dev 1 | Xác thực | Đăng ký: Zod, trùng Email → 409, băm bcrypt, vai trò mặc định Customer (không nhận role từ client) |
| T3-1-2 | **Phase 2** | Dev 1 | Xác thực | Đăng nhập: thông báo chung 'Email hoặc mật khẩu không đúng'; JWT ngắn hạn trong cookie HttpOnly + Secure + SameSite |
| T3-1-3 | **Phase 2** | Dev 1 | Xác thực | Đăng xuất và cơ chế refresh token; cấu hình thời hạn token qua env |
| T4-1-1 | **Phase 2** | Dev 1 | RBAC & IDOR | Middleware `authenticate` và `authorize(...roles)`; helper kiểm tra quyền sở hữu (chống IDOR) |
| T4-1-2 | **Phase 2** | Dev 1 | Bảo mật | Giới hạn tần suất cho đăng nhập/quên mật khẩu; bật CSRF cho mọi form POST |
| T4-1-3 | **Phase 2** | Dev 1 | API Profile | Xem, cập nhật hồ sơ, đổi mật khẩu (không trả trường mật khẩu) |

---

## 2. Phân loại phạm vi (theo WBS, không theo mã task)

### 2.1. Task Phase 2 thuộc Dev 1 — phạm vi chính thức (6 task)

`T3-1-1`, `T3-1-2`, `T3-1-3`, `T4-1-1`, `T4-1-2`, `T4-1-3`

### 2.2. Task Phase 1 của Dev 1 — chỉ là dependency readiness

`T2-1-1`, `T2-1-2`, `T2-1-3` → **không tính vào % Phase 2**. Trạng thái thực tế trên target:

| Task | Bằng chứng trong code | Trạng thái thật |
|---|---|---|
| T2-1-1 | `src/app.js` chỉ có `express.json`, `urlencoded`, `cookieParser` | **PARTIAL/FAIL**: **không** có helmet, compression, session, static cache |
| T2-1-2 | `src/middleware/errorHandler.js`, `src/middleware/404.js`, `src/utils/appError.js` | **PARTIAL**: có handler + 404 + AppError, nhưng 5xx lộ `message` ở production (PR5 sửa) |
| T2-1-3 | `src/middleware/validate.js` (Zod), `src/middleware/csrf.js` | **PASS** phần validate; CSRF được hoàn thiện trong T4-1-2 |

Rủi ro: 2 dependency Phase 1 chưa đạt có thể ảnh hưởng release gate, **nhưng không được cộng/trừ vào % Phase 2**.

### 2.3. Task Phase 1 của Dev 2 — dependency, không phải quyền của Dev 1

`T2-2-1` (schema), `T2-2-2` (schema Order/Cart/Review), `T2-2-3` (index + seed).
→ Nhánh `feature/T2-2-1-category-dependency-review` (PR4) là **review dependency**, **không** phải triển khai/verify Category. Việc "T2-2-1 PASS" chỉ được xác lập bởi Dev 2 + verification riêng (`test/T2-2-1-category-dependency-verification`), không bởi PR4.

### 2.4. Task Phase 2/3 của Dev 2/3/4 — ngoài phạm vi Dev 1

`T3-2-1` (API Category), `T3-2-2` (API Product), `T3-2-3` (query helper), `T3-3-x`, `T3-4-x`, `T4-2-x`… → **không thực hiện, không sửa**.

### 2.5. Hardening phát sinh sau Phase 2 — KHÔNG có trong WBS

| Hạng mục | Branch | Vì sao ngoài WBS |
|---|---|---|
| Trust proxy opt-in + test | `feature/T4-1-2-trust-proxy-hardening` (PR6) | WBS `T4-1-2` = rate limit + CSRF (đã có trong target). Trust proxy không xuất hiện ở dòng WBS nào của Phase 2; gần nhất là `T7-1-1` (Phase 4 – "cookie Secure + trust proxy"). |
| Error page HTML thân thiện + không lộ stack (T5) | `feature/T5-error-page-hardening` (PR5) | WBS `T2-1-2` (Phase 1) mới yêu cầu "trang error.ejs + JSON cho /api". T5 là gia cố thêm — nội dung hardening, không phải task Phase 2. |
| README + completion report | `docs/phase2-dev1-readme` (PR7) | Tài liệu, không phải task WBS. |

→ Các mục này **vẫn nên merge** (tốt cho chất lượng) nhưng phải nhãn **"hardening — ngoài WBS Phase 2"**, không được dùng để tăng % hoàn thành Phase 2.

### 2.6. Task chưa có trong WBS (không được tự thêm)

- V1 (Jest diagnosis), V2 (change-password Mongo integration), V3 (staging verification), V4 (env var consistency), Category verification → đều là **verification/quality work**, không phải task WBS. Ghi ở mục "verification", không tính % WBS.

---

## 3. Đối chiếu 6 task Phase 2 với bằng chứng thực tế (target `952b2f3`)

| Task | File/bằng chứng | Test đã chạy (trên target) | Trạng thái |
|---|---|---|---|
| T3-1-1 | `src/controllers/authController.js`, `src/validators/authValidator.js`, `src/model/User.js` | `test/auth.register.test.js` trong `npm test` 86/86 pass | **PASS** (implementation + test), DoD review chưa đạt |
| T3-1-2 | `src/services/authService.js`, `src/services/tokenService.js`, `src/routes/auth.route.js` | `test/auth.login.test.js` | **PASS** (implementation + test) |
| T3-1-3 | `authController.refresh/logout`, `tokenService`, `src/middleware/csrf.js` | `test/auth.refresh-logout.test.js` | **PASS** (implementation + test); chưa có test riêng cho refresh token cũ bị thu hồi (thuộc V2) |
| T4-1-1 | `src/middleware/authenticate.js` (`authenticate`, `authorize`, `requireSelfOrAdmin`), `src/routes/admin.route.js` | `test/auth.rbac.test.js`, `test/auth.admin-route.test.js` | **PASS** (PR1 đã merge `952b2f3`) |
| T4-1-2 | `src/middleware/rateLimiters.js` (login/register/refresh/logout → 429), `src/middleware/csrf.js` (double-submit + Origin check, áp cho `/refresh`, `/logout`, `PATCH /profile/me`) | `test/auth.rate-limit.test.js`, `test/auth.csrf.test.js`, `test/integration/rate-limit.integration.test.js` (12/12) | **PARTIAL** — rate limit + CSRF đã có và test xanh, nhưng vế "quên mật khẩu" **không tồn tại** trong codebase (chưa có endpoint), và rate limit dùng MemoryStore (không chia sẻ giữa nhiều instance) |
| T4-1-3 | `src/controllers/profileController.js` (get/update), `src/routes/profile.route.js`; **change-password chỉ có trên branch `feature/T4-1-3-change-password`** | `test/auth.profile.test.js` (trên target); 10 test change-password chỉ chạy trên branch | **PARTIAL / PASS ON BRANCH** — xem/ cập nhật hồ sơ PASS trên target; đổi mật khẩu **chưa tích hợp** |

### 3.1. Tỷ lệ hoàn thành Phase 2 (tính theo WBS)

| Cách tính | Kết quả |
|---|---|
| Nghiêm ngặt theo 6 task (PARTIAL = không đạt) | **4/6 = 66.7%** |
| Nếu chấp nhận vế "quên mật khẩu" là N/A (endpoint chưa tồn tại) và T4-1-3 tính theo phần chưa merge | **5/6 = 83.3%** |
| Sau khi PR2 merge + verify trên target | **5/6 = 83.3%**, còn T4-1-2 PARTIAL |
| Sau khi xử lý xong vế quên mật khẩu (hoặc Lead chốt N/A) | **6/6 = 100%** |

Không được ghi 100% khi T4-1-3 chưa merge hoặc T4-1-2 còn PARTIAL.

---

## 4. Xung đột giữa WBS – báo cáo – code (ghi nhận, không tự sửa)

| # | Xung đột | Bằng chứng | Đề xuất |
|---|---|---|---|
| C1 | Báo cáo cũ tính T2-1-1/T2-1-2/T2-1-3 vào Phase 2 | WBS sheet `02_WBS` dòng 14–16 ghi "Phase 1 – Nền tảng" | Sửa cách tính trong final report; giữ nguyên lịch sử báo cáo cũ, ghi chú đính chính |
| C2 | Báo cáo coi T4-1-2 = trust proxy | WBS dòng 39: "Giới hạn tần suất … CSRF cho mọi form POST" | T4-1-2 đánh giá theo rate limit + CSRF; trust proxy = hardening ngoài WBS |
| C3 | T5 (error page) được gọi là task Phase 2 | Không có task T5 trong `02_WBS`; gần nhất `T2-1-2` (Phase 1) | Nhãn "hardening ngoài WBS" |
| C4 | PR4 được kỳ vọng "chứng minh T2-2-1 PASS" | `T2-2-1` là Phase 1, Dev 2 | PR4 chỉ là dependency review; verification riêng mới được kết luận |
| C5 | WBS yêu cầu "Giới hạn tần suất cho … quên mật khẩu" | Không có route/service forgot-password trong `src/` | Ghi gap; cần Lead quyết định: bổ sung task hay chấp nhận N/A |
| C6 | WBS luồng nhánh `main ← develop ← feature` (T1-1-3) | `origin/develop` **không tồn tại** | Release gate phải nêu rõ: tạo `develop` hay dùng `feature → main` (PENDING APPROVAL) |
| C7 | DoD yêu cầu review chéo | Không PR nào có review approval qua API; repo không có CI | DoD #4 chưa đạt cho mọi task — không được tuyên bố PASS trọn DoD |

---

## 5. Ảnh hưởng tới thứ tự công việc

- PR2 (T4-1-3) là **task Phase 2 duy nhất còn thiếu code trên target** → ưu tiên cao nhất, giữ nguyên vị trí Bước 1.
- PR4/PR5/PR6/PR7 không làm thay đổi % Phase 2; chúng là dependency review + hardening + tài liệu → vẫn làm nhưng không dùng làm căn cứ "hoàn thành Phase 2".
- V2 trực tiếp bịt lỗ hổng bằng chứng của T3-1-3 (refresh token cũ) và T4-1-3 (change password) → nên chạy ngay sau PR2 post-merge.
- V4 ảnh hưởng khả năng tái lập test → nên làm trước V2 trên thực tế (đổi thứ tự V4 → V2 như master prompt đã định).

---

## 6. Quyết định cần Lead phê duyệt (PENDING APPROVAL)

| # | Nội dung | Lựa chọn | Đề xuất |
|---|---|---|---|
| S1 | Cách tính % Phase 2 | (a) 4/6 nghiêm ngặt; (b) 5/6 với "quên mật khẩu" = N/A | (b) — nhưng phải ghi rõ vế N/A trong final report |
| S2 | Vế "quên mật khẩu" của T4-1-2 | (a) bổ sung task mới; (b) chấp nhận N/A Phase 2 | (b) + đưa vào backlog |
| S3 | Trust proxy / T5 / README | (a) coi là hardening ngoài WBS; (b) thêm vào WBS | (a) — không sửa WBS |
| S4 | Đính chính báo cáo cũ đã tính T2-1-x vào Phase 2 | (a) sửa file cũ; (b) chỉ ghi chú trong final report | (b) — không sửa lịch sử |

---

## 7. Trạng thái & bước tiếp theo

| Hạng mục | Trạng thái |
|---|---|
| WBS scope mapping | **HOÀN THÀNH (read-only)** — file này |
| Đề xuất phân loại | **PENDING APPROVAL** (S1–S4) |
| Ảnh hưởng code | Không có (không sửa gì) |

**Người chịu trách nhiệm:** Lead/người dùng phê duyệt S1–S4; agent áp dụng vào `PHASE2_DEV1_FINAL_INTEGRATION_REPORT.md` ở tầng P2.
