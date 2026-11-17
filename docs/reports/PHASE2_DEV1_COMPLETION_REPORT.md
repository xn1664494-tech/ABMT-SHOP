# PHASE 2 — DEV 1 COMPLETION REPORT (ABMT Shop)

- **Ngày hoàn tất:** 2026-11-17
- **Phạm vi:** Hoàn thiện các phần còn thiếu của Dev 1 trong Phase 2 trên cơ sở báo cáo `docs/reports/PHASE2_DEV1_BAO_CAO_2026-11-15.md` + WBS `docs/ABMT_Phan_chia_cong_viec.xlsx` (sheet `02_WBS`).
- **Chiến lược Git:** Stacked branches, mỗi task một branch riêng; không merge vào `main`/`develop`; không force-push/reset/clean/restore; không xoá branch/commit/reflog.
- **Branch nền xác minh:** `feature/post-phase2-hardening` @ `aa2f414a9d4e0b795af290ddc64e62e2e19c7227` (đã có trên `origin`).

> Báo cáo KHÔNG tuyên bố Phase 2 hoàn thành 100%: còn 1 task **BLOCKED** (Category dependency thuộc Dev 2) và 1 số hạng mục **chưa xác minh** (Jest, proxy thật, Redis).

---

## 1. Kết quả tổng hợp

| # | Task | Nội dung | Trạng thái | Branch | Commit |
|---|---|---|---|---|---|
| 1 | T4-1-1 | RBAC/IDOR trên route thật | **PASS** | `feature/T4-1-1-rbac-route-integration` | `75c30db7f727aa9741593f90a5ba214562b37cf2` |
| 2 | T4-1-3 | API đổi mật khẩu | **PASS** | `feature/T4-1-3-change-password` | `e8e5af354e228747b92da20a72d8b9c6d1482723` |
| 3 | T2-1-3 | `.env.test` + integration MongoDB thật | **PASS** (Code/test không đổi) | `feature/T2-1-3-env-test-integration` | Không có commit (`.env.test` local, gitignored) |
| 4 | T2-2-1 | Category model dependency | **BLOCKED** (thuộc Dev 2) | `feature/T2-2-1-category-dependency-review` | `26b0ac9c55d2604e517e6324016d0ca2f3dc4330` |
| 5 | T5 | Error handling hardening | **PASS** | `feature/T5-error-page-hardening` | `6e9063a6f55d1eb85853abda801a56417935d465` |
| 6 | T4-1-2 | Trust proxy hardening | **PASS** | `feature/T4-1-2-trust-proxy-hardening` | `55274810cdd2174a09b8046abd40f099f52d81ba` |
| 7 | T7 | README/tài liệu | **PASS** | `docs/phase2-dev1-readme` | `6e4c12731064a039215d02e13003a15aa0e20445` |

### 6 task chính (Dev 1 Phase 2)

| Task | Trạng thái | Ghi chú |
|---|---|---|
| T3-1-1 Register | PASS (giữ nguyên) | Đã PASS trước Phase 2 hardening; không viết lại. |
| T3-1-2 JWT Cookie Login | PASS (giữ nguyên) | Đã PASS; cookie `HttpOnly` được kiểm thử. |
| T3-1-3 Logout/Refresh | PASS (giữ nguyên) | Đã PASS; rotation/replay được kiểm thử. |
| T4-1-1 RBAC/IDOR | **PASS** | Task 1 — `authorize('admin')` gắn route thật + IDOR. |
| T4-1-2 Rate Limit/CSRF | **PASS** (một phần hardening) | Task 6 — bổ sung trust proxy; memory store vẫn là nợ kỹ thuật. |
| T4-1-3 Profile API | **PASS** | Task 2 — bổ sung đổi mật khẩu theo DoD WBS. |

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
- **Final status:** **PASS**

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
- **Final status:** **PASS**

### TASK 7 — Documentation (PASS)

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
- **Final status:** **PASS**

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
- Kết quả tại HEAD (sau TASK 7): **107 pass / 0 fail / 0 skip**.
- Các nhóm bao phủ: register, login, refresh/logout, RBAC, CSRF, profile, rate limit, admin route RBAC/IDOR, change password, error handler, trust proxy, User model.
- Tiến trình tăng test: 86 (TASK 1) → 96 (TASK 2) → 104 (TASK 5) → 107 (TASK 6/7).

### Integration test MongoDB thật (`node:test`)

- Lệnh: `npm run test:integration`
- DB: `abmt_shop_test` (local); dữ liệu test dọn theo prefix email.
- Kết quả tại HEAD: **12 pass / 0 fail / 0 skip**.
- Bao phủ: register + unique email, login, refresh rotation/replay, logout/tokenVersion, CSRF, RBAC/IDOR, profile update thật, soft delete, cookie không lộ, rate limit 429.

### Security test

| Nhóm | File | Pass |
|---|---|---:|
| RBAC/IDOR trên route thật | `test/auth.admin-route.test.js` | 14 |
| Đổi mật khẩu an toàn | `test/auth.change-password.test.js` | 10 |
| Error handling/không lộ 500 | `test/error-handler.test.js` | 8 |
| Trust proxy/IP spoof | `test/trust-proxy.test.js` | 3 |

---

## 5. Jest — chưa xác minh (không tính là integration evidence)

- Lệnh: `npm run test:jest`
- Kết quả môi trường hiện tại: **2/2 test suite FAIL, 7/7 test FAIL**.
- Nguyên nhân quan sát: lỗi kết nối MongoDB từ `tests/setup.js` (`MongooseServerSelectionError: Missing required sub-document 'driver' in the client metadata document` + `buffering timed out`), không phải do assertion nghiệp vụ.
- Đã tạo `.env.test` local đúng mẫu; lỗi còn lại thuộc toolchain Jest/mongoose/mongodb driver trong môi trường hiện tại.
- **Không thay thế** bằng mock và **không** coi Jest là bằng chứng integration PASS. Bộ `node:test` + integration MongoDB thật là bằng chứng chính.

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
3. **Jest toolchain:** chưa xanh trong môi trường hiện tại (lỗi kết nối driver); cần môi trường CI thống nhất hoặc cập nhật toolchain.
4. **Category/Product dependency:** BLOCKED chờ Dev 2.
5. **Đổi mật khẩu:** chưa có `confirmPassword` (theo convention body tối giản hiện tại); UI Dev 4 cần hiển thị xác nhận nếu muốn.
6. **Integration test đổi mật khẩu trên MongoDB thật:** chưa có case riêng trong `test/integration` (đã có HTTP test fake model + integration tổng thể cho các luồng khác); có thể bổ sung khi Dev 2 hoàn tất schema hoặc khi cần tăng độ phủ.

---

## 8. Những việc chưa thể xác minh

- Chạy Jest xanh trong môi trường hiện tại (lỗi driver/mongoose, không phải assertion).
- Hành vi thực tế sau reverse proxy/TLS termination thật (chưa có môi trường deploy; mới kiểm thử cấu hình trust proxy bằng mini-app).
- Redis/distributed rate limit (không có hạ tầng, không thêm dependency).
- Category model/populate thật (chờ Dev 2).
- UI đổi mật khẩu (thuộc Dev 4).

---

## 9. Thứ tự merge Pull Request (stacked branches)

Merge theo đúng thứ tự sau để tránh conflict/lệch base:

1. `feature/T4-1-1-rbac-route-integration` (`75c30db`)
2. `feature/T4-1-3-change-password` (`e8e5af3`)
3. `feature/T2-1-3-env-test-integration` (không có commit; chỉ cần xác nhận môi trường test — có thể bỏ qua PR)
4. `feature/T2-2-1-category-dependency-review` (`26b0ac9`) — **BLOCKED**, chỉ merge báo cáo; code Category chờ Dev 2
5. `feature/T5-error-page-hardening` (`6e9063a`)
6. `feature/T4-1-2-trust-proxy-hardening` (`5527481`)
7. `docs/phase2-dev1-readme` (`6e4c127` + commit báo cáo này)

**Lưu ý merge:** không merge trực tiếp vào `main`/`develop` nếu chưa review; không force-push; các branch sau kế thừa commit của branch trước nên phải merge theo thứ tự trên. Nếu merge bằng PR, đặt base của PR sau là branch trước (hoặc merge tuần tự vào nhánh tích hợp) để giữ lịch sử rõ ràng.

---

## 10. Kết luận

- **PASS:** T4-1-1 (RBAC/IDOR), T4-1-3 (đổi mật khẩu), T2-1-3 (môi trường test + integration MongoDB thật), T5 (error hardening), T4-1-2 (trust proxy), T7 (README).
- **BLOCKED:** T2-2-1 phần Category (Dev 2).
- **Chưa xác minh:** Jest xanh, proxy thật, Redis/distributed rate limit, UI đổi mật khẩu (Dev 4).
- Không có thay đổi ngoài scope (không Cart/Order/Audit/Cron/Product CRUD/Admin CRUD/UI), không chạm 2 file báo cáo untracked có sẵn, không commit secret/`.env.test`.
