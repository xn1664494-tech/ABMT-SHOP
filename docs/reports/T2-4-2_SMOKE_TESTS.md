# T2-4-2 — Test cơ bản (smoke `/health` + validate env)

- **Ngày:** 2026-11-21
- **Nhánh:** `test/T2-4-2-smoke-tests` (tách từ `test/T2-4-1-jest-infra` để kế thừa `forceExit`)
- **WBS:** dòng 24 (`1.2.11`), 4h, ưu tiên TB, phụ thuộc `T1-4-3`.
- **Sản phẩm bàn giao:** Test + báo cáo.
- **DoD:** Test smoke xanh.
- **Reviewer:** Dev 3 (chưa xác nhận → workbook giữ 90%).

---

## 1. Phạm vi 3 suite smoke

| File | Test | Bao phủ |
|---|---|---|
| `tests/env.test.js:11-19` | 2 | `connectDB()` ném `Thiếu MONGODB_URI` khi biến bị xoá hoặc để rỗng (`src/config/db.js:37-43`) |
| `tests/health.test.js:4-9` | 1 | `GET /health` → 200 `{ status: "ok" }` (`src/app.js:48`), dùng `supertest` không mở cổng |
| `tests/infra.test.js:6-29` | 5 | `NODE_ENV=test`; `mongoose.connection.readyState=1` + tên DB chứa `test`; ghi/đọc; `afterEach` dọn sạch (`tests/setup.js:53-56`); import `src/app` trả về function |

Tổng **3 suite / 8 test**. Các guard an toàn nằm ở `tests/setup.js:26-39`: thiếu `MONGODB_URI_TEST` → dừng; tên DB không chứa `test` → dừng; trùng `MONGODB_URI` dev/production → dừng.

---

## 2. Kết quả chạy

| Lệnh | Kết quả |
|---|---|
| `npm run test:jest` (với `JWT_SECRET` tạm trong shell) | **3 suite passed / 3 total; 8 test passed / 8 total; exit 0** (~12.7s) |
| `npm run check:env` | exit 0; các biến bắt buộc `MONGODB_URI`, `JWT_SECRET` đều SET; không in giá trị |
| `npm test` | **260/260 pass, 0 fail, 0 skip, exit 0** (kết quả chi tiết tại [`T2-4-1_TEST_INFRA.md`](T2-4-1_TEST_INFRA.md)) |

Không thêm test case mới, không sửa logic test. Nhánh này kế thừa cấu hình `forceExit: true` từ `test/T2-4-1-jest-infra`, giúp Jest không thoát mã 1 khi handshake MongoDB Atlas kết thúc sau lúc tear down (chi tiết mục 2 của báo cáo T2-4-1).

---

## 3. Đánh giá DoD

| Tiêu chí | Kết luận |
|---|---|
| Smoke `/health` xanh | ✅ 1/1 |
| Validate env xanh | ✅ 2/2 (`connectDB`) + `check:env` exit 0 |
| Hạ tầng DB test riêng | ✅ 5/5 (`infra.test.js`) |
| Không lộ secret | ✅ `check-env.js` chỉ in độ dài; `.env*` bị gitignore |
| Review chéo | ⏳ Chờ Dev 3 |

---

## 4. Giới hạn

- `tests/env.test.js` mới kiểm tra `MONGODB_URI`; chưa có test tự động cho `JWT_SECRET` của `scripts/check-env.js` (đã chạy thủ công, exit 0). Có thể bổ sung ở đợt hardening sau.
- `npm audit` vẫn báo 38 lỗ hổng transitively (ngoài phạm vi smoke).
- Không đo coverage; nợ này chuyển sang T7-4-3.

---

## 5. Liên kết

- [`T2-4-1_TEST_INFRA.md`](T2-4-1_TEST_INFRA.md) — cấu hình Jest/Supertest và số liệu `npm ci`, `npm test`.
- [`T2-4-3_CODE_REVIEW_CHECKLIST.md`](T2-4-3_CODE_REVIEW_CHECKLIST.md) — checklist review chung (nhánh `docs/T2-4-3-review-checklist`; link hợp lệ sau merge).
- [`T1-4-2_NFR_TEST_PLAN.md`](T1-4-2_NFR_TEST_PLAN.md) — ma trận 8 kịch bản kiểm thử.
