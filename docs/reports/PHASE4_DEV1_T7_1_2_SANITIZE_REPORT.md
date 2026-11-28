# T7-1-2 — Sanitize — Báo cáo hoàn tất (Dev 1, Phase 4)

| Mục | Giá trị |
|---|---|
| Mã công việc | `T7-1-2` / `4.7.02` |
| Tên WBS | Sanitize |
| Người làm | Dev 1 (Leader & Lead Backend Core) |
| Worktree | `D:\ABMT_Shop\ABMT-SHOP-PHASE4-T7-1-2` |
| Branch | `feature/phase4-dev1-t7-1-2-sanitize` |
| Base | `origin/main` = `5a01ad6dcc41770132b7a7fb7216654bcf442d28` |
| Dependency | `T6-1-3` — đã DONE |
| Ngày | 2026-11-28 |

---

## 1. Yêu cầu WBS và mức độ đáp ứng

| Yêu cầu WBS | Trạng thái | Bằng chứng |
|---|---|---|
| Chốt sanitize đầu vào (thư viện cho Node) | **Đã chốt: output encoding, không dùng thư viện** — xem §2 | `PHASE4_DEV1_T7_1_2_SANITIZE_CHECKLIST.md` §1 |
| Kiểm tra mọi chỗ in dữ liệu dùng cú pháp thoát ký tự của EJS | Xong, 70 occurrence được phân loại | Checklist §2 + test quét tự động |
| Deliverable: Sanitize (mã nguồn + checklist) | Xong | `src/utils/htmlSafety.js`, checklist |
| Nghiệm thu: **Không còn chỗ in thô** | Đạt — sink duy nhất đã sửa; các `<%- %>` còn lại đều nằm trong whitelist có lý do | Checklist §2, §4; test `nav-sanitize.test.js` |

---

## 2. Vì sao chọn output encoding thay vì HTML sanitizer

**Quyết định: escape tại điểm render, giữ nguyên dữ liệu DB và API contract; không thêm dependency.**

1. **Không có field HTML trong hệ thống.** Mọi nội dung người dùng nhập (`description`, `name`, `slug`, `title`, ...) đều là plain text và đã đi qua validator Zod rồi render bằng `<%= %>` (mặc định EJS đã escape). Không có trường nào cần lưu HTML hợp lệ — sanitizer đầu vào sẽ không có việc để làm, chỉ làm méo dữ liệu.
2. **Sanitizer làm đổi dữ liệu đã lưu.** `sanitize-html`/`xss` sẽ xóa hoặc encode các ký tự hợp lệ như `<`, `&`, gây thay đổi nội dung trong DB và phản hồi API — vi phạm yêu cầu "giữ DB/API contract nguyên trạng".
3. **Rủi ro nằm ở output, không phải input.** Sau khi audit, chỉ có 1 sink thật là `renderMega()` dùng `<%- %>` để ghép chuỗi HTML. Escape đúng chỗ này triệt tiêu payload mà không đụng đến tầng lưu trữ hay business logic.
4. **Không mở rộng dependency.** Không cài `sanitize-html`, `xss`, `DOMPurify` hay bất kỳ package nào (kể cả `package-lock.json`). Chỉ dùng EJS có sẵn + helper tự viết ~40 dòng.
5. **URL là vector riêng.** Với `href`, escape HTML là chưa đủ (`javascript:` không chứa ký tự đặc biệt). Vì vậy thêm `safeHref()` whitelist scheme `http/https` + path tương đối, chặn `javascript:`, `data:`, `vbscript:`, `file:`, `about:`, `//host` và biến thể chèn control character.

---

## 3. Thay đổi mã nguồn

| File | Thay đổi |
|---|---|
| `src/utils/htmlSafety.js` **(mới)** | `escapeHtml(value)` — escape `& < > " '`. `safeHref(value)` — whitelist scheme + escape attribute; trả `#` cho href không an toàn. |
| `src/app.js` | Inject `escapeHtml`/`safeHref` vào `res.locals` bằng middleware nhỏ, đặt trước `securityHeaders` để mọi view dùng được. Không đổi thứ tự route hay middleware bảo mật của T7-1-1. |
| `src/views/partials/header.ejs` | `renderMega()` — mọi giá trị từ DB (`root.name`, `col.title`, `link.name`, `link.href`, `rootHref(...)`) đi qua `escapeHtml()` / `safeHref()` trước khi ghép vào HTML. Giữ nguyên cấu trúc mega menu và class CSS. |
| `test/error-handler.test.js` | Mini-app trong test 500 HTML nhận cùng helper (phản ánh app thật), không đổi assertion nào. |
| `test/nav-sanitize.test.js` **(mới)** | 8 test: XSS trong tên danh mục / tiêu đề cột / tên link; href malicious; ký tự HTML hợp lệ; slug chứa `" onmouseover=`; quét toàn bộ `<%- %>`; kiểm tra `renderMega` dùng helper. |
| `package.json` | Thêm `test/nav-sanitize.test.js` vào script `npm test`. **Không đổi dependency hay phiên bản.** |

### `safeHref` — ma trận quyết định

| Input | Kết quả |
|---|---|
| `/catalog?category=nam`, `?sort=price_asc`, `#section` | Giữ nguyên (đã escape `&`) |
| `https://example.com/a?x=1&y=2`, `HTTP://...` | Giữ nguyên (đã escape `&`) |
| `javascript:`, `JaVaScRiPt:`, `java\nscript:`, `javascript&#58;` | `#` |
| `data:`, `vbscript:`, `file:`, `about:`, `admin:` | `#` |
| `//evil.example/x` (protocol-relative) | `#` |
| Rỗng / chuỗi không có dạng path | `#` |

---

## 4. Phân loại toàn bộ raw EJS (`<%- %>`)

Tổng **70 occurrence / 22 file `.ejs`**. Test `nav-sanitize.test.js` quét lại toàn bộ `src/views` và fail ngay nếu xuất hiện occurrence không thuộc whitelist dưới đây.

| Nhóm | Số lượng | Đánh giá | Lý do chấp nhận |
|---|---:|---|---|
| `include(...)` | 60 | An toàn | EJS include là template source tĩnh, không phải dữ liệu DB/user |
| `JSON.stringify(...).replace(/</g, '\u003c')` | 2 | An toàn | Nằm trong `<script type="application/json">`; thay `<` chặn `</script>`; vẫn có `nonce` CSP từ T7-1-1 |
| `navActive === ...` | 5 | An toàn | Output là literal hard-code, không phụ thuộc input |
| `tab.isActive ? ...` | 1 | An toàn | Output là literal hard-code |
| `renderMega(...)` | 2 | **Đã sửa** | Hàm render giờ escape từng giá trị; output raw là HTML được xây có chủ đích |

**Không còn vị trí nào in dữ liệu user/DB thô.** Chi tiết xem `PHASE4_DEV1_T7_1_2_SANITIZE_CHECKLIST.md` §2, §4.

---

## 5. Kết quả kiểm thử (local)

| Lệnh | Kết quả |
|---|---|
| `node --test test/nav-sanitize.test.js test/error-handler.test.js` (targeted) | **16/16 pass**, 0 fail |
| `npm test` | **371 tests — 365 pass, 0 fail, 6 skip** (6 skip cũ, không phải skip mới) |
| `npm run test:integration` | **60/60 pass**, 0 fail |
| `npm run test:jest` | **4 suites / 11 tests pass**, 0 fail |
| `npm run test:postman` | **264/264 assertions pass**, 0 yêu cầu thất bại |

Không assertion nào bị xóa, không test nào bị skip để đạt kết quả; không đổi expected result.

---

## 6. Giới hạn phạm vi (đúng như phê duyệt)

- Không thêm dependency, không sửa `package-lock.json`.
- Không đổi schema/DB, không migration, không cron, không deployment.
- Không đụng secret, `.env`, Mongo URI thật, credential production.
- Không đổi API contract hay business logic.
- Không đụng các worktree khác, không `git stash`, `checkout -- .`, `add .`, `add -A`, cherry-pick, rebase, force push, reset, clean, xóa branch.
- Không commit/push trực tiếp lên `main`; **không merge PR**.
- **Không bắt đầu T7-1-3.**

Worktree `main` (`D:\ABMT_Shop\ABMT-SHOP`) giữ nguyên trạng thái ngoài phạm vi; mọi thay đổi nằm riêng trong worktree T7-1-2.

---

## 7. Trạng thái PR

- Base: `origin/main` = `5a01ad6`.
- PR sẽ được tạo hướng vào `main` từ branch `feature/phase4-dev1-t7-1-2-sanitize`.
- Chờ CI xanh, sau đó **dừng để chờ phê duyệt merge riêng** — không tự merge.
