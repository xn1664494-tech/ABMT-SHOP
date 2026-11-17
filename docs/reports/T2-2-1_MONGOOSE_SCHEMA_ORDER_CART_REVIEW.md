# T2-2-1 — Mongoose Schema: Order, Cart, Review

- **Ngày:** 2026-11-17
- **Nhánh:** `feature/T2-2-1-order-cart-review` (tách từ `feature/T2-2-1-mongoose-schema`)
- **Phạm vi:** Mongoose schema cho `Order` (items + price snapshot), `Cart`, `Review`; ràng buộc, message lỗi, index, tài liệu và test.
- **Nguồn đặc tả:**
  - `docs/thiet-ke-csdl/erd.png`
  - `docs/thiet-ke-csdl/data-dictionary-1.png`, `data-dictionary-2.png`
  - `docs/thiet-ke-csdl/data-rules.png`, `business-rules.png`
  - `docs/thiet-ke-csdl/order-lifecycle.png`

---

## A. File thay đổi

| File | Loại | Nội dung |
|---|---|---|
| `src/model/Order.js` | mới | Order + OrderItem snapshot, statusHistory, auto tính tiền |
| `src/model/Cart.js` | mới | Cart + CartItem, guest TTL/partial unique |
| `src/model/Review.js` | mới | Review, unique (user, product) |
| `src/utils/orderCode.js` | mới | Sinh/validate mã đơn `ORD-YYYYMMDD-XXXXXX` |
| `test/order.model.test.js` | mới | Unit test Order |
| `test/cart.model.test.js` | mới | Unit test Cart |
| `test/review.model.test.js` | mới | Unit test Review |
| `test/integration/checkout.integration.test.js` | mới | Integration test MongoDB thật (tự skip nếu thiếu DB) |
| `package.json` | sửa | Bổ sung test model + integration checkout |

---

## B. Order (`src/model/Order.js`)

### Order

| Trường | Kiểu / ràng buộc | Message lỗi |
|---|---|---|
| `code` | String, unique, uppercase, match `ORD-\d{8}-[0-9A-F]{6}`, tự sinh | `Mã đơn phải có dạng ORD-YYYYMMDD-XXXXXX` |
| `user` | ObjectId ref `User`, required | `Người đặt hàng là bắt buộc` |
| `items` | `[OrderItem]`, ít nhất 1 | `Đơn hàng phải có ít nhất một sản phẩm` |
| `shippingAddress` | Object snapshot, required | `Địa chỉ giao hàng là bắt buộc` |
| `paymentMethod` | enum `cod` / `bank_transfer`, default `cod` | `Phương thức thanh toán không hợp lệ` |
| `paymentStatus` | enum `unpaid` / `paid` / `refunded`, default `unpaid` | `Trạng thái thanh toán không hợp lệ` |
| `status` | enum 5 trạng thái, default `pending` | `Trạng thái đơn hàng không hợp lệ` |
| `statusHistory` | `[{ status, at, by, note }]`, default `[]` | Lưu vết audit |
| `subtotal` | Number, required, int ≥ 0 | Tự tính từ `lineTotal` |
| `shippingFee` | Number, required, int ≥ 0 | Tự tính 30.000 / 0 nếu chưa truyền |
| `discount` | Number, default 0, int ≥ 0 | |
| `total` | Number, required, int ≥ 0 | `subtotal + shippingFee - discount` |
| `note` | String, max 500 | `Ghi chú tối đa 500 ký tự` |
| `createdAt` / `updatedAt` | timestamps | |

### OrderItem (snapshot)

| Trường | Kiểu / ràng buộc | Ghi chú |
|---|---|---|
| `product` | ObjectId ref `Product`, required | |
| `name` | String, required, max 120 | snapshot |
| `image` | String | snapshot |
| `sku` | String, required, uppercase | snapshot |
| `size` / `color` | String | snapshot |
| `unitPrice` | Number, required, int ≥ 0 | snapshot |
| `qty` | Number, required, int ≥ 1 | |
| `lineTotal` | Number, required, int ≥ 0 | tự tính `unitPrice × qty` |

### Địa chỉ giao hàng (snapshot)

`fullName`, `phone`, `province`, `district`, `ward`, `detail` bắt buộc; `label`, `isDefault` tùy chọn.

### Luồng trạng thái

```
pending → confirmed → shipping → delivered
pending → cancelled
confirmed → cancelled
shipping → delivered
delivered / cancelled: kết thúc
```

- `Order.canTransition(from, to)` trả về `true/false`.
- Schema chỉ default `pending` khi tạo và ghi entry đầu tiên vào `statusHistory`.
- Service phải gọi `canTransition` trước khi cho đổi trạng thái (MongoDB không tự biết trạng thái cũ).

### Index

| Index | Loại |
|---|---|
| `code` | unique |
| `(user, createdAt)` | compound |
| `(status, createdAt)` | compound |

---

## C. Cart (`src/model/Cart.js`)

| Trường | Kiểu / ràng buộc | Ghi chú |
|---|---|---|
| `user` | ObjectId ref `User`, default null | Khách đăng nhập |
| `sessionId` | String, default null | Khách vãng lai |
| `items` | `[CartItem]`, default `[]` | |
| `expiresAt` | Date, default null | Guest: tự set +30 ngày; user: null |
| `createdAt` / `updatedAt` | timestamps | |

Ràng buộc:

- Đúng một trong `user` / `sessionId`:
  `"Giỏ hàng phải thuộc về user hoặc sessionId (không thể cả hai hoặc không có)"`.
- Guest tự set `expiresAt = now + 30 ngày`.
- Chặn trùng `sku` trong cùng giỏ hàng.
- `CartItem`: `product` required, `sku` required, `size`, `color`, `qty` int ≥ 1, `unitPrice` int ≥ 0.

Index:

| Index | Loại | Mục đích |
|---|---|---|
| `user` | unique, partial `{ user: { $type: 'objectId' } }` | 1 giỏ / user |
| `sessionId` | unique, partial `{ sessionId: { $type: 'string' } }` | 1 giỏ / phiên |
| `expiresAt` | TTL `2592000s` | Tự xóa giỏ guest sau 30 ngày |

---

## D. Review (`src/model/Review.js`)

| Trường | Kiểu / ràng buộc | Message lỗi |
|---|---|---|
| `user` | ObjectId ref `User`, required | `Người đánh giá là bắt buộc` |
| `product` | ObjectId ref `Product`, required | `Sản phẩm được đánh giá là bắt buộc` |
| `order` | ObjectId ref `Order`, required | `Đơn hàng xác thực là bắt buộc` |
| `rating` | Number, required, int 1–5 | `Số sao đánh giá tối thiểu là 1` / `... tối đa là 5` |
| `comment` | String, max 1000 | `Nội dung đánh giá tối đa 1000 ký tự` |
| `isApproved` | Boolean, default false | Kiểm duyệt |
| `createdAt` / `updatedAt` | timestamps | |

Index:

| Index | Loại | Mục đích |
|---|---|---|
| `(user, product)` | unique | 1 đánh giá / sản phẩm / người dùng |
| `(product, isApproved, createdAt)` | compound | Hiển thị đánh giá đã duyệt |

Review **không** soft-delete (giữ audit). Ràng buộc verified purchase (order `delivered` và chứa product) phải kiểm tra ở service trước khi tạo.

---

## E. Mã đơn (`src/utils/orderCode.js`)

- Format: `ORD-YYYYMMDD-XXXXXX`.
- `XXXXXX` = 6 ký tự cuối ObjectId, in hoa → unique, không cần counter, không race.
- `buildOrderCode({ id, date })` dùng trong `Order.pre('validate')` nếu chưa có `code`.
- `ORDER_CODE_REGEX = /^ORD-\d{8}-[0-9A-F]{6}$/`.

---

## F. Quy tắc nghiệp vụ và nơi enforce

| Quy tắc | Enforce ở |
|---|---|
| Mã đơn format/unique | Schema + unique index |
| Snapshot tên/giá/ảnh/SKU/địa chỉ | Schema (OrderItem, shippingAddress) |
| Tự tính `lineTotal`, `subtotal`, `total` | Schema `pre('validate')` |
| Phí ship 30.000, free từ 500.000 | Schema khi chưa truyền `shippingFee` |
| Luồng trạng thái chỉ tiến | Static `canTransition` + service |
| Chỉ hủy `pending` / `confirmed` | Service dùng `canTransition` |
| Trừ kho nguyên tử `stock >= qty`, hoàn kho khi hủy | Service (Product variant), ngoài schema |
| Giỏ guest hết hạn 30 ngày | TTL index |
| 1 giỏ / user, 1 giỏ / session | Partial unique index |
| Merge giỏ guest → user, cộng qty theo SKU, giới hạn tồn | Service |
| Verified purchase + unique đánh giá | Unique index + service |
| Order/Review giữ audit, không soft-delete | Không khai báo `isDeleted` |

---

## G. Kiểm chứng

```bash
node --check src/model/Order.js
node --check src/model/Cart.js
node --check src/model/Review.js
node --check src/utils/orderCode.js
npm test
npm run test:integration
```

Kết quả chạy ngày 2026-11-17:

| Lệnh | Kết quả |
|---|---|
| `node --check` các file mới | OK |
| `npm test` | 130 pass / 0 fail / 0 skip |
| `npm run test:integration` | 1 pass / 0 fail / 19 skip (máy chưa có MongoDB test local) |

- `test/order.model.test.js`: code/tự sinh, snapshot, auto totals/ship/discount, enum, statusHistory, `canTransition`, index, toJSON.
- `test/cart.model.test.js`: đúng một owner, TTL 30 ngày, partial unique, CartItem, trùng SKU, toJSON.
- `test/review.model.test.js`: required, rating 1–5, comment, default, index, toJSON.
- `test/integration/checkout.integration.test.js`: Order thật, Cart TTL/partial unique, Review unique `(user, product)`; cần chạy lại khi có MongoDB local.
