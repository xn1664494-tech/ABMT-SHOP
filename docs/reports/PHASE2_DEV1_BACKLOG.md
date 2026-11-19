# PHASE 2 DEV 1 — BACKLOG SAU HARDENING

Cập nhật: 2026-11-19 · Target: `f6fbc23`

Ưu tiên: **P0** chặn merge/release · **P1** phải làm trong sprint kế tiếp · **P2** cải thiện.

---

> **CẬP NHẬT 2026-11-19:** P0-1 và P0-2 đã **CLOSED** qua PR #35 / #37 trên `feature/post-phase2-hardening` @ `2131f56`. Chi tiết: `PHASE2_DEV1_P0_FIX_REPORT.md`. Bảng dưới là trạng thái gốc trước khi sửa.

## P0 — Chặn CI/release

| # | Việc | Owner | Bằng chứng | Ghi chú |
|---|---|---|---|---|
| ~~P0-1~~ **CLOSED** | Sửa `test/category.api.test.js`: `const request = require('supertest')` (bỏ `{ default }`) và thay `t.context.parentId/childId` bằng biến module-level | Dev 2 | 16 test fail, fail y hệt trên `origin/main` | PR #35 → `npm test` 181/181 |
| ~~P0-2~~ **CLOSED** | Thêm `csrfProtection` cho `POST/PUT/PATCH/DELETE /api/categories` | Dev 2 | POST không CSRF token → 201 | PR #37 → thiếu/sai CSRF 403; `npm test` 186/186 |

---

## P1 — Sprint kế tiếp

| # | Việc | Owner | Ghi chú |
|---|---|---|---|
| P1-1 | Triển khai "quên mật khẩu" (request + reset token, hết hạn, một lần) để đóng vế còn thiếu của T4-1-2 | Dev 1 | Cần email provider; hiện không có endpoint nào |
| P1-2 | Dựng CI (GitHub Actions): `npm test`, `npm run test:integration` (service MongoDB), `npm run test:jest`, lint | Dev lead | **Đã thêm workflow** `api-test-gates.yml`; chờ check-run thật trên GitHub. Xem `PHASE2_DEV1_CI_SETUP_REPORT.md` |
| P1-3 | Dựng staging + thực hiện checklist V3 (proxy, cookie Secure, rate limit theo IP thật, /health) | Dev lead/Ops | Xem `PHASE2_DEV1_VERIFICATION_GAPS_V2_V3.md` |
| P1-4 | Chuyển `catalog.integration.test.js` / `checkout.integration.test.js` sang `MONGODB_URI_TEST` (bỏ default localhost) | Dev 2 | Đồng bộ V4 |
| P1-5 | Review chéo (DoD #4): ít nhất 1 người review các PR #15–#29 | Team | Hiện chưa có review approval |

---

## P2 — Cải thiện

| # | Việc | Owner |
|---|---|---|
| P2-1 | Bỏ hẳn Jest: port 8 test hạ tầng (`tests/env|infra|health`) sang `node:test`, xoá devDeps `jest` | Dev 1 |
| P2-2 | Redis store cho rate limit (multi-instance) | Dev 1/Infra |
| P2-3 | Thống nhất RBAC convention: `requireAdmin` (main) vs `authorize('admin')` (Dev 1) | Dev 1+2 |
| P2-4 | Thêm `confirmPassword` cho API đổi mật khẩu (nếu UI cần) | Dev 1 + Dev 4 |
| P2-5 | Bổ sung security header (helmet), CORS policy tường minh cho môi trường deploy | Dev 1 |
| P2-6 | Viết test cho `scripts/seed.js` idempotency (chạy 2 lần không nhân đôi dữ liệu) | Dev 2 |
