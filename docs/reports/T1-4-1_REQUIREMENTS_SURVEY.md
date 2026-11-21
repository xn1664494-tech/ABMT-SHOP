# T1-4-1 — Khảo sát yêu cầu hệ thống

- **Ngày:** 2026-11-21
- **Nhánh:** `docs/T1-4-1-requirements-survey`
- **Phạm vi:** Tác nhân, ma trận RBAC (Guest / Customer / Admin), use case 4 phân hệ. Chỉ khảo sát và truy vết; không sửa code.
- **Sản phẩm bàn giao theo WBS:** `Khảo sát yêu cầu (mã nguồn + minh chứng)` — **Tài liệu yêu cầu**.
- **Trạng thái:** Phần khảo sát hoàn thành; chờ Dev 3 review chéo (DoD #4).
- **Phụ thuộc:** không (`02_WBS` cột N = `—`).
- **Reviewer:** Dev 3 (cột S sheet `02_WBS`; RACI xếp Dev 3 review chéo Dev 4).

Nguồn: [`use-case.svg`](../thiet-ke-csdl/use-case.svg), [`rbac-matrix.png`](../thiet-ke-csdl/rbac-matrix.png), [`Bao_cao_do_an_UrbanMinimal.docx`](../Bao_cao_do_an_UrbanMinimal.docx) §1.2–1.3 (Bảng 2, Bảng 3, Hình 1), [`workbook`](../ABMT_Phan_chia_cong_viec.xlsx) sheet `02_WBS`/`06_Phụ thuộc`, và mã nguồn tại `src/routes/`.

---

## 1. Tác nhân

| Tác nhân | Quyền theo yêu cầu | Nguồn yêu cầu |
|---|---|---|
| **Guest** (khách vãng lai) | Xem danh sách/chi tiết sản phẩm, tìm kiếm/lọc, giỏ tạm; đăng ký, đăng nhập, quên/đặt lại mật khẩu; lấy CSRF token. Không truy cập dữ liệu cá nhân. | docx §1.2, Hình 1 (nhóm "Xác thực & Bảo mật", "Danh mục sản phẩm") |
| **Customer** (đã đăng nhập) | Mọi quyền Guest + xem/sửa hồ sơ, đổi mật khẩu, giỏ đồng bộ DB, đặt hàng, xem/hủy đơn của chính mình, gửi đánh giá. | docx §1.2, §4.4 |
| **Admin** | Mọi quyền Customer + CRUD danh mục/sản phẩm, quản lý tồn kho, chuyển trạng thái đơn, quản lý người dùng, báo cáo tồn kho/doanh thu, kiểm duyệt đánh giá. | docx §1.2, Hình 1 (nhóm "Quản trị") |

Nguyên tắc: **least privilege** — mỗi vai trò chỉ làm việc cần thiết; role mặc định khi đăng ký là `customer`, không nhận `role` từ client (`src/services/authService.js:23-40`).

---

## 2. Ma trận RBAC (đối chiếu route thật)

Ký hiệu: ✅ cho phép · 🔒 cần đăng nhập · 🛡 cần `admin` (+ CSRF cho route ghi) · ⚠️ có route nhưng chạy chưa ổn · ❌ chưa có route.

| Tài nguyên / hành động | Guest | Customer | Admin | Route | Task ID | Code |
|---|---|---|---|---|---|---|
| Lấy CSRF token | ✅ | ✅ | ✅ | `GET /api/auth/csrf` | T2-1-3 | ✅ |
| Đăng ký / đăng nhập | ✅ | ✅ | ✅ | `POST /api/auth/{register,login}` | T3-1-1/2 | ✅ |
| Quên / đặt lại mật khẩu | ✅ | ✅ | ✅ | `POST /api/auth/{forgot-password,reset-password}` | T4-1-2 | ✅ |
| Refresh / logout | 🔒+CSRF | 🔒+CSRF | 🔒+CSRF | `POST /api/auth/{refresh,logout}` | T3-1-3 | ✅ |
| Xem hồ sơ mình / cập nhật / đổi mật khẩu | ❌ | 🔒 (+CSRF khi ghi) | 🔒 | `GET/PATCH /api/profile/me`, `PATCH /api/profile/me/password` | T4-1-3 | ✅ |
| Xem hồ sơ người khác | ❌ | ❌ (chỉ chính mình) | 🛡 | `GET /api/profile/:userId` | T4-1-1 | ✅ |
| Kiểm tra quyền admin | ❌ | ❌ 403 | 🛡 | `GET /api/admin/access-check` | T4-1-1 | ✅ |
| Xem danh mục / sản phẩm | ✅ | ✅ | ✅ | `GET /api/categories*`, `GET /api/products*` | T3-2-1/2 | ✅ |
| Xem SP ẩn / đã xóa | ❌ | ❌ (flag bị bỏ qua) | 🛡 `?includeInactive/includeDeleted` | `GET /api/products*` | T4-2-1 | ✅ (`ProductsController.js:7-14`) |
| CRUD danh mục / sản phẩm | ❌ | ❌ 403 | 🛡+CSRF | `POST/PUT/PATCH/DELETE /api/{categories,products}` | T3-2-1/2 | ✅ |
| Giỏ tạm (session) | ⚠️ | ⚠️ | ⚠️ | `/api/cart*` | T5-2-3 | ⚠️ chưa có session middleware |
| Giỏ đồng bộ DB / merge | ⚠️ | ⚠️ | ⚠️ | `GET /api/cart/merge`, `POST/PUT/DELETE /api/cart/items*` | T5-1-1, T5-2-1 | ⚠️ `_id`/verb lệch, xem T1-4-2 |
| Checkout / tạo đơn / thanh toán | ❌ | ❌ | ❌ | `POST /api/orders` (client gọi, chưa đăng ký) | T6-2-1/2 | ❌ |
| Xem / hủy đơn, đổi trạng thái | ❌ | ❌ | ❌ | — | T6-1-1 | ❌ |
| Quản lý người dùng (đổi role) | ❌ | ❌ | ❌ | — | T5-1-3 | ❌ |
| Dashboard / báo cáo tồn kho | ❌ | ❌ | ❌ | — | T6-2-3 | ❌ (có `homeService.js` nhưng không ai gọi) |
| Đánh giá sản phẩm | ❌ | ❌ | ❌ | — | T5-2-x/T6 | ❌ chỉ có model `Review.js` |

Ghi chú RBAC: `requireAdmin` (`src/middleware/requireAdmin.js`) và `authorize('admin')` (`src/middleware/authenticate.js`) đang là hai convention song song; quyền được đọc từ User trong DB, không tin role trong JWT. CSRF double-submit chạy sau authenticate trên route ghi.

---

## 3. Use case theo 4 phân hệ

| ID | Phân hệ / Use case | Tác nhân | Truy vết Task ID | Trạng thái code |
|---|---|---|---|---|
| UC-01 | Đăng ký tài khoản | Guest | T3-1-1 | Đã code |
| UC-02 | Đăng nhập (cookie HttpOnly) | Guest | T3-1-2 | Đã code |
| UC-03 | Đăng xuất + refresh token | Customer | T3-1-3 | Đã code |
| UC-04 | Quên / đổi mật khẩu | Guest, Customer | T4-1-2, T4-1-3 | Đã code |
| UC-05 | Duyệt sản phẩm (danh sách, chi tiết, tồn kho biến thể) | Guest+ | T3-2-2 | Đã code |
| UC-06 | Tìm kiếm & lọc (cat/giá/từ khóa/Size+Màu) | Guest+ | T4-2-1 | Đã code |
| UC-07 | Giỏ tạm (session) | Guest | T5-2-3 | Một phần (chưa chạy được) |
| UC-08 | Giỏ đồng bộ DB + gộp khi đăng nhập | Customer | T5-1-1, T5-2-1 | Một phần |
| UC-09 | Checkout 1 trang, COD/chuyển khoản | Customer | T6-2-1, T6-3-1 | Kế hoạch (chỉ có view `checkout.ejs`, chưa route/API) |
| UC-10 | Xem / hủy đơn của mình | Customer | T6-1-1, T6-4-1 | Kế hoạch |
| UC-11 | CRUD danh mục / sản phẩm | Admin | T3-2-1, T3-2-2 | Đã code |
| UC-12 | Chuyển trạng thái đơn | Admin | T5-1-2, T6-1-1 | Kế hoạch (model + sơ đồ có, service chưa) |
| UC-13 | Báo cáo tồn kho / dashboard | Admin | T6-2-3 | Kế hoạch |
| UC-14 | Quản lý tài khoản, kiểm duyệt đánh giá | Admin | T5-1-3, T7 | Kế hoạch |

Nhóm phân hệ theo [`use-case.svg`](../thiet-ke-csdl/use-case.svg): UC-01→04 = Xác thực & Bảo mật; UC-05→06 = Danh mục sản phẩm; UC-07→10 = Giỏ hàng & Đơn hàng; UC-11→14 = Quản trị.

---

## 4. Khoảng cách giữa yêu cầu và code hiện tại

| Khoảng cách | Tác động tới QA (Dev 4) |
|---|---|
| Không có session middleware (`package.json` chỉ có `cookie-parser`) → `req.session` trong `src/routes/cart.route.js` luôn `undefined` | Không test được UC-07/UC-08 |
| `cartItemSchema` khai báo `{ _id: false }` (`src/model/Cart.js:40`) nhưng route dùng `item._id.toString()` và `$pull ... _id` | Sửa/xóa dòng giỏ không chạy |
| Client gọi `PATCH /api/cart/items/:id` (`src/public/js/cart.js:94`), server định nghĩa `PUT` (`src/routes/cart.route.js:187`) | 404 khi test UI |
| `POST /api/orders` không tồn tại; Order/Checkout service, audit log, admin users, dashboard API đều ABSENT | TC03/TC04/TC05(vế đơn)/TC06(vế đánh giá) bị block |
| Các view `catalog`, `product-detail`, `checkout`, `admin-*` có file EJS nhưng chưa có route | Không làm UI E2E được |

Các mục này đã được đưa vào ma trận kịch bản trong [`T1-4-2_NFR_TEST_PLAN.md`](T1-4-2_NFR_TEST_PLAN.md) với nhãn BLOCKED/PARTIAL, tránh báo cáo "đã test" khi chưa có luồng chạy. Link này nằm trên branch `docs/T1-4-2-nfr-test-plan` và hợp lệ sau khi merge cả ba branch `docs/T1-4-*`.

---

## 5. DoD — đối chiếu sheet `09_Kiểm thử & DoD`

| Tiêu chí | Bằng chứng |
|---|---|
| Đúng yêu cầu | WBS `T1-4-1`: tác nhân (mục 1), RBAC (mục 2), 4 phân hệ (mục 3) |
| Code chạy ổn định | Không đổi code; link sơ đồ/docx/workbook trong file này đã kiểm tra tồn tại |
| Test pass | Không có test code; chạy `npm test` làm regression |
| Review chéo | Dev 3 (chưa có → chưa chuyển `Hoàn thành` trong workbook) |
| Tài liệu / minh chứng | File này + `use-case.svg` + `rbac-matrix.png` + docx §1.2–1.3 |
| Không regression | Chỉ thêm 1 file Markdown |

Sau khi Dev 3 xác nhận: cập nhật `02_WBS` dòng 11 (`Q11=Hoàn thành`, `R11=100`, `T11=link file này`).
