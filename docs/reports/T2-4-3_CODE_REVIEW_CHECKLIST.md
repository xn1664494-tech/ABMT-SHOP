# T2-4-3 — Checklist code review chung & đối chiếu sơ đồ

- **Ngày:** 2026-11-21
- **Nhánh:** `docs/T2-4-3-review-checklist`
- **WBS:** dòng 25 (`1.2.12`), 4h, ưu tiên TB, phụ thuộc `T1-4-3` (đã merge vào `main`).
- **Sản phẩm bàn giao:** Tài liệu — **Checklist review**; hoàn thiện ERD + use case trong báo cáo.
- **DoD:** Có checklist review.
- **Reviewer:** Dev 3 (chưa xác nhận → workbook giữ 90%).

---

## 1. ERD & use case trong báo cáo — verification

Đã mở `docs/Bao_cao_do_an_UrbanMinimal.docx` dạng zip/XML để kiểm tra **không sửa binary**. Báo cáo có 5 ảnh nhúng thực (`word/media/*`, 5 `<w:drawing>`) và danh mục hình đầy đủ.

| Hình | Vị trí | Nguồn thiết kế | Trạng thái |
|---|---|---|---|
| `Hình 1. Sơ đồ tác nhân và chức năng tổng quát` | CHƯƠNG 1, mục 1.2 | `docs/thiet-ke-csdl/use-case.svg`, `use-case.png` | **Đã nhúng**; giữ nguyên |
| `Hình 3. Mô hình thực thể – quan hệ mức khái niệm` | CHƯƠNG 3, mục 3.1 | `docs/thiet-ke-csdl/erd.svg`, `erd.png` | **Đã nhúng**; giữ nguyên |
| `Hình 2/4/5` | CHƯƠNG 2, 3 | `Kiến trúc tổng thể.png`, `order-lifecycle.svg`,… | Đã nhúng; ngoài phạm vi task này |
| `Hình 6/7` | CHƯƠNG 5 | `docs/thiet-ke-ui/*` | Còn là placeholder `[Chèn ảnh…]` — **ngoài phạm vi T2-4-3** |

Ảnh nhúng trong docx đã được downscale so với PNG gốc trong `docs/thiet-ke-csdl/` (hash khác, kích thước nhỏ hơn). Đây là trạng thái có chủ đích của báo cáo; không thay ảnh trong đợt này để tránh conflict binary.

---

## 2. Checklist code review chung (dùng cho mọi PR)

> Người review: Dev 3 (theo `02_WBS` cột S; nguyên tắc review chéo Dev 3 ↔ Dev 4). Ghi rõ kết quả thay vì chỉ tick.

### 2.1. Yêu cầu & phạm vi

- [ ] PR chỉ chạm đúng Task ID / WBS được ghi trong title và mô tả.
- [ ] Cột `N` (phụ thuộc) trong `02_WBS` đã hoàn thành trước khi bắt đầu.
- [ ] Sản phẩm bàn giao khớp cột `L`; DoD cột `M` được trích dẫn trong PR.
- [ ] Không đưa secret, `.env`, `.env.test`, log thật vào diff.

### 2.2. Bảo mật

- [ ] Auth/RBAC: guest 401, customer vào route admin 403, role lấy từ DB (`src/middleware/authenticate.js`, `requireAdmin.js`).
- [ ] IDOR: user không đọc/sửa profile của người khác; admin là ngoại lệ có kiểm soát.
- [ ] CSRF: route ghi dùng cookie auth có `X-CSRF-Token` + kiểm tra `APP_ORIGIN` (`src/middleware/csrf.js`).
- [ ] Cookie: `HttpOnly`; refresh giới hạn path `/api/auth`; `Secure` theo môi trường (`src/services/tokenService.js`).
- [ ] Rate limit auth còn hoạt động; nhớ giới hạn MemoryStore khi multi-instance (`src/middleware/rateLimiters.js`).
- [ ] Trust proxy chỉ bật khi có reverse proxy tin cậy; không tin `X-Forwarded-For` từ client trực tiếp.
- [ ] Input: Zod validator + whitelist field; không mass-assignment; escape khi render EJS.

### 2.3. Dữ liệu & nghiệp vụ

- [ ] Schema/model khớp `docs/thiet-ke-csdl/data-dictionary-*` và `erd.png`.
- [ ] Luồng đơn hàng đi đúng `order-lifecycle.svg`: `pending → confirmed → shipping → delivered`; hủy chỉ ở 2 trạng thái đầu.
- [ ] Soft-delete có filter `isDeleted` ở mọi query liên quan (`src/plugins/softDelete.js`).
- [ ] Có index cho field lọc/sắp xếp chính; không N+1 query.
- [ ] Giao dịch/đồng thời: tồn kho, hủy đơn, cập nhật số lượng có kiểm soát race condition.

### 2.4. API & xử lý lỗi

- [ ] Response nhất quán: `{ success: true, data }` / `{ success: false, error, details? }`.
- [ ] Status code đúng: 400/401/403/404/409/429/500.
- [ ] `errorHandler` không lộ `stack` hay `error.message` nhạy cảm ở production (`src/middleware/errorHandler.js`).
- [ ] Route mới được mount trong `src/routes/index.js`; API đặt dưới `/api`.

### 2.5. Test & CI

- [ ] Có test unit/API/integration cho hành vi mới; test đi vào `npm test` hoặc script tương ứng trong `package.json:9-19`.
- [ ] `npm test`, `npm run test:jest`, `npm run test:integration` xanh trước khi xin review.
- [ ] Test chỉ dùng CSDL có tên chứa `test`; không trùng `MONGODB_URI` dev/production (`tests/setup.js:26-39`).
- [ ] Không commit fixture chứa mật khẩu/token thật.

### 2.6. Tài liệu & nghiệm thu

- [ ] Báo cáo minh chứng được cập nhật (file MD trong `docs/reports/`).
- [ ] Link trong báo cáo đã verify tồn tại sau merge.
- [ ] `02_WBS` cập nhật `Q/R/T`; **chuyển `Hoàn thành` chỉ sau khi reviewer xác nhận** (rule `00_Hướng dẫn`).
- [ ] Ghi lại reviewer + ngày review trong ô `T` (Ghi chú).

---

## 3. Cách dùng checklist trong PR

1. Dán mục 2.1 → 2.6 vào phần mô tả PR.
2. Reviewer tick từng mục; với mục không đạt, ghi `BLOCKED: <lý do>` kèm file/line.
3. Chỉ approve khi không còn mục `BLOCKED`; sau đó mới đổi `Q/Hoàn thành`, `R/100` trong workbook.
4. CI check-run **không** thay thế approval của con người.

---

## 4. DoD / trạng thái

| Tiêu chí | Bằng chứng |
|---|---|
| ERD + use case trong báo cáo | Mục 1 — `Hình 1`, `Hình 3` đã nhúng, verified bằng docx XML |
| Checklist review | Mục 2 + 3 — 6 nhóm, dùng được ngay cho mọi PR |
| Không regression | Chỉ thêm 1 file Markdown; không đụng docx/code |
| Review chéo | ⏳ Dev 3 chưa xác nhận → `90%` trong workbook |

---

## 5. Liên kết

- [`T1-4-3_DOCS_INDEX.md`](T1-4-3_DOCS_INDEX.md) — index tài liệu & đối chiếu sơ đồ/code.
- [`T1-4-2_NFR_TEST_PLAN.md`](T1-4-2_NFR_TEST_PLAN.md) — NFR & kế hoạch kiểm thử.
- `docs/thiet-ke-csdl/use-case.svg`, `docs/thiet-ke-csdl/erd.svg`, `docs/Bao_cao_do_an_UrbanMinimal.docx`.

> `T2-4-1_TEST_INFRA.md` và `T2-4-2_SMOKE_TESTS.md` nằm trên các nhánh `test/T2-4-1-jest-infra` / `test/T2-4-2-smoke-tests`; sẽ hợp lệ sau khi merge.
