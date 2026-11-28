# T1-4-2 — Yêu cầu phi chức năng & kế hoạch kiểm thử sơ bộ

- **Ngày:** 2026-11-21
- **Nhánh:** `docs/T1-4-2-nfr-test-plan`
- **Phạm vi:** Danh sách NFR (hiệu năng, bảo mật, bảo trì, sử dụng, tương thích, vận hành) + kế hoạch kiểm thử sơ bộ ánh xạ 8 kịch bản cốt lõi. Không sửa code.
- **Sản phẩm bàn giao theo WBS:** `Yêu cầu phi chức năng (tài liệu)` — **Danh sách NFR + kế hoạch test**.
- **Trạng thái:** Phần tài liệu hoàn thành; chờ Dev 3 review chéo (DoD #4).
- **Phụ thuộc:** không (`02_WBS` cột N = `—`).
- **Reviewer:** Dev 3 (cột S sheet `02_WBS`; RACI review chéo Dev 4).

Nguồn: docx §1.4 (Bảng 4), §5.1–5.4 (Bảng 16, Bảng 18), §5.8; workbook sheet `09_Kiểm thử & DoD`; [`README.md`](../../README.md) §10–12, §15; [`POST_PHASE2_HARDENING_REPORT.md`](POST_PHASE2_HARDENING_REPORT.md); [`T4-2-1_PRODUCT_FILTER.md`](T4-2-1_PRODUCT_FILTER.md).

> Liên kết tới `T1-4-1_REQUIREMENTS_SURVEY.md` (phần 2) và `T1-4-3_DOCS_INDEX.md` trỏ tới file trên nhánh `docs/T1-4-1-requirements-survey` / `docs/T1-4-3-docs-index`; sẽ hợp lệ trong workspace sau khi các PR được merge.

---

## 1. Danh sách NFR và tiêu chí kiểm chứng

| # | Nhóm | Yêu cầu | Tiêu chí kiểm chứng (có thể đo/quan sát) | Bằng chứng hiện có |
|---|---|---|---|---|
| NFR-01 | Hiệu năng | Danh sách sản phẩm phản hồi nhỏ, không tải toàn bộ DB | `page` mặc định 20, `limit` tối đa 100; `total/totalPages` trả về | `src/utils/productFilter.js:170-189`, `T4-2-1_PRODUCT_FILTER.md` |
| NFR-02 | Hiệu năng | Truy vấn dùng index, không N+1 | `explain()` cho filter `category`, `basePrice`, `variants.size/color`; đo trước/sau | `T2-2-2_INDEX_SEED.md`; T4-2-3 / T7-2-2 chưa làm xong |
| NFR-03 | Hiệu năng | Trang chủ đạt Lighthouse Mobile ≥ 85 | Số đo trước/sau, ảnh lazy-load, cache tĩnh | Mốc M6 (sheet `05_Mốc bàn giao`); code có lazy-load/cache nhưng **chưa có số đo** |
| NFR-04 | Bảo mật | Không lộ cookie/token cho JS | Cookie `HttpOnly`; refresh cookie giới hạn path `/api/auth`; `Secure` theo môi trường | `src/services/tokenService.js:73-78`, `test/auth.login.test.js` |
| NFR-05 | Bảo mật | Chống CSRF trên route ghi dùng cookie auth | double-submit cookie + header, so sánh timing-safe, kiểm tra Origin/Referer theo `APP_ORIGIN`; thiếu/sai → 403 | `src/middleware/csrf.js`, `test/auth.csrf.test.js` |
| NFR-06 | Bảo mật | Rate limit cho auth | `AUTH_RATE_LIMIT_WINDOW_MS`, `AUTH_RATE_LIMIT_MAX`; vượt ngưỡng → 429 | `src/middleware/rateLimiters.js`, `test/auth.rate-limit.test.js` ⚠️ MemoryStore (không chia sẻ multi-instance) |
| NFR-07 | Bảo mật | Phân quyền chặt, chống IDOR | Guest → 401, Customer vào route admin → 403, đọc profile người khác → 403; role đọc từ DB | `src/middleware/authenticate.js`, `requireAdmin.js`, `test/auth.rbac.test.js`, `test/auth.admin-route.test.js` |
| NFR-08 | Bảo mật | Input an toàn, không mass-assignment | Zod validate + whitelist (`name`, `email`); escape khi render EJS; không hard-code secret | `src/middleware/validate.js`, `src/validators/`, `README.md:215-220` — T7-1-2 **đã hoàn thành** qua [PR #112](https://github.com/xn1664494-tech/ABMT-SHOP/pull/112) (merge commit `a75a52b`): output encoding tại điểm render, giữ nguyên DB/API contract. [Report](PHASE4_DEV1_T7_1_2_SANITIZE_REPORT.md) · [Checklist](PHASE4_DEV1_T7_1_2_SANITIZE_CHECKLIST.md) |
| NFR-09 | Bảo trì | Cấu trúc rõ, lỗi tập trung, có review | MVC; `errorHandler` trả JSON lỗi `{success:false,error,details?}` cho `/api`; PR review chéo | `src/app.js:48-56`, `src/middleware/errorHandler.js`; review chéo đang là nợ (backlog P1-5) |
| NFR-10 | Sử dụng | Hiện lỗi rõ, chống bấm đúp, mobile-first | Form login/register hiển thị lỗi; toast/loading; breakpoint 360/390/768/1280px | `src/views/pages/*`, `src/public/js/ui.js`, `docs/thiet-ke-ui/components-demo.html` — chưa đo trên thiết bị thật |
| NFR-11 | Tương thích | Chạy được Node LTS + Express 5 + MongoDB | `npm ci` → `npm run check:env` → `npm start`; health check `GET /health` | `README.md:13-18`, `.env.example`, `scripts/check-env.js`, `src/app.js:48` |
| NFR-12 | Vận hành | Cấu hình tách khỏi code, seed an toàn, có CI | `.env`/`.env.test` gitignored; `npm run seed` cần `SEED_CONFIRM=1`; workflow chạy 4 bộ test với DB tên chứa `test` | `README.md:99-115`, `scripts/seed.js`, `.github/workflows/api-test-gates.yml:32-79` |

---

## 2. Kế hoạch kiểm thử sơ bộ — 8 kịch bản cốt lõi

Trạng thái được đánh giá theo code hiện tại (xem [`T1-4-1_REQUIREMENTS_SURVEY.md`](T1-4-1_REQUIREMENTS_SURVEY.md) mục 4).

| Mã | Kịch bản (sheet `09`) | Lệnh / cách chạy | Trạng thái | Ghi chú |
|---|---|---|---|---|
| TC01 | Đăng ký / đăng nhập | `npm test` → `test/auth.register.test.js`, `test/auth.login.test.js`; `npm run test:integration` | **PASS** | Đã có test trùng email 409, sai mật khẩu, cookie HttpOnly |
| TC02 | Danh sách / chi tiết sản phẩm | `npm run test:api`, `npm run test:postman` | **PASS** | 4 collection Postman gồm Product + ProductFilter |
| TC03 | Giỏ hàng (thêm/sửa/xóa, refresh) | Chưa có runner ổn định | **BLOCKED** | Không có session middleware; `_id:false` vs `$pull _id`; client `PATCH` vs server `PUT` |
| TC04 | Đặt hàng / thanh toán | Chưa có runner | **BLOCKED** | `POST /api/orders` chưa đăng ký; Order service absent |
| TC05 | Quản trị sản phẩm / đơn | `npm test` (`test/category.api`, `test/product.api`), Postman admin | **PARTIAL** | Vế sản phẩm PASS; vế đơn BLOCKED (chưa có API) |
| TC06 | Tìm kiếm / lọc / đánh giá | `node --test test/product.filter.test.js`, `npm run test:postman` | **PARTIAL** | Lọc PASS; đánh giá BLOCKED (chỉ có `Review.js`) |
| TC07 | Phân quyền | `npm test` → `test/auth.rbac.test.js`, `test/auth.admin-route.test.js` | **PASS** | Có route thật `/api/admin/access-check` + IDOR profile |
| TC08 | Responsive & bảo mật cơ bản | Kiểm tra thủ công EJS + `test/auth.csrf.test.js`, `test/auth.rate-limit.test.js` | **PARTIAL** | View tồn tại nhưng nhiều trang chưa có route; chưa có browser E2E |

Ma trận kịch bản bảo mật tối thiểu (docx Bảng 18): RBAC/IDOR, XSS, CSRF, rate limit, mass assignment. Hiện phủ được RBAC/IDOR/CSRF/rate limit/mass assignment ở mức API; **XSS đã có 8 test tự động trong `test/nav-sanitize.test.js`** (T7-1-2, [report](PHASE4_DEV1_T7_1_2_SANITIZE_REPORT.md)) — payload XSS trong tên danh mục / tiêu đề cột / tên link, scheme href nguy hiểm, quét raw `<%- %>` và kiểm tra `renderMega`. Đã chạy trong PR #112 (CI xanh); phạm vi là output encoding của mega menu, **không phải browser E2E**. Các kịch bản chưa có test tự động vẫn giữ trạng thái chưa thực hiện.

Liên kết báo cáo Phase 4 T7 (Dev 1, 2026-11-28):

- T7-1-2 Sanitize: [báo cáo](PHASE4_DEV1_T7_1_2_SANITIZE_REPORT.md) · [checklist](PHASE4_DEV1_T7_1_2_SANITIZE_CHECKLIST.md) — PR [#112](https://github.com/xn1664494-tech/ABMT-SHOP/pull/112), merge `a75a52b`.
- T7-1-3 Rà soát cấu hình: [báo cáo](PHASE4_DEV1_T7_1_3_CONFIG_REVIEW_REPORT.md) · [checklist](PHASE4_DEV1_T7_1_3_CONFIG_REVIEW_CHECKLIST.md) — PR [#115](https://github.com/xn1664494-tech/ABMT-SHOP/pull/115) / [#117](https://github.com/xn1664494-tech/ABMT-SHOP/pull/117), merge `d9324fc` / `efdd7d4`.

Bổ sung theo docx §5.2 (khi làm T7): số lượng = 0, mã giảm giá hết hạn, hủy đơn đồng thời, phiên hết hạn, tồn kho biến thể vượt mức.

---

## 3. Bộ lệnh kiểm thử và điều kiện chạy

| Lệnh | Phạm vi | Điều kiện |
|---|---|---|
| `npm run check:env` | Kiểm tra biến môi trường bắt buộc | `MONGODB_URI`, `JWT_SECRET` (xem `.env.example`) |
| `npm test` | 23 file unit/API `node:test` | Cần `JWT_SECRET`; test cần DB tự skip nếu không có mongo test |
| `npm run test:integration` | 6 file integration MongoDB thật | `MONGODB_URI_TEST`, tên DB chứa `test` (README §11) |
| `npm run test:jest` | `tests/{env,health,infra}` | `.env.test`, `NODE_OPTIONS=--experimental-vm-modules` có sẵn trong script |
| `npm run test:postman` | 4 collection Newman + MongoMemoryServer | Cần dependency `mongodb-memory-server` cài đủ |
| `npm run seed` + `npm run test:seed-verify` | Seed 1 admin/6 cat/6 product, kiểm tra index | `SEED_CONFIRM=1`, DB test |

**Không có** tool coverage (`c8`/`nyc`, chưa cấu hình trong `jest.config.js`/`package.json`) và **không có** browser E2E (Playwright/Cypress). T7-4-3 "Độ phủ test" cần chốt tooling trước khi báo cáo số liệu.

---

## 4. Kết quả chạy thực tế trên máy local (2026-11-21)

| Lần chạy | Kết quả | Nguyên nhân |
|---|---|---|
| `npm test` với env local hiện tại | **247 test / 229 pass / 18 fail / 0 skip** | 17 test `test/category.api.test.js` trả 401 thay vì 200/403/409 do **thiếu `JWT_SECRET`** (file `.env` chỉ có `MONGODB_URI`, `.env.test` chỉ có `NODE_ENV`, `MONGODB_URI_TEST`). CI đặt biến này tại `.github/workflows/api-test-gates.yml:37`. |
| `npm test` với `JWT_SECRET` + `APP_ORIGIN` đặt tạm trong shell (không ghi vào file) | **247 test / 246 pass / 1 fail / 0 skip** | 1 fail còn lại: `test/soft-delete.plugin.test.js` → `Cannot find module 'mongodb-memory-server'` dù dependency có trong `package.json:43`; `node_modules/mongodb-memory-server` không tồn tại trên máy này. Chạy `npm ci` để cài lại. |

Đây là **lỗi môi trường**, không phải regression của ba task T1-4-x (docs-only). Không ghi giá trị secret vào báo cáo hay Git.

---

## 5. Giới hạn / nợ kỹ thuật cần báo cáo ở T7

- Rate limit dùng MemoryStore: counter reset khi restart, không chia sẻ giữa instance (`README.md:217`).
- Trust proxy phải cấu hình đúng hạ tầng; không bật mặc định (`README.md:218`).
- CSRF/Origin phụ thuộc `APP_ORIGIN`, cần kiểm tra lại khi đổi domain/deploy (`README.md:219`).
- Chưa đo Lighthouse, chưa có ảnh chụp/log thực tế cho docx §5.8.
- Chưa có coverage tool và browser E2E; TC03/TC04/TC05(vế đơn)/TC06(vế đánh giá) bị block bởi backend chưa tồn tại.

---

## 6. DoD — đối chiếu sheet `09_Kiểm thử & DoD`

| Tiêu chí | Bằng chứng |
|---|---|
| Đúng yêu cầu | WBS `T1-4-2`: NFR (mục 1) + kế hoạch test 8 kịch bản (mục 2) |
| Code chạy ổn định | Không đổi code; ghi rõ điều kiện env để test chạy đúng (mục 3–4) |
| Test pass | Có số liệu thật mục 4; không tự động fix lỗi env ngoài scope |
| Review chéo | Dev 3 (chưa có → chưa chuyển `Hoàn thành` trong workbook) |
| Tài liệu / minh chứng | File này + docx §1.4/§5 + workbook sheet `09` |
| Không regression | Chỉ thêm 1 file Markdown |

Sau khi Dev 3 xác nhận: cập nhật `02_WBS` dòng 12 (`Q12=Hoàn thành`, `R12=100`, `T12=link file này`).
