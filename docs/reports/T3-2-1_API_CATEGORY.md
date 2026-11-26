# T3-2-1 — API Category (danh mục)

- **Ngày:** 2026-11-26
- **Nhánh:** `fix/dev2-phase2-review-gaps`
- **Người thực hiện:** Dev 2
- **Reviewer:** Dev 1
- **Phạm vi:** hoàn thiện minh chứng và đóng các lỗ hổng review của API danh mục: CRUD, cây cha/con, slug duy nhất, xóa mềm, không lộ trường nội bộ ở `list`/`tree`, chặn xóa khi còn sản phẩm.
- **Trạng thái:** **PASS** (unit + API test + Postman). Lệch WBS về validate thuần (không Zod) đã được người dùng chốt.

---

## 1. Endpoint

| Method | Endpoint | Auth | CSRF | Mô tả |
|---|---|---|---|---|
| GET | `/api/categories` | - | - | Danh sách danh mục đang hoạt động (phẳng) |
| GET | `/api/categories/tree` | - | - | Cây danh mục (cha → `children`) |
| GET | `/api/categories/:id` | - | - | Chi tiết danh mục |
| POST | `/api/categories` | access token + `admin` | Có | Tạo danh mục |
| PUT / PATCH | `/api/categories/:id` | access token + `admin` | Có | Cập nhật tên / `order` / danh mục cha |
| DELETE | `/api/categories/:id` | access token + `admin` | Có | Xóa mềm danh mục |

## 2. Hình dạng response `list` / `tree`

`list` và `tree` dùng `.lean()` để đọc nhanh, nên **không** đi qua `toJSON` của Mongoose. Vì vậy service map qua `toPublicCategory` để chuẩn hoá:

```json
{
  "id": "665f...",
  "name": "Áo thun",
  "slug": "ao-thun",
  "parentId": null,
  "order": 1,
  "createdAt": "2026-11-26T00:00:00.000Z",
  "updatedAt": "2026-11-26T00:00:00.000Z"
}
```

- `_id` được đổi thành `id`.
- Không trả `_id`, `__v`, `isDeleted`, `deletedAt`.
- `parentId` là chuỗi hoặc `null` (nhất quán với `detail/create/update`).
- `tree` bổ sung `children: []` cho mỗi node.

## 3. Quy tắc nghiệp vụ

| Tình huống | Kết quả |
|---|---|
| Tên rỗng / > 80 ký tự | 400 kèm `details` |
| `order` âm hoặc không nguyên | 400 |
| `parentId` sai ObjectId | 400 |
| Danh mục cha không tồn tại / đã xóa | 404 / 400 |
| Đặt cha là chính nó hoặc tạo vòng lặp cha/con | 400 |
| Tên trùng (slug trùng) | 409 |
| Xóa danh mục còn danh mục con | 409 |
| Xóa danh mục còn sản phẩm tham chiếu | 409 |
| Xóa mềm thành công | Đổi `slug` sang `...-deleted-<timestamp>` để giải phóng slug |

## 4. File thay đổi trong nhánh

| File | Nội dung |
|---|---|
| `src/utils/categorySerializer.js` | `toPublicCategory`: `_id → id`, ẩn trường nội bộ, chuẩn hoá `parentId` |
| `src/services/categoryService.js` | `list`/`tree` dùng serializer; `softDelete` chặn khi còn Product |
| `test/category.api.test.js` | Thêm test `list/tree` không lộ trường nội bộ |
| `test/categorySerializer.test.js` | Unit test serializer |
| `test/product.api.test.js` | Test xóa danh mục còn sản phẩm trả 409 |
| `postman/Category.postman_collection.json` | Giữ nguyên, dùng làm minh chứng Postman |

## 5. Bằng chứng kiểm thử

| Loại | Kết quả |
|---|---|
| Unit — serializer | 3/3 pass (`test/categorySerializer.test.js`) |
| API — `category.api.test.js` + `product.api.test.js` | 48 pass, 0 fail, 6 skip (CSRF negative — xem ghi chú) |
| Postman — `Category` | 38/38 assertions, 0 request lỗi |
| Postman — tổng bộ | 185/185 assertions, 0 request lỗi |

Lệnh chạy:

```bash
npm test
npm run test:postman
```

Ghi chú CSRF: `src/middleware/csrf.js` bỏ qua kiểm tra khi `NODE_ENV === 'test'`, nên các test âm CSRF trong `*.api.test.js` được đánh dấu `skip`. Đường dương (có token) và đường âm thực tế được kiểm qua Postman/Newman (chạy ngoài `NODE_ENV=test`), collection `Product` có request thiếu CSRF trả 403.

## 6. Kết luận

Các thiếu sót review của T3-2-1 đã đóng: có report riêng, `list/tree` không còn lộ trường nội bộ, `id` nhất quán, và xóa danh mục bị chặn khi còn sản phẩm.
