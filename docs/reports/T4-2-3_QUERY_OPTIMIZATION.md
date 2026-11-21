# T4-2-3 — Tối ưu truy vấn danh sách sản phẩm

- **Ngày:** 2026-11-21
- **Phạm vi:** `GET /api/products` (danh sách công khai + admin).
- **Không thay đổi:** `GET /api/products/:id`, `homeService`, API Category/Cart/Order.

## 1. Vấn đề

Trước thay đổi, danh sách sản phẩm:

- lấy **toàn bộ document** (gồm `description` tới 2000 ký tự) trong khi card/catalog không dùng;
- trả Mongoose document đầy đủ, kéo theo `__v`, `isDeleted`, `deletedAt`;
- sort `newest` (`createdAt: -1, _id: -1`) chỉ có index `(isActive, isDeleted)` nên MongoDB phải **SORT trong bộ nhớ** sau khi quét toàn bộ nhóm visible.

## 2. Thay đổi

| File | Nội dung |
|---|---|
| `src/utils/productFilter.js` | Thêm hằng `PRODUCT_LIST_FIELDS` (`name slug category images basePrice variants isActive createdAt updatedAt`). |
| `src/utils/productSerializer.js` (mới) | `toPublicProductListItem(doc)` map plain object từ `.lean()` về shape API: `id`, `totalStock`, `inStock`; ẩn `_id`, `__v`, `isDeleted`, `deletedAt`. |
| `src/services/ProductsServices.js` | `list()` dùng `.select(PRODUCT_LIST_FIELDS).lean()` rồi map qua serializer. Giữ nguyên filter, pagination, sort, xử lý slug không tồn tại. |
| `src/model/Products.js` | Thêm index `{ isActive: 1, isDeleted: 1, createdAt: -1, _id: -1 }`. |

### Vì sao phải có serializer

`.lean()` bỏ qua `toJSON` transform và virtual của Mongoose. Nếu trả thẳng lean document, API sẽ mất `id`, mất `totalStock`/`inStock`, và lộ `_id`/`isDeleted`. Serializer tính lại:

- `totalStock = Σ variants[].stock` (variants rỗng/thiếu → `0`);
- `inStock = variants.some(stock > 0)` (rỗng → `false`).

## 3. Hợp đồng API sau thay đổi

`GET /api/products` vẫn trả wrapper cũ:

```json
{
  "success": true,
  "message": "Lấy danh sách sản phẩm thành công",
  "data": {
    "items": [
      {
        "id": "...",
        "name": "...",
        "slug": "...",
        "category": "...",
        "images": ["..."],
        "basePrice": 199000,
        "variants": [{ "size": "M", "color": "Đỏ", "sku": "...", "stock": 5, "price": 199000 }],
        "isActive": true,
        "totalStock": 5,
        "inStock": true,
        "createdAt": "...",
        "updatedAt": "..."
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 100, "totalPages": 5, "itemCount": 20 }
  }
}
```

**Lưu ý cho frontend:** item trong danh sách **không còn `description`**. Gọi `GET /api/products/:id` nếu cần mô tả đầy đủ.

Postman collections `Product`, `QueryHelper`, `ProductFilter` đã được cập nhật từ `data` sang `data.items` cho các request danh sách (khớp response phân trang hiện tại).

## 4. Index và phạm vi tối ưu

Index mới:

```js
{ isActive: 1, isDeleted: 1, createdAt: -1, _id: -1 }
```

- Khớp filter visible thực tế `{ isActive: true, isDeleted: false }` và sort mặc định `newest = { createdAt: -1, _id: -1 }`.
- Nhờ vậy explain không còn stage `SORT`; số document/key examined giảm từ toàn bộ nhóm visible xuống đúng `limit`.

**Không phủ bởi index này:**

- `category` + `basePrice`: dùng index sẵn có `(category, basePrice)` nhưng sort `createdAt` có thể vẫn `SORT`.
- `sort=price_asc|price_desc`: chưa có index visibility + `basePrice`; có thể `SORT`.
- `keyword` regex trên `name`/`description`: không dùng index thường.
- `size`/`color`: dùng index multikey hiện có, không phải index mới.

Các trường hợp trên là giới hạn có chủ đích của T4-2-3; tối ưu sort giá là task/index riêng nếu cần.

### Tạo index trên DB thật

MongoDB **không** tự tạo index khi chỉ sửa schema. Chạy một trong hai lệnh sau trên môi trường thật:

```powershell
npm run seed
# hoặc trong script khởi động:
await Product.init();
```

`Product.syncIndexes()` cũng tạo index mới nhưng sẽ **drop index không còn trong schema** — chỉ dùng khi đã kiểm tra kỹ.

## 5. Đo hiệu năng

Script: `scripts/benchmark-product-list.js` (`npm run benchmark:product-list`).

- 10.000 document, mỗi document có `description` ~1000 ký tự.
- Warm-up 10 vòng, đo 50 vòng, lấy mean/median/p95.
- Filter `{ isActive: true, isDeleted: false }`, sort `newest`, `limit = 20`.
- Môi trường: `mongodb-memory-server` (số đo mang tính so sánh tương đối, không phải benchmark phần cứng production).

### Thời gian & payload

| Cách đo | Mean | Median | p95 | JSON response |
|---|---:|---:|---:|---:|
| Trước: full document, không lean | 2.19 ms | 2.06 ms | 3.66 ms | 30.8 KB |
| Sau: projection + lean | 1.09 ms | 1.05 ms | 1.48 ms | 9.6 KB |

- Thời gian trung bình giảm **~50%** (2.19 → 1.09 ms).
- Payload danh sách giảm **~69%** (30.8 → 9.6 KB) nhờ bỏ `description`.

### Explain (executionStats)

| Kế hoạch | Index | SORT | COLLSCAN | Keys examined | Docs examined | ms |
|---|---|---|---:|---:|---:|---:|---:|
| Trước (hint index cũ `isActive_1_isDeleted_1`) | `isActive_1_isDeleted_1` | true | false | 9000 | 9000 | 21 |
| Sau (index compound mới) | `isActive_1_isDeleted_1_createdAt_-1__id_-1` | false | false | 20 | 20 | 1 |

Index mới giúp MongoDB lấy đúng 20 document theo thứ tự có sẵn, không phải đọc 9000 document rồi sort.

## 6. Kiểm chứng

| Lệnh | Kết quả |
|---|---|
| `node --test test/product.query-optimization.test.js` | 6/6 pass |
| `npm test` | 214 pass, 0 fail, 46 skip (các test cần MongoDB local theo `.env.test` đang không chạy) |
| `npm run test:postman` | 158/158 assertions, 0 request fail |
| `npm run benchmark:product-list` | Số đo ở mục 5 |

Test mới bao gồm:

- sort mặc định khớp index;
- shape list: có `id`, không có `_id`/`description`/`isDeleted`/`deletedAt`;
- `totalStock`/`inStock` đúng khi variants rỗng hoặc thiếu;
- filter `size` + `color` vẫn đúng sau khi dùng `.lean()`;
- explain dùng `IXSCAN`, không `COLLSCAN`, không `SORT` (duyệt cây đệ quy, không phụ thuộc cấu trúc `winningPlan` của từng phiên bản MongoDB);
- hint index cũ cho thấy `SORT` để so sánh trước/sau.

## 7. Rủi ro & lưu ý

- **Thay đổi payload:** client nào đọc `description` trong danh sách sẽ nhận `undefined`; cần gọi endpoint chi tiết.
- **Index chưa có trên DB thật:** nếu chưa chạy `Product.init()`/`npm run seed`, explain vẫn có thể `SORT` và benchmark không đạt kết quả như báo cáo.
- **Số đo benchmark:** phụ thuộc máy và phiên bản MongoDB; dùng để so sánh tương đối giữa trước/sau.
- **`syncIndexes()`:** có thể drop index ngoài schema, không chạy mù trên production.

## 8. Đối chiếu DoD T4-2-3

| Yêu cầu | Trạng thái |
|---|---|
| Dùng `.lean()` cho truy vấn danh sách | Đạt |
| Chỉ lấy trường cần thiết (projection) | Đạt — bỏ `description` khỏi list |
| Có index hỗ trợ truy vấn danh sách | Đạt — compound newest index |
| Có minh chứng explain trước/sau | Đạt — mục 5 |
| Có đo lường trước/sau | Đạt — 10.000 document, warm-up + 50 vòng |
| Không phá vỡ API hiện có | Đạt — `id`, `totalStock`, `inStock` giữ nguyên; Postman 158/158 |
