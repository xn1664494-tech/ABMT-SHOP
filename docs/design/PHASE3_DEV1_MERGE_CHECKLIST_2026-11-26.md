# PHASE 3 DEV 1 — MERGE / POST-MERGE CHECKLIST (2026-11-26)

> **Mục đích:** checklist để reviewer xác nhận 2 branch Dev 1 đã push vào `main`, và liệt kê việc còn lại. Tài liệu này **không thực hiện** merge, checkout, commit hay test DB. Chỉ đọc/lệnh chỉ đọc được liệt kê bên dưới.

| Item | Giá trị |
|---|---|
| Ngày | 2026-11-26 |
| Snapshot đối chiếu | `main` @ `67be29ab8dc1c478039c644c02cc8d38aaf8268e` (`origin/main` cùng SHA) |
| Audit gốc | `4503220` — xem `docs/reports/PHASE3_DEV1_READINESS_AUDIT_AFTER_MAIN_PULL_2026-11-26.md` |
| Branch đã push | `fix/phase2-dev1-hardening` @ `45ab020`; `feature/phase3-dev1-t5-1-3-admin-user-api-2026-11-26` @ `88a8e91` |

---

## 1. Kết luận nhanh: cả 2 branch ĐÃ vào `main`

| Kiểm tra (chỉ đọc) | Kết quả tại `67be29a` |
|---|---|
| `git merge-base --is-ancestor 45ab020 HEAD` | `0` → **Phase 2 hardening đã merge** (PR #77, commit merge `67be29a`) |
| `git merge-base --is-ancestor 18272b5 HEAD` | `0` → **code T5-1-3 đã merge** |
| `git merge-base --is-ancestor 88a8e91 HEAD` | `0` → **report T5-1-3 đã merge** (PR #76, commit merge `1d5e8ac`) |
| `git merge-base --is-ancestor c309879 HEAD` | `1` → **currentUser mount fix CHƯA merge** |
| File T5-1-3 trên HEAD | `src/controllers/adminUserController.js`, `src/services/adminUserService.js`, `src/validators/adminUserValidator.js`, `src/services/auditEvent.js`, `test/admin.users.test.js`, `test/admin.audit-event.test.js`, `postman/AdminUsers.postman_collection.json` — **đều có** |
| `src/middleware/validate.js:31` | `req.validatedQuery = result.data` (lỗi Express 5 đã sửa) |
| `src/routes/admin.route.js:52-71` | `GET /users` + `PATCH /users/:userId/role` có `authenticate`, `authorize('admin')`, `validate`, `csrfProtection` |
| `src/routes/profile.route.js` | `/me`, `/me/password`, `/addresses` đứng trước `/:userId` (`:199`) — route shadowing đã hết |
| `package.json:9` | script `test` đã chứa `test/admin.users.test.js`, `test/admin.audit-event.test.js` |
| CSRF skip còn lại | 7 (1 Secure-cookie production trong `auth.login.test.js:88`; 5 trong `category.api.test.js:242-281`; 1 trong `product.api.test.js:205`) — cũ 5 skip auth đã được bật lại |

**Hệ quả:** checklist dưới đây là **post-merge verification**, không phải yêu cầu merge lại PR #76/#77.

---

## 2. Checklist reviewer (chạy từng mục, chỉ đọc/trừ test DB-free)

### 2.1 Git / tích hợp

```powershell
git status --short --branch
git rev-parse HEAD
git rev-parse origin/main
git log --oneline --merges -6
git merge-base --is-ancestor 45ab020 HEAD
git merge-base --is-ancestor 88a8e91 HEAD
git merge-base --is-ancestor c309879 HEAD
```

Kỳ vọng: `HEAD == origin/main == 67be29a`; hai lệnh đầu trả `0`; lệnh cuối trả `1`.

### 2.2 Contract T5-1-3 đã đúng trên main

```powershell
git ls-tree --name-only HEAD src/controllers/adminUserController.js src/services/adminUserService.js src/validators/adminUserValidator.js src/services/auditEvent.js test/admin.users.test.js test/admin.audit-event.test.js postman/AdminUsers.postman_collection.json
Select-String -Path src\routes\admin.route.js -Pattern "'/users'|/users/:userId/role|csrfProtection|authorize"
Select-String -Path src\middleware\validate.js -Pattern 'validatedQuery'
```

Kỳ vọng: 7 path hiện ra; route có RBAC + CSRF; `validatedQuery` hiện diện.

### 2.3 Phase 2 hardening đã đúng trên main

```powershell
Select-String -Path src\routes\profile.route.js -Pattern "router\.(get|patch)\('/"
Select-String -Path test\auth.csrf.test.js,test\auth.profile.test.js,test\auth.change-password.test.js -Pattern 'test\.skip'
```

Kỳ vọng: `/addresses` trước `/:userId`; 3 file auth **không còn** test CSRF bị skip.

### 2.4 Test an toàn (DB-free) — chạy khi có phép

```powershell
$env:NODE_ENV='test'; $env:MONGODB_URI=''
node --test test/auth.register.test.js test/auth.login.test.js test/auth.refresh-logout.test.js test/auth.rbac.test.js test/auth.csrf.test.js test/auth.profile.test.js test/auth.rate-limit.test.js test/auth.admin-route.test.js test/auth.change-password.test.js test/profile.view.test.js test/admin.users.test.js test/admin.audit-event.test.js test/error-handler.test.js test/trust-proxy.test.js test/user.model.test.js test/category.model.test.js test/product.model.test.js test/order.model.test.js test/cart.model.test.js test/review.model.test.js test/product.validator.test.js test/product.filter.test.js test/product.pagination.test.js test/integration/rate-limit.integration.test.js
```

Lưu ý: `admin.users.test.js` / `admin.audit-event.test.js` dùng fake model (đã kiểm tra source), nhưng **chưa được chạy trong audit này** — kết quả cần do reviewer xác nhận. Không chạy `npm test`, `test:all`, `test:integration`, `test:api`, `test:postman`, `test:seed-verify` vì gồm file connect/xóa DB hoặc phụ thuộc package/DB chưa chắc có.

### 2.5 Không làm

- Không chạy `deleteMany` / `dropDatabase` / bất kỳ test nào dùng `MONGODB_URI` thật.
- Không đọc `.env`; không ghi credential vào báo cáo/collection.
- Không merge `c309879` cả branch (đang diverge ~55 file); nếu cần chỉ cherry-pick đúng 1 commit sau khi Dev 2 chốt.

---

## 3. Việc còn lại sau post-merge

| Việc | Trạng thái | Người quyết |
|---|---|---|
| Mount `currentUser` trước `/api` (`c309879`) | Chưa merge; `/api/cart/merge` vẫn luôn 401 | **Dev 1 chốt đề xuất**: lấy riêng commit `c309879`; chờ Dev 2 uỷ quyền/cherry-pick |
| Contract cart | **Dev 1 chốt**: giữ `PUT /api/cart/items/:id {qty}`; FE `cart.js:177-178` đã khớp, **không đổi FE**; identity dùng `sku`, nhưng `cart.route.js` thuộc Dev 2 nên Dev 2 sửa 2 dòng `:171,:211`; API set cookie `cartId` | Dev 2 xác nhận lịch sửa |
| Merge semantics | Dev 1 chốt hành vi: cộng dồn qty + check stock + lấy giá DB + `mergedAt/mergedFrom` + clear cookie sau save; **Dev 2 viết trong `cart.route.js`, Dev 1 review** | Dev 2 |
| T5-1-2 state machine service | Dev 1 chốt actor `admin/system/scheduler`; spec sẵn; Dev 1 có thể tạo file mới `src/services/orderStateMachine.js` + test khi được phép implement | Ma trận chi tiết vẫn chờ Dev 2 |
| T6-1-3 policy + cron | Dev 1 chốt TTL 2h, unpaid-only, paid không hủy, dryRun, UTC, ưu tiên external scheduler; **owner hoàn kho + dep `node-cron` vẫn chờ Dev 2** | Dev 2 |
| T6-1-2 audit publisher thật | `auditEvent.js` vẫn no-op | Làm sau T6-1-1 |

---

## 4. Ghi chú worktree

- Worktree chính `D:\ABMT_Shop\ABMT-SHOP` đang có sẵn 1 file staged `src/controllers/authController.js` (bỏ 1 dòng trống) và các file untracked cũ — **giữ nguyên**, không stage/unstage/restore.
- Worktree phụ `D:\ABMT_Shop\ABMT-SHOP-dev1-current-user` @ `c309879` vẫn sạch; chỉ đọc, không chuyển sang.
