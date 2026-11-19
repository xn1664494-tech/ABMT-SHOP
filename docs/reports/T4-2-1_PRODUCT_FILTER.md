# T4-2-1 — Bộ lọc sản phẩm (`buildFilter`)

- **Ngày:** 2026-11-19
- **Nhánh:** `feature/T4-2-1-product-filter`
- **Phạm vi:** bộ lọc `GET /api/products`: danh mục, khoảng giá, từ khóa (thoát ký tự regex), Size + Màu + tồn kho > 0 bằng `$elemMatch`. Không gồm phân trang/sắp xếp (task kế tiếp).
- **Trạng thái:** **PASS** (unit + API test + Postman).

---

## 1. Hợp đồng query

| Query | Kiểu | Quy tắc | Lỗi |
|---|---|---|---|
| `category` | ObjectId 24 hex **hoặc** slug | Slug được service tra sang `_id` (`isDeleted: false`); slug không tồn tại → danh sách rỗng | ObjectId không hợp lệ khi gọi trực tiếp `buildFilter` → 400 `category` |
| `minPrice` | số nguyên ≥ 0 | `basePrice.$gte` | 400 `minPrice` |
| `maxPrice` | số nguyên ≥ 0 | `basePrice.$lte` | 400 `maxPrice` |
| `minPrice` + `maxPrice` | — | `minPrice <= maxPrice` | 400 `minPrice` |
| `keyword` | chuỗi ≤ 100 | Escape rồi regex `i` trên `name` + `description` | 400 `keyword` |
| `size` | chuỗi / mảng | Regex neo `^...$`, không phân biệt hoa/thường | — |
| `color` | chuỗi / mảng | Regex neo `^...$`, không phân biệt hoa/thường | — |
| `inStock` | `true` / `1` | Yêu cầu có biến thể `stock > 0` | — |

Kết hợp `size`/`color` dùng **duy nhất một `$elemMatch`**:

```js
{
  variants: {
    $elemMatch: {
      stock: { $gt: 0 },
      size: { $regex: '^M$', $options: 'i' },
      color: { $regex: '^Đỏ$', $options: 'i' },
    },
  },
}
```

Vì cả ba điều kiện nằm trong cùng `$elemMatch`, MongoDB chỉ khớp khi **một biến thể** thỏa đồng thời Size + Màu + tồn kho. Cách sai thường gặp là `{ 'variants.size': 'M', 'variants.color': 'Đỏ' }` — cho phép biến thể M-Xanh và biến thể S-Đỏ của cùng sản phẩm ghép lại và trả sai kết quả.

### Từ khóa an toàn

```js
const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
```

Nhờ đó `keyword=a.*b` tìm đúng chuỗi `a.*b` thay vì bị hiểu là regex (tránh sai kết quả và ReDoS).

---

## 2. Mã nguồn

| File | Nội dung |
|---|---|
| `src/utils/productFilter.js` | `escapeRegex`, `isObjectId`, `buildFilter` (hàm thuần, ném 400 kèm `details`) |
| `src/services/ProductsServices.js` | `resolveCategoryFilter` (id/slug), `list(filters, options)` ghép filter hiển thị + filter người dùng |
| `src/controllers/ProductsController.js` | `filterOptions(req)` truyền query xuống service |
| `test/product.filter.test.js` | 13 unit test |
| `test/product.api.test.js` | Bổ sung test API bộ lọc |
| `postman/ProductFilter.postman_collection.json` | 17 request, minh chứng Postman |
| `scripts/run-postman-test.js` | Chạy thêm collection `ProductFilter` |
| `package.json` | Thêm unit test vào `npm test` |
| `README.md` | Bảng query bộ lọc |

Không sửa schema/index (đã có `(category, basePrice)` và `(variants.size, variants.color)` từ T2-2-1/T2-2-2).

---

## 3. Minh chứng "M + Đỏ" chính xác

Dữ liệu test (cùng danh mục):

| Sản phẩm | Biến thể | Kỳ vọng `?size=M&color=Đỏ` |
|---|---|---|
| P1 `Filter Match` | M/Đỏ stock 5; L/Xanh stock 5 | **Khớp** |
| P2 `Filter Split` | M/Xanh stock 5; S/Đỏ stock 5 | **Không khớp** (M và Đỏ khác biến thể) |
| P3 `Filter Out` | M/Đỏ stock 0; L/Xanh stock 0 | **Không khớp** (hết hàng) |
| P4 `Filter Other` | M/Đỏ stock 5, **danh mục khác** | Không khớp khi lọc theo danh mục |

Test API `test/product.api.test.js` assert P1 có trong kết quả, P2/P3 không có; thêm case chữ thường `m`/`đỏ` vẫn khớp P1.

Postman request `Filter - 'M + Do' chi khop cung bien the, con hang` assert đúng ba điều kiện trên.

---

## 4. Kết quả kiểm thử

| Lệnh / phạm vi | Kết quả |
|---|---|
| `node --test test/product.filter.test.js` | **13/13 pass** |
| `node --test test/product.api.test.js` (MongoMemoryServer) | **25/25 pass** (gồm 2 test bộ lọc mới) |
| `npm test` | **200 pass / 0 fail / 46 skip** (test cần MongoDB local tự skip) |
| `npm run test:postman` | Category 38/38 + Product 44/44 + QueryHelper 36/36 + **ProductFilter 40/40** = **158/158 assertions**, 0 request thất bại |

Lưu ý: máy local không cấu hình `MONGODB_URI_TEST` nên khi chạy `npm test` file `test/product.api.test.js` tự skip; đã chạy riêng với MongoMemoryServer để xác nhận 25/25 pass. CI (`api-test-gates.yml`) có MongoDB service cũng sẽ chạy các test này.

---

## 5. Giới hạn / lệch đặc tả

- Chưa có phân trang, giới hạn bản ghi và sắp xếp động — thuộc task kế tiếp.
- `category` lọc **đúng danh mục** (so khớp `_id`), chưa gồm danh mục con.
- `keyword` tìm trên `name` + `description`, không tìm theo slug/SKU.
- `size`/`color` so khớp không phân biệt hoa/thường nhưng **không** bỏ dấu tiếng Việt (`Đỏ` khác `Do`).
- Khi không truyền `size`/`color`/`inStock`, sản phẩm hết hàng vẫn hiển thị (bộ lọc tồn kho chỉ bật khi có tham số).
