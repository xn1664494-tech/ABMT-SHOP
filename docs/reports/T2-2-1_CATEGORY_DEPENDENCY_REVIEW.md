# T2-2-1 — Category Model Dependency Review (Dev 1)

- **Date:** 2026-11-17
- **Branch:** `feature/T2-2-1-category-dependency-review`
- **Parent branch:** `feature/T2-1-3-env-test-integration` (stacked from TASK 3)
- **Base commit:** `e8e5af354e228747b92da20a72d8b9c6d1482723`
- **Final status:** **BLOCKED** (dependency thuộc Dev 2; Dev 1 không triển khai)

## 1. Ownership / scope xác minh

| Nguồn | Kết quả |
|---|---|
| `docs/ABMT_Phan_chia_cong_viec.xlsx` → sheet `02_WBS`, row 17 (T2-2-1) | Owner: **Dev 2** (Backend Business & Database). Nội dung: "Viết schema User, Category, Product (variants + SKU), kèm ràng buộc và message lỗi". |
| `docs/reports/PHASE2_DEV1_BAO_CAO_2026-11-15.md` (§2, §7) | Ghi rõ T2-2-1 User schema là **Dev 2** chưa có đầy đủ; yêu cầu Dev 2 bổ sung model Category còn thiếu và chỉnh `Products.js` dùng `ValidationError`. |
| Master prompt TASK 4 | "Nếu thuộc Dev 2: không tự ý triển khai thay Dev 2. Tạo báo cáo dependency rõ ràng. Đề xuất contract model cần có. Nếu chưa xác định được ownership, dừng task và ghi rõ BLOCKED, không sửa code." |

**Kết luận:** Category model (và hoàn thiện Product/Category schema theo T2-2-1) thuộc **Dev 2**. Dev 1 **không** triển khai, **không** sửa schema Product/Category theo suy đoán.

## 2. Hiện trạng code (read-only)

- `src/model/User.js`: tồn tại (Dev 1, Phase 2).
- `src/model/Category.js`: **không tồn tại**.
- `src/model/Products.js`: tham chiếu `category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true }` và có index `{ category: 1, price: 1 }` — ref trỏ tới model chưa được khai báo.
- Ghi chú sẵn có trong báo cáo Phase 2: `Products.js` dùng `Error` thay vì `ValidationError` (cần Dev 2 xử lý theo convention dự án).

## 3. Tác động dependency

- Populate/query liên quan `Category` từ Product sẽ lỗi hoặc không hoạt động đúng khi model `Category` chưa đăng ký trong Mongoose.
- Các API/catalog, seed, và CRUD Category/Product (Dev 2, T3-2-x / Phase 2+) phụ thuộc contract Category.
- Không ảnh hưởng đến các chức năng Dev 1 Phase 2 đã PASS (Auth, RBAC, Profile, CSRF, Rate limit).

## 4. Đề xuất contract tối thiểu cho `Category` model (để Dev 2 tham chiếu)

> **Lưu ý:** Đây là đề xuất contract tham khảo dựa trên WBS/data dictionary gợi ý và cách `Products.js` đang ref; Dev 2 phải đối chiếu data dictionary/thiết kế chính thức trước khi hiện thực.

| Trường | Kiểu gợi ý | Ghi chú |
|---|---|---|
| `name` | `String`, required, trim | Tên danh mục, có giới hạn độ dài hợp lý. |
| `slug` | `String`, required, trim, lowercase, **unique** | Dùng cho URL/lookup; sinh/chuẩn hoá nhất quán. |
| `description` | `String`, optional | Mô tả ngắn. |
| `parent` | `ObjectId`, ref `Category`, default `null` | Hỗ trợ cây cha/con (WBS T3-2-1 nêu "cây cha/con"). |
| `isDeleted` | `Boolean`, default `false` | Soft-delete theo convention dự án. |
| `deletedAt` | `Date`, default `null` | Kèm soft-delete. |
| `status`/`isActive` | theo thiết kế chính thức | Nếu data dictionary yêu cầu. |
| `timestamps` | `true` | `createdAt`, `updatedAt`. |

**Indexes gợi ý:** unique `slug`; index phục vụ truy vấn theo `parent`/trạng thái nếu cần (theo thiết kế).

**Ràng buộc/validation:** message lỗi rõ ràng (tiếng Việt theo convention hiện tại nếu áp dụng), không cho vòng lặp parent (nếu thiết kế yêu cầu) — do Dev 2 quyết định.

**Liên kết với `Products.js`:** giữ `ref: 'Category'` và tên model export là `Category` (`mongoose.model('Category', schema)`) để populate hoạt động; mọi thay đổi ref/schema Product phải do Dev 2 và theo data dictionary.

## 5. Hành động Dev 1

- Không tạo/sửa `src/model/Category.js`, không sửa `src/model/Products.js`, không thêm route/controller/service Category.
- Báo cáo dependency và **BLOCKED** phần triển khai T2-2-1 Category cho Dev 1.

## 6. Đề xuất cho Dev 2 / điều phối

1. Tạo `src/model/Category.js` đúng data dictionary và WBS T2-2-1/T3-2-1.
2. Đồng bộ `Products.js` (ref, validation/error type) theo convention.
3. Bổ sung seed/index/test Postman/model theo DoD T3-2-1/T3-2-2.
4. Sau khi có model, xác nhận populate/index hoạt động trên DB test.
