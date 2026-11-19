# T3-2-2 — API Product

- **Ngày:** 2026-11-19
- **Phạm vi:** CRUD sản phẩm, validate dữ liệu, chặn trùng cặp Size–Màu, tồn kho ≥ 0, chỉ lưu URL ảnh, xóa mềm.
- **Trạng thái:** **PASS** (endpoint + test Postman).
- **Quyết định của người dùng:** **không dùng Zod** — validate thuần JavaScript.

---

## 1. Endpoint

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/api/products` | Công khai | Chỉ trả sản phẩm `isActive=true`, `isDeleted=false`; admin có thể thêm `?includeInactive=true`, `?includeDeleted=true` |
| GET | `/api/products/:id` | Công khai | Cùng quy tắc hiển thị; id sai → 400, không thấy → 404 |
| POST | `/api/products` | Admin + CSRF | Tạo sản phẩm → 201 |
| PUT | `/api/products/:id` | Admin + CSRF | Cập nhật → 200 |
| PATCH | `/api/products/:id` | Admin + CSRF | Cập nhật một phần → 200 |
| DELETE | `/api/products/:id` | Admin + CSRF | Xóa mềm → 200 |

Định dạng phản hồi dùng chung: `{ success, message, data }`; lỗi validate trả 400 kèm `details: [{ field, message }]`.

---

## 2. Validate thuần (không Zod)

File: `src/validators/productValidator.js`

| Nhóm | Quy tắc | Lỗi |
|---|---|---|
| Tên | chuỗi, trim, 1–120 ký tự | 400 tại `name` |
| Mô tả | chuỗi, trim, ≤ 2000 | 400 tại `description` |
| Danh mục | chuỗi ObjectId 24 hex; service kiểm tra tồn tại + chưa xóa | 400 `category` / 404 “Danh mục không tồn tại” |
| Ảnh | mảng URL `http/https`, tối đa 20; không nhận nhị phân | 400 tại `images` |
| Giá cơ bản | số nguyên ≥ 0 | 400 tại `basePrice` |
| Biến thể | mảng ≥ 1 | 400 tại `variants` |
| Size | chuỗi, trim, tự uppercase | 400 tại `variants.N.size` |
| Màu | chuỗi, trim | 400 tại `variants.N.color` |
| colorCode | `#RRGGBB` nếu có | 400 tại `variants.N.colorCode` |
| SKU | bắt buộc, tự uppercase, đúng `SKU_REGEX` | 400 tại `variants.N.sku` |
| Tồn kho | số nguyên ≥ 0, mặc định 0 | 400 tại `variants.N.stock` |
| Giá biến thể | `null` hoặc số nguyên ≥ 0 | 400 tại `variants.N.price` |
| Trùng Size–Màu | không phân biệt hoa/thường trong cùng sản phẩm | 400 tại `variants` |
| Trùng SKU | không trùng trong cùng sản phẩm | 400 tại `variants` |
| Field lạ | bị loại bỏ (whitelist thủ công) | — |
| Update rỗng | không có field hợp lệ | 400 tại `body` |

Model `Products` vẫn giữ các ràng buộc tương ứng làm lớp bảo vệ thứ hai. Trùng slug/SKU toàn cục do unique index → `errorHandler` trả 409.

---

## 3. Hành vi nghiệp vụ

- **Chặn trùng Size–Màu:** kiểm tra ở validator (400) và `pre('validate')` của model.
- **Tồn kho ≥ 0:** validator + schema `min: 0` + kiểm tra số nguyên.
- **Ảnh:** chỉ nhận URL; không có xử lý tệp nhị phân/upload.
- **SKU:** client bắt buộc gửi; đúng định dạng `SP-{CAT}-{NNN}-{SIZE}-{COLOR}`; unique toàn cục.
- **Xóa mềm:** `isDeleted=true`, `deletedAt`, gắn hậu tố `-deleted-<timestamp>` vào slug để giải phóng slug.
- **Hiển thị:** khách chỉ thấy sản phẩm đang bán; admin mở rộng bằng query flag, áp dụng qua `optionalAuthenticate`.
- **Category:** service kiểm tra danh mục tồn tại và chưa xóa trước khi lưu sản phẩm.

---

## 4. File thay đổi

| File | Nội dung |
|---|---|
| `src/validators/productValidator.js` | Validate thuần JS cho create/update |
| `src/services/ProductsServices.js` | CRUD, visibility, validate category, xóa mềm |
| `src/controllers/ProductsController.js` | Thay stub bằng 5 handler |
| `src/routes/products.route.js` | Public GET, admin writes + CSRF |
| `src/routes/index.js` | Mount `/api/products` |
| `src/middleware/authenticate.js` | Thêm `optionalAuthenticate` |
| `test/product.validator.test.js` | 14 test validator |
| `test/product.api.test.js` | 23 test API |
| `postman/Product.postman_collection.json` | Collection Postman Product |
| `postman/Category.postman_collection.json` | Bổ sung CSRF bootstrap + header tự động |
| `scripts/run-postman-test.js` | Chạy Category + Product, tổng hợp kết quả |
| `package.json` | Thêm test validator/API vào `test`, `test:api` |
| `README.md` | Bảng API Product |

---

## 5. Bằng chứng kiểm thử

| Lệnh / phạm vi | Kết quả |
|---|---|
| `node --test test/product.validator.test.js` | 14/14 pass |
| `test/product.api.test.js` với MongoDB test (MongoMemoryServer) | 23/23 pass |
| `npm test` | 179 pass / 0 fail / 44 skip (các test cần MongoDB local tự skip) |
| `npm run test:postman` | **Category 38/38 + Product 44/44 = 82/82 assertions**, 0 request thất bại |

Ghi chú: trước thay đổi này `npm run test:postman` chỉ đạt 15/36 assertion do collection Category thiếu CSRF; runner và collection đã được sửa để “Test Postman đạt” có ý nghĩa.

---

## 6. Lệch so với WBS & giới hạn

- **WBS ghi “validate Zod”; triển khai dùng validate thuần JavaScript** theo yêu cầu người dùng. Không thêm dependency Zod, không dùng `src/middleware/validate.js` cho Product.
- Chưa có phân trang/bộ lọc nâng cao (danh mục, khoảng giá, từ khóa, `$elemMatch`) — thuộc **T4-2-1**.
- Chưa có upload ảnh; đúng phạm vi “chỉ lưu URL ảnh”.
- Không thay đổi schema/model Product (đã hoàn thành ở T2-2-1).
