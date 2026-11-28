# T7-1-2 — Sanitize checklist

## 1. Quyết định chốt

**Chọn output encoding tại điểm render, không cài HTML sanitizer.**

Lý do:

- Không có field nào trong API/schema lưu HTML (`description` là plain text, render qua `<%= %>`). Sanitizer ở đầu vào sẽ sửa dữ liệu hợp lệ (`<`, `&`) và làm đổi contract dữ liệu đã lưu.
- EJS đã có escaping mặc định qua `<%= %>`; rủi ro thực sự chỉ nằm ở những chỗ dùng `<%- %>` (raw output).
- Vì vậy: giữ nguyên DB/API, escape mọi giá trị động trong raw output và whitelist scheme của URL trước khi đưa vào attribute.
- Không thêm dependency (`sanitize-html`, `xss`, `DOMPurify`, v.v.).

---

## 2. Phân loại toàn bộ `<%- %>` trong `src/views`

Quét toàn bộ file `.ejs`: **70 occurrence**, chia thành 5 nhóm. Không còn occurrence nào ngoài danh sách dưới đây (test `nav-sanitize.test.js` quét lại và fail nếu xuất hiện nhóm mới).

| Nhóm | Số lượng | Ví dụ | Đánh giá | Hành động |
|---|---:|---|---|---|
| `include(...)` | 60 | `<%- include('../partials/header') %>` | Template tĩnh do EJS dựng, không chứa dữ liệu user | Chấp nhận |
| `JSON.stringify(...)` đã thay `<` | 2 | `admin-chart-data`, `variants-data`: `.replace(/</g, '\\u003c')` | Nằm trong `<script type="application/json">`; thay `<` chặn `</script>` phá thẻ | Chấp nhận, giữ nonce CSP của T7-1-1 |
| Attribute tĩnh — `navActive` | 5 | `<%- navActive === 'categories' ? ' class="is-active" aria-current="page"' : '' %>` | So sánh với chuỗi cố định, output là literal cố định | Chấp nhận |
| Attribute tĩnh — `tab.isActive` | 1 | `<%- tab.isActive ? 'aria-current="page"' : '' %>` | Output là literal cố định | Chấp nhận |
| `renderMega(...)` | 2 | `header.ejs` dòng mega menu Nam/Nữ | **Sink thật**: trước đây ghép `root.name`, `col.title`, `link.name`, `link.href` thô | Đã sửa: mọi giá trị qua `escapeHtml()`, href qua `safeHref()` |

---

## 3. Sink đã sửa

`src/views/partials/header.ejs` — hàm `renderMega(root, tileClass)`:

| Trường | Trước | Sau |
|---|---|---|
| `link.href` | ghép thô vào `href="..."` | `safeHref(link.href)` |
| `link.name` | ghép thô vào nội dung `<a>` | `escapeHtml(link.name)` |
| `col.title` | ghép thô vào `<h4>` | `escapeHtml(col.title)` |
| `root.name` | ghép thô vào `<b>` và vào text link "Tất cả đồ ..." | `escapeHtml(root.name)` |
| `rootHref(root, ...)` | ghép thô vào `href` của tile | `safeHref(rootHref(root, '/catalog'))` |
| `tileClass` | literal tĩnh từ template | `escapeHtml(tileClass)` (phòng thủ) |

`safeHref` (trong `src/utils/htmlSafety.js`):

- Chấp nhận: đường dẫn tương đối bắt đầu bằng một dấu `/` (không phải `//`), query `?...`, fragment `#...`, và scheme `http:`/`https:`.
- Từ chối, trả về `#`: `javascript:`, `data:`, `vbscript:`, `file:`, `about:`, mọi scheme khác, protocol-relative `//host`, chuỗi rỗng/không có dạng path.
- Loại control character trước khi xét scheme để chặn biến thể `java\nscript:`.
- Escape `& < > " '` trước khi đưa vào attribute.

---

## 4. Các vị trí raw EJS còn lại và lý do chấp nhận

| Vị trí | Lý do chấp nhận |
|---|---|
| 60 `include(...)` | EJS include là template source, không phải dữ liệu từ DB/user |
| 2 `<script type="application/json">` | Đã thay mọi `<` thành `\u003c`, không thể đóng thẻ `</script>`; vẫn giữ `nonce` từ T7-1-1 |
| 5 + 1 attribute tĩnh | Giá trị là literal hard-code trong template, không phụ thuộc input |
| 2 `renderMega(...)` | Bản thân hàm đã escape từng giá trị; output raw là HTML được xây có chủ đích |

Không có vị trí `<%- %>` nào còn in dữ liệu user/DB thô.

---

## 5. Kiểm chứng

- Test tự động `test/nav-sanitize.test.js`: payload XSS trong tên danh mục / tiêu đề cột / tên link; `javascript:` và các scheme nguy hiểm; ký tự HTML hợp lệ; slug chứa `" onmouseover=`; quét toàn bộ `<%- %>`; kiểm tra `renderMega` dùng helper.
- Regression: `npm test`, `npm run test:integration`, `npm run test:jest`, `npm run test:postman` — xem report T7-1-2.
- Không test nào bị xóa hoặc skip để đạt kết quả.
