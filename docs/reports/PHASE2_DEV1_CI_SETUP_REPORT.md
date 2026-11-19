# PHASE 2 DEV 1 — CI SETUP REPORT

- **Ngày:** 2026-11-19
- **Branch:** `ci/github-actions-test-gates`
- **File thêm:** `.github/workflows/api-test-gates.yml`
- **Trạng thái:** workflow đã chạy thật trên PR #39 tại commit `c0e9c10` → **check-run SUCCESS**.
- **Run ID:** `44432177347` · [Job log](https://github.com/xn1664494-tech/ABMT-SHOP/actions/runs/44432177347/job/135252043131)

---

## 1. Trigger

| Sự kiện | Branch |
|---|---|
| `pull_request` | `feature/post-phase2-hardening` |
| `push` | `feature/post-phase2-hardening` |
| `workflow_dispatch` | chạy tay |

Quyền mặc định: `contents: read` (không cầnsecret, không đụng workspace Postman).

---

## 2. Gate

| Gate | Lệnh | Bảo chứng |
|---|---|---|
| Cài dependency | `npm ci` | Dùng đúng `package-lock.json` |
| Guard DB test | shell `case "$MONGODB_URI_TEST" in *test*)` | Từ chối chạy nếu URI không trỏ DB có tên chứa `test` |
| Seed | `SEED_CONFIRM=1 npm run seed` | Tạo dữ liệu.seed cho gate tiếp theo |
| Seed + index | `npm run test:seed-verify` | 4/4: index unique/compound + 6 category / 6 product / ≥1 admin |
| Unit | `npm test` | 186 test (đã gồm 21 test Category API + CSRF) |
| Integration | `npm run test:integration` | 32 test trên MongoDB thật |
| Jest | `npm run test:jest` | 3 suite / 8 test hạ tầng env/infra/health |

MongoDB được cung cấp bởi service container `mongo:7` với health check `mongosh ... ping`, mở cổng `127.0.0.1:27017`.

---

## 3. Biến môi trường trong workflow

| Biến | Giá trị | Mục đích |
|---|---|---|
| `NODE_ENV` | `test` | Chế độ test |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/abmt_shop_ci_test` | Dùng riêng cho bước seed |
| `MONGODB_URI_TEST` | `mongodb://127.0.0.1:27017/abmt_shop_ci_test` | Chuẩn V4 cho integration + Jest |
| `TEST_MONGODB_URI` | cùng URI ở trên | Tên legacy, vẫn được các test catalog/checkout dùng |
| `JWT_SECRET` | chuỗi test cố định ≥32 ký tự | Chỉ dùng trong CI, không phải secret production |
| `APP_ORIGIN` | `http://localhost:3000` | CSRF origin hợp lệ |

**Lưu ý Jest:** `tests/setup.js` cấm `MONGODB_URI === MONGODB_URI_TEST`. Vì job dùng chung URI để seed, bước Jest override `MONGODB_URI: ''`; setup sẽ tự gán lại URI test. Đây là lý do duy nhất cần override ở cấp step.

---

## 4. Verification đã chạy (cục bộ, mô phỏng env CI)

| Kiểm tra | Kết quả |
|---|---|
| Parse YAML bằng `js-yaml` | OK — đúng 3 trigger, 9 step, đúng override Jest |
| `npm run seed` (DB `abmt_shop_ci_test`) | exit 0 |
| `npm run test:seed-verify` | **4/4 pass** |
| `npm test` | **186/186 pass** |
| `npm run test:integration` | **32/32 pass** |
| `npm run test:jest` (với `MONGODB_URI=''`) | **3 suite / 8 test pass** |

Tổng mô phỏng: **230/230 pass**.

### Check-run GitHub thật (PR #39, commit `c0e9c10`)

| Step | Kết quả |
|---|---|
| Initialize containers (`mongo:7`) | ✅ success |
| Install dependencies (`npm ci`) | ✅ success |
| Guard - only a test database | ✅ success |
| Seed test database | ✅ success |
| Seed + index verification | ✅ success |
| Unit tests | ✅ success |
| Integration tests (real MongoDB) | ✅ success |
| Jest tests | ✅ success |

**Kết luận check-run:** `success` — xem run `44432177347`.

> Bảng "Verification đã chạy (cục bộ)" ở trên là bằng chứng local; bảng check-run này là bằng chứng GitHub Actions thật.

---

## 5. Còn lại

- R7 (review chéo) vẫn chưa có approval người; CI tạo check-run nhưng không thay thế review của con người.
- R9 (staging/V3) vẫn **NOT VERIFIED**.
- T4-1-2 (quên mật khẩu) vẫn **PARTIAL**.
