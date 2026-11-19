# ABMT SHOP

Backend/API cho dự án ABMT Shop (Node.js, Express, MongoDB/Mongoose, JWT cookie auth).  
Tài liệu này phản ánh **trạng thái code hiện tại** (Dev 1 Phase 2 hardening) và không mô tả các tính năng chưa triển khai là đã hoàn thành.

## 1. Giới thiệu

- Kiến trúc: MVC (routes / controllers / services / middleware / model / views).
- Xác thực: JWT lưu trong cookie `HttpOnly` (`accessToken`, `refreshToken`) + cơ chế refresh/rotation và `tokenVersion`.
- Bảo vệ: CSRF double-submit cho request thay đổi trạng thái dùng cookie auth, rate limit cho endpoint auth, RBAC/IDOR trên route thật.
- View: EJS cho trang chủ và trang lỗi HTML; API dưới prefix `/api` trả JSON.

## 2. Yêu cầu môi trường

- Node.js (khuyến nghị LTS hiện hành; repo đã được kiểm thử với Node 24 trong môi trường phát triển).
- npm.
- MongoDB (local hoặc Atlas) cho chạy ứng dụng; MongoDB local khuyến nghị cho integration test.
- Git.

## 3. Cài đặt dependencies

```bash
npm install
```

## 4. Cấu hình `.env` (ứng dụng)

Tạo file `.env` từ mẫu và điền giá trị phù hợp (không commit `.env`):

```bash
copy .env.example .env
```

Các biến chính (`.env.example`):

| Biến | Ý nghĩa |
|---|---|
| `NODE_ENV` | `development` / `production` / `test` |
| `MONGODB_URI` | Chuỗi kết nối MongoDB (Atlas: cần allowlist IP) |
| `PORT` | Cổng server (mặc định 3000) |
| `DB_MAX_RETRIES`, `DB_RETRY_DELAY_MS` | Retry kết nối DB khi khởi động |
| `JWT_SECRET` | Secret ký JWT (bắt buộc, đủ mạnh, giữ bí mật) |
| `JWT_ACCESS_EXPIRES_IN` | TTL access token (vd `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | TTL refresh token (vd `7d`) |
| `APP_ORIGIN` | Origin hợp lệ cho kiểm tra CSRF/Origin (vd `http://localhost:3000`) |
| `AUTH_RATE_LIMIT_WINDOW_MS` | Cửa sổ rate limit auth (ms) |
| `AUTH_RATE_LIMIT_MAX` | Số request tối đa trong cửa sổ |
| `TRUST_PROXY` | (Tuỳ chọn, production sau proxy) số hop (vd `1`) hoặc giá trị Express hợp lệ; **không** đặt nếu app truy cập trực tiếp |

> **Không** đặt `TRUST_PROXY` nếu ứng dụng không nằm sau reverse proxy tin cậy, để tránh client giả mạo `X-Forwarded-For`.

## 5. Cấu hình MongoDB

- Ứng dụng dùng `MONGODB_URI` (`src/config/db.js`).
- Kiểm tra env cơ bản:

```bash
npm run check:env
```

## 6. Cấu hình JWT

- `JWT_SECRET`: bắt buộc, không hardcode, không commit.
- `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`: điều khiển thời hạn access/refresh token.
- Access token và refresh token được set qua cookie `HttpOnly`; refresh token giới hạn path `/api/auth`.
- Đổi mật khẩu / logout / rotation làm tăng `tokenVersion` để vô hiệu hoá phiên/token cũ theo cơ chế hiện tại.

## 7. Cấu hình CSRF

- Endpoint lấy CSRF token: `GET /api/auth/csrf` (trả token và set cookie `csrfToken` đọc được bởi client JS để gửi kèm).
- Các request state-changing dùng cookie auth (ví dụ refresh, logout, cập nhật profile, đổi mật khẩu) yêu cầu CSRF token hợp lệ (header `X-CSRF-Token` hoặc cơ chế tương đương theo middleware) và kiểm tra Origin/nguồn theo `APP_ORIGIN`.

## 8. Chạy development

```bash
npm run dev
```

## 9. Chạy production

```bash
npm start
```

Khi chạy sau reverse proxy/TLS termination (ví dụ Render/nginx), cấu hình `TRUST_PROXY` phù hợp hạ tầng (thường `1`) để `req.ip` và secure cookie hoạt động đúng. Không bật trust proxy tuỳ tiện.

## 10. Chạy unit test

Bộ test `node:test` (Auth/Profile/RBAC/CSRF/rate limit/model/error handling...):

```bash
npm test
# hoặc
npm run test:unit
```

## 11. Chạy integration test (MongoDB thật)

Yêu cầu MongoDB test riêng (tên database chứa `test`). Tạo `.env.test` local từ mẫu:

```bash
copy .env.test.example .env.test
```

Ví dụ local:

```env
NODE_ENV=test
MONGODB_URI_TEST=mongodb://127.0.0.1:27017/abmt_shop_test
TEST_MONGODB_URI=mongodb://127.0.0.1:27017/abmt_shop_test
```

- `.env.test` **không được commit** (đã bị gitignore).
- Integration test node (`test/integration/*`) dùng `TEST_MONGODB_URI` (mặc định `mongodb://127.0.0.1:27017/abmt_shop_test` nếu không set) và chỉ xoá dữ liệu do test tạo trong DB test.
- **Không** dùng database production, không chạy seed/migration trên DB thật, không xoá dữ liệu ngoài phạm vi test DB.

Chạy:

```bash
npm run test:integration
# hoặc toàn bộ node --test
npm run test:all
```

## 12. Cấu hình `.env.test` và chạy Jest

`tests/setup.js` (Jest) và integration test (`node --test`) dùng **cùng một biến chuẩn `MONGODB_URI_TEST`**, trỏ tới database có tên chứa `test`.

```bash
# Windows PowerShell
Copy-Item .env.test.example .env.test
# Linux/macOS
cp .env.test.example .env.test
```

Quy tắc an toàn:
- Thiếu `MONGODB_URI_TEST` → test **dừng ngay** với thông báo rõ (không fallback im lặng về localhost, tránh chạy nhầm DB).
- Tên database không chứa `test` → test từ chối chạy.
- Tên cũ `TEST_MONGODB_URI` chỉ còn hỗ trợ tạm 1 sprint và có cảnh báo deprecated.

```bash
npm run test:jest
npm run test:jest:watch
```

> Lưu ý (đã xác định nguyên nhân gốc): với `mongodb@7.x`, driver dùng dynamic `import()`; trong Jest VM cần bật cờ VM modules, nếu không metadata handshake sẽ rỗng và MongoDB trả `Missing required sub-document 'driver'`.
>
> Hai script trên **đã** set sẵn `NODE_OPTIONS=--experimental-vm-modules` bằng `cross-env`, nên không cần export biến thủ công. Nếu chạy Jest trực tiếp (`npx jest`), phải tự bật cờ:
>
> ```bash
> # Windows PowerShell
> $env:NODE_OPTIONS="--experimental-vm-modules"; npx jest
> # Linux/macOS
> NODE_OPTIONS=--experimental-vm-modules npx jest
> ```
>
> Bộ `node:test` (unit + integration) là bằng chứng kiểm thử chính được xác minh trong quy trình Dev 1 Phase 2.

## 13. Các API Auth/Profile hiện có

| Method | Endpoint | Auth | CSRF | Mô tả |
|---|---|---:|---:|---|
| GET | `/api/auth/csrf` | - | - | Cấp CSRF token |
| POST | `/api/auth/register` | - | - | Đăng ký (rate limited) |
| POST | `/api/auth/login` | - | - | Đăng nhập, set auth cookies (rate limited) |
| POST | `/api/auth/refresh` | cookie refresh | Có | Xoay vòng refresh token (rate limited) |
| POST | `/api/auth/logout` | cookie | Có | Đăng xuất, thu hồi phiên (rate limited) |
| GET | `/api/auth/me` | access token | - | Thông tin user hiện tại |
| GET | `/api/profile/me` | access token | - | Profile của chính user |
| PATCH | `/api/profile/me` | access token | Có | Cập nhật profile (whitelist `name`, `email`) |
| PATCH | `/api/profile/me/password` | access token | Có | Đổi mật khẩu (xác minh mật khẩu hiện tại, hash bcrypt, tăng `tokenVersion`, xoá auth cookies) |
| GET | `/api/profile/:userId` | access token | - | Xem profile (chính chủ hoặc admin) |
| GET | `/api/admin/access-check` | access token + `admin` | - | Endpoint kiểm tra quyền admin tối thiểu (RBAC trên route thật) |
| GET | `/api/products` | - | - | Danh sách sản phẩm đang bán (admin có thể `includeInactive`/`includeDeleted`) |
| GET | `/api/products/:id` | - | - | Chi tiết sản phẩm đang bán (admin dùng cờ tương tự) |
| POST | `/api/products` | access token + `admin` | Có | Tạo sản phẩm (validate thuần, chặn trùng Size–Màu, tồn kho ≥ 0, ảnh là URL) |
| PUT / PATCH | `/api/products/:id` | access token + `admin` | Có | Cập nhật sản phẩm |
| DELETE | `/api/products/:id` | access token + `admin` | Có | Xóa mềm sản phẩm |

### Query helper loại bản ghi đã xóa

- `User`, `Category`, `Product` dùng plugin `src/plugins/softDelete.js`.
- Mặc định mọi truy vấn `find*`, `countDocuments` và `aggregate` tự thêm điều kiện `isDeleted != true`.
- Truy vấn có `isDeleted` tường minh (ví dụ `{ isDeleted: true }`) được giữ nguyên.
- Muốn đọc cả bản ghi đã xóa, dùng `.setOptions({ includeDeleted: true })`; Product admin dùng query flag `?includeDeleted=true`.
- Kiểm thử: `test/soft-delete.plugin.test.js` và collection `postman/QueryHelper.postman_collection.json` (chạy qua `npm run test:postman`).

Các API nghiệp vụ khác (Cart/Order, Admin CRUD đầy đủ, bộ lọc nâng cao, Audit log, Cron, v.v.) **chưa** thuộc phạm vi đã hoàn thành trong tài liệu này.

## 14. Quy tắc Git branch của team

- Mỗi task trên một branch riêng, không gộp nhiều task vào một branch.
- Stacked branches theo chuỗi kế thừa khi làm chuỗi task phụ thuộc; ghi rõ branch cha và base commit.
- Không push/merge trực tiếp vào `main` (hoặc `develop`) khi chưa có quy trình review/PR.
- Không force-push, không `reset --hard`, không `clean/restore` xoá thay đổi, không xoá branch/commit/reflog.
- Commit/push sau khi test liên quan PASS, diff đúng scope, không chứa secret.
- Không tự ý commit/stash/restore thay đổi không thuộc phạm vi.

## 15. Các cảnh báo bảo mật còn tồn tại

- **Rate limit memory store:** counter lưu trong bộ nhớ tiến trình, reset khi restart và **không chia sẻ** giữa nhiều instance/pod → chưa phải distributed rate limiting. Chỉ cân nhắc Redis/store dùng chung khi có hạ tầng và nhu cầu multi-instance.
- **Trust proxy:** phải cấu hình `TRUST_PROXY` đúng với hạ tầng thực tế khi đứng sau proxy; cấu hình sai có thể ảnh hưởng xác định IP/secure cookie. Mặc định không bật để tránh tin `X-Forwarded-For` giả mạo.
- **CSRF/Origin:** phụ thuộc cấu hình `APP_ORIGIN` và client gửi token đúng; cần kiểm tra lại khi đổi domain/deploy.
- **JWT secret & env:** `JWT_SECRET`, `MONGODB_URI` và các secret khác phải quản lý an toàn (env/secret manager), không đưa vào Git/báo cáo.
- **Category/Product dependency:** `Category` model và API Category đã có (T2-2-1); Product API (T3-2-2) đã có CRUD cơ bản. Bộ lọc nâng cao (`buildFilter`, `$elemMatch`) vẫn thuộc T4-2-1.
- **Jest/toolchain:** bộ Jest có thể yêu cầu môi trường tương thích; không thay thế bằng mock cho integration MongoDB thật.
