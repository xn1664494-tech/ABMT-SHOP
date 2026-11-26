# T4-2-2 — Phân trang & sắp xếp sản phẩm

- **Ngày:** 2026-11-26
- **Nhánh:** `fix/dev2-phase2-review-gaps`
- **Người thực hiện:** Dev 2
- **Reviewer:** Dev 1
- **Phạm vi:** `GET /api/products` với `page`, `limit`, `sort`; giới hạn `limit`; `total`/`totalPages`; từ chối tham số sai (400). Kèm sửa lỗi chặn nghiệm thu `getFlash` ở các trang HTML.
- **Trạng thái:** **PASS** (unit + API test + Postman).

---

## 1. Hợp đồng query

| Query | Mặc định | Quy tắc | Lỗi |
|---|---|---|---|
| `page` | `1` | Số nguyên ≥ 1 | 400 field `page` |
| `limit` | `20` (`DEFAULT_PAGE_SIZE`) | Số nguyên ≥ 1; `> 100` bị ép về `100` (`MAX_PAGE_SIZE`) | 400 field `limit` |
| `sort` | `newest` | `newest` → `{ createdAt: -1, _id: -1 }`; `price_asc` → `{ basePrice: 1, _id: 1 }`; `price_desc` → `{ basePrice: -1, _id: -1 }`; không phân biệt hoa/thường | 400 field `sort` |

- `skip = (page - 1) * limit`.
- Response: `data = { items, pagination }`, `pagination = { page, limit, total, totalPages }`, `totalPages = Math.ceil(total / limit)`.
- Luôn có tie-breaker `_id` để phân trang ổn định, tránh trùng/thiếu bản ghi khi `basePrice` hoặc `createdAt` bằng nhau.
- Tham số sai trả 400 kèm `details: [{ field, message }]`.

## 2. Mã nguồn

| File | Nội dung |
|---|---|
| `src/utils/productFilter.js` | `DEFAULT_PAGE_SIZE`, `MAX_PAGE_SIZE`, `buildPagination`, `buildSort` |
| `src/services/ProductsServices.js` | Áp `skip`, `limit`, `sort` vào truy vấn danh sách |
| `src/controllers/ProductsController.js` | Truyền `page/limit/sort` từ query xuống service |

## 3. Sửa lỗi chặn nghiệm thu (P0)

`src/routes/index.js` gọi `getFlash(req)` ở `/catalog` và `/products/:slug` nhưng hàm chưa được định nghĩa → `ReferenceError` khi mở 2 trang này, chặn nghiệm thu luồng xem danh sách/chi tiết.

Đã thêm `src/utils/flash.js`:

- Đọc flash từ query (`?flash=...&type=...`, `?success=...`, `?error=...`) và cookie `flash` (JSON object hoặc mảng).
- Luôn trả mảng `{ type, message }`, không crash khi cookie hỏng.
- `src/routes/index.js` import `getFlash`; hai route render 200 bình thường.

## 4. Minh chứng kiểm thử

| Loại | Kết quả |
|---|---|
| Unit — `test/product.pagination.test.js` | 8/8 pass (label đã sửa từ T4-2-1 → T4-2-2) |
| Unit — `test/flash.util.test.js` | 4/4 pass |
| API — `test/product.api.test.js` | Có test page 1/2/3, không trùng trang, cap `limit=100`, sort tăng/giảm, `page=0` → 400, `sort` sai → 400 |
| API — render HTML | `GET /catalog` và `GET /products/:slug` trả 200 |
| Postman — `ProductPagination` | 27/27 assertions, 0 request lỗi |
| Postman — tổng bộ | 185/185 assertions, 0 request lỗi |

Lệnh chạy:

```bash
npm test
npm run test:postman
```

Kết quả thực tế của bộ API (`category.api.test.js` + `product.api.test.js`): **48 pass, 0 fail, 6 skip** (CSRF negative — `NODE_ENV=test` bypass, xem ghi chú ở `T3-2-1_API_CATEGORY.md`).

## 5. Postman

`postman/ProductPagination.postman_collection.json` (14 request):

1. Lấy CSRF token + `runId`.
2. Tạo danh mục và 5 sản phẩm giá 100k…500k với SKU `SP-AO-801..805`.
3. `page=1&limit=2` → 2 item, `total=5`, `totalPages=3`, giá tăng dần.
4. `page=2&limit=2` → 2 item, không trùng trang 1.
5. `page=3&limit=2` → 1 item.
6. `limit=999` → `pagination.limit = 100`.
7. `sort=price_desc` → giá giảm dần.
8. `page=0` và `sort=khong_hop_le` → 400.

Collection được đăng ký trong `scripts/run-postman-test.js` và chạy tự động qua `npm run test:postman` (CI thêm bước newman).

## 6. Ghi chú còn lại

- Đặt tên lịch sử: các commit/test trước đây gắn nhãn T4-2-1 cho phân trang; nhánh này chuẩn hoá lại label test sang T4-2-2. WBS không đổi.
- `inStock=false` (lọc hàng hết) vẫn chưa hỗ trợ; WBS T4-2-1 chỉ yêu cầu `inStock=true`, giữ nguyên và ghi nhận.
- CSRF negative test ở tầng API test bị skip do bypass `NODE_ENV=test`; được bù bằng Postman/Newman.
