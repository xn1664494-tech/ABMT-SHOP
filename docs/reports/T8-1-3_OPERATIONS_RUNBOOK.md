# T8-1-3 — Tài liệu vận hành: deploy, biến môi trường, xử lý sự cố

| Mục | Giá trị |
|---|---|
| Mã WBS | `T8-1-3` / `4.8.03` |
| Tên WBS | Tài liệu vận hành — cách deploy, biến môi trường, xử lý sự cố thường gặp |
| Người làm | Dev 1 (Leader & Lead Backend Core) |
| Worktree | `D:\ABMT_Shop\ABMT-SHOP-PHASE4-T8-1-3` |
| Branch | `docs/phase4-dev1-t8-1-3-operations-documentation` |
| Base | `origin/main` = `9b88b3fd2ab870eac82b97d11c8f17e79cf94325` (sau PR #124) |
| Dependency | `T7-1-3` — rà soát cấu hình, đã hoàn thành |
| Deliverable | Tài liệu (Markdown) — không phải mã nguồn hạ tầng |
| Ngày | 2026-11-28 |

---

## 1. Phạm vi và nguyên tắc an toàn

Tài liệu này **mô tả** cách vận hành; nó **không tự động deploy, không cấu hình production, không ghi secret, không chạy migration/cron và không thêm dependency**. Mọi lệnh có tác động ghi dữ liệu đều cần phê duyệt riêng và DB đã được sao lưu.

| Nguyên tắc | Giải thích |
|---|---|
| Không đọc/in `.env` thật | Chạy `npm run check:env` — script chỉ báo `SET/MISSING` và độ dài, không in giá trị (`scripts/check-env.js`). |
| Không dùng DB production cho test | Integration/Jest bắt buộc `MONGODB_URI_TEST` trỏ tới DB có tên chứa `test`. |
| Không tự bật cron/migration | Job quá hạn và migration `expiresAt` chỉ được **mô tả**, xem [`DEV1_OPS_RUNBOOK_HANDOFF.md`](DEV1_OPS_RUNBOOK_HANDOFF.md). T8-1-3 không kích hoạt chúng. |
| Không thay đổi hạ tầng | `TRUST_PROXY`, rate-limit store dùng chung, outbox audit là đề xuất/chờ Lead — xem §7 và handoff. |
| Không tin lời hứa "đã deploy" | Luôn đối chiếu log khởi động và 3 smoke check ở §6. |

Trạng thái công việc này: **DONE** (tài liệu). Các bước deploy trong tài liệu: **NOT RUN** — không được thực hiện trong PR docs-only này.

---

## 2. Luồng khởi động ứng dụng

```
npm start  →  src/server.js
             ├─ dotenv.config()
             ├─ connectDB()            (src/config/db.js: retry DB_MAX_RETRIES × DB_RETRY_DELAY_MS)
             ├─ app.listen(PORT)       (mặc định 3000)
             └─ startAutoCompleteOrders()  (job in-process, mỗi ~10 phút)
```

Điểm cần nhớ:

- `app.js` cài audit-log publisher khi `NODE_ENV !== 'test'`; khi chạy test thì không cài.
- `autoIndex: process.env.NODE_ENV !== 'production'` (`src/config/db.js:11`). **Production KHÔNG tự tạo index** — xem lỗi hay gặp ở §7.6.
- `TRUST_PROXY` chỉ được áp dụng khi khai báo rõ; mặc định không bật để tránh tin `X-Forwarded-For` giả mạo (`src/app.js:31-43`).
- **Chưa có endpoint `/health`**. Dùng các smoke check ở §6 thay vì đợi health route.
- Job tự hoàn tất đơn `delivered` sau `AUTO_COMPLETE_DAYS` chạy ngay trong process web (`src/jobs/autoCompleteOrders.js`); không phải cron riêng. Job hủy đơn quá hạn là script CLI riêng, **không** tự chạy lúc khởi động.

---

## 3. Chuẩn bị môi trường

### 3.1 Yêu cầu

- Node.js LTS (repo đã kiểm thử với Node 24); npm; Git.
- MongoDB local hoặc Atlas. Với Atlas: whitelist IP của host deploy trong **Network Access** và dùng connection string từ secret manager.
- Repository đã có `package-lock.json` → dùng `npm ci` để cài đặt lặp lại được (`npm install` cũng được README nêu).

### 3.2 Cấu hình

```bash
# Windows PowerShell
copy .env.example .env
# Linux/macOS
cp .env.example .env

# Kiểm tra cấu hình bắt buộc (không in secret)
npm run check:env
```

`.env` và `.env.*` đã bị gitignore (ngoại lệ: `.env.example`, `.env.test.example`). **Không commit `.env`**, không dán connection string/token vào báo cáo hay ticket.

Tách biệt ba môi trường:

| Môi trường | `NODE_ENV` | Biến DB | Ghi chú |
|---|---|---|---|
| Development | `development` | `MONGODB_URI` | Có thể dùng DB local; `autoIndex` bật. |
| Test/CI | `test` | `MONGODB_URI_TEST` / `TEST_MONGODB_URI` | DB tên chứa `test`; audit publisher không cài; CSRF bypass cho runner. |
| Production | `production` | `MONGODB_URI` | `autoIndex` tắt; cookie `secure` bật; cần `TRUST_PROXY` nếu sau proxy. |

Chi tiết test: [`README.md`](../../README.md) §11–12.

---

## 4. Bảng biến môi trường

### 4.1 Bắt buộc / khởi động

| Biến | Bắt buộc | Mặc định | Vai trò | Nơi đọc |
|---|---|---|---|---|
| `NODE_ENV` | Khuyến nghị | `development` | `development`/`production`/`test`; đổi `autoIndex`, cookie `secure`, audit publisher | nhiều module |
| `MONGODB_URI` | **Có** | — | Chuỗi kết nối ứng dụng (secret) | `src/config/db.js` |
| `JWT_SECRET` | **Có** | — | Secret ký JWT (secret) | `src/services/tokenService.js` |
| `PORT` | Không | `3000` | Cổng HTTP | `src/server.js` |
| `DB_MAX_RETRIES` | Không | `5` | Số lần retry kết nối DB lúc khởi động | `src/config/db.js` |
| `DB_RETRY_DELAY_MS` | Không | `3000` | Độ trễ giữa 2 lần retry (ms) | `src/config/db.js` |

`npm run check:env` chỉ kiểm tra `MONGODB_URI`, `JWT_SECRET` và các biến tùy chọn liệt kê trong script. Thiếu → exit 1 kèm thông báo; không in giá trị.

### 4.2 Bảo mật / phiên

| Biến | Mặc định | Vai trò | Lưu ý vận hành |
|---|---|---|---|
| `APP_ORIGIN` | `http://localhost:3000` | Origin hợp lệ cho CSRF; cho phép nhiều origin, phân cách bằng `,` | Đổi domain → phải cập nhật, nếu không request ghi bị 403. Xem §7.2. |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | TTL access token | Cookie `accessToken` (HttpOnly). |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | TTL refresh token | Cookie `refreshToken`, path `/api/auth`. |
| `TRUST_PROXY` | không bật | Số hop hoặc giá trị Express hợp lệ (vd `1`) | Chỉ đặt khi sau reverse proxy tin cậy. Không đặt khi truy cập trực tiếp. |
| `CARRIER_WEBHOOK_SECRET` | — | Secret so khớp header `x-carrier-key` của `POST /api/shipping/webhook` | Bắt buộc để webhook hoạt động; thiếu → 401. Xem §7.4. |
| `SMS_OTP_SECRET` | secret dev cứng trong code | Salt hash OTP | Nếu dùng OTP, phải set giá trị riêng. Không commit. |
| `SMS_PROVIDER` | `console` | Provider gửi OTP | `console` **in mã OTP ra stdout** và chưa có provider thật (TODO trong `src/services/smsService.js`) — không dùng ở production. Xem §7.7. |
| `RESET_PASSWORD_TTL_MS` | `900000` (15 phút) | Thời hạn token đặt lại mật khẩu | `src/services/resetPasswordService.js`. |
| `REQUIRE_PHONE_VERIFIED` | `true` | Chặn đặt hàng khi SĐT chưa xác thực | Chỉ tắt khi `false` chuỗi; cần phê duyệt nghiệp vụ. |

Cookie CSRF (`csrfToken`) có `httpOnly: false` để client JS đọc và gửi lại qua `x-csrf-token`; `secure` bật khi `NODE_ENV=production`, `sameSite=strict`.

### 4.3 Rate limit, cache, nghiệp vụ

| Biến | Mặc định | Vai trò | Giới hạn đã biết |
|---|---|---|---|
| `AUTH_RATE_LIMIT_WINDOW_MS` | `900000` (15 phút) | Cửa sổ rate limit auth | `MemoryStore` — bộ đếm **theo process**, reset khi restart, không chia sẻ multi-instance. |
| `AUTH_RATE_LIMIT_MAX` | `20` | Số request auth tối đa/cửa sổ | Áp cho register/login/refresh/logout/forgot/reset. |
| `SHIPPING_WEBHOOK_RATE_LIMIT_MAX` | `60` | Webhook vận chuyển tối đa/phút | Cùng dạng MemoryStore. |
| `CATEGORY_CACHE_TTL_MS` | `60000` (60 giây) | TTL snapshot cây danh mục | Cache **in-process**; mỗi instance có snapshot riêng. |
| `AUTO_COMPLETE_DAYS` | `7` | Số ngày sau `delivered` thì tự `completed` | Job chạy trong process web, ~10 phút/lần. |
| `ORDER_PENDING_TTL_MINUTES` | `30` | TTL đơn `pending` chưa thanh toán | Dùng cho `expiresAt`; job hủy quá hạn là CLI riêng. |
| `ALLOW_CARRIER_SIMULATION` | `false` | Bật endpoint mô phỏng đơn vị vận chuyển | Chỉ bật trong môi trị nghiên cứu/dev; giá trị phải đúng chuỗi `true`. |
| `BEST_SELLER_WINDOW_DAYS` | `90` | Cửa sổ tính sản phẩm bán chạy | `src/services/homeService.js`. |
| `BEST_SELLER_MIN_UNITS` | `5` | Ngưỡng số lượng tối thiểu | `src/services/homeService.js`. |

Biến trong bảng 4.2–4.3 phần lớn **không có trong `.env.example`**; chỉ thêm vào file env của môi trường khi cần đổi khỏi mặc định và phải đi qua quản lý secret. PR này **không** sửa `.env.example`.

---

## 5. Quy trình deploy (mô tả — chưa thực hiện)

### 5.1 Trước deploy

- [ ] `git fetch origin` và deploy đúng commit đã được review/merge vào `main`.
- [ ] CI `[API test gates]` xanh trên commit đó (xem báo cáo PR tương ứng).
- [ ] Đã sao lưu DB/ có planning rollback; xác nhận không chạy migration trong khung giờ cao điểm.
- [ ] Secret (`MONGODB_URI`, `JWT_SECRET`, `CARRIER_WEBHOOK_SECRET`, …) có trong secret manager, không nằm trong Git.
- [ ] Atlas Network Access cho phép IP host deploy; `npm run check:env` chạy được trên host.
- [ ] Nếu có reverse proxy/TLS termination: quyết định `TRUST_PROXY` (thường `1`) và `APP_ORIGIN` tương ứng domain mới.

### 5.2 Triển khai

```bash
# 1) Cài dependency theo lockfile
npm ci

# 2) Kiểm tra env (không in secret)
npm run check:env

# 3) Chạy ứng dụng
npm start
# development: npm run dev
```

Dừng/restart: dùng process manager của hạ tầng (systemd/PM2/container platform). **Không** chạy `npm install` lúc runtime nếu lockfile đã cố định; **không** chạy seed/migration tự động lúc khởi động — ứng dụng không làm điều đó.

> Nếu DB production chưa có index từ schema mới, cần tạo index có kiểm soát (xem §7.6). `npm run seed` có `Model.init()` nhưng **xóa các bản ghi seed theo email/slug/SKU cố định** — không chạy trên DB thật khi không có phê duyệt (`scripts/seed.js:198-205`).

### 5.3 Sau deploy — smoke check

Xem §6. Chỉ chuyển trạng thái "deploy thành công" khi cả 3 check PASS và log có `MongoDB Connected:`.

### 5.4 Rollback

- Giữ nguyên artifact/phiên bản trước đó để deploy lại (không xóa dữ liệu, không `reset --hard`).
- Nếu lỗi do cấu hình: sửa env trong secret manager rồi restart; **không** thay code trong lúc sự cố.
- Nếu lỗi do schema/index: rollback code trước, giữ DB nguyên; đánh giá riêng việc tạo/xóa index.
- Mọi rollback phải được ghi log với lý do, commit đang chạy và người phê duyệt.

---

## 6. Smoke check không cần auth

Thay `$BASE` bằng origin thực tế (`http://localhost:3000` khi local). Không dán token/secret vào lệnh.

```bash
# 1) Trang chủ EJS render được
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/"                 # kỳ vọng 200

# 2) API công khai trả JSON có phân trang
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/api/products"     # kỳ vọng 200

# 3) Endpoint cấp CSRF token (cookie + JSON)
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/api/auth/csrf"    # kỳ vọng 200
```

Log khởi động phải có dòng `MongoDB Connected: <host>`. Thiếu dòng này hoặc process exit → xem §7.1. Với môi trường production, kiểm tra thêm `Set-Cookie` có `Secure` và `req.ip` đúng sau proxy (§7.3). Không có endpoint `/health` nên không dùng path đó cho monitor.

---

## 7. Sự cố thường gặp

| # | Triệu chứng | Nguyên nhân thường gặp | Cách kiểm tra | Hành động |
|---|---|---|---|---|
| 7.1 | Process thoát ngay, log `Khong the ket noi MongoDB` / `MongoDB error:` | Sai `MONGODB_URI`, IP chưa được allowlist Atlas, DB chưa chạy, hoặc retry kiệt sức | `npm run check:env`; kiểm tra Network Access; thử kết nối từ cùng host | Sửa connection string/allowlist, rồi restart. `DB_MAX_RETRIES`/`DB_RETRY_DELAY_MS` chỉ kéo dài chờ, không sửa sai cấu hình. |
| 7.2 | Request ghi (login/refresh/profile/admin) bị **403** sau đổi domain | `APP_ORIGIN` chưa chứa origin mới; CSRF double-submit thiếu/sai token | Xem response lỗi; đối chiếu `Origin`/`Referer` với `APP_ORIGIN`; gọi lại `GET /api/auth/csrf` | Cập nhật `APP_ORIGIN` (nhiều origin thì phân cách bằng `,`), client lấy CSRF token mới và gửi `x-csrf-token`. Không tắt CSRF. |
| 7.3 | Cookie không có `Secure`, hoặc `req.ip` là IP proxy thay vì client | `TRUST_PROXY` chưa đặt/sai số hop sau reverse proxy | Kiểm tra `Set-Cookie` và log IP; đối chiếu số lớp proxy thực tế | Đặt `TRUST_PROXY` đúng hạ tầng (thường `1`). Không bật khi app tiếp nhận traffic trực tiếp. |
| 7.4 | Webhook vận chuyển trả **401** / **429** / **400 / 409** | 401: sai/thiếu `x-carrier-key` hoặc thiếu `CARRIER_WEBHOOK_SECRET`; 429: quá `SHIPPING_WEBHOOK_RATE_LIMIT_MAX`; 400: payload thiếu `orderCode`/`event: delivered`/`trackingCode` hoặc tracking không khớp; 409: đơn không còn ở `shipping` | Đối chiếu header, secret trong secret manager, trạng thái đơn, `shipment.trackingCode` | Không log secret. Đồng bộ lại secret/định dạng payload với đối tác; webhook đã idempotent khi đơn `delivered` (trả 200). |
| 7.5 | Admin chuyển đơn sang `shipping` bị **400** `ORDER_SHIPPING_INFO_REQUIRED` | Contract yêu cầu `carrier` + `trackingCode`; client gửi thiếu (đã được đồng bộ trong collection Postman qua PR #123) | Xem body request admin, đối chiếu `src/services/orderStatusService.js` | Bổ sung đúng 2 field vào request; **không** nới validation hay đổi assertion để che lỗi. |
| 7.6 | Danh sách sản phẩm chậm sau deploy, `explain` hiện `SORT` | `autoIndex=false` ở production → index mới từ schema chưa tồn tại | So sánh `db.products.getIndexes()` giữa test và production; xem báo cáo T4-2-3/T7-2-2 | Tạo index bằng quy trình có phê duyệt/backup (`Model.init()` hoặc script index chuyên dụng). Không chạy `npm run seed` trên DB thật. |
| 7.7 | Log chứa `[SMS][OTP] … code=` | `SMS_PROVIDER=console` (mặc định) in OTP ra stdout; repo chưa tích hợp provider thật | `grep '[SMS][OTP]'` trên log (không chia sẻ log ra ngoài) | Không dùng `console` ở production; đưa tích hợp provider vào backlog riêng. Không tự thêm dependency trong PR docs. |
| 7.8 | Audit log có dòng JSON `scope=audit` nhưng request vẫn thành công | Ghi audit fail-open (cố ý): mutation không trả 500 vì lỗi audit | Tìm dòng log `scope=audit` kèm `action`, `targetType`, `targetId` | Theo dõi/cảnh báo; nếu downtime audit kéo dài, event có thể mất — đề xuất outbox/retry cho Lead (xem handoff §4). |
| 7.9 | Đơn `delivered` không tự sang `completed` | Job chạy trong process web, bị restart liên tục hoặc `AUTO_COMPLETE_DAYS` đặt quá lớn; log `[auto-complete] job that bai` | Kiểm tra log định kỳ ~10 phút và giá trị `AUTO_COMPLETE_DAYS` | Restart đúng process, sửa giá trị nếu sai. Không thêm cron mới. |
| 7.10 | Đơn `pending` quá hạn không bị hủy | Job hủy quá hạn là CLI riêng, chưa được lên lịch tự động | Xem [`DEV1_OPS_RUNBOOK_HANDOFF.md`](DEV1_OPS_RUNBOOK_HANDOFF.md) §1–2; chạy dry-run để đếm | Chỉ chạy job/migration sau phê duyệt + backup + dry-run. T8-1-3 **không** cấu hình cron. |
| 7.11 | Rate limit "không hiệu lực" khi chạy nhiều instance | `MemoryStore` đếm theo process, reset khi restart | So sánh số instance/pod và log restart | Chưa có store dùng chung; đề xuất Redis/Mongo + phê duyệt dependency riêng (handoff §3). Giữ response 429 hiện tại. |
| 7.12 | Trang danh mục/Mega Menu hiển thị cũ sau khi sửa danh mục | Cache snapshot in-process, TTL `CATEGORY_CACHE_TTL_MS`; instance khác chưa invalidate | Đợi quá TTL (mặc định 60s) hoặc restart instance | Không xóa DB; cân nhắc TTL phù hợp khi có nhiều instance. |
| 7.13 | CI/test fail `E11000 … variants.sku_1` | `skuFor()` trong `test/integration/create-order.integration.test.js` sinh SKU ngẫu nhiên 100–999, va chạm seed | Rerun job; đối chiếu log tại `seedProduct` | Đây là flaky test-data cũ, không phải lỗi production. Không đổi source/assertion để "sửa" trong PR docs. |
| 7.14 | Jest báo `Missing required sub-document 'driver'` | `mongodb@7.x` dùng dynamic `import()` trong Jest VM | Kiểm tra `NODE_OPTIONS` | Dùng `npm run test:jest` (script đã set `--experimental-vm-modules`); không chạy `npx jest` trực tiếp. |

Nguyên tắc xử lý sự cố: **đo → đối chiếu cấu hình → thay đổi tối thiểu → smoke lại → ghi log**. Không dán secret/token/connection string thật vào ticket hay báo cáo.

---

## 8. Liên kết

| Tài liệu | Nội dung |
|---|---|
| [`README.md`](../../README.md) | Cài đặt, `.env`, chạy dev/production, test, API, cảnh báo bảo mật |
| [`DEV1_OPS_RUNBOOK_HANDOFF.md`](DEV1_OPS_RUNBOOK_HANDOFF.md) | Job quá hạn, migration `expiresAt`, rate limit dùng chung, audit fail-open |
| [`PHASE4_DEV1_T7_1_3_CONFIG_REVIEW_CHECKLIST.md`](PHASE4_DEV1_T7_1_3_CONFIG_REVIEW_CHECKLIST.md) | Rate limit / body / cookie — nguồn của §4 và §7 |
| [`PHASE4_DEV1_T7_1_3_CONFIG_REVIEW_REPORT.md`](PHASE4_DEV1_T7_1_3_CONFIG_REVIEW_REPORT.md) | Kết quả rà soát cấu hình (dependency T7-1-3) |
| [`T1-4-2_NFR_TEST_PLAN.md`](T1-4-2_NFR_TEST_PLAN.md) | NFR/test plan sau Phase 4 T7 |
| [`T1-4-3_DOCS_INDEX.md`](T1-4-3_DOCS_INDEX.md) | Mục lục minh chứng theo chương docx |
| [`PHASE4_DEV1_T8-1-3_OPERATIONS_DOCUMENTATION_REPORT.md`](PHASE4_DEV1_T8-1-3_OPERATIONS_DOCUMENTATION_REPORT.md) | Báo cáo hoàn tất task này |

---

## 9. Trạng thái công việc

| Hạng mục | Trạng thái |
|---|---|
| Thu thập cấu hình/code thực tế | **DONE** |
| Viết runbook + checklist + báo cáo | **DONE** |
| Kiểm tra link tương đối / `git diff --check` | Xem báo cáo task |
| Deploy thật / chạy migration / bật cron | **NOT RUN** — ngoài phạm vi docs-only |
| Thay đổi dependency / hạ tầng / secret | **SKIP** — không thực hiện |
