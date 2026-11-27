# T5-2-3 — HAI CHẾ ĐỘ GIỎ (GUEST / CUSTOMER)

- **Task ID:** T5-2-3
- **Phase:** Phase 3 — Nghiệp vụ thương mại
- **Dev:** Dev 2 — Backend Business & Database
- **Nhánh:** `fix/t5-2-3-two-cart-modes`
- **Trạng thái:** DONE — chờ review

## 1. Yêu cầu

- **Guest:** giỏ theo `sessionId`, lưu qua cookie `cartId`, TTL 30 ngày.
- **Customer:** giỏ là document `Cart` riêng, tham chiếu `user` (1 giỏ/user).
- Hai chế độ chạy ổn: khách vãng lai dùng giỏ session; khi đăng nhập giỏ guest được chuyển/gộp sang giỏ user.

## 2. Mã nguồn chính

| Nội dung | Vị trí |
|---|---|
| Schema phân biệt user XOR sessionId (`pre('validate')`) | `src/model/Cart.js:92-125` |
| Unique partial index 1 giỏ/user, 1 giỏ/session | `src/model/Cart.js:127-143` |
| TTL index `expiresAt` với `expireAfterSeconds: 0` (xóa đúng tại `expiresAt`) | `src/model/Cart.js:145-148` |
| `expiresAt = now + 30 ngày` cho giỏ guest | `src/model/Cart.js:103-109` |
| Cookie `cartId` (httpOnly, SameSite=Lax, 30 ngày, secure ở production) | `src/services/CartService.js:13-22` |
| Resolve giỏ theo `user` hoặc `sessionId` | `src/services/CartService.js:195-245` |
| Chuyển giỏ guest → user khi user chưa có giỏ | `src/services/CartService.js:214-221` |
| Gộp guest vào user khi có cả hai (`throw`/`clamp`) | `src/services/CartService.js:93-180`, `:222-227` |
| Tạo giỏ guest mới + set cookie | `src/services/CartService.js:238-241` |
| API `/api/cart` mount `currentUser` riêng | `src/routes/api.js:11` |
| API resolve mặc định `mergeOnConflict: 'none'` | `src/routes/cart.route.js:25-33` |
| `POST /api/cart/merge` tường minh | `src/routes/cart.route.js:246-...` |
| Trang `/cart`, `/checkout` gộp `clamp` | `src/routes/index.js:112-124`, `:319-331` |

## 3. Luồng 2 chế độ

1. **Guest:** chưa có `cartId` cookie → `Cart.create({ sessionId })` + set cookie; các request sau resolve theo `sessionId`.
2. **Đăng nhập, user chưa có giỏ:** giỏ guest được đổi `user`, xóa `sessionId`, `expiresAt = null`, xóa cookie `cartId` (promote).
3. **Có cả 2 giỏ:** API giữ nguyên chờ `/api/cart/merge` tường minh; trang HTML gộp `clamp` và hiện flash.
4. **Customer:** resolve theo `user`, unique partial index đảm bảo 1 giỏ/user, không TTL.

## 4. Lỗi TTL đã sửa + migrate

**Trước:** `expiresAt = now + 30 ngày` nhưng `expireAfterSeconds = 30 ngày` → giỏ guest bị xóa sau ~60 ngày.
**Sau:** `expireAfterSeconds = 0` → xóa đúng tại `expiresAt`.

Script migrate: `scripts/migrate-cart-ttl-index.js` (npm script `migrate:cart-ttl`), dùng chung `MONGODB_URI` với app, idempotent, ưu tiên `collMod`, fallback `dropIndex` + `createIndex`, in lại index để verify, guard `MIGRATE_CONFIRM=1`.

Cách chạy:

```bash
# Dev (có .env chứa MONGODB_URI)
MIGRATE_CONFIRM=1 npm run migrate:cart-ttl

# Windows PowerShell
$env:MIGRATE_CONFIRM='1'; npm run migrate:cart-ttl

# Atlas: dùng MONGODB_URI Atlas có quyền collMod/createIndex; lệnh giữ nguyên
MIGRATE_CONFIRM=1 node scripts/migrate-cart-ttl-index.js
```

**Thứ tự deploy:** chạy migrate **trước** khi deploy code mới/restart app. Dev (`autoIndex=true`) và integration (`Cart.init()`) sẽ gặp `IndexOptionsConflict` nếu DB còn index cũ; production (`autoIndex=false`) không tự conflict nhưng vẫn cần migrate để TTL đúng. Không mất dữ liệu (chỉ đổi thuộc tính index; fallback drop/recreate cũng chỉ dựng lại index).

Đã `grep` toàn repo `GUEST_CART_TTL_SECONDS`: chỉ 5 chỗ (`src/model/Cart.js` ×3, `test/cart.model.test.js`, `test/integration/checkout.integration.test.js`) — đã xóa/đổi hết.

## 5. Test & minh chứng

| Lệnh | Kết quả |
|---|---|
| `node --test test/cart.api.test.js test/cart.merge.test.js test/cart.view.test.js test/cart.model.test.js` | 33/33 pass, 0 fail |
| `npm test` | 323 tests, 268 pass, 0 fail, 55 skipped |
| `npm run test:postman` | 204/204 assertions, 0 request fail (Cart 19/19) |

Test mới/cập nhật:

- `test/cart.model.test.js:133-162`: TTL `expireAfterSeconds === 0`; `expiresAt ≈ now + 30 ngày` (`:72-80`).
- `test/integration/checkout.integration.test.js:201-209`: assert `expireAfterSeconds === 0`; giữ `expiresAt > 29 ngày`.
- `test/cart.merge.test.js`: `T5-2-3: guest cart tu chuyen thanh user cart qua GET /api/cart` — 200, chỉ còn 1 giỏ `user`, hết giỏ guest, cookie `cartId` bị clear, items giữ nguyên.
- Các test merge/guest có sẵn: `cart.merge.test.js:101-172`, `cart.api.test.js` (cartId cookie).

## 6. Ghi chú

- `cartCount` (`src/routes/index.js:217-227`, `:290-300`) đếm theo **user hoặc guest**, chưa cộng cả hai khi đang có 2 giỏ; đây là hành vi cố ý chờ merge, giữ nguyên.
- Kiểm tra tồn kho authoritative khi đặt hàng dùng CAS (`ProductsServices.js:99-122`).
