# T3-2-3 — Query helper loại bản ghi `isDeleted`

- **Ngày:** 2026-11-19
- **Phạm vi:** loại bản ghi đã xóa mềm khỏi truy vấn mặc định; giữ khả năng đọc bản ghi đã xóa khi có opt-out.
- **Trạng thái:** **PASS** (unit test + Postman manual/runner).
- **Branch:** `feature/T3-2-3-query-helper`.

---

## 1. Thiết kế

Plugin: `src/plugins/softDelete.js`

- Filter mặc định: `{ isDeleted: { $ne: true } }`.
- Áp dụng cho:
  - `find*` (gồm `find`, `findOne`, `findById`, `findOneAndUpdate`, `findOneAndDelete`, ...)
  - `countDocuments`
  - `aggregate`
- Bỏ qua tự động thêm filter khi:
  - filter đã có `isDeleted` ở cấp cao nhất, hoặc
  - query dùng `.setOptions({ includeDeleted: true })` (aggregate dùng `.option({ includeDeleted: true })`).
- Plugin gắn vào 3 model có xóa mềm: `User`, `Category`, `Product`.
- Dùng middleware đồng bộ của Mongoose 9 (không dùng `next`).

Ý nghĩa:

| Truy vấn | Kết quả |
|---|---|
| `Model.find({})` | Chỉ bản ghi chưa xóa |
| `Model.find({ isDeleted: true })` | Chỉ bản ghi đã xóa (filter tường minh thắng mặc định) |
| `Model.find({}).setOptions({ includeDeleted: true })` | Cả chưa xóa và đã xóa |
| `Model.aggregate([...])` | Tự thêm `$match` loại bản ghi đã xóa |
| `Model.aggregate([...]).option({ includeDeleted: true })` | Không tự thêm `$match` |
| Bản ghi cũ thiếu `isDeleted` | Vẫn được xem là chưa xóa |

---

## 2. Thay đổi theo service

| File | Thay đổi |
|---|---|
| `src/services/ProductsServices.js` | Giữ filter hiển thị hiện tại; khi `includeDeleted=true` dùng query option để admin vẫn đọc được sản phẩm đã xóa |
| `src/services/categoryService.js` | Opt-out ở truy vấn kiểm tra danh mục cha để giữ thông báo “Danh mục cha đã bị xóa” |
| `src/services/profileService.js` | Kiểm tra email trùng vẫn nhìn thấy user đã xóa mềm vì unique index DB vẫn tính các bản ghi này |
| `src/services/homeService.js` | Bỏ filter `isVisible` không tồn tại; danh mục cha/con trên trang chủ giờ lấy theo mặc định của plugin |
| `src/model/User.js`, `Category.js`, `Products.js` | Gắn `softDeletePlugin` |

---

## 3. Kiểm thử tự động

File: `test/soft-delete.plugin.test.js`

| Nhóm kiểm thử | Kết quả |
|---|---|
| `find` / `findOne` / `findById` / `countDocuments` mặc định loại bản ghi đã xóa | PASS |
| Filter `isDeleted` tường minh (`true`/`false`) được giữ nguyên | PASS |
| `includeDeleted` trả cả bản ghi đã xóa | PASS |
| `aggregate` mặc định loại và có thể opt-out | PASS |
| `findOneAndUpdate` không sửa bản ghi đã xóa nếu không opt-out | PASS |
| Bản ghi cũ thiếu `isDeleted` vẫn hiển thị | PASS |
| Plugin áp dụng cho `User` và `Product` | PASS |
| `homeService.getNavCategories` không trả danh mục đã xóa | PASS |

Kết quả toàn bộ unit test:

| Lệnh | Kết quả |
|---|---|
| `node --test test/soft-delete.plugin.test.js` | **8/8 pass** |
| `npm test` | **187 pass / 0 fail / 44 skip** (các test cần MongoDB local tự skip) |

---

## 4. Kiểm thử Postman

Collection: `postman/QueryHelper.postman_collection.json`

Luồng kiểm thử:

1. Lấy CSRF token.
2. Tạo danh mục cha, danh mục con, sản phẩm.
3. Xác nhận dữ liệu xuất hiện trước khi xóa.
4. Xóa mềm sản phẩm.
5. Kiểm tra danh sách/chi tiết công khai không còn sản phẩm.
6. Kiểm tra admin vẫn xem được sản phẩm qua `?includeDeleted=true`.
7. Xóa mềm danh mục con, kiểm tra list/tree/detail công khai.
8. Xóa mềm danh mục cha, kiểm tra list/tree/detail công khai.

Kết quả `npm run test:postman`:

| Collection | Kết quả |
|---|---|
| Category | 38/38 assertions |
| Product | 44/44 assertions |
| QueryHelper | 36/36 assertions |
| **Tổng** | **118/118 assertions, 0 request thất bại** |

Chạy thủ công trong Postman:

- Import collection `QueryHelper`.
- Đặt biến `baseUrl` (ví dụ `http://localhost:3099`).
- Đặt `adminToken` là access token admin hợp lệ.
- Chạy toàn bộ collection; collection tự lấy CSRF và tự sinh `runId`.

---

## 5. File thay đổi

| File | Nội dung |
|---|---|
| `src/plugins/softDelete.js` | Plugin lọc `isDeleted` mặc định |
| `src/model/User.js` | Gắn plugin |
| `src/model/Category.js` | Gắn plugin |
| `src/model/Products.js` | Gắn plugin |
| `src/services/ProductsServices.js` | Opt-out `includeDeleted` cho admin |
| `src/services/categoryService.js` | Giữ kiểm tra danh mục cha đã xóa |
| `src/services/profileService.js` | Giữ kiểm tra email trùng với user đã xóa |
| `src/services/homeService.js` | Bỏ `isVisible`, dùng mặc định plugin |
| `test/soft-delete.plugin.test.js` | 8 test plugin + home service |
| `test/support/fakeUserModel.js` | Hỗ trợ `setOptions()` cho fake model |
| `postman/QueryHelper.postman_collection.json` | Bằng chứng Postman |
| `scripts/run-postman-test.js` | Chạy thêm collection QueryHelper |
| `package.json` | Thêm test plugin vào `npm test` |
| `README.md` | Quy ước query helper |

---

## 6. Giới hạn

- `estimatedDocumentCount` không nhận filter nên không áp dụng mặc định; cần dùng `countDocuments` nếu muốn lọc xóa mềm.
- `aggregate` mặc định thêm `$match` ở đầu pipeline; nếu cần aggregate bản ghi đã xóa phải dùng `.option({ includeDeleted: true })`.
- Không thay đổi hành vi xóa mềm hay khôi phục bản ghi; task chỉ tập trung vào truy vấn mặc định.
