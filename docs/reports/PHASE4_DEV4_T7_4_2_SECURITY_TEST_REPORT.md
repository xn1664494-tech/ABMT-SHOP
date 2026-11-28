# T7-4-2 — Test bảo mật — Báo cáo (Dev 4, Phase 4)

| Mục | Giá trị |
|---|---|
| Mã công việc | `T7-4-2` / `4.7.11` |
| WBS | `02_WBS!A84:T84` — `docs/ABMT_Phan_chia_cong_viec.xlsx` |
| Nghiệm thu | `Mọi kịch bản bị chặn` |
| Deliverable | Test bảo mật (test + báo cáo) |
| Phụ thuộc | `T6-1-1`, `T6-4-1` — đã hoàn thành theo `docs/reports/PHASE3_DEV1_FINAL_ACCEPTANCE.md` và `docs/reports/T6-4-1_VIEW_ORDER.md` |
| Branch | `test/T7-4-2-security` |
| Base | `main` @ `d0443f6` sau `git pull origin main` |

---

## 1. Phạm vi kịch bản

| Nhóm | Kịch bản | Kết quả |
|---|---|---|
| IDOR | `PUT/DELETE /api/profile/addresses/:id` với địa chỉ của user khác | Chặn `404`, DB không đổi |
| IDOR | `POST /api/orders` với `addressId` của user khác | Chặn `404`, không tạo đơn, tồn kho không đổi |
| XSS địa chỉ | Payload `<img src=x onerror=alert(1)>` trong `fullName`/`detail` | Lưu raw nhưng render `&lt;img ...&gt;` tại `/account?tab=addresses`; payload thô không xuất hiện |
| XSS đánh giá | `POST/PUT/DELETE /api/reviews` và payload trong `comment` | Không có route ghi; trả `404`; payload không được render thô trên `/products/:slug` |
| CSRF | Thiếu token, sai token, `Origin` không được phép | `403`; yêu cầu hợp lệ với token + origin đúng vẫn `201` |
| RBAC | Guest / customer / token tự khai `admin` / admin thật | `401 / 403 / 403 / 200` cho API và trang `/admin` |

---

## 2. Thay đổi mã nguồn

| File | Thay đổi |
|---|---|
| `test/integration/security.integration.test.js` **(mới)** | 6 test integration: IDOR địa chỉ, IDOR checkout addressId, XSS địa chỉ, XSS đánh giá, CSRF, RBAC. Dùng MongoDB memory server khi không có `MONGODB_URI_TEST`/`TEST_MONGODB_URI`. |
| `package.json` | Thêm script `test:security`; thêm file mới vào `test:integration`. Không đổi dependency. |
| `docs/reports/PHASE4_DEV4_T7_4_2_SECURITY_TEST_REPORT.md` **(mới)** | Báo cáo này. |

Không sửa logic ứng dụng; test xác nhận các cơ chế chặn hiện có.

---

## 3. Kết quả kiểm thử

| Lệnh | Kết quả |
|---|---|
| `npm run test:security` | **6/6 pass**, 0 fail, 0 skip |
| `npm test` | **378 tests — 372 pass, 0 fail, 6 skip** (6 skip cũ) |
| `npm run test:integration` | **69 tests — 57 pass, 2 fail, 10 skip**; 6 test `T7-4-2` đều pass |

Hai fail trong `npm run test:integration` là test cũ có sẵn trên `main`, không nằm trong diff của branch này:

- `test/integration/checkout.order.integration.test.js:284` — admin hủy đơn qua `POST /api/orders/:code/cancel` nhận `403` theo logic quyền mới của `src/services/orderStatusService.js`.
- `test/integration/create-order.integration.test.js:289` — cùng kịch bản admin hủy confirmed qua route customer.

Các test mới không bị skip; CSRF được kiểm tra bằng cách tạm đổi `NODE_ENV` sang `integration` trong lúc gửi request rồi khôi phục ngay sau đó.

---

## 4. Ghi chú phạm vi

- Địa chỉ được lưu raw theo thiết kế hiện tại; phòng XSS nằm ở lớp render EJS (`<%= %>` trong `src/views/pages/account.ejs`), không phải sanitize input.
- Dự án hiện chưa có route/controller/service/view động cho đánh giá sản phẩm (`src/model/Review.js` mới chỉ có model). Test ghi nhận sự vắng mặt của surface ghi và kiểm tra payload không xuất hiện thô trên trang sản phẩm; khi nào có luồng đánh giá thật cần bổ sung test render tương ứng.
- Kiểm tra RBAC dùng token ký trực tiếp để mô phỏng client tự khai role; `src/middleware/authenticate.js` vẫn lấy role từ DB nên không bị vượt quyền.

---

## 5. Kết luận

Mọi kịch bản bảo mật trong phạm vi `T7-4-2` đều bị chặn đúng kỳ vọng. Deliverable gồm file test integration, script chạy riêng và báo cáo này.
