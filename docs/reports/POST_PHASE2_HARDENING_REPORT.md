# Báo cáo Hardening sau Phase 2

- **Ngày:** 2026-11-16
- **Branch làm việc:** `feature/post-phase2-hardening` (tách từ `feature/T4-1-3-profile-api` tại `8ea7f97`)
- **Phạm vi:** T2-1-3, T2-2-1, MongoDB integration test, xử lý commit `6614096`, chuẩn hóa `.env`, regression test.
- **Nguyên tắc:** không push, không merge `main`, không rewrite lịch sử đã push, không in giá trị bí mật.

---

## A. Tổng quan

### Đã xử lý
- Đối chiếu và xác nhận T2-1-3 đã có đủ `validate(schema)` bằng Zod và giải pháp CSRF double-submit cookie + kiểm tra Origin/Referer; không tạo middleware trùng lặp.
- Hoàn thiện User Schema theo data dictionary: đổi trường chuẩn sang `password`, bổ sung `phone`, `addresses` (tối đa 3), `isDeleted`, `deletedAt`; giữ `status`, `tokenVersion` làm phần mở rộng Phase 2; thêm index `status`; chuẩn hóa `toJSON`.
- Đồng bộ toàn bộ service/middleware và unit test sang trường `password`.
- Thêm bộ integration test chạy trên MongoDB thật (local test DB), có setup/teardown và chỉ xóa dữ liệu do test tạo.
- Xử lý an toàn commit `6614096`: xác định chỉ nằm trên branch local `errorHandler.js`, đã backup rồi đưa branch về `141eac0`; commit không còn trong bất kỳ ref nào (vẫn còn trong reflog/object store — xem mục E).
- Chuẩn hóa `.env` cục bộ, bổ sung đủ khóa, giữ nguyên giá trị URI hiện có; thêm `scripts/check-env.js`.
- Chạy lại toàn bộ unit + integration test: **85 pass / 0 fail / 0 skip** (bao gồm 1 entry helper của thư mục `test/support`).

### Chưa xử lý (cần thao tác thủ công hoặc cần xác nhận)
- `JWT_SECRET` trong `.env` đang để trống — server chưa thể khởi chạy cho tới khi người dùng điền.
- Credential MongoDB Atlas trong `6614096` phải được coi là **đã lộ** và cần rotate trên Atlas.
- Chưa purge hoàn toàn object `6614096` khỏi Git object store/reflog vì cần xác nhận trước khi chạy `gc`/`reflog expire`.
- Chưa chạy server thật với Atlas (tránh dùng production DB và do thiếu `JWT_SECRET`).
- Chi tiết từng trường trong `Address[]` chưa có trong data dictionary nên schema con là tạm thời.

### Trạng thái chung
Code Phase 2 chạy được với MongoDB thật trên môi trường test; unit test và integration test đều pass. Các thay đổi đang ở trạng thái **chưa commit** trên branch hardening để bảo toàn nguyên trạng công việc.

---

## B. T2-1-3 — Validate & CSRF

### Đặc tả đã đọc
- WBS `02_WBS`, dòng `T2-1-3`: “Middleware validate(schema) dùng Zod; tra cứu và chọn thư viện CSRF còn được hỗ trợ”; sản phẩm: mã nguồn + checklist; DoD: “Chốt giải pháp CSRF”.

### File liên quan
- `src/middleware/validate.js` — middleware Zod dùng chung.
- `src/validators/authValidator.js` — schema register/login/update profile.
- `src/middleware/csrf.js` — double-submit cookie + Origin/Referer.
- `src/routes/auth.route.js`, `src/routes/profile.route.js` — nơi gắn middleware.
- `src/middleware/errorHandler.js` — chuẩn hóa lỗi trả về.
- `test/auth.csrf.test.js`, `test/auth.register.test.js`, `test/auth.login.test.js`, `test/auth.profile.test.js`, `test/auth.rate-limit.test.js`.

### Chức năng đã xác nhận
- `validate(schema)` dùng `safeParse`, trả `400` với `details[]` gồm `field` + `message`, thay `req.body` bằng dữ liệu đã parse (loại field lạ).
- `registerSchema` chỉ cho `role: 'customer'`; `loginSchema` chuẩn hóa email; `updateProfileSchema` chỉ cho `name`, `email` và bắt buộc ít nhất 1 trường.
- CSRF áp dụng cho các endpoint thay đổi dữ liệu có cookie auth: `POST /api/auth/refresh`, `POST /api/auth/logout`, `PATCH /api/profile/me`.
- CSRF kiểm tra đồng thời:
  - cookie `csrfToken` và header `X-CSRF-Token` khớp nhau bằng so sánh timing-safe;
  - `Origin`/`Referer` thuộc `APP_ORIGIN` (hỗ trợ nhiều origin phân tách bằng dấu phẩy).
- Endpoint `GET /api/auth/csrf` cấp token mới; cookie CSRF để `httpOnly: false` cho frontend đọc, `SameSite=Strict`.
- Login/register không yêu cầu CSRF vì chưa dùng phiên cookie cũ.
- Lỗi validation và CSRF đều đi qua `errorHandler`, format thống nhất `{ success: false, error, details? }`.

### Khác biệt so với đặc tả
- WBS yêu cầu “tra cứu và chọn thư viện CSRF còn được hỗ trợ”. Dự án đang dùng middleware tự viết theo chuẩn double-submit thay vì thư viện ngoài. Cách này đáp ứng DoD “chốt giải pháp CSRF”, không thêm dependency và đã được test. Nếu team muốn dùng thư viện (ví dụ `csrf-csrf`), cần một task riêng để thay thế, không làm trùng lặp ở thời điểm này.
- Không thấy tài liệu mô tả chi tiết response schema của từng endpoint ngoài format chung; các message hiện tại là tiếng Việt không dấu, giữ nguyên theo code Phase 2.

### Kết quả test
- Unit: các test register/login/CSRF/profile/rate-limit đều pass (xem mục G).
- Integration: `IT-CSRF` xác nhận refresh thiếu token trả `403` trên MongoDB thật.

---

## C. T2-2-1 — User Schema

### Đặc tả đã đọc
- Data dictionary `docs/thiet-ke-csdl/data-dictionary-1.png` và `data-dictionary-2.png`.
- WBS `T2-2-1`: viết schema User (cùng Category, Product), kèm ràng buộc và message lỗi; DoD: schema chạy được.
- Lưu ý: phạm vi T2-2-1 trong WBS gồm cả Category/Product, nhưng yêu cầu hardening lần này tập trung User. Product model hiện có vẫn giữ nguyên.

### Trước khi sửa
- Trường lưu mật khẩu tên `passwordHash` (không khớp data dictionary dùng `password`).
- Thiếu `phone`, `addresses`, `isDeleted`, `deletedAt`.
- `toJSON` chỉ xóa `passwordHash`, chưa xử lý `isDeleted`/`__v`/`id`.
- Chưa có index `status`.
- Service/middleware và test dùng trực tiếp `passwordHash`.

### Sau khi sửa (`src/model/User.js`)
| Trường | Kiểu / ràng buộc | Ghi chú |
|---|---|---|
| `name` | String, required, trim, max 80 | |
| `email` | String, required, unique, lowercase, trim, regex | Chuẩn hóa + unique |
| `password` | String, required, `select: false` | Trường chuẩn theo data dictionary |
| `role` | enum `customer` / `admin`, default `customer` | |
| `phone` | String, trim, regex `(0|\+84)` + 9–10 số | Tùy chọn |
| `addresses` | mảng subdocument, tối đa 3 | Trường con tạm thời (xem ghi chú) |
| `isDeleted` | Boolean, default `false` | Soft delete |
| `deletedAt` | Date, default `null` | |
| `status` | enum `active` / `blocked`, default `active` | Mở rộng Phase 2 |
| `tokenVersion` | Number, default 0, min 0 | Mở rộng Phase 2, thu hồi token |
| `createdAt`, `updatedAt` | timestamps | |

- Index: `email` unique (khai báo trên field), `status: 1`.
- `toJSON`: trả `id`, xóa `_id`, `__v`, `password`, `passwordHash`, `isDeleted`.
- Virtual `passwordHash` (get/set) giữ tương thích code cũ nhưng **không lưu thêm field**.
- `addresses` dùng các trường `label`, `recipient`, `phone`, `street`, `ward`, `district`, `city`, `isDefault`. Data dictionary chỉ ghi `Address[]` tối đa 3, không liệt kê trường con → đây là phần tạm thời, cần chốt lại khi có đặc tả Address.

### API sử dụng User Model
- `src/services/authService.js`: register, login, refresh, logout.
- `src/middleware/authenticate.js`: đọc lại user từ DB, chặn `isDeleted`, `status !== 'active'`, sai `tokenVersion`.
- `src/services/profileService.js`: đọc/cập nhật profile, chặn user đã xóa mềm.
- `src/controllers/profileController.js`: dùng `toPublicUser` từ authService.

Không có User Model thứ hai; toàn bộ dùng `src/model/User.js`.

### Kết quả test
- `test/user.model.test.js`: 11 test cho field, enum, email normalization, phone, giới hạn 3 địa chỉ, virtual `passwordHash`, index `status`, `toJSON`.
- Integration `IT-SCHEMA`: ghi/đọc `phone`, `addresses`, `isDeleted`, `status` từ MongoDB thật.

---

## D. MongoDB Integration Test

### Môi trường
- Loại DB: **MongoDB local**, database riêng tên `abmt_shop_test`.
- URI lấy từ `TEST_MONGODB_URI`, mặc định `mongodb://127.0.0.1:27017/abmt_shop_test` (không dùng URI Atlas trong `.env`).
- Có guard: tên database **bắt buộc chứa `test`**, nếu không thì toàn bộ test được skip.
- Nếu không kết nối được MongoDB, test skip với lý do, không fail.
- Setup: `mongoose.connect` + `User.init()` để tạo index.
- Teardown: chỉ `deleteMany` các email có tiền tố `it-<runId>-` do lần chạy đó tạo; sau đó `mongoose.disconnect()`.

### File
- `test/integration/mongodb.integration.test.js`
- `test/integration/rate-limit.integration.test.js`

### Test case đã chạy
| Mã | Nội dung |
|---|---|
| IT-REGISTER | Tạo user thật trong MongoDB, kiểm tra bcrypt hash |
| IT-UNIQUE | Email trùng trả 409, không tạo thêm bản ghi |
| IT-SCHEMA | Ghi/đọc `phone`, `addresses`, `isDeleted`, `status` |
| IT-LOGIN | Login thật, access token xác thực `/api/auth/me` |
| IT-REFRESH | Refresh rotation, token cũ replay trả 401 |
| IT-CSRF | Refresh thiếu CSRF token trả 403 |
| IT-LOGOUT | Logout tăng `tokenVersion` trong DB, refresh cũ bị thu hồi |
| IT-RBAC-IDOR | Customer không xem được profile admin |
| IT-PROFILE | PATCH profile cập nhật thật trong MongoDB |
| IT-SOFT-DELETE | User `isDeleted: true` không đăng nhập được |
| IT-COOKIE | Cookie auth được set, token không lộ trong body |
| IT-RATE-LIMIT | Vượt ngưỡng login trả 429 (file riêng, ngưỡng thấp) |

### Kết quả
- **PASS: 12 — FAIL: 0 — SKIP: 0**
- Xác nhận test **có thực sự ghi và đọc MongoDB**: các test register/login/profile/logout đều kiểm tra lại document bằng `User.findOne`/`findById`/`countDocuments`, không chỉ nhìn HTTP response.

### Chưa thể / chưa thực hiện
- Chưa chạy trên Atlas hoặc replica set; hành vi transaction/rollback chưa được kiểm chứng.
- Chưa test race condition refresh đồng thời (replay được test tuần tự).
- Rate limit được test ở process riêng với ngưỡng thấp, không chạy chung suite chính để tránh ảnh hưởng các test khác.

---

## E. Security & Git History

### Commit `6614096`
- Nội dung: cập nhật `.env.example`, chứa URI MongoDB Atlas thật (không in giá trị).
- Ref chứa commit: chỉ `refs/heads/errorHandler.js` (branch local).
- Không nằm trong `main`, không nằm trong bất kỳ `refs/remotes/*` nào.
- Không có commit con (là tip của branch).
- Các commit khác có chuỗi `mongodb+srv://`: `86ec2e1` (`.env.example` toàn placeholder) và `3b5a207` (`.env.test.example` dùng placeholder). Không phát hiện credential thật.

### Đã làm sạch
1. Tạo backup bundle:
   `C:\Users\Admin\AppData\Local\Temp\opencode\errorHandler-backup-20261116-194945.bundle`
   (bundle này chứa commit nghi vấn — cần xóa an toàn sau khi thống nhất phương án).
2. `git update-ref refs/heads/errorHandler.js 141eac0` (đưa branch về commit cha đã push).
3. Xác nhận: **không còn ref nào chứa `6614096`**.

### Còn tồn tại
- Commit vẫn còn trong reflog (`errorHandler.js@{1}`) và Git object store. Chưa chạy:
  - `git reflog expire --expire=now --all`
  - `git gc --prune=now --aggressive`
  vì hai lệnh này ảnh hưởng toàn repository và cần người dùng xác nhận.
- Vì `6614096` chưa từng push, không cần force push và không ảnh hưởng remote.

### Hành động bảo mật bắt buộc (thủ công)
1. Đăng nhập MongoDB Atlas → **Database Access** → user bị lộ → **Edit** → **Edit Password** → tạo mật khẩu mới.
2. Nếu user dùng chung cho nhiều môi trường, tạo user riêng cho dev/test và giới hạn quyền.
3. Kiểm tra **Network Access** (IP allowlist), thu hồi IP không còn dùng.
4. Cập nhật `MONGODB_URI` trong `.env` bằng credential mới; không commit `.env`.
5. Sau khi xác nhận, cân nhắc xóa backup bundle nêu trên.

### Kết quả secret scan
- Quét mọi ref với mẫu URI Atlas có credential thật (loại placeholder `<...>`): **không phát hiện**.
- Quét file tracked hiện tại: chỉ phát hiện `JWT_SECRET` là secret test cố ý trong các file `test/auth.*.test.js`; không có credential thật.
- `.env` không được Git track (đã kiểm tra `git ls-files`).

---

## F. Environment

### Biến bắt buộc theo code hiện tại
| Biến | Bắt buộc | Ghi chú |
|---|---|---|
| `MONGODB_URI` | Có | `src/config/db.js` |
| `JWT_SECRET` | Có | `src/services/tokenService.js`; hiện đang trống |
| `NODE_ENV` | Khuyến nghị | Ảnh hưởng cookie `Secure`, log lỗi |
| `PORT` | Không (mặc định 3000) | |
| `DB_MAX_RETRIES`, `DB_RETRY_DELAY_MS` | Không | Mặc định 5 / 3000 |
| `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | Không | Mặc định 15m / 7d |
| `APP_ORIGIN` | Không | Mặc định `http://localhost:3000`; hỗ trợ nhiều origin |
| `AUTH_RATE_LIMIT_WINDOW_MS`, `AUTH_RATE_LIMIT_MAX` | Không | Mặc định 900000 / 20 |
| `TEST_MONGODB_URI` | Chỉ integration test | Tùy chọn; mặc định local `abmt_shop_test` |

### File đã sửa / tạo
- `.env` (local, **không commit**): chuẩn hóa định dạng, bổ sung đủ khóa, giữ nguyên URI hiện có, `JWT_SECRET` để trống.
- `scripts/check-env.js` (mới): kiểm tra biến bắt buộc, chỉ in `SET/MISSING` và độ dài, không in giá trị.
- `package.json`: thêm `test:unit`, `test:integration`, `test:all`, `check:env`.
- `.env.example`: giữ nguyên, đã là placeholder đầy đủ.
- `.gitignore`: đã có `.env`, `.env.*`, miễn trừ `.env.example`.

### Server đã khởi chạy được chưa?
- **Chưa.** `JWT_SECRET` đang trống nên login sẽ lỗi 500 và server chưa sẵn sàng cho auth. `npm run check:env` trả exit code `1` với `JWT_SECRET: MISSING`.
- Chưa chạy server với Atlas để tránh dùng production DB trong quá trình hardening.

### Thông tin cần tự cập nhật
- Điền `JWT_SECRET` mạnh (tối thiểu 32 ký tự) vào `.env`.
- Cập nhật `MONGODB_URI` sau khi rotate Atlas.
- Điền `TEST_MONGODB_URI` nếu muốn dùng MongoDB test khác local.

---

## G. Regression Test

### Lệnh đã chạy
```bash
npm test                 # unit test
npm run test:integration # MongoDB integration test
npm run test:all         # toàn bộ
node --check <các file đã sửa>
```

### Kết quả từng nhóm
| Nhóm | Kết quả |
|---|---|
| `test/auth.register.test.js` | PASS |
| `test/auth.login.test.js` | PASS |
| `test/auth.refresh-logout.test.js` | PASS |
| `test/auth.rbac.test.js` | PASS |
| `test/auth.csrf.test.js` | PASS |
| `test/auth.profile.test.js` | PASS |
| `test/auth.rate-limit.test.js` | PASS |
| `test/user.model.test.js` | PASS |
| `test/integration/mongodb.integration.test.js` | 11 PASS |
| `test/integration/rate-limit.integration.test.js` | 1 PASS |
| Helper `test/support/fakeUserModel.js` | 1 entry PASS |

### Tổng
- **Unit:** 72 PASS / 0 FAIL / 0 SKIP.
- **Integration:** 12 PASS / 0 FAIL / 0 SKIP.
- **`npm run test:all`:** 85 PASS / 0 FAIL / 0 SKIP (gồm entry helper).
- `node --check` trên các file đã sửa: OK.
- Không có cấu hình ESLint/Prettier trong repo nên không chạy lint.

### Lỗi còn tồn tại
- Không có lỗi test.
- Cảnh báo Mongoose deprecated `new` trong `findOneAndUpdate` đã được sửa sang `returnDocument: 'after'`.

---

## H. Git Status

- **Branch hiện tại:** `feature/post-phase2-hardening`
- **Commit mới:** chưa tạo (giữ nguyên thay đổi để người dùng kiểm tra trước khi commit).
- **Push:** không push.
- **Merge `main`:** không.
- **Branch `errorHandler.js`:** đã đưa về `141eac0`; không còn ref chứa `6614096`.

### File modified
- `package.json`
- `src/middleware/authenticate.js`
- `src/model/User.js`
- `src/services/authService.js`
- `src/services/profileService.js`
- `test/auth.csrf.test.js`
- `test/auth.login.test.js`
- `test/auth.profile.test.js`
- `test/auth.rbac.test.js`
- `test/auth.refresh-logout.test.js`
- `test/auth.register.test.js`
- `test/support/fakeUserModel.js`
- `test/user.model.test.js`

### File untracked
- `docs/reports/PHASE2_DEV1_BAO_CAO_2026-11-15.md` (báo cáo cũ, giữ nguyên)
- `docs/reports/POST_PHASE2_HARDENING_REPORT.md` (báo cáo này)
- `scripts/check-env.js`
- `test/integration/mongodb.integration.test.js`
- `test/integration/rate-limit.integration.test.js`

### Xác nhận
- Không có secret thật trong diff/file tracked.
- `.env` không được commit.
- Không push, không merge `main`, không force push.

---

## I. Việc cần làm tiếp

1. **Điền `JWT_SECRET`** mạnh vào `.env` (tối thiểu 32 ký tự), sau đó chạy `npm run check:env` để xác nhận.
2. **Rotate MongoDB Atlas credential** bị lộ trong `6614096` theo hướng dẫn mục E; cập nhật lại `MONGODB_URI` trong `.env`.
3. **Xác nhận purge Git object** rồi chạy:
   ```bash
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive
   ```
   Chỉ chạy sau khi đã xác nhận không cần khôi phục `6614096`.
4. **Xóa backup bundle** `errorHandler-backup-20261116-194945.bundle` sau khi quyết định purge (bundle chứa credential cũ).
5. **Chốt đặc tả Address**: bổ sung trường con của `Address` vào data dictionary để hoàn thiện `addresses`.
6. **Quyết định có dùng thư viện CSRF** (ví dụ `csrf-csrf`) hay giữ middleware tự viết; nếu đổi, làm task riêng và cập nhật test.
7. **Review và commit** các thay đổi trên branch `feature/post-phase2-hardening` sau khi kiểm tra diff; hiện chưa commit.
8. **Chạy server thật** với Atlas sau khi có `JWT_SECRET` và credential mới để xác minh khởi động end-to-end.
9. **Cân nhắc thêm integration test** cho refresh đồng thời (race) và cho Category/Product nếu T2-2-1 được mở rộng.
