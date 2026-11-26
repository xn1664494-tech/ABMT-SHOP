# PHASE 3 DEV 1 — T5-1-3 ADMIN USER API REPORT (2026-11-26)

## Thông tin chung
| Mục | Giá trị |
|---|---|
| Task | `T5-1-3` — Admin User API (danh sách + đổi vai trò) |
| Branch | `feature/phase3-dev1-t5-1-3-admin-user-api-2026-11-26` |
| Base | `origin/main` @ `45032200e70c9cb4ca2ec519a21fc787cf7bce71` |
| Commit | `18272b5` — `feat(phase3): add admin user list and role update API (T5-1-3)` |
| Remote | `https://github.com/xn1664494-tech/ABMT-SHOP.git` |
| Remote branch | `origin/feature/phase3-dev1-t5-1-3-admin-user-api-2026-11-26` |
| Push status | **PUSHED** (feature branch only; không force, không đụng `main`/`develop`) |

### Ghi chú tên branch
Local đã tồn tại `feature/phase3-dev1-t5-1-3-admin-user-api` ở `b8911c2` (stale, chứa code cũ) và remote **chưa có** branch này. Để tuân thủ "không ghi đè / không xóa branch / không force push", tôi **không** checkout hay ghi đè branch cũ mà tạo branch mới có suffix ngày `2026-11-26` từ `origin/main`. Branch stale vẫn giữ nguyên tại `b8911c2`.

## Dependency status (WBS `02_WBS` + `06_Phụ thuộc`)
- `T5-1-3` là task Phase 3 Dev 1, độc lập với critical path đang chờ Dev 2. Không bỏ qua dependency nào.
- Critical path `T5-1-1 → T6-1-3` vẫn **BLOCKED** (xem mục Blocked bên dưới) và **không** bị triển khai trong commit này.
- `T6-1-2` (audit log) chưa triển khai; T5-1-3 chỉ tạo **điểm cắm sự kiện no-op** để T6-1-2 cắm publisher sau này.

## Files changed (đúng scope — 11 files)
| File | Thay đổi |
|---|---|
| `src/routes/admin.route.js` | Đăng ký `GET /api/admin/users` (admin only, validate query) và `PATCH /api/admin/users/:userId/role` (admin only + CSRF). |
| `src/controllers/adminUserController.js` | **Mới**. Controller list/updateRole, dùng whitelist service, trả `sendResponse`. |
| `src/services/adminUserService.js` | **Mới**. `listUsers` (phân trang, tìm kiếm name/email, escape regex, ẩn field nhạy cảm), `updateUserRole` (chặn tự hạ quyền, gọi audit hook). |
| `src/validators/adminUserValidator.js` | **Mới**. Schema query `page/limit/search` + schema body `role`. |
| `src/middleware/validate.js` | Express 5: `req.query` là getter chỉ đọc → đưa dữ liệu đã validate sang `req.validatedQuery` thay vì gán đè. |
| `test/support/fakeUserModel.js` | Mở rộng fake model: `find/countDocuments`, so khớp `$or`/`$regex`/`$ne`, so sánh ObjectId không phân biệt hoa thường. |
| `test/admin.users.test.js` | **Mới**. 21 test DB-free (401/403, pagination, search, giới hạn limit, role change, không lộ dữ liệu nhạy cảm). |
| `src/services/auditEvent.js` | **Mới**. Contract 7 field cho sự kiện đổi role + publisher mặc định **no-op**; không ghi DB. |
| `test/admin.audit-event.test.js` | **Mới**. 2 test DB-free cho contract và khả năng thay publisher. |
| `postman/AdminUsers.postman_collection.json` | **Mới**. Collection với biến `baseUrl`, `adminToken`, `customerToken` để trống (không chứa credential). |
| `package.json` | Thêm `test/admin.users.test.js` và `test/admin.audit-event.test.js` vào script `test`. |

## Files untouched (bảo toàn)
- `src/controllers/authController.js` — vẫn **staged** với thay đổi xóa 1 dòng trắng có từ trước, **không** đưa vào commit `18272b5` (nguồn gốc thay đổi không rõ, ngoài scope T5-1-3).
- 8 báo cáo cũ trong `docs/reports/` (kể cả báo cáo audit 2026-11-26) giữ nguyên, không sửa/ghi đè.
- `test/scripts/` (`check-env.js`, `run-postman-test.js`, `seed.js`) giữ nguyên, không commit.
- Branch stale `feature/phase3-dev1-t5-1-3-admin-user-api@b8911c2` giữ nguyên.
- Không sửa WBS, không merge, không PR, không đụng `.env`/secret.

## Test commands (DB-free)
```powershell
$env:NODE_ENV='test'; $env:MONGODB_URI=''; node --test test/admin.users.test.js test/admin.audit-event.test.js
```
→ `tests 23 | pass 23 | fail 0 | skipped 0`

```powershell
$env:NODE_ENV='test'; $env:MONGODB_URI=''; node --test test/auth.register.test.js test/auth.login.test.js test/auth.refresh-logout.test.js test/auth.rbac.test.js test/auth.csrf.test.js test/auth.rate-limit.test.js test/auth.admin-route.test.js test/auth.profile.test.js test/auth.change-password.test.js test/profile.view.test.js test/admin.users.test.js test/admin.audit-event.test.js test/error-handler.test.js test/trust-proxy.test.js test/user.model.test.js test/category.model.test.js test/product.model.test.js test/order.model.test.js test/cart.model.test.js test/review.model.test.js test/product.validator.test.js test/product.filter.test.js test/product.pagination.test.js test/integration/rate-limit.integration.test.js
```
→ `tests 232 | pass 226 | fail 0 | skipped 6 | exit 0` (6 skip có từ trước, gồm 5 CSRF + 1 Secure cookie; Phase 2 hardening nằm ở branch khác nên không có ở base này)

Không chạy `npm test`, `test:integration`, Jest hay file có `mongoose.connect`/`deleteMany`. Không cài package.

## PASS / FAIL / NOT VERIFIED
| Hạng mục | Kết quả |
|---|---|
| T5-1-3 unit/HTTP DB-free | **PASS** 23/23 |
| Full regression DB-free | **PASS** 226/232 (0 fail, 6 skip cũ) |
| Bảo mật response (không lộ password/resetToken/tokenVersion) | **PASS** |
| Phân quyền 401/403 + chặn tự hạ quyền | **PASS** |
| CSRF trên PATCH role | **PASS** |
| Newman / Postman runtime | **NOT VERIFIED** — `newman` không có trong PATH và `node_modules/.bin/newman.cmd` không tồn tại; không được cài package |
| MongoDB integration thật | **NOT VERIFIED** — `mongodb-memory-server` không có; không chạy test DB/destructive |

## Security considerations
- Không đọc/in `.env`, mật khẩu, JWT secret thật, MongoDB URI hay token. Collection Postman chỉ có placeholder trống.
- Response admin dùng whitelist 7 field (`id name email role status phone createdAt`); không trả document thô.
- Regex search được escape (`escapeRegex`) để tránh ReDoS/regex injection.
- Đổi role có `csrfProtection` và chặn admin tự hạ quyền chính mình.
- Audit hook chỉ chuẩn hóa payload; **không** ghi log, không tạo model/route `AuditLog` trong task này.

## Known limitations / Blocked
- `authLimiter` (các luồng auth liên quan) vẫn dùng `MemoryStore` → không phù hợp multi-instance. Ghi nhận, không sửa trong scope.
- 6 test skipped vẫn giữ nguyên; Phase 2 hardening đã fix 5 CSRF skip ở branch `fix/phase2-dev1-hardening`, chưa merge vào branch này (không được merge).
- Newman chưa xác minh → collection chỉ được kiểm tra cấu trúc, chưa chạy runtime.
- **Critical path `T5-1-1 → T6-1-3` BLOCKED**: cart/checkout/restock ownership và concurrent dev branch `D:/ABMT_Shop/ABMT-SHOP-dev1-current-user` (`fix/T2-1-1-current-user-api` @ `c309879`) cần phối hợp Dev 2. Không triển khai `T5-1-1`, `T5-1-2`, `T6-1-1`, `T6-1-2`, `T6-1-3` trong đợt này.

## Git safety
- Không force push, `reset --hard`, `clean`, `rebase`, `cherry-pick`, `revert`, xóa branch, merge, PR, `git add .` hay `git commit -a`.
- Không ghi đè 1 staged file / 8 mục untracked còn lại; không push vào `main`/`develop`.
