# PHASE 4 DEV 1 — T7-1-1 SECURITY REVIEW

## 1. Mục tiêu task

Rà soát và hoàn thiện các hạng mục bảo mật backend theo `02_WBS!T7-1-1`: CSP bằng nonce (Helmet), cookie Secure + trust proxy, không lộ trường mật khẩu / stack trace, có security checklist và báo cáo kết quả cùng các giới hạn còn lại.

Dependency `T6-1-3` đã DONE theo `docs/reports/PHASE3_DEV1_FINAL_ACCEPTANCE.md` §1, nên task đủ điều kiện bắt đầu.

---

## 2. Branch

| Item | Giá trị |
|---|---|
| Branch | `feature/phase4-dev1-t7-1-1-security-review` |
| Nguồn | `origin/main` @ `2574ede28e64b5bbfb6f14bbd37b6b9e771b62e4` |
| Worktree | `D:\ABMT_Shop\ABMT-SHOP-PHASE4-WORK` (ngoài working tree `main`) |
| Working tree `main` | Không đụng vào; 2 file modified + 14 untracked + `stash@{0}` giữ nguyên |

---

## 3. Các file đã thay đổi

| File | Thay đổi |
|---|---|
| `package.json` | Thêm `"helmet": "8.3.0"`; đưa `test/security-headers.test.js` vào script `test` |
| `package-lock.json` | Thêm entry `node_modules/helmet` (version/integrity/resolved). 17 hunk còn lại chỉ xoá metadata `libc` của package optional do npm chuẩn hoá — **không** đổi version/integrity dependency nào khác |
| `src/middleware/securityHeaders.js` | **Mới** — middleware tạo nonce + cấu hình Helmet CSP |
| `src/app.js` | Mount `securityHeaders` sau `configureTrustProxy`, trước static/routes |
| `src/views/partials/header.ejs` | `nonce="<%= cspNonce %>"` cho block `<style>` (dòng 2) và `<script>` (dòng 365) |
| `src/views/pages/product-detail.ejs` | nonce cho `<script type="application/json" id="variants-data">` |
| `src/views/pages/admin-dashboard.ejs` | nonce cho `<script type="application/json" id="admin-chart-data">` |
| `src/views/pages/admin-categories.ejs` | nonce cho block `<style>` |
| `src/views/pages/admin-orders.ejs` | nonce cho block `<style>` |
| `src/views/pages/admin-users.ejs` | nonce cho block `<style>` |
| `src/views/pages/orders.ejs` | nonce cho block `<style>` |
| `src/views/pages/profile.ejs` | nonce cho block `<style>` |
| `test/security-headers.test.js` | **Mới** — 4 test CSP/nonce/allowlist/quét toàn bộ EJS |
| `test/error-handler.test.js` | Mount `securityHeaders` vào mini-app trong test 500 HTML (xem §4) |
| `docs/reports/PHASE4_DEV1_T7_1_1_SECURITY_REVIEW.md` | Báo cáo này |

Tổng cộng 9 inline `<script>/<style>` thực tế trong `src/views` đã được gắn nonce (đã quét toàn bộ `.ejs`, không chỉ danh sách ban đầu). Các `<script src="...">` external được phủ bởi `'self'` nên không cần nonce.

---

## 4. Các vấn đề phát hiện

| # | Vấn đề | Phân tích |
|---|---|---|
| 1 | Không có Helmet / CSP | `package.json`, `package-lock.json`, `node_modules` đều không có helmet; source chỉ set `Cache-Control`. Không có header `Content-Security-Policy` nào |
| 2 | WBS yêu cầu "CSP bằng nonce (Helmet)" | Phương án tự viết middleware bằng `crypto` không đáp ứng cụm "(Helmet)" và không cấp HSTS / `X-Content-Type-Options` / `Referrer-Policy` / frame protection → phải xin phê duyệt dependency |
| 3 | Inline script/style chưa có nonce | 9 tag inline trong EJS; nếu bật CSP mà không gắn nonce sẽ vỡ giao diện/chức năng |
| 4 | CDN/font ngoài | Chart.js từ `cdn.jsdelivr.net`; font từ `fonts.googleapis.com` / `fonts.gstatic.com` — cần allowlist nếu không trang admin/font sẽ hỏng |
| 5 | Ảnh sản phẩm ngoài | Seed dùng `https://cdn.example.com/...`; Helmet mặc định `img-src 'self' data:` sẽ chặn ảnh → hỏng giao diện |
| 6 | Regression test 500 HTML | `test/error-handler.test.js` dùng mini-app không mount middleware CSP; sau khi `error.ejs` include `header.ejs`, biến `cspNonce` bị `undefined` → 500 fallback thay vì trang lỗi Vietnamese. Đã mount `securityHeaders` vào mini-app, **giữ nguyên toàn bộ assertion** về không lộ message/stack |
| 7 | Thuộc tính `style=""` | 14 occurrence trong EJS. CSP3 không áp dụng nonce cho style attribute; refactor sang class là thay đổi UI lớn → giữ `'unsafe-inline'` có kiểm soát (xem §5) |

---

## 5. Giải pháp đã triển khai

### 5.1 Nonce

- `crypto.randomBytes(16).toString('base64')` → 22 ký tự + `==`, tạo **mới cho từng request** trong `attachCspNonce`.
- Lưu vào `res.locals.cspNonce`; Express tự trộn `res.locals` vào `res.render()` nên template dùng `<%= cspNonce %>` được (đã escape an toàn).
- Test xác nhận nonce của 2 request khác nhau không trùng.

### 5.2 CSP directives

| Directive | Giá trị | Lý do |
|---|---|---|
| `default-src` | `'self'` | Nền tảng |
| `script-src` | `'self'`, `'nonce-...'`, `https://cdn.jsdelivr.net` | Không `'unsafe-inline'`, không `'unsafe-eval'`; CDN cho Chart.js |
| `script-src-attr` | `'none'` | Không dùng inline event handler (đã quét: không có `on*=` hay `javascript:`) |
| `style-src` | `'self'`, `'nonce-...'`, `https://fonts.googleapis.com` | Block `<style>` có nonce; font stylesheet |
| `style-src-attr` | `'unsafe-inline'` | **Giữ có kiểm soát** — 14 thuộc tính `style=""` hiện hữu; CSP3 không hỗ trợ nonce cho style attribute. Không tuyên bố đã loại bỏ toàn bộ inline style |
| `font-src` | `'self'`, `https://fonts.gstatic.com` | Font tĩnh |
| `img-src` | `'self'`, `data:`, `https:` | Ảnh sản phẩm từ CDN ngoài; mở `https:` để không hỏng giao diện hiện tại |
| `base-uri` / `form-action` | `'self'` | Chặn base/form hijack |
| `frame-ancestors` / `object-src` | `'none'` | Chặn clickjacking / plugin |
| `upgrade-insecure-requests` | bỏ qua (`null`) | Tránh ép `http://localhost` sang https; production kết thúc TLS tại reverse proxy |
| `crossOriginEmbedderPolicy` | `false` | CDN/font không có CORP header sẽ bị chặn nếu bật |

Các header Helmet khác (HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `X-DNS-Prefetch-Control`, frame protection...) được giữ theo mặc định của Helmet 8.3.0.

### 5.3 Không thay đổi behavior

- Cookie Secure/HttpOnly/SameSite giữ nguyên (`tokenService.js`, `csrf.js`).
- Trust proxy vẫn opt-in qua `TRUST_PROXY` + unit test hiện có.
- Error handler production vẫn ẩn message/stack; test gốc giữ nguyên assertion, chỉ bổ sung middleware vào harness.

---

## 6. Test đã chạy

| Lệnh | Kết quả | Exit |
|---|---|---|
| `node --check src/middleware/securityHeaders.js` | OK | 0 |
| `node --check test/security-headers.test.js` | OK | 0 |
| `node --test test/security-headers.test.js` | 4 tests / 4 pass / 0 fail / 0 skip | 0 |
| `node --test test/security-headers.test.js test/error-handler.test.js test/trust-proxy.test.js` | 15 tests / 15 pass / 0 fail / 0 skip | 0 |
| `npm test` | 363 tests / 357 pass / 0 fail / 6 skip | 0 |
| So sánh `version`/`integrity`/`resolved` trong package-lock (HEAD vs worktree) | Chỉ `helmet@8.3.0` là thêm mới; không dependency khác đổi | 0 |
| Quét secret trong diff (`MONGODB_URI`, `JWT_SECRET=`, password, private key, api key) | Không có kết quả | 0 |

> 6 test `skip` trong `npm test` **không được tính là PASS**; baseline trước task là 359 tests / 353 pass / 0 fail / 6 skip, sau task tăng đúng 4 test mới.

Không chạy DB thật, migration, cron, seed production; không đọc `.env`, secret hay MongoDB URI.

---

## 7. Kết quả test

- Test mới bao phủ: CSP header tồn tại; nonce đúng format `'nonce-[A-Za-z0-9+/]{22}=='`; nonce khác nhau giữa 2 request; nonce trong HTML khớp header; `script-src` không có `'unsafe-inline'`/`'unsafe-eval'`; CDN/font/img allowlist; quét toàn bộ file `.ejs` đảm bảo mọi inline script/style đều có `nonce="<%= cspNonce %>"`.
- Regression đầy đủ `npm test` xanh; không có test nào bị bỏ qua để đạt kết quả.

---

## 8. Security review

| Hạng mục | Kết luận |
|---|---|
| CSP nonce | Đạt — nonce ngẫu nhiên 128-bit mỗi request, không tái sử dụng |
| Script inline | Đạt — có nonce; không `'unsafe-inline'`, không `'unsafe-eval'` |
| Style inline | Đạt một phần — block `<style>` có nonce; **style attribute vẫn `'unsafe-inline'`** (xem §5) |
| CDN/font/ảnh | Đã allowlist có chủ đích; không dùng wildcard cho script |
| Cookie | Không thay đổi; Secure + HttpOnly + SameSite như cũ, đã có test |
| Trust proxy | Không thay đổi; vẫn opt-in, có test chống giả mạo `X-Forwarded-For` |
| Error leakage | Production vẫn ẩn message/stack; test API + HTML đều pass |
| Log nhạy cảm | Không thêm log mới; error handler production chỉ log method/URL/status |
| Secret trong diff | Không có |
| Dependency | Chỉ `helmet@8.3.0` (MIT, Node >= 18, không transitive runtime dependency), đã được phê duyệt |

---

## 9. Definition of Done checklist

- [x] Security review được thực hiện đầy đủ
- [x] CSP và nonce đáp ứng yêu cầu (Helmet + nonce riêng từng request)
- [x] Secure cookie và trust proxy được kiểm tra (giữ nguyên + regression xanh)
- [x] Production không lộ stack trace hay thông tin nhạy cảm
- [x] Test liên quan PASS
- [x] Có security checklist (bảng §8)
- [x] Có báo cáo kết quả và các giới hạn còn lại (§10, §11)
- [x] Không đánh dấu DONE khi CSP nonce chưa xử lý — nonce đã xử lý

---

## 10. Những nội dung chưa hoàn thành

| Item | Lý do |
|---|---|
| Loại bỏ hoàn toàn inline style | 14 thuộc tính `style=""` vẫn dùng `'unsafe-inline'` ở `style-src-attr`; refactor sang class CSS là thay đổi UI lớn, nằm ngoài phạm vi T7-1-1 |
| `upgrade-insecure-requests` | Chủ động bỏ qua để không hỏng `http://localhost`; cần bật lại khi có cấu hình TLS/production rõ ràng (T8) |
| Kiểm chứng CSP trên browser thật | Repo không có Playwright/Cypress (`T1-4-2_NFR_TEST_PLAN.md`); `T7-4-1` E2E chưa xong → blockers đã ghi trong readiness audit |
| Kiểm chứng header qua reverse proxy thật | Thuộc T8-1-2, đang BLOCKED |

---

## 11. Dependency hoặc approval còn chờ

| Item | Trạng thái |
|---|---|
| `helmet@8.3.0` | **Đã phê duyệt** và đã cài đúng lệnh `npm install helmet@8.3.0 --save-exact` |
| Package khác | Không thêm; không nâng cấp; lockfile chỉ thay đổi đúng phạm vi đã duyệt |
| T7-4-1 / T8 | Không phải dependency của T7-1-1; không triển khai trong PR này |

---

## 12. Commit SHA

`713d46ed3b5068c5358777c49dfb1f4b275ad2c9` — `feat(T7-1-1): add Helmet CSP nonce and security header tests`

Commit báo cáo này: sẽ được ghi nhận trong lịch sử PR ngay sau commit code.

---

## 13. PR URL

https://github.com/xn1664494-tech/ABMT-SHOP/pull/109

---

## 14. Merge commit SHA

Chờ merge. Giá trị cuối cùng được ghi trong báo cáo tổng kết Phase 4 sau khi PR #109 merge và CI `main` xanh.

---

## 15. Trạng thái cuối cùng

| Trường | Giá trị |
|---|---|
| Task | T7-1-1 Security Review |
| Trạng thái code | Hoàn thành, đã push, PR #109 đang chờ CI/review |
| DoD | Đạt (với các giới hạn đã nêu rõ tại §10) |
| Merge | Chưa merge — tuân thủ điều kiện "chỉ merge khi CI xanh" |
| Task tiếp theo | Chưa bắt đầu T7-1-2; chỉ chuyển sau khi PR #109 merge thành công, CI `main` xanh và `origin/main` cập nhật |
