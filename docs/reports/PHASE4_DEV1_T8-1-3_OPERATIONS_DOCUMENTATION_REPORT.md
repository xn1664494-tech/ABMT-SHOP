# Phase 4 Dev 1 — T8-1-3 Tài liệu vận hành — Báo cáo

| Mục | Giá trị |
|---|---|
| Mã công việc | `T8-1-3` / `4.8.03` |
| Tên WBS | Tài liệu vận hành — cách deploy, biến môi trường, xử lý sự cố thường gặp |
| Người làm | Dev 1 (Leader & Lead Backend Core) |
| Worktree | `D:\ABMT_Shop\ABMT-SHOP-PHASE4-T8-1-3` |
| Branch | `docs/phase4-dev1-t8-1-3-operations-documentation` |
| Base | `origin/main` = `9b88b3fd2ab870eac82b97d11c8f17e79cf94325` (merge PR #124) |
| Dependency | `T7-1-3` — rà soát cấu hình, **DONE** |
| Trạng thái chung | **DONE** (docs) — chờ phê duyệt merge PR riêng |
| Ngày | 2026-11-28 |

---

## 1. Đối chiếu WBS

| Yêu cầu WBS | Trạng thái | Bằng chứng |
|---|---|---|
| Cách deploy | **DONE** | `T8-1-3_OPERATIONS_RUNBOOK.md` §3–5 |
| Biến môi trường | **DONE** | Runbook §4 (bảng đầy đủ, có mặc định/giới hạn đã biết); checklist §A |
| Xử lý sự cố thường gặp | **DONE** | Runbook §7 (14 tình huống), checklist §D |
| Deliverable "Tài liệu" | **DONE** | 3 file Markdown mới + 1 dòng cập nhật mục lục |
| Nghiệm thu "Đầy đủ" | **PASS** | Phủ 3 nội dung WBS + smoke check + rollback + cổng phê duyệt |
| Dependency `T7-1-3` | **DONE** | `PHASE4_DEV1_T7_1_3_CONFIG_REVIEW_REPORT.md` / `_CHECKLIST.md` |

---

## 2. Phạm vi và ranh giới

**Làm:** chỉ tài liệu vận hành, dựa trên cấu hình và mã nguồn hiện có trên `origin/main` `9b88b3f`.

**Không làm** (đều ghi rõ là **NOT RUN** / **SKIP** trong tài liệu):

- Không deploy, không cấu hình production, không restart service thật.
- Không đọc/in `.env` thật; không ghi connection string, token, mật khẩu hay secret vào báo cáo. Dùng `npm run check:env` làm ví dụ an toàn (script chỉ báo `SET/MISSING` + độ dài).
- Không chạy migration, seed, job quá hạn, không bật cron, không thêm dependency hay thay đổi hạ tầng.
- Không sửa source, schema, assertion, `.env.example` hay `package.json`.
- Không đụng worktree `main` (`5a01ad6`, 3 modified + 14 untracked, `stash@{0}`), PR #118/#119 hay branch của Dev 2.

Các nội dung chỉ được **mô tả** và trỏ tới phê duyệt riêng: job quá hạn/migration (`DEV1_OPS_RUNBOOK_HANDOFF.md` §1–2), rate-limit store dùng chung (§3), outbox audit (§4).

---

## 3. Sản phẩm bàn giao

| File | Mục đích |
|---|---|
| [`T8-1-3_OPERATIONS_RUNBOOK.md`](T8-1-3_OPERATIONS_RUNBOOK.md) | Runbook chính: luồng khởi động, chuẩn bị môi trường, bảng env, deploy/smoke/rollback, 14 tình huống sự cố |
| [`T8-1-3_OPERATIONS_CHECKLIST.md`](T8-1-3_OPERATIONS_CHECKLIST.md) | Checklist A–F để vận hành điền/tracks sau khi thực tế kiểm tra |
| [`PHASE4_DEV1_T8-1-3_OPERATIONS_DOCUMENTATION_REPORT.md`](PHASE4_DEV1_T8-1-3_OPERATIONS_DOCUMENTATION_REPORT.md) | Báo cáo này |
| [`T1-4-3_DOCS_INDEX.md`](T1-4-3_DOCS_INDEX.md) | Thêm 1 dòng ánh xạ chương 5 (deploy) → runbook/checklist, theo quy ước index |

Dữ liệu được đối chiếu trực tiếp từ: `.env.example`, `README.md`, `package.json`, `scripts/check-env.js`, `src/server.js`, `src/app.js`, `src/config/db.js`, `src/jobs/autoCompleteOrders.js`, `src/middleware/csrf.js`, `src/middleware/rateLimiters.js`, `src/routes/shipping.route.js`, `src/services/{smsService,categoryCacheService,auditLogService,resetPasswordService,homeService}.js`, `src/services/orderStatusService.js` (contract `shipping`) và báo cáo T7-1-3.

---

## 4. Kiểm tra

| Hạng mục | Trạng thái | Kết quả |
|---|---|---|
| Fetch/đối chiếu base | **DONE** | `origin/main` = `9b88b3f` sau merge PR #124 |
| CI `main` trước khi tạo branch | **PASS** | [run 46147035927](https://github.com/xn1664494-tech/ABMT-SHOP/actions/runs/46147035927) — seed + unit + integration + Jest + Postman |
| Đối chiếu env/code thực tế | **DONE** | 22 biến được liệt kê; không đọc giá trị thật |
| Kiểm tra link tương đối | **PASS** | 60/60 — xem §6 |
| `git diff --check` | **PASS** | exit 0 — xem §6 |
| Chạy deploy thật | **NOT RUN** | Ngoài phạm vi docs-only |
| Chạy test code | **SKIP** | Không đổi code; CI `main` đã xanh trên base |
| Merge PR này | **NOT RUN** | Chờ phê duyệt riêng |

---

## 5. Trạng thái theo từng nhãn

| Nhãn | Nội dung |
|---|---|
| **DONE** | Thu thập cấu hình, viết runbook + checklist + báo cáo, cập nhật index |
| **PASS** | CI `main` trên base; link tương đối; `git diff --check` |
| **FAIL** | Không có — PR này không chạy deploy hay test code mới |
| **SKIP** | Chạy test code (không đổi code) |
| **BLOCKED** | Không còn blocker; PR #124 đã merge, CI `main` xanh |
| **NOT RUN** | Deploy, migration/seed, cron, thay dependency/hạ tầng/secret, merge PR |

---

## 6. Kết quả kiểm tra cuối

| Kiểm tra | Kết quả |
|---|---|
| Link tương đối trong 4 file thay đổi | **PASS** — 60/60 link trỏ tới file tồn tại (script đọc UTF-8, bỏ qua `https?://`) |
| Ký tự ngoài phạm vi (CJK do lỗi gõ) | **PASS** — 0 kết quả |
| `git diff --check` | **PASS** — exit 0 |
| CI PR | **Đang kiểm tra** — sẽ cập nhật trong commit bổ sung |

---

## 7. Việc vẫn cần phê duyệt ngoài PR này

| Việc | Lý do chưa làm |
|---|---|
| Chạy `node scripts/migrate-order-expires-at.js --apply` | Cần Lead phê duyệt + backup + dry-run (handoff §2) |
| Bật cron cho `scripts/run-overdue-orders.js` | Cần quyết định hạ tầng; T8-1-3 không thêm cron |
| Rate-limit store dùng chung (Redis/Mongo) | Cần phê duyệt dependency mới; giữ `MemoryStore` + cảnh báo đã ghi runbook §7.11 |
| Outbox/retry audit, SMS provider thật | Backlog riêng; runbook đã nêu rủi ro (§7.7–7.8) |

PR này **dừng lại để chờ review/merge riêng**. T8-1-3 hoàn tất ở mức tài liệu; không có hành động vận hành nào được thực hiện tự động.
