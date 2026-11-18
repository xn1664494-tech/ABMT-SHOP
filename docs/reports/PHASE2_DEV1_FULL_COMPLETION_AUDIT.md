# PHASE 2 DEV 1 — FULL COMPLETION AUDIT

- **Ngày audit:** 2026-11-18, 22:20–22:55 (+07:00)
- **Repository:** `D:\ABMT_Shop\ABMT-SHOP`
- **Branch audit:** `feature/post-phase2-hardening`
- **HEAD audit:** `952b2f31cb1669e653eaf5ec9acd343377acfb04`
- **Loại nhiệm vụ:** AUDIT read-only — không sửa code, không commit, không push, không tạo/merge PR.
- **Nguyên tắc áp dụng:** có code ≠ đã tích hợp; đã merge ≠ PASS; fake model ≠ integration; local ≠ staging.

---

## 1. Executive Summary

**Kết luận: `PHASE 2 DEV 1 NOT COMPLETE`.**

Dev 1 đã hoàn thành tốt **lớp xác thực và phân quyền cốt lõi** (Register, Login, Logout/Refresh, RBAC/IDOR, Validate/CSRF) và phần này **đã nằm trong nhánh tích hợp, có test chạy xanh thực tế**. Tuy nhiên, **toàn bộ chuỗi hardening Phase 2 (PR2, PR4, PR5, PR6, PR7) chưa được tích hợp**, `main` chưa được sync, và **4 nhóm verification gap (V1–V4) cùng Category verification vẫn chưa có bằng chứng**.

| Nhóm | PASS | PARTIAL | BLOCKED | NOT STARTED | NOT VERIFIED |
|---|---:|---:|---:|---:|---:|
| WBS Task (9) | 5 | 4 | 0 | 0 | 0 |
| Hardening/PR (6) | 1 | 0 | 5 | 0 | 0 |
| Sync + Verification (7) | 0 | 0 | 2 | 2 | 3 |
| **Tổng (22)** | **6** | **4** | **7** | **2** | **3** |

Bằng chứng test tái lập trong audit này (trên target `952b2f3`):

- `npm test` → **86 pass / 0 fail / 0 skip** (exit 0).
- `npm run test:integration` → **12 pass / 0 fail / 0 skip** trên `abmt_shop_test` (exit 0).
- `npm run test:jest` → **2/2 suite fail, 7/7 test fail** (exit 1) — lỗi hạ tầng Jest, đã tái hiện.

---

## 2. Audit Scope

### 2.1. Trong phạm vi

| Nhóm | Hạng mục |
|---|---|
| WBS | T2-1-1, T2-1-2, T2-1-3, T3-1-1, T3-1-2, T3-1-3, T4-1-1, T4-1-2, T4-1-3 |
| Hardening phát sinh | PR1, PR2, PR4, PR5, PR6, PR7 |
| Tích hợp | Main synchronization |
| Verification gap | V1 (Jest), V2 (change-password MongoDB), V3 (trust proxy staging), V4 (env var consistency) |
| Dependency | Category dependency verification (Dev 2) |
| Tài liệu/release | Backlog, decision log, final integration report, release gate |

### 2.2. Ngoài phạm vi (không audit, không kết luận)

- Cart, Order, Payment, Review API (Dev 2).
- Admin CRUD đầy đủ, Audit log, Cron (ngoài Phase 2 Dev 1).
- Frontend UI (Dev 3 / Dev 4).
- PR #14 (home-view), #16 (header-actions) — không thuộc Dev 1.

### 2.3. Giới hạn audit

- Không checkout branch khác để chạy test PR2/PR5/PR6/PR7 (tránh thay đổi trạng thái working tree). Các test trên branch chưa merge được ghi nhận là **báo cáo trước đó, không tái xác minh trong audit này**.
- Không có quyền truy cập staging/deployment → V3 không thể xác minh.
- WBS gốc (`docs/ABMT_Phan_chia_cong_viec.xlsx`) không có trong repo; phạm vi lấy theo master prompt và các báo cáo hiện có.

---

## 3. Git / Branch / Commit Evidence

### 3.1. Trạng thái hiện tại

| Hạng mục | Giá trị |
|---|---|
| Branch | `feature/post-phase2-hardening` |
| HEAD | `952b2f31cb1669e653eaf5ec9acd343377acfb04` |
| Origin target | `952b2f31cb1669e653eaf5ec9acd343377acfb04` (bằng local) |
| `origin/main` | `8a3865cd3444accba70c340290a35db81687b8fc` |
| `main` local | `3d33a2370fa28df5734b5ea33c8f85a1e69145bf` (behind 6) |
| Tracked changes | **Không có** (`git status --short` chỉ có untracked) |
| Untracked | 6 file (2 bảo vệ + 4 báo cáo) |

Untracked:

- `docs/reports/FINAL_SECURITY_CLEANUP_REPORT.md` (bảo vệ)
- `docs/reports/PHASE2_DEV1_BAO_CAO_2026-11-15.md` (bảo vệ)
- `docs/reports/PHASE2_DEV1_PR1_CLOSEOUT_REPORT.md`
- `docs/reports/PHASE2_DEV1_PR2_PREFLIGHT_REPORT.md`
- `docs/reports/PHASE2_DEV1_PR2_GITHUB_GATE_REPORT.md`
- `docs/reports/PHASE2_DEV1_MASTER_PROGRESS.md`

### 3.2. Ancestry — branch nào đã nằm trong target

| Branch | Commit | Trong target? |
|---|---|---|
| `feature/T2-1-2-restore-foundation` | `148ab68` | **Có** |
| `feature/T3-1-1-register` | `4c3bc69` | **Có** |
| `feature/T3-1-2-jwt-cookie-login` | `da38def` | **Có** |
| `feature/T3-1-3-logout-refresh` | `3c94f8f` | **Có** |
| `feature/T4-1-1-rbac-idor` | `e02b10f` | **Có** |
| `feature/T4-1-1-rbac-route-integration` | `75c30db` | **Có** (PR #15) |
| `feature/T4-1-2-rate-limit-csrf` | `cf91b13` | **Có** |
| `feature/T4-1-3-profile-api` | `8ea7f97` | **Có** |
| `feature/T4-1-3-change-password` | `e8e5af3` | **KHÔNG** |
| `feature/T2-2-1-category-dependency-review` | `26b0ac9` | **KHÔNG** |
| `feature/T5-error-page-hardening` | `6e9063a` | **KHÔNG** |
| `feature/T4-1-2-trust-proxy-hardening` | `5527481` | **KHÔNG** |
| `docs/phase2-dev1-readme` | `223a330` | **KHÔNG** |
| `errorHandler.js` | `141eac0` | **KHÔNG** |
| `feature/T2-1-3-env-test-integration` | trỏ `e8e5af3` (không có commit riêng) | **KHÔNG** (chỉ là alias local, không có upstream) |

Bất thường ghi nhận: local branch `feature/T2-1-3-env-test-integration` trỏ vào `e8e5af3` (cùng commit PR2) và **không có remote tracking** — tên branch gây nhầm lẫn, không phản ánh task T2-1-3.

### 3.3. Chênh lệch target ↔ main

- `origin/main` cách target **17 commit** (trước báo cáo cũ: 11) do PR #17, #18 được merge.
- Target cách `origin/main` **2 commit** (`75c30db`, `952b2f3`).

Các khác biệt quan trọng của `main` so với target:

| Thành phần | `main` (`8a3865c`) | Target (`952b2f3`) |
|---|---|---|
| `src/model/Category.js` | Có | **Không có** |
| `src/model/Cart/Order/Review.js` | Có | Không |
| `src/model/Products.js` | Bản mới (variants, SKU, indexes) | Bản cũ |
| `src/routes/category.route.js` | Có (+ `requireAdmin`) | Không |
| `src/routes/admin.route.js` | **Không có** | Có (PR1) |
| `src/routes/index.js` | mount `/categories`, không mount `/admin` | mount `/admin`, không mount `/categories` |
| `src/app.js` | Có `/health`, không trust proxy | Có trust proxy? **Không** (PR6 chưa merge) |
| `package.json` scripts | test model/API catalog, seed, postman | test auth/admin |
| DevDeps | `mongodb-memory-server`, `newman`, `asap` | không có |

Kết luận: sync `main` sẽ **xung đột thực sự** ở `package.json`, `src/routes/index.js`, `src/app.js`, và phải chọn bản `main` cho model Products/Category.

---

## 4. Pull Request Status

Kiểm tra qua GitHub API (`/pulls?state=all`) và `git ls-remote "refs/pull/*/head"` ngày 2026-11-18.

| PR | Title | Base | Head | State | Merge commit | Đánh giá |
|---|---|---|---|---|---|---|
| #15 | RBAC authorize into admin route | `feature/post-phase2-hardening` | `feature/T4-1-1-rbac-route-integration` (`75c30db`) | **MERGED** | `952b2f3` | PR1 — integrated, verified |
| #19 | Docs/phase2 dev1 pr1 investigation | **`main`** | `docs/phase2-dev1-pr1-investigation` (`dd3e6cd`) | OPEN | — | **Sai base**, `mergeable_state = dirty`, 3 commit/5 file (kéo theo PR1) |
| — | Change Password (T4-1-3) | — | — | **KHÔNG TỒN TẠI** | — | PR2 chưa được tạo |
| — | PR4, PR5, PR6, PR7 | — | — | **KHÔNG TỒN TẠI** | — | Chưa tạo |

Ghi chú môi trường: `gh` CLI không có trong máy; dữ liệu PR lấy từ GitHub REST API công khai. Không thể đọc review status/CI checks chi tiết (API công khai không trả về checks cho repo này trong lần gọi hiện tại) → **CI status: NOT VERIFIED**.

Phân biệt rõ:

| Trạng thái | PR1 | PR2 | PR4 | PR5 | PR6 | PR7 |
|---|---|---|---|---|---|---|
| Đã tạo PR | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Đã merge | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Commit trong target | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Test trên target sau merge | ✅ (86/12) | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 5. WBS Task-by-Task Audit

### 5.1. Bảng tổng hợp

| Task ID | Task | Implementation | Commit | PR | Merged | Test | DoD | Status | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| T2-1-1 | Nền tảng ứng dụng | Có một phần (Express, cookie-parser, EJS, static, JSON/urlencoded) | Trong base history | Không riêng | ✅ | Không có test riêng trong `npm test` | Thiếu helmet, compression, session store, body limit tường minh | **PARTIAL** | `src/app.js`, `src/server.js`, `src/config/viewEngine.js`, `package.json` |
| T2-1-2 | Xử lý lỗi | Có (AppError, errorHandler, 404 JSON) | Trong base history | ❌ (PR5 chưa merge) | ✅ bản cơ bản | Không có test error handler trong `npm test` | Thiếu HTML error page + che message 500 ở production | **PARTIAL** | `src/utils/appError.js`, `src/middleware/errorHandler.js`, `src/middleware/404.js` |
| T2-1-3 | Validate & CSRF | Có đầy đủ (Zod strip unknown, CSRF double-submit + Origin) | `cf91b13` (nhánh rate-limit-csrf) | Không riêng | ✅ | 7 test CSRF + IT-CSRF | Đạt | **PASS** | `src/middleware/validate.js`, `src/middleware/csrf.js`, `test/auth.csrf.test.js`, `test/integration/mongodb.integration.test.js` |
| T3-1-1 | Đăng ký | Có (Zod, 409, bcrypt, role cố định customer) | `4c3bc69` | Không riêng | ✅ | 9 test + IT-REGISTER/IT-UNIQUE | Đạt | **PASS** | `src/services/authService.js`, `src/controllers/authController.js`, `src/validators/authValidator.js` |
| T3-1-2 | Đăng nhập | Có (JWT, HttpOnly, SameSite=Strict, thông báo chung) | `da38def` | Không riêng | ✅ | 9 test + IT-LOGIN/IT-COOKIE | Đạt | **PASS** | `src/services/tokenService.js`, `src/services/authService.js` |
| T3-1-3 | Logout & Refresh | Có (rotation, tokenVersion, chặn replay) | `3c94f8f` | Không riêng | ✅ | 9 test + IT-REFRESH/IT-LOGOUT | Đạt | **PASS** | `src/services/authService.js`, `src/services/tokenService.js` |
| T4-1-1 | RBAC & IDOR | Có (authenticate DB-based, authorize, requireSelfOrAdmin, admin route thật) | `e02b10f` + `75c30db` | #15 | ✅ | 11 RBAC + 14 admin-route + IT-RBAC-IDOR | Đạt | **PASS** | `src/middleware/authenticate.js`, `src/routes/admin.route.js` |
| T4-1-2 | Bảo mật (rate limit/CSRF/trust proxy) | Rate limit + CSRF có; **trust proxy không có trong target** | `cf91b13`; PR6 chưa merge | ❌ | Một phần | 3 rate-limit + IT-RATE-LIMIT | Thiếu trust proxy; staging chưa xác minh | **PARTIAL** | `src/middleware/rateLimiters.js`; `grep trust proxy` → 0 kết quả |
| T4-1-3 | Profile API + Change Password | Xem/sửa profile có; **đổi mật khẩu không có trong target** | `8ea7f97`; PR2 chưa merge | ❌ | Một phần | 12 profile + IT-PROFILE; change-password 0 test trên target | Thiếu change password; thiếu integration Mongo thật | **PARTIAL** | `src/routes/profile.route.js`, `src/controllers/profileController.js`, `src/services/profileService.js` |

### 5.2. Chi tiết từng task

#### T2-1-1 — Nền tảng ứng dụng — PARTIAL

Có:

- `express.json()`, `express.urlencoded()`, `cookie-parser`.
- EJS view engine + static.
- 404 + error handler đặt cuối.
- `server.js` graceful shutdown, retry connect DB (`src/config/db.js`), `scripts/check-env.js` fail-fast khi thiếu `MONGODB_URI`/`JWT_SECRET`.
- Body size limit: chỉ mặc định 100kb của Express, **không khai báo tường minh**.

Không có (NO EVIDENCE FOUND):

- `helmet` (không có trong `package.json`, không dùng trong `app.js`).
- `compression`.
- Session / MongoDB session store (kiến trúc dùng JWT cookie; cần Lead xác nhận đây là **NOT APPLICABLE** thay vì thiếu).
- CSP, HSTS, X-Frame-Options ở tầng app.

Rủi ro: thiếu header bảo mật mặc định; body limit không được tài liệu hoá.

#### T2-1-2 — Xử lý lỗi — PARTIAL

Có:

- `ErrorResponse` (statusCode).
- Xử lý CastError → 404, duplicate key → 409, ValidationError → 400, JWT errors → 401, JSON syntax → 400.
- 404 thống nhất JSON.
- Log chi tiết chỉ ở non-production, stack chỉ khi ≥500.

Thiếu (so với DoD nêu trong master prompt):

- **HTML error page** cho request không phải `/api`: hiện mọi lỗi đều trả JSON (`res.json`).
- **Che message 500 ở production**: target trả `error.message` cho cả 5xx. Nếu lỗi nội bộ (DB/mongoose) có message chứa chi tiết, production sẽ lộ. PR5 sửa điểm này nhưng **chưa merge**.
- Không có test error handler trong target (`test/error-handler.test.js` chỉ tồn tại trên branch PR5).

#### T2-1-3 — Validate & CSRF — PASS

- `validate(schema)` dùng `safeParse`, trả 400 kèm `details` theo field; `req.body = result.data` → strip unknown.
- CSRF: double-submit cookie + kiểm tra Origin/Referer, `timingSafeEqual`, cookie `sameSite=strict`, `secure` theo `NODE_ENV`.
- Áp dụng cho `POST /api/auth/refresh`, `POST /api/auth/logout`, `PATCH /api/profile/me`.
- Test: 7/7 CSRF pass + IT-CSRF pass.
- Ghi chú thiết kế: `POST /login`, `/register` không CSRF (login CSRF là rủi ro thấp, cần Lead xác nhận chấp nhận).

#### T3-1-1 — Đăng ký — PASS

- Zod: name 2–100, email hợp lệ ≤254, password 8–72 có chữ + số; `role` chỉ chấp nhận literal `customer`.
- Service luôn gán `role: 'customer'`, hash bcrypt rounds 10, kiểm tra email trùng → 409; unique index ở schema là chốt cuối (race → 11000 → 409).
- Response chỉ trả `toPublicUser` (không password/hash).
- Test: 9/9; IT-REGISTER (hash thật trong Mongo), IT-UNIQUE.

#### T3-1-2 — Đăng nhập — PASS

- `.select('+password')` vì schema `select:false`; message chung "Email hoac mat khau khong chinh xac" cho cả email sai và mật khẩu sai.
- Tài khoản `status !== 'active'` → 403 (sau khi đã xác thực mật khẩu, tránh enumeration).
- JWT: `iss/aud`, `expiresIn` cấu hình; access cookie `HttpOnly`, `SameSite=Strict`, `Secure` ở production, `path=/`; refresh cookie `path=/api/auth`.
- Token không trả trong body (IT-COOKIE xác nhận).
- Test: 9/9 + IT-LOGIN.

#### T3-1-3 — Logout & Refresh — PASS

- Refresh: verify `type=refresh`, `findOneAndUpdate` điều kiện `tokenVersion = payload.ver` + `$inc` → rotation nguyên tử; replay token cũ → 401 (IT-REFRESH).
- Logout: `$inc tokenVersion` (idempotent khi token thiếu/hỏng), clear cả 2 cookie.
- Access token cũ bị 401 qua so khớp `ver` với DB trong `authenticate`.
- Test: 9/9 + IT-LOGOUT.

#### T4-1-1 — RBAC & IDOR — PASS

- `authenticate`: đọc cookie/Bearer, verify, từ chối refresh token dùng như access, load user từ DB, chặn `isDeleted`/`status != active`, so `tokenVersion`.
- `authorize(...roles)` dùng `req.user.role` từ DB, không tin JWT/client.
- `requireSelfOrAdmin('userId')` chặn IDOR.
- Route thật: `GET /api/admin/access-check` (PR #15 đã merge).
- Test: 11 RBAC + 14 admin-route + IT-RBAC-IDOR.

#### T4-1-2 — Bảo mật — PARTIAL

Có:

- `authLimiter` (memory store, 20 req/15 phút mặc định, 429 format thống nhất) gắn cho register/login/refresh/logout.
- CSRF như T2-1-3.
- Cookie `Secure` theo `NODE_ENV=production`.

Thiếu:

- `trust proxy`: **0 occurrence** trong toàn bộ `src/` của target. Hệ quả: sau reverse proxy, `req.ip` là IP proxy → mọi client chung một bucket rate limit (nguy cơ 429 toàn hệ thống) và log IP sai.
- PR6 có implementation (`configureTrustProxy` opt-in qua `TRUST_PROXY`) + 3 test, nhưng **chưa merge**.
- Staging: **NOT VERIFIED** — không có môi trường deploy, không có log/URL.
- Rate limit memory store: không chia sẻ giữa instance (đã ghi nhận là nợ kỹ thuật).

#### T4-1-3 — Profile API + Change Password — PARTIAL

Đã có trong target (từ `8ea7f97`):

- `GET /api/profile/me`, `GET /api/auth/me`, `GET /api/profile/:userId` (self/admin), `PATCH /api/profile/me`.
- Validator `updateProfileSchema` strict (chỉ name/email), email trùng → 409.
- 12 test profile + IT-PROFILE (đọc/ghi Mongo thật).

Chưa có trong target:

- `PATCH /api/profile/me/password` — **không tồn tại** (`grep "me/password|changePassword"` → 0 kết quả).
- `changePasswordSchema`, `changeMyPassword`, `changePassword` service.
- 10 test change-password.
- Không có integration test change-password trên Mongo thật (V2).

Đánh giá code trên branch PR2 (đọc diff, không checkout): middleware order đúng (`authenticate → csrfProtection → validate`), bcrypt compare/hash 10 rounds, `$inc tokenVersion` nguyên tử, clear cookies, không trả hash. Nhưng **chưa tích hợp → không thể coi là hoàn thành T4-1-3**.

---

## 6. Hardening Task Audit

| Task | Branch | Commit | Implementation | PR | Merged | Test evidence | Status | Ghi chú |
|---|---|---|---|---|---|---|---|---|
| PR1 — RBAC route integration | `feature/T4-1-1-rbac-route-integration` | `75c30db` | admin route + 14 test | #15 | ✅ `952b2f3` | 14 admin-route + 86 regression trên target | **PASS (integrated)** | Đã verify ancestry + test lại trong audit |
| PR2 — Change Password | `feature/T4-1-3-change-password` | `e8e5af3` | route/service/validator/controller + 10 test | ❌ | ❌ | Báo cáo trước: 10/10; audit này **không tái chạy** (code không có trong target) | **BLOCKED** | PR chưa tạo; `e8e5af3` không phải ancestor của target |
| PR4 — Category dependency docs | `feature/T2-2-1-category-dependency-review` | `26b0ac9` | 1 file docs (63 dòng) | ❌ | ❌ | N/A (docs) | **BLOCKED** | Doc ghi base `e8e5af3` (stacked trên PR2); trạng thái T2-2-1 = BLOCKED |
| PR5 — Error hardening | `feature/T5-error-page-hardening` | `6e9063a` | errorHandler + `error.ejs` + 8 test | ❌ | ❌ | Báo cáo trước: 8/8 + 104 regression; không tái chạy | **BLOCKED** | Trong target vẫn lộ message 500 ở production |
| PR6 — Trust proxy | `feature/T4-1-2-trust-proxy-hardening` | `5527481` | `configureTrustProxy` opt-in + 3 test | ❌ | ❌ | Báo cáo trước: 3/3 + 107 regression; không tái chạy | **BLOCKED** | Staging **NOT VERIFIED** |
| PR7 — README + completion report | `docs/phase2-dev1-readme` | `6e4c127`, `223a330` | README 170 dòng + completion report 266 dòng | ❌ | ❌ | N/A (docs) | **BLOCKED** | Completion report tuyên bố PASS cho các task chưa merge |
| Main synchronization | — | — | Chưa thực hiện | — | — | — | **NOT STARTED** | `main` cách 17 commit |
| Release gate | — | — | Chưa thực hiện | — | — | — | **BLOCKED** | Thiếu 5 PR + sync + verification |

### 6.1. Phát hiện quan trọng về stacked branches

PR4, PR5, PR6, PR7 đều stack lên nhau và lấy `feature/post-phase2-hardening` làm base. Diff so với target hiện tại:

| Branch | Diff vs target | Nội dung thực chất của riêng task |
|---|---|---|
| PR4 (`26b0ac9`) | 8 files, +409/−8 | 1 file docs (phần còn lại là PR2) |
| PR5 (`6e9063a`) | 11 files, +629/−12 | errorHandler + error.ejs + 8 test |
| PR6 (`5527481`) | 13 files, +770/−12 | app.js trust proxy + 3 test |
| PR7 (`223a330`) | 15 files, +1206/−12 | README + completion report (+ toàn bộ stack) |

Hệ quả: nếu tạo PR4–PR7 với base = target **trước khi** PR2 merge, GitHub sẽ hiển thị toàn bộ commit của các PR trước. Phải tạo/merge **tuần tự** PR2 → PR4 → PR5 → PR6 → PR7 (hoặc đổi base tạm sang branch trước).

---

## 7. Unit Test Results

### 7.1. Kết quả chạy thực tế trong audit

| Lệnh | Exit | Pass | Fail | Skip | Thời gian | Ghi chú |
|---|---:|---:|---:|---:|---:|---|
| `npm test` | 0 | **86** | 0 | 0 | 3.62 s | Trên target `952b2f3` |
| `node --test test/auth.change-password.test.js` | **NOT RUN** | — | — | — | — | File không tồn tại trong target |
| `npm run test:jest` | 1 | 0 | **7** | 0 | 73.9 s | 2/2 suite fail |

### 7.2. Phân bổ 86 test (đếm theo file)

| File | Test |
|---|---:|
| `test/auth.register.test.js` | 9 |
| `test/auth.login.test.js` | 9 |
| `test/auth.refresh-logout.test.js` | 9 |
| `test/auth.rbac.test.js` | 11 |
| `test/auth.csrf.test.js` | 7 |
| `test/auth.profile.test.js` | 12 |
| `test/auth.rate-limit.test.js` | 3 |
| `test/auth.admin-route.test.js` | 14 |
| `test/user.model.test.js` | 12 |
| **Tổng** | **86** |

### 7.3. Test chưa chạy được

| Test | Lý do | Điều kiện chạy lại |
|---|---|---|
| Change password (10) | Code chưa merge | Sau khi merge PR2 |
| Error handler (8) | Code chưa merge | Sau khi merge PR5 |
| Trust proxy (3) | Code chưa merge | Sau khi merge PR6 |
| Toàn bộ Jest (7) | Lỗi driver khi connect trong Jest | Xử lý V1 hoặc quyết định bỏ Jest |

---

## 8. Integration Test Results

| Lệnh | Exit | Pass | Fail | Skip | Database | Ghi chú |
|---|---:|---:|---:|---:|---|---|
| `npm run test:integration` | 0 | **12** | 0 | 0 | `abmt_shop_test` (đã xác minh **chỉ tên DB**, không in URI) | Trên target `952b2f3` |

Case bao phủ (11 Mongo thật + 1 rate limit):

- IT-REGISTER, IT-UNIQUE, IT-SCHEMA, IT-LOGIN, IT-REFRESH, IT-CSRF, IT-LOGOUT, IT-RBAC-IDOR, IT-PROFILE, IT-SOFT-DELETE, IT-COOKIE, IT-RATE-LIMIT.

Không bao phủ:

- **Change password** (không có case) → V2.
- Category/Product (chưa có trong target).
- Error handler HTML page.
- Trust proxy sau reverse proxy thật.

An toàn dữ liệu: test đọc `TEST_MONGODB_URI`, từ chối DB không chứa chữ "test", không dùng `MONGODB_URI` production. Đã kiểm tra tên DB = `abmt_shop_test`.

---

## 9. Staging Verification

**NOT VERIFIED.**

- Không tìm thấy URL staging, deployment config, hay log truy cập trong repo.
- Không có bằng chứng `X-Forwarded-For`/proxy hop thực tế.
- Không có bằng chứng cookie `Secure` hoạt động sau TLS termination thật.
- PR6 mới chỉ có test trên mini-app/Express trong unit test.
- Kết luận: toàn bộ hành vi sau reverse proxy (rate limit IP, cookie Secure, CSRF Origin) **chưa được chứng minh trên môi trường thật**.

---

## 10. V1 / V2 / V3 / V4 Results

### V1 — Jest diagnosis — **NOT VERIFIED (đã tái hiện lỗi)**

| Hạng mục | Kết quả |
|---|---|
| Lệnh | `npm run test:jest` |
| Kết quả | 2/2 suite fail, 7/7 test fail, exit 1 (>70 s) |
| Lỗi | `MongooseServerSelectionError: Missing required sub-document 'driver' in the client metadata document` |
| Vị trí | `tests/setup.js:36` (`mongoose.connect`) |
| Phiên bản | Node v24.14.0, mongoose 9.12.0, mongodb 7.8.0, jest 30.5.2 |
| Kiểm tra đối chứng | `node -e "mongoose.connect(process.env.MONGODB_URI_TEST)"` → **OK, db=abmt_shop_test** |
| Kết luận sơ bộ | Không phải lỗi URI/DB/server; lỗi **đặc thù môi trường Jest** (vm/context của Jest + driver) |
| Báo cáo chẩn đoán | **KHÔNG CÓ** |
| Nguyên nhân gốc | **CHƯA XÁC ĐỊNH** (không tìm thấy message trong `node_modules/mongodb` → lỗi phía server/handshake) |
| Hành động | Không sửa gì; cần branch `chore/V1-jest-diagnosis` + quyết định của Lead |

### V2 — Change-password MongoDB integration — **NOT VERIFIED**

- Không có case change-password trong `test/integration/`.
- Bằng chứng duy nhất là 10 test HTTP dùng **fake User model** → không chứng minh persistence.
- Không chứng minh: hash lưu vào Mongo, `tokenVersion` tăng trong DB, refresh token cũ bị 401, user khác không bị ảnh hưởng, cleanup.
- Trạng thái: **NOT VERIFIED**, cần branch `test/V2-change-password-mongo-integration`.

### V3 — Trust proxy staging — **NOT VERIFIED**

- Không có staging.
- Không có cấu hình `TRUST_PROXY` trong target (PR6 chưa merge).
- Không có bằng chứng proxy chain.
- Trạng thái: **NOT VERIFIED** — phải giữ nguyên, không được đánh dấu PASS.

### V4 — Test environment consistency — **NOT STARTED (đã xác nhận lỗi cấu hình)**

| Nguồn | Biến đọc | Giá trị mẫu |
|---|---|---|
| `test/integration/mongodb.integration.test.js:27` | `TEST_MONGODB_URI` | fallback `mongodb://127.0.0.1:27017/abmt_shop_test` |
| `tests/setup.js:10` (Jest) | **`MONGODB_URI_TEST`** | bắt buộc, throw nếu thiếu |
| `.env.test.example` | **`MONGODB_URI_TEST`** | `.../urbanminimal_test` |

Phát hiện:

1. **Hai tên biến khác nhau** cho cùng mục đích (`TEST_MONGODB_URI` vs `MONGODB_URI_TEST`).
2. File mẫu chỉ document `MONGODB_URI_TEST` → người mới clone có thể chạy integration mà **không có** `TEST_MONGODB_URI`; test sẽ **âm thầm fallback** về localhost `abmt_shop_test` thay vì fail-fast.
3. Tên DB mẫu (`urbanminimal_test`) khác DB thực dùng (`abmt_shop_test`).
4. `.env.test` local hiện có **cả hai** biến → chỉ che lỗi cấu hình, không sửa gốc.
5. Không có rủi ro trỏ nhầm production (fallback là localhost + kiểm tra tên chứa "test"), nhưng thiếu fail-fast là lỗi DoD.
6. Chưa có branch/commit sửa → **NOT STARTED**.

---

## 11. Category Dependency Verification

### 11.1. Phần Dev 2 đã bàn giao (trên `origin/main`)

Từ PR #10, #17, #18 (đã merge vào `main`):

| Tiêu chí | Bằng chứng | Trạng thái |
|---|---|---|
| Category schema tồn tại | `origin/main:src/model/Category.js` | ✅ |
| Slug unique | `slug: { unique: true }` + pre-validate slugify | ✅ |
| Soft-delete | `isDeleted`, `deletedAt` + transform ẩn | ✅ |
| Parent/child | `parentId` ref `Category`, chặn self-parent, index `{parentId, order}` | ✅ |
| Product ref Category | `category: { ref: 'Category', required: true }` | ✅ |
| Index `{category, basePrice}` | `productSchema.index({ category: 1, basePrice: 1 })` | ✅ |
| API CRUD + tree | `src/routes/category.route.js` + `CategoryController` + `categoryService` | ✅ |
| Admin guard Category | `requireAdmin` (middleware riêng của main) | ✅ (khác convention `authorize` của Dev 1) |
| Index seed | PR #17 (`feature/T2-2-2-index-seed`) | ✅ (chưa kiểm chứng nội dung) |
| Populate hoạt động | **Chưa có test chạy trong audit** | **NOT VERIFIED** |
| Integration test catalog | `test/integration/catalog.integration.test.js` tồn tại trên main | **Chưa chạy** |

### 11.2. Phần Dev 1 cần verify

- Category **chưa có trong target** `952b2f3` → mọi tiêu chí T2-2-1 vẫn **BLOCKED ở góc độ tích hợp**.
- Báo cáo PR4 (`T2-2-1_CATEGORY_DEPENDENCY_REVIEW.md`) ghi `Final status: BLOCKED` và base `e8e5af3`; nội dung đúng tại thời điểm viết, nhưng **đã lạc hậu** so với `main` hiện tại (Dev 2 đã bàn giao).
- Không được sửa schema/model của Dev 2. Không đánh dấu T2-2-1 PASS.

**Kết luận:** T2-2-1 (Dev 1 verification) = **BLOCKED**, chuyển sang `test/T2-2-1-category-dependency-verification` chỉ sau khi sync `main`.

---

## 12. Documentation Audit

| Tài liệu | Vị trí | Trạng thái | Đánh giá |
|---|---|---|---|
| `POST_PHASE2_HARDENING_REPORT.md` | target (tracked) | Có | Mô tả hardening T2-1-3/User schema/integration; số liệu test tương ứng thời điểm cũ. Không tuyên bố toàn bộ Phase 2 xong. |
| `PHASE2_DEV1_BAO_CAO_2026-11-15.md` | untracked (bảo vệ) | Có | Báo cáo gốc; không đụng. |
| `FINAL_SECURITY_CLEANUP_REPORT.md` | untracked (bảo vệ) | Có | Không đụng. |
| `PHASE2_DEV1_PR1_INVESTIGATION_REPORT.md` | branch `docs/...-pr1-investigation` (`dd3e6cd`) | Đã commit + push | Chính xác, có push; **PR #19 mở sai base**. |
| `PHASE2_DEV1_PR1_CLOSEOUT_REPORT.md` | untracked | Có | Chưa commit (đúng yêu cầu). |
| `PHASE2_DEV1_PR2_PREFLIGHT_REPORT.md` | untracked | Có | Đầy đủ, khớp diff thực tế. |
| `PHASE2_DEV1_PR2_GITHUB_GATE_REPORT.md` | untracked | Có | Ghi đúng gate + phát hiện PR #19. |
| `PHASE2_DEV1_MASTER_PROGRESS.md` | untracked | Có | Checkpoint; chưa cập nhật sau audit này (theo yêu cầu không sửa file khác). |
| `T2-2-1_CATEGORY_DEPENDENCY_REVIEW.md` | branch PR4 | Có | Nội dung đúng thời điểm; đã lạc hậu (main có Category). |
| `PHASE2_DEV1_COMPLETION_REPORT.md` | branch PR7 | Có (266 dòng) | **Rủi ro**: tuyên bố PASS cho T4-1-3 change password, T5, T4-1-2 trust proxy khi các PR **chưa merge**. Số test 107 khớp đếm trên branch (14+10+7+9+12+3+11+9+9+8+3+12 = 107) nhưng là **test trên branch, không phải target**. Phải bổ sung caveat hoặc chỉ merge sau khi tích hợp. |
| `README.md` | branch PR7 | Có (170 dòng) | Chưa kiểm chứng từng câu; chưa merge. |
| `POST_PHASE2_HARDENING_BACKLOG.md` | — | **KHÔNG CÓ** | NO EVIDENCE FOUND |
| `PHASE2_DEV1_DECISION_LOG.md` | — | **KHÔNG CÓ** | NO EVIDENCE FOUND |
| `PHASE2_DEV1_FINAL_INTEGRATION_REPORT.md` | — | **KHÔNG CÓ** | NO EVIDENCE FOUND |

Ghi chú: completion report (PR7) tự ghi "Không tuyên bố Phase 2 hoàn thành 100%", nhưng bảng trạng thái dùng PASS cho các mục chưa tích hợp → dễ gây hiểu nhầm khi đọc rời. Cần sửa thành "PASS trên branch (chưa tích hợp)" trước khi merge.

---

## 13. Blockers

| # | Blocker | Ảnh hưởng |
|---|---|---|
| B-01 | PR2 chưa tồn tại/merge | Chặn toàn bộ chuỗi PR4–PR7, chặn T4-1-3 DoD |
| B-02 | PR4–PR7 chưa tạo/merge | Chặn hardening integration |
| B-03 | PR #19 sai base (`main`) và `dirty` | Nguy cơ merge docs + PR1 vào `main` ngoài luồng |
| B-04 | `main` chưa sync (17 commit) | Chặn Category verification, chặn release |
| B-05 | Không có staging | V3 không thể PASS |
| B-06 | Jest hỏng trong môi trường hiện tại | CI gate nếu dùng Jest sẽ đỏ |
| B-07 | Không có integration test change-password | V2 không thể PASS |
| B-08 | `.env.test.example` không khớp code | V4 DoD fail |

---

## 14. Missing Work

Xem bảng ưu tiên ở mục 17. Tóm tắt theo loại:

| Loại | Thiếu |
|---|---|
| Tích hợp | PR2, PR4, PR5, PR6, PR7 chưa merge; `main` chưa sync |
| Verification | V1 (chẩn đoán Jest), V2 (change-password Mongo), V3 (staging), V4 (env var) |
| Dependency | Category verification sau sync |
| Code hardening | helmet/compression/body limit (T2-1-1), HTML error page + che message 500 (T2-1-2 trong target), trust proxy (T4-1-2 trong target) |
| Tài liệu | Backlog, decision log, final integration report, release gate |
| Quy trình | PR #19 base; local branch `feature/T2-1-3-env-test-integration` gây nhầm |

---

## 15. Risk Assessment

| Rủi ro | Mức | Chi tiết | Giảm thiểu |
|---|---|---|---|
| Sync `main` conflict | **Cao** | `routes/index.js` (admin vs categories), `app.js` (health + trust proxy), `package.json` (union scripts/deps), `Products.js` (bản Dev2) | Merge trên branch riêng, giữ cả admin route + categories + health + trust proxy; lấy Products/Category của main |
| Rate limit sau proxy | **Cao** | Không có trust proxy → mọi client chung IP proxy → 429 toàn hệ thống; log IP sai | Merge PR6 + cấu hình `TRUST_PROXY` đúng hop |
| Lộ thông tin lỗi 500 | **Trung bình-Cao** | Target trả `error.message` cho 5xx ở production | Merge PR5 |
| PR #19 merge nhầm vào main | **Trung bình** | Base `main`, chứa PR1 + docs, `dirty` | Đổi base sang target hoặc đóng PR |
| Stacked PR hiển thị sai diff | **Trung bình** | PR4–PR7 kéo theo PR trước | Merge tuần tự, không squash |
| Jest đỏ trong CI | **Trung bình** | 7/7 fail do handshake | V1 diagnosis + quyết định runner |
| V4 fallback âm thầm | **Trung bình** | Thiếu `TEST_MONGODB_URI` vẫn chạy nhờ default localhost | Fail-fast + thống nhất tên biến |
| Completion report gây hiểu nhầm | **Thấp-Trung bình** | PASS cho phần chưa merge | Sửa wording trước khi merge PR7 |
| Trùng lặp `server.js`/`app.js` | **Thấp** | mount routes 2 lần, cấu hình view 2 lần | Backlog B4 |
| `authLimiter` áp cho refresh/logout | **Thấp** | 20 req/15 phút có thể chặn refresh hợp lệ | Cân nhắc limiter riêng cho refresh |

---

## 16. Final Completion Decision

### A. WBS Completion — **CHƯA ĐẠT**

- 5/9 task PASS (T2-1-3, T3-1-1, T3-1-2, T3-1-3, T4-1-1).
- 4/9 task PARTIAL (T2-1-1, T2-1-2, T4-1-2, T4-1-3).
- Lý do chính: T4-1-3 thiếu change password trong target; T4-1-2 thiếu trust proxy; T2-1-2 thiếu HTML/production sanitization; T2-1-1 thiếu hardening cơ bản.

### B. Integration Completion — **CHƯA ĐẠT**

- Chỉ PR1 được tích hợp.
- PR2, PR4, PR5, PR6, PR7 chưa merge.
- `main` chưa sync.
- T4-1-3, T4-1-2, T2-1-2 ở target vẫn là bản cũ.

### C. Verification Completion — **CHƯA ĐẠT**

- Unit 86/86 và integration 12/12 trên target: tốt, nhưng chỉ phủ phần đã merge.
- Jest: fail toàn bộ.
- V2, V3, V4: chưa có bằng chứng.
- Category: BLOCKED.

### Kết luận

> **`PHASE 2 DEV 1 NOT COMPLETE`**
>
> Không có blocker kỹ thuật không thể giải quyết; nhưng theo đúng quy tắc DoD (code + tích hợp + test trên target + verification), Dev 1 chưa hoàn thành Phase 2. Chỉ được tuyên bố hoàn thành sau khi: PR2–PR7 merge, `main` sync, V2/V4 có bằng chứng, V1 có kết luận, Category verify xong, và release gate có approval.

---

## 17. Recommended Next Actions

| Priority | Task | Missing work | Dependency | Recommended branch | Acceptance criteria |
|---|---|---|---|---|---|
| **P0** | PR2 — Change Password | Tạo PR (base `feature/post-phase2-hardening`), review, merge, chạy lại `npm test` + `npm run test:integration` trên target | — | `feature/T4-1-3-change-password` (đã có, `e8e5af3`) | PR merge commit; 96/96 unit + 12/12 integration trên target; `e8e5af3` là ancestor |
| **P0** | PR #19 base | Đổi base `main` → `feature/post-phase2-hardening` hoặc đóng PR | Quyết định người dùng | `docs/phase2-dev1-pr1-investigation` | Diff chỉ còn 1 file docs; không `dirty` |
| **P0** | PR4 — Category dependency docs | Tạo PR sau PR2, merge, verify | PR2 | `feature/T2-2-1-category-dependency-review` | Diff chỉ 1 file docs; không PASS T2-2-1 |
| **P0** | PR5 — Error hardening | Tạo PR sau PR4, merge, test trên target | PR4 | `feature/T5-error-page-hardening` | 8 test + regression pass; HTML page + 500 sanitize có trên target |
| **P0** | PR6 — Trust proxy | Tạo PR sau PR5, merge, test trên target | PR5 | `feature/T4-1-2-trust-proxy-hardening` | 3 test pass; `TRUST_PROXY` opt-in có trên target |
| **P0** | PR7 — Docs | Sửa wording PASS → "PASS trên branch" nếu cần; tạo PR sau PR6 | PR6 | `docs/phase2-dev1-readme` | README + completion report khớp trạng thái thật |
| **P0** | Main sync | Tạo branch sync, `git merge --no-ff origin/main`, giải quyết 4 conflict, test | PR7 merged + approval | `chore/sync-main-into-post-phase2-hardening` | Giữ admin + categories + health + trust proxy; lấy model Dev2; 100% test pass trên target |
| **P1** | V2 — Change-password Mongo integration | Viết integration test Mongo thật (11 case) | PR2 merged | `test/V2-change-password-mongo-integration` | ≥11 case pass trên `abmt_shop_test`; hash + tokenVersion đọc từ DB; refresh cũ 401 |
| **P1** | V4 — Env var consistency | Thống nhất tên biến, sửa `.env.test.example`, fail-fast | Sync (hoặc độc lập) | `fix/V4-test-env-variable-consistency` | Thiếu biến → fail rõ ràng; không silent fallback; example khớp tên DB |
| **P1** | V1 — Jest diagnosis | Minimal repro, xác định nguyên nhân, đề xuất 2 phương án | Không | `chore/V1-jest-diagnosis` | Có báo cáo nguyên nhân + quyết định Lead |
| **P1** | V3 — Trust proxy staging | Kiểm tra staging thật hoặc ghi NOT VERIFIED + checklist | PR6 + hạ tầng | `test/V3-trust-proxy-staging-verification` | Có log/URL staging hoặc NOT VERIFIED rõ ràng |
| **P1** | Category verification | Chạy test model/populate/soft-delete/index trên `abmt_shop_test` | Sync | `test/T2-2-1-category-dependency-verification` | 12 tiêu chí có bằng chứng; chỉ khi đó BLOCKED → PASS |
| **P2** | T2-1-1 hardening | helmet, compression, body limit tường minh; xác nhận session N/A | Không | `chore/T2-1-1-foundation-hardening` | Header bảo mật có test; body limit cấu hình |
| **P2** | Backlog / Decision log / Final report | Soạn 3 tài liệu | Sync + verification | `docs/phase2-dev1-release-documentation` | 3 file đúng trạng thái; PENDING cho quyết định chưa có |
| **P2** | Release gate | Checklist gate + approval | Tất cả P0/P1 | — | Gate READY/BLOCKED có bằng chứng; không tự release |
| **P2** | Cleanup branch alias | Xử lý `feature/T2-1-3-env-test-integration` (không upstream, trùng `e8e5af3`) | — | — | Không còn branch gây nhầm; **không xoá** nếu chưa được phép |
| **P2** | B4 duplication | Hợp nhất `server.js`/`app.js` | Sync | `chore/B4-server-app-dedup` | Mount route 1 lần; test pass |

---

## 18. Evidence Index

| Bằng chứng | Giá trị |
|---|---|
| Target HEAD | `952b2f31cb1669e653eaf5ec9acd343377acfb04` |
| `origin/main` | `8a3865cd3444accba70c340290a35db81687b8fc` |
| PR1 commit | `75c30db7f727aa9741593f90a5ba214562b37cf2` |
| PR1 merge | `952b2f31cb1669e653eaf5ec9acd343377acfb04` (#15) |
| PR2 head | `e8e5af354e228747b92da20a72d8b9c6d1482723` (chưa merge) |
| PR4 head | `26b0ac9c55d2604e517e6324016d0ca2f3dc4330` (chưa merge) |
| PR5 head | `6e9063a6f55d1eb85853abda801a56417935d465` (chưa merge) |
| PR6 head | `55274810cdd2174a09b8046abd40f099f52d81ba` (chưa merge) |
| PR7 head | `223a3307af34bc234c1188b99709b684ab295dae` (chưa merge) |
| Docs PR1 | `dd3e6cda278a1e5a960dcdf079e0957dcc0c840c` |
| PR #19 | open, base `main`, `mergeable_state = dirty` |
| `npm test` | 86 pass / 0 fail / 0 skip |
| `npm run test:integration` | 12 pass / 0 fail / 0 skip, `abmt_shop_test` |
| `npm run test:jest` | 7 fail / 2 suites fail |
| Secret scan | Placeholder-only trong `.env.example`, `.env.test.example`; không có credential thật trong tracked files |
| Working tree | Không có tracked change; 6 untracked (2 bảo vệ) |

---

## 19. Audit Limitations

- Không chạy test trên các branch PR2/PR5/PR6/PR7 (tránh checkout làm thay đổi working tree). Số liệu 10/8/3 test của các branch là **báo cáo trước đó**, không tái xác minh.
- Không đọc được CI checks/review status chi tiết qua API công khai → CI **NOT VERIFIED**.
- Không có quyền truy cập staging → V3 **NOT VERIFIED**.
- Không đọc WBS gốc ngoài repo; phạm vi theo master prompt.
- Không kiểm tra nội dung nhị phân/xlsx; không chạy seed/migration.
- Không đọc giá trị `.env*`; chỉ đọc tên biến và tên database.
- Không kết luận về Cart/Order/Review/Category implementation chất lượng — chỉ đối chiếu sự tồn tại phục vụ dependency.
