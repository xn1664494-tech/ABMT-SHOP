# PR-6 / T5-1-1 — Login cart merge (báo cáo)

Ngày: 2026-11-27
Worktree: `D:\ABMT_Shop\ABMT-SHOP-pr6`
Branch: `feat/T5-1-1-login-cart-merge` (base `main` @ `79d9920`)

## 1. Scope

Chỉ 3 file, nằm đúng trong worktree PR-6:

| File | Thay đổi |
| --- | --- |
| `src/controllers/authController.js` | Thêm `require` CartService + gọi merge trong **duy nhất hàm `login`** |
| `test/auth.cart-merge-on-login.test.js` | Mới — 8 test, DB-free |
| `docs/reports/PR6_T5-1-1_LOGIN_CART_MERGE.md` | Mới — báo cáo này |

KHÔNG sửa: `CartService.js`, `cart.route.js`, `Cart.js`, `currentUser.js`, `admin.route.js`, `auth.route.js`, `authService.js`, `tokenService.js`.
KHÔNG merge / cherry-pick / rebase / reset / clean / force push; KHÔNG dùng `git add .`.

## 2. Kiểm tra API thực tế trước khi implement

`src/services/CartService.js:195` có sẵn:

```js
resolveCartForRequest({ userId = null, cartId = null, createIfMissing = false,
                        res = null, mergeOnConflict = 'none' } = {})
```

- `mergeOnConflict: 'clamp'` được hỗ trợ (`CartService.js:223`) và đi vào `mergeGuestIntoUser(..., { onOverflow: 'clamp' })` (`CartService.js:93`).
- `mergeGuestIntoUser` cộng qty theo SKU, clamp theo `variant.stock`, bỏ qua sản phẩm `isDeleted` / `isActive === false` / thiếu variant (`CartService.js:103-176`), xóa guest cart và `res.clearCookie('cartId')` (`CartService.js:178-180`).
- Trường hợp chỉ có guest cart, chưa có user cart: helper tự chuyển quyền sở hữu giỏ guest sang user và cũng tự clear cookie (`CartService.js:214-221`).
- `createIfMissing` mặc định `false` nên login không tạo giỏ rỗng khi không có guest cart.

→ Contract tương thích; **không refactor CartService**.

Điểm cần hiệu chỉnh trong `login`: `loginUser()` trả *public user* (`toPublicUser` ở `authService.js:11`) chỉ có `id`, không có `_id`. Vì vậy tham số được truyền là `user._id || user.id` thay vì chỉ `user._id`; nếu truyền `user._id` đơn lẻ thì giá trị là `undefined` và merge không bao giờ chạy. CartService nhận cả chuỗi/ObjectId nên không cần đổi helper.

## 3. Luồng sau khi login hợp lệ

```js
setAuthCookies(res, accessToken, refreshToken);
try {
  await CartService.resolveCartForRequest({
    userId: user._id || user.id,
    cartId: req.cookies && req.cookies.cartId,
    res,
    mergeOnConflict: 'clamp',
  });
} catch (error) {
  console.warn('[auth/login] cart merge skipped:', (error && error.message) || 'unknown error');
}
return res.status(200).json({ success: true, message: 'Dang nhap thanh cong', data: { user } });
```

- Chạy **sau** `setAuthCookies`, trước khi trả response; body login giữ nguyên contract cũ.
- Cookie `cartId` chỉ được clear bởi helper; controller không gọi `clearCookie` cho `cartId`.
- Merge lỗi → `try/catch` nuôi lỗi, log **duy nhất `error.message`** (không log request/token/cookie/secret/stack), vẫn trả 200 kèm user, không báo merge thành công.
- Không có guest cart: helper không làm gì, vẫn 200.
- Không merge lặp: sau khi cookie bị clear (và guest cart bị xóa), login lại không cộng qty lần 2 — kể cả client cố gửi lại `cartId` cũ.

### Về cờ `cartMergeAdjusted`

**Không trả cờ `cartMergeAdjusted` trong response login.** Helper chỉ gắn `mergeAdjusted = true` trên document giỏ hàng (`CartService.js:133,155`) để tầng HTML đọc flash, không có contract trả cờ cho HTTP response. Controller không tự tính cờ mới để tránh bịa ra giá trị ngoài contract của helper. Test khẳng định response login không chứa `mergeAdjusted` ở cả root lẫn `data`.

## 4. Bằng chứng test

Môi trường: `$env:NODE_PATH='D:\ABMT_Shop\ABMT-SHOP\node_modules'` (worktree PR-6 không có `node_modules` riêng). Không dùng DB thật, không đọc `.env` thật; fake User/Cart/Products được cài qua `test/support/` **trước khi** `require('../src/app')`.

### Focused

```
node --test test/auth.cart-merge-on-login.test.js
```

- total **8**, pass **8**, fail **0**, skipped **0**, cancelled **0**, todo **0**
- exit code **0**
- Phủ: merge trùng SKU + clamp stock 5+9→10; guest cart chuyển thành user cart khi chưa có user cart; login không guest (cart unchanged / không tạo cart); merge ném lỗi vẫn 200 + user + không lộ JWT + log an toàn; retry sau clear cookie không tăng qty; bỏ qua variant missing/deleted/inactive/không có variant; `GET /api/cart` với access cookie đọc đúng customer cart sau merge.

### Regression

```
node --test test/auth.login.test.js test/auth.refresh-logout.test.js test/cart.merge.test.js test/cart.api.test.js
```

- total **38**, pass **37**, fail **0**, skipped **1** (`T3-1-2: cookie co Secure=true o production` — skip có sẵn từ trước), cancelled **0**
- exit code **0**
- Baseline trước khi sửa cũng là 38/37/0/1 → không có regression.

Ghi chú: trong regression, `auth.login.test.js` dùng model `Cart` mongoose thật với user fake `_id = '1'`, nên helper ném CastError; `try/catch` ghi message an toàn và login vẫn 200. Đây là hành vi fallback đúng thiết kế (không làm login thất bại), không phải failure.

## 5. Xác nhận PR-1 / whitespace

- Trước khi làm việc: `git status --short --branch` sạch trên branch PR-6; `git diff` và `git diff --cached` đều trống.
- `git diff -- src/controllers/authController.js` chỉ có 2 hunk: (1) thêm `require('../services/CartService')`, (2) thêm khối merge trong `login`.
- **Không có bất kỳ thay đổi nào trong `forgotPassword`** (kể cả dòng trắng/staging whitespace edit của PR-1). Whitespace edit đó của Lead không được đưa sang PR-6; branch này vẫn giữ nội dung `forgotPassword` đúng base `79d9920`.

## 6. Giới hạn

- Chỉ kiểm chứng bằng fake model/DB-free; không chạy integration MongoDB thật theo yêu cầu.
- Không có contract trả cờ clamp cho response login → không trả `cartMergeAdjusted`; nếu cần cờ này cho client, phải là task riêng có thay đổi contract (nằm ngoài scope PR-6).
- Không thay đổi/đóng gói lại CartService; mọi xử lý nằm trong `login`.
