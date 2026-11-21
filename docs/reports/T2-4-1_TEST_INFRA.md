# T2-4-1 — Hạ tầng test (Jest + Supertest + CSDL test riêng)

- **Ngày:** 2026-11-21
- **Nhánh:** `test/T2-4-1-jest-infra`
- **WBS:** dòng 23 (`1.2.10`), 6h, ưu tiên Cao, phụ thuộc `T1-4-3` (đã merge vào `main`).
- **Sản phẩm bàn giao:** Hạ tầng test (mã nguồn + minh chứng).
- **DoD:** Chạy được `npm test`.
- **Reviewer:** Dev 3 (chưa xác nhận → workbook giữ 90%).

---

## 1. Hiện trạng được xác nhận

| Thành phần | File | Kết luận |
|---|---|---|
| Script chạy | `package.json:13-17` | `test:jest`, `test:jest:watch`, `test:api`, `test:postman`, `check:env` đều có sẵn |
| Cấu hình Jest | `jest.config.js` | `testEnvironment: node`, `roots: tests`, `setupFilesAfterEnv`, `maxWorkers: 1`, `clearMocks`, `verbose` |
| Setup an toàn DB | `tests/setup.js:1-61` | Nạp `.env.test`; fail-fast nếu thiếu `MONGODB_URI_TEST` (`:26-28`); từ chối DB tên không chứa `test` (`:29-33`); cấm trùng `MONGODB_URI` (`:34-36`); dọn dữ liệu sau mỗi test (`:53-56`) |
| Env check | `scripts/check-env.js:1-54` | Kiểm tra `MONGODB_URI`, `JWT_SECRET`; chỉ in độ dài, không in giá trị |
| Smoke/env test | `tests/{env,health,infra}.test.js` | 3 suite / 8 test, chứng minh import app không mở cổng, DB test riêng, `/health` trả 200 |

`.env.test` local dùng `mongodb+srv` với DB **`ABMTSHOP_test`** (có chữ `test`, đúng guard). File `.env` / `.env.test` đều bị gitignore (`.gitignore:5-8`), không commit secret.

---

## 2. Thay đổi trong nhánh này

Chỉ một dòng được thêm vào `jest.config.js`:

```js
forceExit: true,
```

**Lý do:** trước khi sửa, `npm run test:jest` báo `3 passed / 8 passed` nhưng **thoát mã 1 không ổn định** (tái hiện 1/2 lần). Log lỗi:

```text
ReferenceError: You are trying to `require` a file after the Jest environment has been torn down.
  at passwordDigest (node_modules/mongodb/src/cmap/auth/scram.ts:234:18)
```

Handshake SCRAM của MongoDB Atlas tiếp tục sau khi Jest dọn môi trường. `forceExit` giúp Jest kết thúc sau khi các test chạy xong; mã lỗi test thật vẫn được giữ nguyên nếu có test fail. Không sửa logic test, không đổi DB, không đụng secret.

---

## 3. Kết quả chạy thực tế

| Lệnh | Kết quả |
|---|---|
| `npm ci` | exit 0; cài 858 package. Cảnh báo audit: 38 vulnerabilities (25 moderate, 12 high, 1 critical) — nợ kỹ thuật ngoài phạm vi T2-4-1 |
| `npm run check:env` (với `JWT_SECRET` đặt tạm trong shell) | exit 0; `MONGODB_URI` hợp lệ, `JWT_SECRET` SET; không in giá trị |
| `npm run test:jest` **trước sửa** | 3 suite / 8 test pass nhưng exit 1 ở 1/2 lần chạy (lỗi teardown ở trên) |
| `npm run test:jest` **sau sửa** | **4/4 lần chạy exit 0**; 3 suite / 8 test pass, ~7–9s |
| `npm test` | **260 test / 260 pass / 0 fail / 0 skip**, exit 0 (~11.9s) |

> `JWT_SECRET` chỉ được đặt tạm bằng biến môi trường shell trong lúc chạy; không ghi vào file, không commit. CI đã đặt sẵn tại `.github/workflows/api-test-gates.yml:37`.

---

## 4. Minh chứng & giới hạn

- CI hiện gọi `npm test` và `npm run test:jest` tại `.github/workflows/api-test-gates.yml:68-79`, nhưng trigger mới chỉ là `feature/post-phase2-hardening` (`:3-10`). Không mở rộng trigger trong đợt này.
- `npm audit` còn 38 lỗ hổng transitively; cần issue riêng, không block DoD hạ tầng test.
- Chưa có coverage tool; sẽ chốt ở T7-4-3 theo kế hoạch NFR.
- Review chéo Dev 3 chưa có → chưa đánh dấu task Hoàn thành trong workbook.

---

## 5. Liên kết

- [`T2-4-2_SMOKE_TESTS.md`](T2-4-2_SMOKE_TESTS.md) — chi tiết smoke test env/health/infra.
- [`T2-4-3_CODE_REVIEW_CHECKLIST.md`](T2-4-3_CODE_REVIEW_CHECKLIST.md) — checklist review chung.
- [`T1-4-3_DOCS_INDEX.md`](T1-4-3_DOCS_INDEX.md) — index tài liệu.
- [`PHASE2_DEV1_CI_SETUP_REPORT.md`](PHASE2_DEV1_CI_SETUP_REPORT.md) — nền tảng CI trước đó.

> `T2-4-2_SMOKE_TESTS.md` và `T2-4-3_CODE_REVIEW_CHECKLIST.md` nằm trên các nhánh `test/T2-4-2-smoke-tests` / `docs/T2-4-3-review-checklist`; link hợp lệ sau khi các PR được merge.
