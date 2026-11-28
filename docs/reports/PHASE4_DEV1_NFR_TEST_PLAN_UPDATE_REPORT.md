# Phase 4 Dev 1 — Cập nhật NFR Test Plan — Báo cáo

| Mục | Giá trị |
|---|---|
| Giai đoạn | 1/2 — Docs NFR Test Plan (đã commit/push, chờ phê duyệt merge PR riêng) |
| Worktree | `D:\ABMT_Shop\ABMT-SHOP-PHASE4-NFR-DOCS` |
| Branch | `docs/update-nfr-test-plan-after-phase4-t7` |
| Base ban đầu | `d0443f609dc99e60b55ff9751f63c0aac0f356b4` |
| Base hiện tại | `origin/main` = `433237f1042ef8eda9b062290f6927e5d3d5a9d2` (sau PR #123) |
| Trạng thái chung | **READY FOR REVIEW** — CI `main` xanh; PR NFR đã tạo, **không tự merge** |
| Ngày | 2026-11-28 |

---

## 1. Trạng thái các bước

| Bước | Trạng thái | Ghi chú |
|---|---|---|
| Fetch origin, kiểm tra local/remote/worktree/stash | **DONE** | Xem §5 |
| Audit tài liệu chỉ đọc | **DONE** | Xem §3 |
| Soạn thay đổi docs trong worktree riêng | **DONE** | Đã commit — xem §6 |
| Kiểm tra link tương đối | **PASS** | 8/8 link tồn tại |
| `git diff --check` | **PASS** | exit 0 |
| Commit | **DONE** | 2 file docs cụ thể, không dùng `add .` |
| Push / tạo PR | **DONE** | Branch riêng, PR vào `main` |
| CI PR | **Đang kiểm tra** | Sẽ ghi nhận kết quả trong commit bổ sung |
| Merge | **NOT RUN** | Chờ phê duyệt riêng; không tự merge |

SKIP không được tính là PASS; không hạng mục nào bị skip để đạt kết quả.

---

## 2. Nội dung trước và sau khi sửa

### 2.1 Dòng 28 — NFR-08

**Trước:**

> `README.md:215-220` ⚠️ sanitize T7-1-2 chưa xong

**Sau:**

> `README.md:215-220` — T7-1-2 **đã hoàn thành** qua [PR #112](https://github.com/xn1664494-tech/ABMT-SHOP/pull/112) (merge commit `a75a52b`): output encoding tại điểm render, giữ nguyên DB/API contract. [Report](PHASE4_DEV1_T7_1_2_SANITIZE_REPORT.md) · [Checklist](PHASE4_DEV1_T7_1_2_SANITIZE_CHECKLIST.md)

Chỉ khẳng định nội dung có trong report/checklist T7-1-2: escape tại điểm render, không sanitizer, DB/API contract giữ nguyên, sink `renderMega()` đã sửa, 70 occurrence `<%- %>` đã phân loại.

### 2.2 Dòng 51 — ma trận kịch bản bảo mật

**Trước:**

> Hiện phủ được RBAC/IDOR/CSRF/rate limit/mass assignment ở mức API; **XSS chưa có test tự động**, sanitize là T7-1-2.

**Sau:**

> Hiện phủ được RBAC/IDOR/CSRF/rate limit/mass assignment ở mức API; **XSS đã có 8 test tự động trong `test/nav-sanitize.test.js`** (T7-1-2, [report](PHASE4_DEV1_T7_1_2_SANITIZE_REPORT.md)) — payload XSS trong tên danh mục / tiêu đề cột / tên link, scheme href nguy hiểm, quét raw `<%- %>` và kiểm tra `renderMega`. Đã chạy trong PR #112 (CI xanh); phạm vi là output encoding của mega menu, **không phải browser E2E**. Các kịch bản chưa có test tự động vẫn giữ trạng thái chưa thực hiện.

Phân biệt rõ: **test đã có** (8 test), **đã chạy** (PR #112, CI run 46088339951 pass), **chưa thực hiện** (browser E2E, các kịch bản chưa có runner). Không nâng TC03/TC04/TC05/TC06 hay TC08 lên PASS.

### 2.3 Liên kết báo cáo bổ sung

Thêm 3 dòng ngay sau đoạn ma trận bảo mật (không viết lại toàn bộ NFR):

- T7-1-2: [report](PHASE4_DEV1_T7_1_2_SANITIZE_REPORT.md) · [checklist](PHASE4_DEV1_T7_1_2_SANITIZE_CHECKLIST.md)
- T7-1-3: [report](PHASE4_DEV1_T7_1_3_CONFIG_REVIEW_REPORT.md) · [checklist](PHASE4_DEV1_T7_1_3_CONFIG_REVIEW_CHECKLIST.md)
- PR/merge tương ứng: #112 / `a75a52b`; #115 + #117 / `d9324fc` + `efdd7d4`

---

## 3. Nguồn dùng để xác minh

| Nguồn | Nội dung xác minh được |
|---|---|
| `docs/reports/T1-4-2_NFR_TEST_PLAN.md` (`origin/main`) | Dòng 28, dòng 51, cấu trúc 6 mục — giữ nguyên phần còn lại |
| `docs/reports/PHASE4_DEV1_T7_1_2_SANITIZE_REPORT.md` §1, §3, §5, §7 | PR #112, merge `a75a52b`, CI PR run 46088339951 / main run 46089030889 pass, 8 test `nav-sanitize.test.js` |
| `docs/reports/PHASE4_DEV1_T7_1_2_SANITIZE_CHECKLIST.md` §1, §2, §4 | Quyết định output encoding, không sanitizer, DB/API contract giữ nguyên |
| `docs/reports/PHASE4_DEV1_T7_1_3_CONFIG_REVIEW_REPORT.md` §1, §7 | PR #115/#117, merge `d9324fc`/`efdd7d4`, checklist là deliverable |
| `docs/reports/PHASE4_DEV1_T7_1_3_CONFIG_REVIEW_CHECKLIST.md` | Rate limit/body/cookie — chỉ dẫn link, không sửa NFR |
| `docs/reports/PHASE4_DEV1_T7_1_1_SECURITY_REVIEW.md` | Đối chiếu bối cảnh T7-1-1 (không sửa nội dung) |
| `test/nav-sanitize.test.js` (`origin/main`) | **8** test function `node:test`, phạm vi: XSS tên danh mục/tiêu đề cột/tên link, ký tự HTML hợp lệ, slug/href, scheme nguy hiểm, quét `<%- %>`, `renderMega` dùng helper |

Số lượng 8 được đếm trực tiếp từ source (`^\s*test\(`), khớp report T7-1-2 §3.

---

## 4. File thay đổi / kiểm tra chất lượng

| Hạng mục | Kết quả |
|---|---|
| File thay đổi | Chỉ `docs/reports/T1-4-2_NFR_TEST_PLAN.md` (7 dòng thêm, 2 dòng sửa) + báo cáo này |
| Source code | **Không đụng** |
| Dependency / `package-lock.json` | **Không đụng** |
| Link tương đối | **8/8 OK** — gồm 4 link mới và 4 link có sẵn; không link sai/file thiếu |
| Markdown | Bảng NFR-08 vẫn đúng 5 cột; đoạn link nằm ngoài bảng |
| `git diff --check` | **PASS** (exit 0), không whitespace error |
| `git diff --stat` | 1 file, `7 insertions(+), 2 deletions(-)` (trước khi thêm báo cáo này) |
| Secret / production info | **Không có** — chỉ tên PR, SHA commit công khai, tên file test |

---

## 5. Trạng thái remote/local (thời điểm audit)

| Mục | Giá trị |
|---|---|
| Worktree `main` | HEAD local `5a01ad6`; 3 modified (`.env.example`, `PR105_CI_SEED_FIX.md`, `PR106_AUDIT_HARDENING.md`) + 14 untracked; `stash@{0}` — **giữ nguyên, không đụng** |
| `origin/main` | `d0443f6` (sau PR #119) — không giả định còn `e29ceeb` |
| Commit mới từ `e29ceeb` | `75ca52b` test(T7-4-1) E2E, `f8ba69f` merge main vào branch test, `d0443f6` merge PR #119 |
| PR #116 | **MERGED** `25cde1b`, CI pass |
| PR #118 | **MERGED** `e29ceeb`, CI PR **FAIL** (run 46093395228) |
| PR #119 | **MERGED** `d0443f6`, CI PR pass |
| PR đang mở | **Không có** (`gh pr list --state open` → `[]`) — không có fix nào đang chờ cho CI đỏ |
| Worktree khác | Không sử dụng, không thay đổi |

---

## 6. Blocker trước đó — đã gỡ

Trình tự mở khóa CI `main`:

1. Lỗi `T6-4-3` (`expect 200, actual 403`) đã được xử lý sẵn trên `main` qua PR #121 (commit `4035b75`): 2 call site admin hủy đơn chuyển sang `/api/admin/orders/:code/cancel` với `{ reason }`. Không cần PR CI fix mới.
2. CI tiếp tục đỏ tại 2 assertion Postman (`AdminOrders - confirmed -> shipping` trả 400 do thiếu `carrier`/`trackingCode`; `AdminAuditLogs` fail hệ quả). Đã sửa **test-only** qua PR #123, commit `dd492b1`, merge commit `433237f`. Không đụng `src/`, schema hay assertion.
3. Sau merge, run [`46143502149`](https://github.com/xn1664494-tech/ABMT-SHOP/actions/runs/46143502149) có 1 lần fail do **flaky test-data**: `skuFor()` trong `test/integration/create-order.integration.test.js:35` sinh random `100–999`, va chạm `E11000` tại SKU `SP-AO-963-M-DEN` (`seedProduct`, dòng 73). Rerun cùng job → **PASS**. Đây là lỗi seed ngẫu nhiên cũ, không phải lỗi docs NFR và không phải lỗi do PR #123.

| Hạng mục | Trạng thái |
|---|---|
| Commit / push / tạo PR docs | **DONE** |
| CI `main` trước khi tạo PR | **PASS** (rerun `46143502149`, head `433237f`) |
| Merge PR NFR | **NOT RUN** — chờ phê duyệt riêng |
| T8-1-3 | **KHÔNG BẮT ĐẦU** — chỉ bắt đầu sau khi PR NFR merge và CI `main` xanh |

### 6.1 Kiểm tra lại theo follow-up (2026-11-28)

- Fetch lại origin: `origin/main` tiến từ `d0443f6` → `b88c67a` (#120/#121/#122) → `433237f` (PR #123).
- PR #123 **MERGED**, CI PR pass (`46142379491`, `46142391316`); CI `main` sau rerun pass.
- Branch NFR được cập nhật bằng **merge commit** từ `origin/main` (`433237f`), **không rebase / cherry-pick / force push**.
- Quyết định: commit/push 2 file docs, tạo PR, chờ CI PR. **Dừng chờ phê duyệt merge riêng**; không đụng worktree `main`, `stash@{0}`, PR #118/#119 hay branch Dev 2.
