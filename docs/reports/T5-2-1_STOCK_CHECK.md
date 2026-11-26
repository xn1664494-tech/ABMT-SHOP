# T5-2-1 — KIỂM TRA TỒN KHO (CART/MERGE)

- **Task ID:** T5-2-1
- **Phase:** Phase 3 — Nghiệp vụ thương mại
- **Dev:** Dev 2 — Backend Business & Database
- **Nhánh:** `fix/t5-2-1-stock-check`
- **Base (stacked):** `feat/dev2-cart-api-fix-2026-11-26` (PR clamp/flash chưa merge vào `main`; PR của nhánh này cần base là nhánh trên)
- **Trạng thái:** DONE — chờ review

## 1. Yêu cầu

- So số lượng với tồn kho **đúng biến thể (SKU)**.
- Trả **409 rõ ràng** khi vượt kho.
- **Báo đúng biến thể** vượt kho (message nêu SKU + size/color + tồn kho còn lại).

## 2. Mã nguồn chính

| Nội dung | Vị trí |
|---|---|
| Xác định biến thể theo SKU khi merge | `src/services/CartService.js:104-108` |
| Bỏ qua dòng không còn bán (`!product || isDeleted || isActive===false || !variant`) | `src/services/CartService.js:110-112` |
| Merge item đã có: cộng dồn + 409 kèm SKU/size/color/còn lại | `src/services/CartService.js:123-132` |
| Merge item mới: so tồn kho, tôn trọng `onOverflow` (`throw` → 409, `clamp` → cắt) | `src/services/CartService.js:146-158` |
| POST thêm mới: 409 kèm SKU + size/color | `src/routes/cart.route.js:95-100` |
| POST cộng dồn: 409 kèm SKU + hiện có + thêm | `src/routes/cart.route.js:112-118` |
| PUT: guard product/variant (404) + 409 kèm SKU | `src/routes/cart.route.js:172-190` |
| Kiểm tra tồn kho authoritative (CAS `stock >= qty`) | `src/services/ProductsServices.js:99-122`, `src/routes/order.route.js:164-192` |

## 3. Lỗi đã sửa

| # | Trước | Sau |
|---|---|---|
| 1 | Merge item **mới** (SKU chưa có trong giỏ user) không so tồn kho; ở chế độ `throw` vẫn cắt âm thầm | `guestItem.qty > variant.stock`: `throw` → 409; `clamp` → cắt về `variant.stock`, gắn `mergeAdjusted` (0 thì bỏ dòng) |
| 2 | Message 409 POST/PUT không nêu biến thể | Message nêu `SKU (size/color)` + tồn kho còn lại + số lượng yêu cầu |
| 3 | Merge gộp cả biến thể/sản phẩm đã xóa hoặc ngừng bán | Bỏ qua khi `!product || product.isDeleted || product.isActive===false || !variant` |
| 4 | PUT coi product/variant thiếu là tồn kho 0 → 409 sai | Product không tồn tại/đã xóa/ngừng bán → 404; variant thiếu → 404 |

## 4. Test & minh chứng

| Lệnh | Kết quả |
|---|---|
| `node --test test/cart.api.test.js test/cart.merge.test.js test/cart.view.test.js` | 21/21 pass, 0 fail |
| `npm test` | 322 tests, 267 pass, 0 fail, 55 skipped |
| `npm run test:postman` | 204/204 assertions, 0 request fail (Cart 19/19) |

Test T5-2-1 (`test/cart.merge.test.js`):

- `:139` merge item đã có vượt kho → API 409, `/cart` clamp + flash.
- `:163` merge item **mới** vượt kho → API 409, message chứa SKU, giỏ guest giữ nguyên, giỏ user không đổi.
- `:181` merge item mới trong kho → giữ nguyên số lượng.
- `:196` `/cart` clamp item mới vượt kho + flash.
- `:212` bỏ qua biến thể đã xóa (`isDeleted`).
- `:232` bỏ qua biến thể ngừng bán (`isActive === false`).

Test message API (`test/cart.api.test.js`): `:93`, `:140` assert 409 chứa `SP-AO-001-M-DEN` và `còn 5`.

## 5. Reproduction

```http
POST /api/cart/merge
Cookie: accessToken=<jwt>; cartId=<guest-session>

# Giỏ guest có SKU mới qty 11, tồn kho 10
# → 409 { "success": false, "error": "Vượt quá tồn kho cho SKU ... (M/Den) — còn 10, giỏ khách 11" }
```

## 6. Ghi chú

- Kiểm tra ở giỏ mang tính cảnh báo; chốt tồn kho cuối cùng khi đặt hàng dùng CAS `stock >= qty` (chống oversell) và cũng trả 409.
- Nhánh stacked trên PR clamp/flash; khi PR kia merge vào `main`, đổi base PR này về `main`.
