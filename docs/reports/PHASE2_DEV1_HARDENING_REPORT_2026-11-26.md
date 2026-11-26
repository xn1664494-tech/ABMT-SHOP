# PHASE 2 DEV 1 — HARDENING REPORT (2026-11-26)

## Thông tin chung
| Mục | Giá trị |
|---|---|
| Task | `T4-1-2` (Rate limit + CSRF), `T4-1-3` (Profile route shadowing), `T3-1-2` (Login token assertion) |
| Branch | `fix/phase2-dev1-hardening` |
| Base | `origin/main` @ `45032200e70c9cb4ca2ec519a21fc787cf7bce71` |
| Commit | `032b947` — `fix(phase2): harden auth rate limit csrf and profile routes` |
| Remote | `https://github.com/xn1664494-tech/ABMT-SHOP.git` |
| Remote branch | `origin/fix/phase2-dev1-hardening` (mới, push thành công) |
| Push status | **PUSHED** (không force push, không push vào `main`/`develop`) |

## Dependency status
- WBS `02_WBS`: cả 3 task đều là Phase 2 Dev 1, đã có commit gốc trong lịch sử (`cf91b13`, `e8e5af3`/`b4be920`, `da38def`) và là ancestor của `origin/main`.
- Không có dependency Phase 3 bị bỏ qua. Đây là hardening sau audit, không mở task mới.

## Files changed (đúng scope)
| File | Thay đổi |
|---|---|
| `src/routes/profile.route.js` | Dời `GET /:userId` xuống **sau** các route `/addresses` để `/api/profile/addresses` không bị bắt nhầm. Không đổi handler nào khác. |
| `test/auth.forgot-password-rate-limit.test.js` | **Mới**. 2 test DB-free: `/forgot-password` vượt ngưỡng → 429; limiter dùng chung với `/reset-password`. |
| `test/auth.csrf.test.js` | Bật lại 2 test CSRF bị `test.skip`; dùng helper `withCsrfEnforced` tạm đổi `NODE_ENV` rồi khôi phục trong `finally`. |
| `test/auth.change-password.test.js` | Bật lại 2 test CSRF bị skip với helper tương tự. |
| `test/auth.profile.test.js` | Bật lại 1 test CSRF bị skip; thêm regression test `GET /api/profile/addresses`. |
| `test/auth.login.test.js` | Bổ sung assertion: body không chứa JWT (regex), `accessToken`/`refreshToken`/`token` ở mọi cấp. **Không sửa implementation.** |

## Files untouched (bảo toàn)
- 5 file staged có từ trước vẫn giữ nguyên và **không** nằm trong commit `032b947`: `package.json`, `src/controllers/authController.js`, `src/middleware/validate.js`, `src/routes/admin.route.js`, `test/support/fakeUserModel.js`.
- 14 mục untracked của bạn/dev khác giữ nguyên (7 báo cáo, Postman collection, T5-1-3 source/test, `test/scripts/`).
- `src/middleware/csrf.js` **không sửa**: giữ nguyên bypass `NODE_ENV=test` (`:68-70`) theo yêu cầu "không xóa bypass khi chưa có lý do kỹ thuật được chứng minh".
- Không sửa WBS, CI, `package.json`, không cài package, không đụng `.env`/secret.

## Implementation summary
1. **T4-1-2** — có bằng chứng runtime mới cho `/api/auth/forgot-password` → 429. 5 test CSRF bị skip trước đây nay chạy thật bằng cách bật CSRF trong phạm vi một request (pattern `NODE_ENV='development'` → khôi phục ở `finally`), không dùng `test.skip`, không đổi production code.
2. **T4-1-3** — route tĩnh `/addresses` được đăng ký trước route động `/:userId`; có regression test trả 200 thay vì bị IDOR guard chặn.
3. **T3-1-2** — chỉnh assertion của test cũ; implementation login vốn đúng (chỉ trả cookie HttpOnly) nên không sửa code.

## Test commands (DB-free, không đụng MongoDB thật)
```powershell
$env:NODE_ENV='test'; $env:MONGODB_URI=''; node --test test/auth.csrf.test.js test/auth.login.test.js test/auth.profile.test.js test/auth.change-password.test.js test/auth.forgot-password-rate-limit.test.js test/auth.rate-limit.test.js test/admin.users.test.js
```
→ `tests 65 | pass 64 | fail 0 | skipped 1`

```powershell
$env:NODE_ENV='test'; $env:MONGODB_URI=''; node --test test/auth.register.test.js test/auth.login.test.js test/auth.refresh-logout.test.js test/auth.rbac.test.js test/auth.csrf.test.js test/auth.rate-limit.test.js test/auth.admin-route.test.js test/auth.profile.test.js test/auth.change-password.test.js test/auth.forgot-password-rate-limit.test.js test/profile.view.test.js test/admin.users.test.js test/error-handler.test.js test/trust-proxy.test.js test/user.model.test.js test/category.model.test.js test/product.model.test.js test/order.model.test.js test/cart.model.test.js test/review.model.test.js test/product.validator.test.js test/product.filter.test.js test/product.pagination.test.js test/integration/rate-limit.integration.test.js
```
→ `tests 233 | pass 232 | fail 0 | skipped 1 | duration_ms 11251.27`

Không chạy `npm test`, `test:integration`, `test:jest` hay file có `mongoose.connect`/`deleteMany`. Không cài `mongodb-memory-server`.

## PASS / FAIL / SKIP
| Hạng mục | Kết quả |
|---|---|
| T4-1-2 forgot-password 429 | **PASS** (2/2) |
| 5 test CSRF bật lại | **PASS** (5/5) |
| T4-1-3 route shadowing | **PASS** (1 regression test) |
| T3-1-2 assertion | **PASS** (test cũ nay assert đúng) |
| Full regression DB-free | **PASS** 232/233 |
| SKIP | 1 test `cookie co Secure=true o production` (có từ trước, ngoài scope master prompt) |
| FAIL | 0 |

## Security considerations
- Không đọc/in `.env`, mật khẩu, JWT secret thật, MongoDB URI hay token. Giá trị `JWT_SECRET` trong test là placeholder cố định đã có từ trước trong repo, không phải credential.
- Không ghi token vào file/collection; không chạy Newman.
- CSRF production giữ nguyên; test chỉ bật tạm trong tiến trình con (`node --test` tách process theo file).

## Known limitations
- `authLimiter` vẫn dùng `MemoryStore` của `express-rate-limit` → không áp dụng được cho multi-instance. Đây là giới hạn hiện tại, đã ghi nhận, không sửa trong scope.
- `NODE_ENV=test` vẫn bypass double-submit CSRF ở production code; 5 test bật lại chứng minh middleware hoạt động khi không ở chế độ test, nhưng không xóa bypass.
- Chưa có integration MongoDB thật; mọi bằng chứng ở mức unit/HTTP in-memory.
- Test Secure cookie production vẫn bị skip từ trước.

## Git safety
- Không force push, reset --hard, clean, rebase, cherry-pick, revert, xóa branch, merge, PR, `git add .` hay `git commit -a`.
- Không ghi đè 5 staged file / 14 untracked mục có từ trước.
- Không push vào `main` hoặc `develop`.
