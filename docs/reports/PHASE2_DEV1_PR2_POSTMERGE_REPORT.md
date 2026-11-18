# PHASE 2 DEV 1 — PR2 POST-MERGE VERIFICATION

- **Task ID:** T4-1-3 (API Profile — đổi mật khẩu)
- **PR:** #20 `feat(profile): add secure password change API`
- **Branch:** `feature/T4-1-3-change-password` @ `e8e5af354e228747b92da20a72d8b9c6d1482723`
- **Base branch:** `feature/post-phase2-hardening`
- **Merge commit:** `b4be920e6112ff41b241d2a3feca919dd30476a4`
- **Merge parents:** `54ae102` (merge PR #19) + `e8e5af3` (PR2 head)
- **Merged by:** `xn1664494-tech` (người dùng), `merged_at = 2026-11-18T16:07:58Z`
- **Thời điểm verify:** 2026-11-18, sau khi fetch
- **Loại:** verification read-only trên target; không commit, không push.

---

## 1. Xác minh tích hợp

| Kiểm tra | Kết quả |
|---|---|
| `origin/feature/post-phase2-hardening` | `b4be920` |
| Commit PR2 `e8e5af3` là ancestor của target | ✅ `git merge-base --is-ancestor` → true |
| Merge commit `b4be920` là ancestor của target | ✅ true |
| Merge commit có 2 parent đúng (`54ae102`, `e8e5af3`) | ✅ |
| PR #20 state | `closed`, `merged = true`, `merged_at` 16:07:58Z |
| Base của PR lúc merge | `feature/post-phase2-hardening` ✅ (không phải `main`) |
| Head SHA lúc merge | `e8e5af3` ✅ (không đổi so với preflight) |
| Local target | fast-forward `952b2f3` → `b4be920` (`git merge --ff-only`), không tạo commit mới |
| Working tree sau ff | không có thay đổi tracked/staged |

### 1.1. PR #19 cũng đã được merge (ghi nhận)

`54ae102 Merge pull request #19 from .../docs/phase2-dev1-pr1-investigation` — parents `952b2f3` + `dd3e6cd`, **base là `feature/post-phase2-hardening`** (không phải `main`), diff chỉ 1 file docs (+284). Việc sửa base ở bước trước đã phát huy tác dụng: không có code PR1 nào được đưa lại vào target.

---

## 2. Diff thực tế trên target

`git diff --stat 952b2f3 b4be920`:

| File | Thay đổi |
|---|---|
| `docs/reports/PHASE2_DEV1_PR1_INVESTIGATION_REPORT.md` | +284 (từ PR #19) |
| `package.json` | +1/−1 (thêm `test/auth.change-password.test.js` vào script `test`) |
| `src/controllers/profileController.js` | +21/−2 |
| `src/routes/profile.route.js` | +14/−2 |
| `src/services/profileService.js` | +46/−1 |
| `src/validators/authValidator.js` | +25/−1 |
| `test/auth.change-password.test.js` | +234 (mới) |
| `test/support/fakeUserModel.js` | +5/−1 |
| **Tổng** | **8 files, +630/−8** |

Kiểm tra "không lặp PR1":

| File PR1 | Có bị sửa lại trong delta này? |
|---|---|
| `src/routes/admin.route.js` | ❌ không |
| `src/routes/index.js` | ❌ không (`git diff` rỗng) |
| `test/auth.admin-route.test.js` | ❌ không |
| `package.json` | ✅ có, nhưng chỉ thêm 1 test file vào script — không lặp thay đổi PR1 |

---

## 3. Test đã chạy (trên target `b4be920`)

| Lệnh | Kết quả | Ghi chú |
|---|---|---|
| `npm test` (`node --test`, 10 file) | **96 pass / 0 fail / 0 skipped / 0 todo** (exit 0) | bao gồm `test/auth.change-password.test.js` |
| `node --test test/auth.change-password.test.js` | **10 pass / 0 fail** | riêng T4-1-3 change password |
| `npm run test:integration` | **12 pass / 0 fail** (exit 0) | MongoDB thật, DB **`abmt_shop_test`** |

### 3.1. Bằng chứng DB test

- `test/integration/mongodb.integration.test.js` dòng 27: `process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/abmt_shop_test'`.
- Dòng 85: test **skip nếu tên database không chứa `"test"`** → không thể vô tình chạy trên DB production.
- Biến `TEST_MONGODB_URI` **không được set** trong phiên này → dùng default `abmt_shop_test`.

---

## 4. Security checks

| Kiểm tra | Kết quả |
|---|---|
| Secret / credential trong diff PR2 | Không |
| `.env` bị commit | Không |
| Password lưu plaintext | Không — service dùng hash hiện có |
| Trả trường mật khẩu trong response | Không (test `IT-COOKIE` + profile tests kiểm tra) |
| Thay đổi ngoài phạm vi T4-1-3 | Không (7 file, đều thuộc profile/auth + test) |
| Sửa code Dev 2 (Category/Product) | Không |
| File bảo vệ bị đụng | Không |

---

## 5. Known limitations (chưa được coi là PASS)

| # | Hạn chế | Ảnh hưởng |
|---|---|---|
| L1 | **V2 chưa làm**: chưa có integration Mongo thật cho change-password (refresh token cũ bị từ chối, `tokenVersion` tăng, user khác không ảnh hưởng, cleanup theo record) | T4-1-3 mới PASS ở mức unit + route; bằng chứng hành vi token chưa có |
| L2 | `npm run test:jest` vẫn fail (`Missing required sub-document 'driver'`) — **không chạy lại trong gate này**, trạng thái cũ vẫn hiệu lực | Không được coi Jest PASS (V1) |
| L3 | Không có CI (0 check-run), không có review approval | DoD #4 chưa đạt |
| L4 | Không có staging | V3 vẫn NOT VERIFIED |
| L5 | Target chưa sync `main` → thiếu Category API, `/health`, helmet/compression/session | Chưa thể coi là bản release |

---

## 6. Kết luận

| Hạng mục | Trạng thái |
|---|---|
| PR2 đã tích hợp vào target | **PASS** |
| Test unit trên target | **PASS** (96/96) |
| Test integration trên `abmt_shop_test` | **PASS** (12/12) |
| Hành vi đổi mật khẩu với MongoDB thật | **NOT VERIFIED** (V2) |
| T4-1-3 (WBS Phase 2) | **PASS** implementation + test; vẫn mở L1/L3 |
| Gate chuyển sang PR4 | **ĐẠT** |

**Bước tiếp theo:** PR4 preflight (`docs/reports/PHASE2_DEV1_PR4_PREFLIGHT_REPORT.md`) → người dùng tạo PR → verify → người dùng merge → post-merge verify.

**Người chịu trách nhiệm:** người dùng tạo/merge PR4; agent verify + chạy test.
