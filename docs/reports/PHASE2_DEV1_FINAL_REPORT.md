# PHASE 2 DEV 1 — FINAL REPORT & RELEASE CHECKLIST

- **Ngày:** 2026-11-19
- **Nhánh tích hợp:** `feature/post-phase2-hardening` @ `f6fbc23`
- **Đã gồm:** `origin/main` @ `66f3224` + PR #15, #19, #20, #22, #23, #24, #25, #26, #27, #28, #29
- **Chưa merge vào `main`.**

> **CẬP NHẬT 2026-11-19:** target hiện tại là `2131f56` (đã gồm PR #35, #37 đóng 2 lỗi P0). Số liệu và checklist bên dưới là **ảnh chụp tại `f6fbc23`**; trạng thái mới xem `PHASE2_DEV1_P0_FIX_REPORT.md`. Workflow CI đã được thêm (`.github/workflows/api-test-gates.yml`), chi tiết tại `PHASE2_DEV1_CI_SETUP_REPORT.md`; check-run GitHub vẫn **PENDING**.

---

## 1. Trạng thái tổng thể

| Hạng mục | Trạng thái |
|---|---|
| Sync `main` | **PASS** |
| Hardening Dev 1 (error page, trust proxy, README) | **PASS** |
| Gap V1 (Jest) | **CLOSED** |
| Gap V2 (integration đổi mật khẩu) | **CLOSED** |
| Gap V4 (env var test) | **CLOSED** |
| Gap V3 (staging) | **NOT VERIFIED** (không có môi trường) |
| CI | **KHÔNG CÓ** |
| Test `category.api.test.js` | **FAIL — Dev 2** (pre-existing trên `main`) |
| CSRF route ghi Category | **FAIL — Dev 2** (P0 bảo mật) |

---

## 2. Bằng chứng kiểm thử (đo trên `f6fbc23`)

| Bộ test | Lệnh | Kết quả |
|---|---|---|
| Unit (`node:test`) | `npm test` | 181 test: **165 pass / 16 fail / 0 skip** |
| — loại trừ file lỗi của Dev 2 | 17 file còn lại | **165/165 pass** |
| Integration MongoDB thật | `npm run test:integration` | **32/32 pass** (`abmt_shop_test`) |
| Jest | `npm run test:jest` | **3 suite / 8 test pass** |
| Seed + index | `npm run test:seed-verify` (DB test) | **4/4 pass** |
| Smoke entry thật | `require('./src/server')` | `/health` 200 JSON · `/api/unknown` 404 JSON · HTML 404 error page |

Số test theo bộ: unit 181 · integration 32 · jest 8 · seed-verify 4 → **225 test** (221 pass).

---

## 3. WBS Phase 2 Dev 1 (6 task)

| Task | Trạng thái | Bằng chứng |
|---|---|---|
| T3-1-1 Register | **PASS** | test/auth.register.test.js |
| T3-1-2 JWT cookie login | **PASS** | test/auth.login.test.js |
| T3-1-3 Logout/Refresh | **PASS** | test/auth.refresh-logout.test.js |
| T4-1-1 RBAC/IDOR | **PASS** | PR #15, 14 test |
| T4-1-2 Rate limit + CSRF | **PARTIAL** | rate limit + CSRF PASS; **thiếu "quên mật khẩu"** |
| T4-1-3 Profile + đổi mật khẩu | **PASS** | PR #20 + V2 (12 integration) |

**Hoàn thành: 5/6 = 83.3%** (nghiêm ngặt 4/6 = 66.7%). **Không tuyên bố 100%.**

---

## 4. Release checklist

### 4.1. Bắt buộc trước khi merge vào `main`

| # | Điều kiện | Trạng thái |
|---|---|---|
| R1 | Không có secret trong diff | ✅ đã scan diff từng PR |
| R2 | `npm test` xanh | ❌ 16 test Dev 2 (`category.api.test.js`) → **P0-1** |
| R3 | `npm run test:integration` xanh | ✅ 32/32 |
| R4 | `npm run test:jest` xanh | ✅ 8/8 |
| R5 | Không mất route/hardening sau sync | ✅ smoke + route list |
| R6 | Không sửa `.env`/`.env.test` trong commit | ✅ |
| R7 | Review chéo (DoD #4) | ❌ chưa có |
| R8 | CSRF cho route ghi Category | ❌ **P0-2** |
| R9 | Staging verification (V3) | ❌ chưa có môi trường |

> **Kết luận:** **chưa đủ điều kiện release lên `main`** — vướng R2, R8 (P0, Dev 2) và R7/R9.

### 4.2. Biến môi trường production cần đặt

```
NODE_ENV=production
PORT=<port>
MONGODB_URI=<uri production>        # KHÔNG dùng chung với MONGODB_URI_TEST
JWT_SECRET=<>=32 ký tự ngẫu nhiên>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
APP_ORIGIN=https://<domain>
TRUST_PROXY=<số hop, thường 1>      # chỉ đặt khi chạy sau reverse proxy
AUTH_RATE_LIMIT_MAX=<số>            # tuỳ ngưỡng
```

### 4.3. Sau khi deploy

1. `GET /health` → 200 `{"status":"ok"}`.
2. Đăng ký/đăng nhập thật, kiểm cookie `HttpOnly` + `Secure`.
3. Gửi login sai liên tục → 429.
4. Gây lỗi 500 → trang lỗi không lộ stack/message.
5. Xác nhận rate limit dùng IP client thật (qua proxy).

---

## 5. Tài liệu kèm theo

| File | Nội dung |
|---|---|
| `PHASE2_DEV1_MAIN_SYNC_REPORT.md` | Sync `main`, conflict, lỗi `server.js`, 16 test Dev 2 |
| `PHASE2_DEV1_CATEGORY_VERIFICATION.md` | 18 điểm kiểm tra Category, phát hiện thiếu CSRF |
| `PHASE2_DEV1_VERIFICATION_GAPS_V2_V3.md` | V2 (12 case) + checklist V3 |
| `PHASE2_DEV1_V1_JEST_DIAGNOSIS.md` | Root cause + fix Jest (đã đóng) |
| `PHASE2_DEV1_V4_TEST_ENV_CONSISTENCY.md` | Chuẩn hoá env var (đã đóng) |
| `PHASE2_DEV1_BACKLOG.md` | P0/P1/P2 |
| `PHASE2_DEV1_DECISION_LOG.md` | 14 quyết định |
| `PHASE2_DEV1_COMPLETION_REPORT.md` | Báo cáo tổng hợp (đã cập nhật) |
| `README.md` | Hướng dẫn vận hành + test |

---

## 6. Việc tiếp theo (theo thứ tự)

1. Dev 2 sửa P0-1 (test `category.api`) và P0-2 (CSRF Category).
2. Chạy lại `npm test` → kỳ vọng **181/181**.
3. Review chéo các PR (R7).
4. Dựng staging → thực hiện checklist V3.
5. Quyết định merge PR #21 (`feature/post-phase2-hardening → main`) — **người dùng quyết định**.
