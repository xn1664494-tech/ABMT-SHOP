# PHASE 2 — DEV 1 COMPLETION REPORT (ABMT Shop)

- **Ngày hoàn tất:** 2026-11-17 — **cập nhật trạng thái tích hợp:** 2026-11-18, **19 (sync main + đóng gap V1/V2/V4 + verify Category)**
- **Phạm vi:** Hoàn thiện các phần còn thiếu của Dev 1 trong Phase 2 trên cơ sở báo cáo `docs/reports/PHASE2_DEV1_BAO_CAO_2026-11-15.md` + WBS `docs/ABMT_Phan_chia_cong_viec.xlsx` (sheet `02_WBS`).
- **Chiến lược Git:** Stacked branches, mỗi task một branch riêng; không merge vào `main`/`develop`; không force-push/reset/clean/restore; không xoá branch/commit/reflog.
- **Branch nền xác minh:** `feature/post-phase2-hardening` — hiện tại `f6fbc23` (đã gồm `main` @ `66f3224` và PR #15, #19, #20, #22, #23, #24, #25, #26, #27, #28, #29).

> Báo cáo KHÔNG tuyên bố Phase 2 hoàn thành 100%: còn 1 task **PARTIAL** (T4-1-2 thiếu vế "quên mật khẩu"), 1 hạng mục **BLOCKED** thuộc Dev 2 (Category CSRF + test `category.api`), và **V3 (staging) NOT VERIFIED**.
>
> **Quy ước trạng thái:** `PASS` = đã là ancestor của `feature/post-phase2-hardening` và test trên target xanh; `PASS ON BRANCH` = đã chạy xanh trên branch nhưng **chưa** tích hợp; `NOT VERIFIED` = chưa có môi trường/bằng chứng.
>
> **Phạm vi WBS:** `T2-1-1`, `T2-1-2`, `T2-1-3` là **Phase 1**, không tính vào % hoàn thành Phase 2. Phase 2 của Dev 1 gồm 6 task: `T3-1-1`, `T3-1-2`, `T3-1-3`, `T4-1-1`, `T4-1-2`, `T4-1-3`. T5/trust proxy/README là **hardening ngoài WBS**.

---

## 1. Kết quả tổng hợp

| # | Task | Nội dung | Trạng thái | Branch | Commit |
|---|---|---|---|---|---|
| 1 | T4-1-1 | RBAC/IDOR trên route thật | **PASS** (merge `952b2f3`, PR #15) | `feature/T4-1-1-rbac-route-integration` | `75c30db7f727aa9741593f90a5ba214562b37cf2` |
| 2 | T4-1-3 | API đổi mật khẩu | **PASS** (merge `b4be920`, PR #20) | `feature/T4-1-3-change-password` | `e8e5af354e228747b92da20a72d8b9c6d1482723` |
| 3 | T2-1-3 | `.env.test` + integration MongoDB thật | **Phase 1 — dependency readiness** (không tính % Phase 2) | `feature/T2-1-3-env-test-integration` | Không có commit (`.env.test` local, gitignored) |
| 4 | T2-2-1 | Category model dependency | **BLOCKED** (thuộc Dev 2) | `feature/T2-2-1-category-dependency-review` | `26b0ac9c55d2604e517e6324016d0ca2f3dc4330` |
| 5 | T5 | Error handling hardening (ngoài WBS) | **PASS** (merge `3b790ca`, PR #23) | `feature/T5-error-page-hardening` | `6e9063a6f55d1eb85853abda801a56417935d465` |
| 6 | T4-1-2 | Trust proxy hardening (ngoài WBS) | **PASS** (merge `101c990`, PR #24) | `feature/T4-1-2-trust-proxy-hardening` | `55274810cdd2174a09b8046abd40f099f52d81ba` |
| 7 | T7 | README/tài liệu | **PASS** (merge `7d888d9`, PR #25) | `docs/phase2-dev1-readme` | `1a5fb6f` |
| 8 | V1 | Jest VM modules | **PASS** (merge `491f9a4`, PR #27) | `fix/V1-jest-vm-modules` | `ce40b05` |
| 9 | V4 | Chuẩn hoá `MONGODB_URI_TEST` | **PASS** (merge `7985e9e`, PR #28) | `fix/V4-test-env-consistency` | `4c02e84` |
| 10 | V2 | Integration MongoDB thật cho đổi mật khẩu | **PASS** (merge `f6fbc23`, PR #29) | `test/V2-change-password-integration` | `bff3a5a` |
| 11 | SYNC | Đồng bộ `main` vào nhánh tích hợp | **PASS** (merge `7d55116`, PR #26) | `chore/sync-main-into-post-phase2-hardening` | `13fe39c` |

### 6 task chính (Dev 1 Phase 2)

| Task | Trạng thái | Ghi chú |
|---|---|---|
| T3-1-1 Register | PASS (giữ nguyên) | Đã PASS trước Phase 2 hardening; không viết lại. |
| T3-1-2 JWT Cookie Login | PASS (giữ nguyên) | Đã PASS; cookie `HttpOnly` được kiểm thử. |
| T3-1-3 Logout/Refresh | PASS (giữ nguyên) | Đã PASS; rotation/replay được kiểm thử. |
| T4-1-1 RBAC/IDOR | **PASS** | Task 1 — `authorize('admin')` gắn route thật + IDOR. |
| T4-1-2 Rate Limit/CSRF | **PARTIAL** (rate limit + CSRF PASS trên target) | Task 6 bổ sung trust proxy; memory store vẫn là nợ kỹ thuật; **vế "quên mật khẩu" chưa có endpoint** → chưa đạt đủ DoD WBS. |
| T4-1-3 Profile API | **PASS** (merge `b4be920`, PR #20) | Task 2 — xem/cập nhật hồ sơ + đổi mật khẩu; 10 test change-password + 12 integration MongoDB thật (V2) + regression xanh trên target. |

### 3 công việc nền tảng

| Task | Trạng thái | Ghi chú |
|---|---|---|
| T2-1-2 Restore Foundation | PASS (giữ nguyên) | Error handler/404/AppError đã có. |
| T2-1-3 Validate & CSRF | **PASS** | Zod validate + CSRF đã có; Task 3 xác minh môi trường test. |
| T2-2-1 User Schema | PASS một phần (User do Dev 1), **BLOCKED** phần Category | Category thuộc Dev 2 theo WBS row 17. |

---

## 2. Chi tiết từng task

### TASK 1 — T4-1-1 RBAC / IDOR (PASS)

- **Branch:** `feature/T4-1-1-rbac-route-integration`
- **Parent:** `feature/post-phase2-hardening`
- **Base commit:** `aa2f414a9d4e0b795af290ddc64e62e2e19c7227`
- **Commit mới:** `75c30db7f727aa9741593f90a5ba214562b37cf2`
- **Remote:** `origin/feature/T4-1-1-rbac-route-integration` (cùng SHA, đã xác minh)
- **Files created:** `src/routes/admin.route.js`, `test/auth.admin-route.test.js`
- **Files changed:** `src/routes/index.js`, `package.json`
- **Implementation summary:** thêm `GET /api/admin/access-check` với `authenticate` + `authorize('admin')`; quyền lấy từ User trong DB, không tin role trong JWT/client; kiểm thử IDOR trên `GET /api/profile/:userId`.
- **Tests executed:** `node --test test/auth.admin-route.test.js`; `npm test`
- **Tests PASS:** 14 (admin route) + 86 (regression) / **FAIL:** 0 / **SKIP:** 0
- **MongoDB real integration:** NO (HTTP test dùng fake model; integration thật ở TASK 3)
- **Security review:** 401/403/200 đúng; token giả role admin bị chặn; blocked/soft-deleted bị chặn; refresh token không dùng như access token; tokenVersion lệch bị thu hồi. Không thêm Admin CRUD ngoài scope.
- **Final status:** **PASS**

### TASK 2 — T4-1-3 API đổi mật khẩu (PASS)

- **Branch:** `feature/T4-1-3-change-password`
- **Parent:** `feature/T4-1-1-rbac-route-integration`
- **Base commit:** `75c30db7f727aa9741593f90a5ba214562b37cf2`
- **Commit mới:** `e8e5af354e228747b92da20a72d8b9c6d1482723`
- **Remote:** `origin/feature/T4-1-3-change-password` (cùng SHA, đã xác minh)
- **DoD xác minh:** WBS `02_WBS` row 40 (T4-1-3) yêu cầu "Xem, cập nhật hồ sơ, **đổi mật khẩu** (không trả trường mật khẩu)" → trong scope Dev 1.
- **Files changed:** `src/validators/authValidator.js`, `src/services/profileService.js`, `src/controllers/profileController.js`, `src/routes/profile.route.js`, `test/support/fakeUserModel.js`, `package.json`
- **Files created:** `test/auth.change-password.test.js`
- **Implementation summary:** `PATCH /api/profile/me/password` với `authenticate` + `csrfProtection` + Zod; xác minh `currentPassword` bằng bcrypt; hash `newPassword`; tăng `tokenVersion`; xoá auth cookies; không trả password/hash.
- **Tests executed:** `node --test test/auth.change-password.test.js`; `npm test`
- **Tests PASS:** 10 (change password) + 96 (regression) / **FAIL:** 0 / **SKIP:** 0
- **MongoDB real integration:** NO (HTTP test dùng fake model)
- **Security review:** 401 khi chưa đăng nhập; 403 khi thiếu/sai CSRF; 401 khi sai mật khẩu hiện tại; 400 khi mật khẩu mới không hợp lệ/trùng mật khẩu cũ/field ngoài scope; 200 khi thành công; DB lưu bcrypt hash; tokenVersion tăng; token cũ 401; login mật khẩu cũ fail, mật khẩu mới thành công.
- **Remaining issues:** không hỗ trợ `confirmPassword` vì API hiện tại dùng convention body tối giản (`currentPassword`, `newPassword`); có thể bổ sung nếu UI yêu cầu.
- **Final status:** **PASS**

### TASK 3 — T2-1-3 `.env.test` + Integration MongoDB thật (PASS)

- **Branch:** `feature/T2-1-3-env-test-integration`
- **Parent:** `feature/T4-1-3-change-password`
- **Base commit:** `e8e5af354e228747b92da20a72d8b9c6d1482723`
- **Commit mới:** không có (không thay đổi file được track; `.env.test` là local-only và đã gitignored)
- **Remote:** không push (không có commit)
- **Files created (local, không commit):** `.env.test` (từ `.env.test.example`, trỏ `mongodb://127.0.0.1:27017/abmt_shop_test`)
- **Files changed:** không
- **Implementation summary:** xác minh đúng cách chạy test; dùng MongoDB local **database test riêng** `abmt_shop_test`; chạy unit + integration thật; không dùng mock thay integration, không đụng DB production.
- **Tests executed:** `npm test`; `npm run test:integration`; `npm run test:jest` (xem mục 5)
- **Tests PASS:** Unit **96/96**; Integration MongoDB thật **12/12** (gồm register/unique email, login, refresh rotation/replay, logout, CSRF, RBAC/IDOR, profile, soft delete, cookie không lộ; + rate limit 429)
- **Tests FAIL:** 0 (node:test) / **SKIP:** 0
- **MongoDB real integration verified:** **YES** (`test/integration/mongodb.integration.test.js` chạy trên `abmt_shop_test`, dữ liệu test được dọn theo prefix).
- **Security review:** `.env.test` không commit; URI test local, không chứa secret; không chạm Atlas/production; test chỉ xoá dữ liệu do lần chạy tạo.
- **Remaining issues:** Jest chưa xanh trong môi trường hiện tại (chi tiết mục 5).
- **Final status:** **PASS** (phần node:test + integration MongoDB thật), Jest là **chưa xác minh**.

### TASK 4 — T2-2-1 Category Dependency Review (BLOCKED)

- **Branch:** `feature/T2-2-1-category-dependency-review`
- **Parent:** `feature/T2-1-3-env-test-integration`
- **Base commit:** `e8e5af354e228747b92da20a72d8b9c6d1482723`
- **Commit mới:** `26b0ac9c55d2604e517e6324016d0ca2f3dc4330`
- **Remote:** `origin/feature/T2-2-1-category-dependency-review` (cùng SHA, đã xác minh)
- **Files created:** `docs/reports/T2-2-1_CATEGORY_DEPENDENCY_REVIEW.md`
- **Files changed:** không (không sửa code)
- **Implementation summary:** xác minh ownership theo WBS: T2-2-1 (User/Category/Product schema) thuộc **Dev 2**; `src/model/Category.js` không tồn tại trong khi `src/model/Products.js` ref `Category`; ghi báo cáo dependency + đề xuất contract tối thiểu cho Dev 2.
- **Tests executed:** không (không thay đổi code)
- **MongoDB real integration:** N/A
- **Security review:** không sửa schema theo suy đoán; không vượt scope Dev 1.
- **Remaining issues:** cần Dev 2 tạo `Category` model và đồng bộ `Products.js` (kể cả `ValidationError` theo báo cáo Phase 2).
- **Final status:** **BLOCKED**

### TASK 5 — Hardening Error Handling (PASS)

- **Branch:** `feature/T5-error-page-hardening`
- **Parent:** `feature/T2-2-1-category-dependency-review`
- **Base commit:** `26b0ac9c55d2604e517e6324016d0ca2f3dc4330`
- **Commit mới:** `6e9063a6f55d1eb85853abda801a56417935d465`
- **Remote:** `origin/feature/T5-error-page-hardening` (cùng SHA, đã xác minh)
- **Files created:** `src/views/error.ejs`, `test/error-handler.test.js`
- **Files changed:** `src/middleware/errorHandler.js`, `package.json`
- **Implementation summary:** render `error.ejs` cho request HTML non-API; giữ JSON cho `/api`; production 500 trả thông báo chung `Lỗi máy chủ nội bộ`, không lộ message/stack; chỉ log tối thiểu ở production; giữ status 400/401/403/404/409.
- **Tests executed:** `node --test test/error-handler.test.js`; `npm test`
- **Tests PASS:** 8 (error handler) + 104 (regression) / **FAIL:** 0 / **SKIP:** 0
- **MongoDB real integration:** NO (không cần cho error handling)
- **Security review:** không lộ `error.message`/stack 500 ở production; không log secret; HTML/JSON phân biệt đúng; không đổi format lỗi 4xx hiện có.
- **Final status:** **PASS** — merge commit `3b790ca` (PR #23); verify trên target: 104/104 unit + 12/12 integration.

### TASK 6 — T4-1-2 Trust Proxy Hardening (PASS)

- **Branch:** `feature/T4-1-2-trust-proxy-hardening`
- **Parent:** `feature/T5-error-page-hardening`
- **Base commit:** `6e9063a6f55d1eb85853abda801a56417935d465`
- **Commit mới:** `55274810cdd2174a09b8046abd40f099f52d81ba`
- **Remote:** `origin/feature/T4-1-2-trust-proxy-hardening` (cùng SHA, đã xác minh)
- **Files changed:** `src/app.js`, `package.json`
- **Files created:** `test/trust-proxy.test.js`
- **Implementation summary:** cấu hình `trust proxy` **opt-in** qua `TRUST_PROXY` (không bật mặc định; số hop hoặc giá trị Express hợp lệ); thêm test cho spoof `X-Forwarded-For` khi không tin proxy, resolve IP/rate-limit key khi tin 1 hop, và rate limit app thật vẫn hoạt động.
- **Tests executed:** `node --test test/trust-proxy.test.js`; `npm test`
- **Tests PASS:** 3 (trust proxy) + 107 (regression) / **FAIL:** 0 / **SKIP:** 0
- **MongoDB real integration:** NO (không cần)
- **Security review:** không tin `X-Forwarded-For` khi không có proxy tin cậy; không bật trust proxy tuỳ tiện; secure cookie vẫn theo `NODE_ENV=production`; memory rate limit giữ nguyên và được ghi nhận là nợ kỹ thuật.
- **Remaining issues:** **Memory Store** không chia sẻ giữa nhiều instance → chưa phải distributed rate limit; chỉ cân nhắc Redis khi có hạ tầng.
- **Final status:** **PASS** — merge commit `101c990` (PR #24); verify trên target: 107/107 unit + 12/12 integration; **staging NOT VERIFIED**.

### TASK 7 — Documentation (PENDING MERGE)

- **Branch:** `docs/phase2-dev1-readme`
- **Parent:** `feature/T4-1-2-trust-proxy-hardening`
- **Base commit:** `55274810cdd2174a09b8046abd40f099f52d81ba`
- **Commit mới:** `6e4c12731064a039215d02e13003a15aa0e20445`
- **Remote:** `origin/docs/phase2-dev1-readme` (cùng SHA, đã xác minh)
- **Files created:** `README.md`
- **Implementation summary:** tài liệu môi trường, cài đặt, `.env`/MongoDB/JWT/CSRF, chạy dev/prod, unit/integration/Jest, `.env.test`, API Auth/Profile hiện có, quy tắc Git branch, cảnh báo bảo mật còn tồn tại. Không ghi secret; không mô tả tính năng chưa có là đã hoàn thành.
- **Tests executed:** `npm test`; `npm run test:integration` (xác nhận tài liệu không ảnh hưởng code)
- **Tests PASS:** 107 unit + 12 integration / **FAIL:** 0 / **SKIP:** 0
- **MongoDB real integration:** YES (12/12)
- **Final status:** **PASS** — merge commit `7d888d9` (PR #25).

---

## 1.1. Verification gaps (cập nhật 2026-11-19)

| Mã | Nội dung | Trạng thái | Ghi chú |
|---|---|---|---|
| V1 | Jest `Missing required sub-document 'driver'` | **CLOSED** (PR #27, `491f9a4`) | Root cause: driver `mongodb@7.8.0` dynamic `import()` trong Jest VM. Fix: `NODE_OPTIONS=--experimental-vm-modules` trong script. Kết quả: **3 suite / 8 test pass**. |
| V2 | Integration MongoDB thật cho change-password | **CLOSED** (PR #29, `f6fbc23`) | 12 case trên `abmt_shop_test`: auth, CSRF, sai mật khẩu, hash bcrypt, `tokenVersion`, thu hồi access/refresh token cũ, user khác không ảnh hưởng. |
| V3 | Staging / hạ tầng thật | **NOT VERIFIED** (blocked) | Không có staging/reverse proxy/CI. Checklist bàn giao ở `PHASE2_DEV1_VERIFICATION_GAPS_V2_V3.md`. |
| V4 | `TEST_MONGODB_URI` vs `MONGODB_URI_TEST` | **CLOSED** (PR #28, `7985e9e`) | Chuẩn `MONGODB_URI_TEST`, fail-fast, legacy có cảnh báo, `.env.test.example` trỏ `abmt_shop_test`. |
| — | Category verification | **VERIFIED 17/18** (Dev 1 verify, ownership Dev 2) | 1 FAIL: route ghi Category thiếu CSRF → xem `PHASE2_DEV1_CATEGORY_VERIFICATION.md`. |
| — | Test `category.api.test.js` (Dev 2) | **FAIL — BLOCKED (Dev 2)** | 2 lỗi test: `{ default: request }` và dùng `t.context` như biến chia sẻ. Đã fail y hệt trên `origin/main` → không phải regression. |

### 1.2. Tỷ lệ hoàn thành Phase 2 (theo WBS, 6 task)

| Cách tính | Kết quả |
|---|---|
| Nghiêm ngặt (PARTIAL = không đạt) | **4/6 = 66.7%** |
| Chấp nhận vế "quên mật khẩu" của T4-1-2 là N/A | **5/6 = 83.3%** |
| 100% | **Chưa đạt** — cần triển khai endpoint quên mật khẩu + có staging để đóng V3 |

---

## 3. File thay đổi (theo task)

| Task | Files |
|---|---|
| 1 | `src/routes/admin.route.js` (new), `test/auth.admin-route.test.js` (new), `src/routes/index.js`, `package.json` |
| 2 | `src/validators/authValidator.js`, `src/services/profileService.js`, `src/controllers/profileController.js`, `src/routes/profile.route.js`, `test/support/fakeUserModel.js`, `test/auth.change-password.test.js` (new), `package.json` |
| 3 | `.env.test` (local-only, gitignored — không commit) |
| 4 | `docs/reports/T2-2-1_CATEGORY_DEPENDENCY_REVIEW.md` (new) |
| 5 | `src/middleware/errorHandler.js`, `src/views/error.ejs` (new), `test/error-handler.test.js` (new), `package.json` |
| 6 | `src/app.js`, `test/trust-proxy.test.js` (new), `package.json` |
| 7 | `README.md` (new) |

---

## 4. Kết quả kiểm thử

### Unit test (`node:test`)

- Lệnh: `npm test`
- Kết quả trên target `f6fbc23`: **165 pass / 16 fail / 0 skip** (tổng 181).
- 16 fail đều thuộc `test/category.api.test.js` (Dev 2) và **đã fail y hệt trên `origin/main`** — không phải regression. Chi tiết: `PHASE2_DEV1_MAIN_SYNC_REPORT.md` §4.1.
- Loại trừ file lỗi của Dev 2: **165/165 pass**.
- Tiến trình tăng test: 86 (TASK 1) → 96 (TASK 2) → 104 (TASK 5) → 107 (TASK 6/7) → 165 (sau sync `main`).

### Integration test MongoDB thật (`node:test`)

- Lệnh: `npm run test:integration`
- DB: `abmt_shop_test`; dữ liệu test dọn theo prefix riêng.
- Kết quả trên target `f6fbc23`: **32 pass / 0 fail / 0 skip**.
- Bao phủ: register + unique email, login, refresh rotation/replay, logout/tokenVersion, CSRF, RBAC/IDOR, profile update thật, soft delete, cookie không lộ, rate limit 429, **catalog/checkout (Dev 2)**, **đổi mật khẩu 12 case (V2)**.

### Jest

- Lệnh: `npm run test:jest` (script đã set `NODE_OPTIONS=--experimental-vm-modules`)
- Kết quả: **3 suite / 8 test pass**, ~4s.

### Seed / index

- `SEED_CONFIRM=1 MONGODB_URI=<test> node scripts/seed.js` → OK (6 category, 6 product, index tạo).
- `npm run test:seed-verify` với DB test → **4/4 pass**.

### Security test

| Nhóm | File | Pass |
|---|---|---:|
| RBAC/IDOR trên route thật | `test/auth.admin-route.test.js` | 14 |
| Đổi mật khẩu an toàn | `test/auth.change-password.test.js` | 10 |
| Error handling/không lộ 500 | `test/error-handler.test.js` | 8 |
| Trust proxy/IP spoof | `test/trust-proxy.test.js` | 3 |

---

## 5. Jest — đã đóng (V1)

- Lệnh: `npm run test:jest` → **3/3 suite, 8/8 test pass** (~4s).
- Nguyên nhân cũ (đã xác định và sửa): driver `mongodb@7.8.0` dùng dynamic `import()`; Jest VM không bật `--experimental-vm-modules` → metadata handshake rỗng → server trả `Missing required sub-document 'driver'`.
- Fix: `package.json` set `NODE_OPTIONS=--experimental-vm-modules` cho `test:jest`/`test:jest:watch`.
- Chi tiết: `PHASE2_DEV1_V1_JEST_DIAGNOSIS.md`.

---

## 6. Dependencies thuộc Dev 2 / Dev 3 / Dev 4

- **Dev 2 (T2-2-1/T3-2-x):** `src/model/Category.js` còn thiếu dù `src/model/Products.js` ref `Category`; cần tạo model/index/validation theo data dictionary, đồng bộ ref và xử lý `ValidationError` trong `Products.js`. Xem `docs/reports/T2-2-1_CATEGORY_DEPENDENCY_REVIEW.md`.
- **Dev 2/3/4:** Cart, Order, Payment, Audit log, Cron, Product/Category API + CRUD, Admin CRUD đầy đủ — **chưa** thuộc phạm vi Dev 1 Phase 2 và không được triển khai trong chuỗi task này.
- **Dev 4:** UI form login/register/profile/đổi mật khẩu; cần bổ sung UI gọi API `PATCH /api/profile/me/password` nếu muốn dùng tính năng đổi mật khẩu trên giao diện.
- **Dev 3:** Trang chủ EJS hiện có; không thay đổi trong chuỗi task này.

---

## 7. Nợ kỹ thuật còn lại

1. **Rate limit Memory Store:** không chia sẻ giữa nhiều instance, reset khi restart → chưa phải distributed rate limiting; chỉ thêm Redis khi có hạ tầng/nhu cầu.
2. **Trust proxy:** đã opt-in qua `TRUST_PROXY`, nhưng chưa xác minh trên môi trường deploy thật (Render/nginx) — cần cấu hình đúng số hop.
3. **Jest toolchain:** đã xanh nhờ cờ VM modules (experimental). Backlog: cân nhắc port 8 test hạ tầng sang `node:test` để bỏ hẳn Jest.
4. **Category/Product (Dev 2):** route ghi Category **thiếu CSRF**; `test/category.api.test.js` hỏng (2 lỗi test); `catalog/checkout` integration còn đọc `TEST_MONGODB_URI`.
5. **Đổi mật khẩu:** chưa có `confirmPassword` (theo convention body tối giản hiện tại); UI Dev 4 cần hiển thị xác nhận nếu muốn.
6. ~~Integration test đổi mật khẩu trên MongoDB thật~~ → **đã đóng ở V2** (12 case).
7. **Không có CI:** 0 check-run; mọi kiểm chứng hiện do agent/người dùng chạy thủ công.
8. **`src/server.js` đã được sửa** để dùng chung `app.js`; cần reviewer xác nhận không có nơi nào khác tạo app riêng.

---

## 8. Những việc chưa thể xác minh

- Hành vi thực tế sau reverse proxy/TLS termination thật (chưa có staging) — **V3**.
- Redis/distributed rate limit (không có hạ tầng, không thêm dependency).
- UI đổi mật khẩu (thuộc Dev 4).
- 16 test `category.api.test.js` (thuộc Dev 2).

---

## 9. Trạng thái các PR (đã merge)

| # | Branch | Merge commit | Base |
|---|---|---|---|
| 15 | `feature/T4-1-1-rbac-route-integration` | `952b2f3` | `feature/post-phase2-hardening` |
| 19 | `docs/phase2-dev1-pr1-investigation` | `54ae102` | `feature/post-phase2-hardening` |
| 20 | `feature/T4-1-3-change-password` | `b4be920` | `feature/post-phase2-hardening` |
| 22 | `feature/T2-2-1-category-dependency-review` | `cfc2b60` | `feature/post-phase2-hardening` |
| 23 | `feature/T5-error-page-hardening` | `3b790ca` | `feature/post-phase2-hardening` |
| 24 | `feature/T4-1-2-trust-proxy-hardening` | `101c990` | `feature/post-phase2-hardening` |
| 25 | `docs/phase2-dev1-readme` | `7d888d9` | `feature/post-phase2-hardening` |
| 26 | `chore/sync-main-into-post-phase2-hardening` | `7d55116` | `feature/post-phase2-hardening` |
| 27 | `fix/V1-jest-vm-modules` | `491f9a4` | `feature/post-phase2-hardening` |
| 28 | `fix/V4-test-env-consistency` | `7985e9e` | `feature/post-phase2-hardening` |
| 29 | `test/V2-change-password-integration` | `f6fbc23` | `feature/post-phase2-hardening` |

> Chưa có PR nào merge vào `main`. PR #21 (`feature/post-phase2-hardening → main`) vẫn để người dùng quyết định.

---

## 10. Kết luận

- **PASS:** T3-1-1, T3-1-2, T3-1-3 (giữ nguyên), T4-1-1, T4-1-3; hardening T5, trust proxy, README.
- **PARTIAL:** T4-1-2 (rate limit + CSRF PASS; thiếu endpoint "quên mật khẩu").
- **Đã đóng:** V1 (Jest), V2 (integration đổi mật khẩu), V4 (env var).
- **BLOCKED (Dev 2):** Category CSRF, test `category.api`, `catalog/checkout` env var.
- **NOT VERIFIED:** V3 (staging).
- Không có thay đổi ngoài scope (không Cart/Order/Audit/Cron/Product CRUD/Admin CRUD/UI), không chạm 2 file báo cáo được bảo vệ, không commit secret/`.env.test`.
