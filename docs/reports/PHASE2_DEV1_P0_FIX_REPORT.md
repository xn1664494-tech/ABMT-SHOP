# PHASE 2 DEV 1 — P0 FIX REPORT

- **Ngày:** 2026-11-19
- **Nhánh tích hợp:** `feature/post-phase2-hardening` @ `2131f56`
- **PR liên quan:** #35 (P0-1), #37 (P0-2)
- **Phạm vi:** chỉ 2 lỗi P0 đã được user duyệt; không đụng `main`, không đụng tài liệu bảo vệ.

---

## 1. Kết quả

| ID | Vấn đề | Fix | Trạng thái |
|---|---|---|---|
| P0-1 | `test/category.api.test.js` fail 16/16 trên mọi branch | PR #35 (`866b7c6`) | **CLOSED** |
| P0-2 | Route ghi Category thiếu `csrfProtection` | PR #37 (`f4295f2`) | **CLOSED** |

---

## 2. P0-1 — Sửa test `category.api.test.js`

Nguyên nhân gốc (3 defect) và cách xử lý:

1. `const { default: request } = require('supertest')` → `const request = require('supertest')` (CommonJS export là function).
2. Dùng `t.context.parentId/childId` như biến chia sẻ giữa các test, nhưng `t.context` là **per-test** → thay bằng biến module-level `parentId`/`childId`.
3. Token ký với `sub: 'admin-test-id'`/`'customer-test-id'` (chuỗi giả) trong khi `authenticate()` gọi `User.findById(payload.sub)` → ký token với `_id` thật của user vừa tạo trong `test.before`.

Bổ sung: nạp `.env.test`, ưu tiên `MONGODB_URI_TEST` rồi đến `TEST_MONGODB_URI`, giữ guard tên DB chứa `test`.

Ngoài ra, test "đặt cha là con gây vòng lặp" đã bị đảo chiều (cập nhật `childId` với `parentId: parentId` là hợp lệ): đổi thành cập nhật `parentId` với `parentId: childId` để thực sự kiểm tra detect cycle.

**Bằng chứng:** `node --test test/category.api.test.js` → **16/16 pass**; `npm test` → **181/181 pass**.

---

## 3. P0-2 — CSRF cho route ghi Category

`src/routes/category.route.js` thêm `csrfProtection` **sau** `authenticate, requireAdmin` cho `POST /`, `PUT /:id`, `PATCH /:id`, `DELETE /:id`.

Thứ tự này giữ nguyên hợp đồng lỗi đã có:

- chưa đăng nhập → **401** (auth chạy trước);
- không phải admin → **403** (RBAC chạy trước);
- admin nhưng thiếu/sai CSRF → **403** (CSRF chạy sau RBAC).

Test được cập nhật dùng `request.agent(app)` để giữ cookie `csrfToken` từ `GET /api/auth/csrf` và gửi `X-CSRF-Token` qua double-submit. Thêm 5 case phủ định:

- POST thiếu CSRF → 403;
- POST CSRF sai → 403;
- PUT thiếu CSRF → 403;
- PATCH thiếu CSRF → 403;
- DELETE thiếu CSRF → 403.

**Bằng chứng:** category test **21/21 pass**; `npm test` **186/186 pass**.

---

## 4. Verification tổng hợp (trên `2131f56`, DB `abmt_shop_test`)

| Bộ test | Lệnh | Kết quả |
|---|---|---|
| Unit | `npm test` | **186/186 pass** |
| Integration | `npm run test:integration` | **32/32 pass** |
| Jest | `npm run test:jest` | **3 suite / 8 test pass** |

Tổng: **226 test**, **226 pass**, 0 fail.

---

## 5. Còn lại sau khi đóng 2 P0

- **R7** Review chéo (DoD #4): chưa có; repo chưa có CI check-run.
- **R9** V3 staging: **NOT VERIFIED** (không có môi trường/reverse proxy).
- **T4-1-2** vẫn **PARTIAL**: chưa có endpoint "quên mật khẩu".
- **PR #21** (`main ← feature/post-phase2-hardening`) vẫn mở, chờ user quyết định.

> Không tuyên bố release sẵn sàng khi R7/R9 và T4-1-2 chưa xong. Báo cáo này chỉ xác nhận 2 lỗi P0 đã được sửa và kiểm chứng bằng test chạy thật.
