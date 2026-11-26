# T5-4-2 — VIEW CHECKOUT (KHUNG)

- **Task ID:** T5-4-2 (WBS 3.5.11)
- **Phase:** Phase 3 – Nghiệp vụ thương mại, Dev 4 (Reviewer: Dev 3)
- **Tuần:** 5
- **Sản phẩm:** `View Checkout (khung) (file EJS)`
- **Nguồn:** `docs/ABMT_Phan_chia_cong_viec.xlsx`, sheet `02_WBS`
- **DoD:** Khung view xong
- **Phụ thuộc:** T5-4-1 (View Cart) — đã hoàn thành
- **Nhánh:** `feature/T5-4-2-view-checkout-khung`
- **Trạng thái:** ACCEPTED — khung có sẵn trong source; nghiệm thu bằng source review
- **File phân việc:** giữ nguyên, không cập nhật theo yêu cầu
- **Thay đổi code:** KHÔNG; báo cáo này chỉ ghi nhận kết quả review

## 1. Kết luận nghiệm thu

Với cách hiểu “khung” = shell trang + các block chính + CSS/JS/route wiring, DoD **đạt**. Khung checkout đã tồn tại trong source trước nhánh này và được nối đầy đủ từ `/cart` sang `/checkout`.

Trạng thái WBS `Chưa bắt đầu (0%)` đang lệch so với hiện trạng source. Không rebuild layout; chỉ ghi nhận bằng chứng để Dev 3 review.

## 2. Bằng chứng source

| Thành phần | Bằng chứng |
|---|---|
| Shell trang, assets, header/footer | `src/views/pages/checkout.ejs:1-10`, `src/views/pages/checkout.ejs:214-219` |
| Breadcrumb, heading, link quay lại giỏ | `src/views/pages/checkout.ejs:35-51` |
| Form tổng + hidden `item` cho luồng chọn một dòng | `src/views/pages/checkout.ejs:53-54` |
| Block địa chỉ giao hàng | `src/views/pages/checkout.ejs:56-129` |
| Block sản phẩm | `src/views/pages/checkout.ejs:131-152` |
| Block phương thức thanh toán | `src/views/pages/checkout.ejs:154-172` |
| Block ghi chú đơn hàng | `src/views/pages/checkout.ejs:174-183` |
| Tóm tắt đơn, nút `Đặt hàng`, mobile sticky bar | `src/views/pages/checkout.ejs:186-212` |
| CSS layout/responsive | `src/public/css/app.css:1148-1196` |
| JS tương tác địa chỉ, ghi chú, thanh toán, submit | `src/public/js/checkout.js:18-192` |
| Route GET `/checkout`: auth, merge giỏ, lọc `?item=`, summary, render | `src/routes/index.js:323-410` |

## 3. Liên kết với T5-4-1

- `/cart` có nút thanh toán từng dòng `/checkout?item=<itemId>` và nút cả giỏ `/checkout`.
- `GET /checkout` đọc `?item=`, validate và lọc đúng dòng được chọn: `src/routes/index.js:360-375`.
- Hidden input `item` được render tại `src/views/pages/checkout.ejs:54` và đưa vào payload tại `src/public/js/checkout.js:77-80`.
- Regression test nằm tại `tests/checkout-one-item.test.js`.

## 4. Verification

| Lệnh | Kết quả |
|---|---|
| Source review trên branch `feature/T5-4-2-view-checkout-khung` | Khung đầy đủ các block theo mục 2 |
| `npm test` | 301 tests, 277 pass, 0 fail, 24 skip |

24 test skip là các test cần MongoDB test không kết nối được trong môi trường hiện tại (`MongooseServerSelectionError`) và các skip CSRF có sẵn; không có test nào fail.

## 5. Lưu ý không block DoD

Các điểm dưới đây thuộc phạm vi “view hoàn chỉnh”, không làm sai DoD “khung view xong”:

- Dòng sản phẩm checkout đang dùng `sku` làm tên và ảnh placeholder: `src/routes/index.js:387-391`, `src/views/pages/checkout.ejs:140-149`.
- Chưa có test view checkout riêng theo kiểu `test/cart.view.test.js`; hiện có regression test trong `tests/checkout-one-item.test.js`.
- CSS legacy không còn khớp markup hiện dùng: `src/public/css/app.css:899-915`.
- Route xóa `cartId` rồi set lại cookie ở cuối response: `src/routes/index.js:350`, `src/routes/index.js:409`.
- Radio groups và live region cho nội dung động chưa tối ưu accessibility.

## 6. Reproduction tay

```powershell
npm run dev
```

1. Đăng nhập, thêm sản phẩm vào giỏ.
2. Vào `http://localhost:3000/cart`.
3. Bấm `Tiến hành thanh toán` (toàn giỏ) hoặc `Thanh toán` riêng một dòng.
4. Tại `/checkout`, kiểm tra lần lượt: breadcrumb, địa chỉ, sản phẩm, phương thức thanh toán, ghi chú, tóm tắt và nút `Đặt hàng`.

## 7. Bàn giao Dev 3

Review trọng tâm: cấu trúc các block và wiring từ `/cart` sang `/checkout`. Nếu muốn nâng lên mức “View hoàn chỉnh”, mở task riêng cho dữ liệu sản phẩm thật, test view checkout riêng và cleanup CSS/a11y.
