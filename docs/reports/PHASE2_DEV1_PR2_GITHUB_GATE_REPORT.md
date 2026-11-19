# PHASE 2 DEV 1 — PR2 GITHUB GATE REPORT (T4-1-3 CHANGE PASSWORD)

- **Thời điểm kiểm tra:** 2026-11-18 22:18 (+07:00)
- **Branch đang đứng:** `feature/post-phase2-hardening`
- **HEAD local:** `952b2f31cb1669e653eaf5ec9acd343377acfb04`
- **Trạng thái file:** untracked — **chưa commit, chưa push**.
- **Kết luận gate:** **BLOCKED — PR2 CHƯA ĐƯỢC TẠO VÀ CHƯA ĐƯỢC MERGE.**

---

## 1. Kết quả kiểm tra Git/GitHub

### 1.1. Remote refs

| Ref | SHA |
|---|---|
| `origin/feature/post-phase2-hardening` | `952b2f31cb1669e653eaf5ec9acd343377acfb04` |
| Local `feature/post-phase2-hardening` | `952b2f31cb1669e653eaf5ec9acd343377acfb04` |
| `origin/feature/T4-1-3-change-password` | `e8e5af354e228747b92da20a72d8b9c6d1482723` |
| `origin/docs/phase2-dev1-pr1-investigation` | `dd3e6cda278a1e5a960dcdf079e0957dcc0c840c` |
| `origin/main` | `8a3865cd3444accba70c340290a35db81687b8fc` |

### 1.2. Ancestry

```
git merge-base --is-ancestor e8e5af3 origin/feature/post-phase2-hardening  -> exit 1 (chưa merge)
git log --oneline origin/feature/post-phase2-hardening..origin/feature/T4-1-3-change-password
  e8e5af3 feat(profile): add secure password change API
```

### 1.3. Trạng thái GitHub Pull Requests

Đọc qua GitHub API công khai (`GET /repos/xn1664494-tech/ABMT-SHOP/pulls?state=all`) và `git ls-remote origin "refs/pull/*/head"`.

- Danh sách PR hiện có: #1–#18.
- **Không có PR nào** có head `feature/T4-1-3-change-password`.
- PR #16 `Feature/header actions` (head `feature/header-actions`) — open, base `main`, không liên quan.
- PR #17 và #18 (Category/index-seed) — đã merge vào `main`.

**Kết luận:** PR2 **chưa được tạo** trên GitHub. Không có gì để review/merge.

### 1.4. Thay đổi ngoài dự kiến so với báo cáo trước

`origin/main` đã tiến từ `3d33a237` → **`8a3865cd`** do PR #17 và #18 được merge:

- `8a3865c` Merge PR #18 `feature/T2-2-1-api-category` — **Dev2 đã đưa API Category CRUD vào `main`**.
- `bcf4aec` / `63f87f5` — API danh mục, cây cha/con, xoá mềm, test Postman.

Ảnh hưởng:

- Sync `main` ở giai đoạn P2 giờ là **17 commit** (trước báo cáo là 11), không phải 11.
- Category verification (P4) sẽ có schema + API thật từ Dev2 trên `main`, nên khả năng BLOCKED giảm — nhưng **chỉ được đánh giá sau sync**, không suy đoán trước.
- Không ảnh hưởng PR2: diff PR2 vẫn tính trên base `952b2f3`.

Không có thay đổi nào trên `feature/post-phase2-hardening` hay nhánh PR2.

---

## 2. PR2 — thông tin xác minh lại

| Hạng mục | Giá trị |
|---|---|
| Base branch | `feature/post-phase2-hardening` |
| Base SHA | `952b2f31cb1669e653eaf5ec9acd343377acfb04` |
| Head branch | `feature/T4-1-3-change-password` |
| Head SHA | `e8e5af354e228747b92da20a72d8b9c6d1482723` |
| Số commit | 1 |
| Diff | 7 files, **+346 / −8** |
| Lặp PR1 | Không (không có `admin.route.js`, `admin-route.test.js`, `routes/index.js`) |
| Secret thật | Không phát hiện |

```
 package.json                         |   2 +-
 src/controllers/profileController.js |  23 +++-
 src/routes/profile.route.js          |  16 ++-
 src/services/profileService.js       |  47 ++++++-
 src/validators/authValidator.js      |  26 +++-
 test/auth.change-password.test.js    | 234 +++++++++++++++++++++++++++++++++++
 test/support/fakeUserModel.js        |   6 +-
 7 files changed, 346 insertions(+), 8 deletions(-)
```

Diff khớp 100% với preflight report `PHASE2_DEV1_PR2_PREFLIGHT_REPORT.md`. Head SHA không đổi.

---

## 3. Bằng chứng test hiện có (từ head PR2, chưa phải target sau merge)

| Lệnh | Kết quả | Ghi chú |
|---|---|---|
| `node --test test/auth.change-password.test.js` | 10 pass / 0 fail | Fake User model |
| `npm test` | 96 pass / 0 fail / 0 skip | Trên head `e8e5af3` |
| `npm run test:integration` | 12 pass / 0 fail / 0 skip | `abmt_shop_test` |

Các kết quả này **không thay thế** test trên target sau merge. Sau khi PR2 merge phải chạy lại và ghi báo cáo post-merge.

---

## 4. Secret scan

- Diff PR2: chỉ có hằng số test (`JWT_SECRET` test, mật khẩu test) trong `test/auth.change-password.test.js`.
- Không có `.env`, URI thật, credential, token, private key.
- Không in giá trị nào trong báo cáo.

**Kết quả:** PASS (không có secret thật).

---

## 5. Hành động cần người dùng thực hiện

### 5.1. Tạo PR2

URL:

```text
https://github.com/xn1664494-tech/ABMT-SHOP/compare/feature/post-phase2-hardening...feature/T4-1-3-change-password?expand=1
```

- **base:** `feature/post-phase2-hardening`
- **compare:** `feature/T4-1-3-change-password`

**Title:**

```text
feat(auth): implement change password endpoint (T4-1-3)
```

**Description:**

```markdown
## Summary
Thêm API đổi mật khẩu cho user đang đăng nhập: `PATCH /api/profile/me/password`.
Xác minh mật khẩu hiện tại, hash mật khẩu mới bằng bcrypt, tăng `tokenVersion` để thu hồi token cũ và xoá auth cookies.

## Changes
- `src/routes/profile.route.js`: route `authenticate` + `csrfProtection` + `validate(changePasswordSchema)`.
- `src/validators/authValidator.js`: `changePasswordSchema` strict, password policy 8–72 ký tự có chữ + số, new ≠ current.
- `src/services/profileService.js`: bcrypt compare/hash (10 rounds), `$inc tokenVersion`, điều kiện `isDeleted: false`.
- `src/controllers/profileController.js`: `changeMyPassword`, trả 200 và xoá auth cookies.
- `test/auth.change-password.test.js`: 10 test HTTP.
- `test/support/fakeUserModel.js`: hỗ trợ `$set`/`select` cho test.
- `package.json`: thêm test file vào script `npm test`.

## API
`PATCH /api/profile/me/password`

Body:
```json
{ "currentPassword": "...", "newPassword": "..." }
```

## Security behavior
- 401: chưa đăng nhập, sai mật khẩu hiện tại, token cũ bị thu hồi.
- 403: thiếu/sai CSRF token.
- 400: input không hợp lệ, trùng mật khẩu cũ, field ngoài scope.
- 200: thành công; không trả password/hash.
- `tokenVersion` tăng; access token cũ bị từ chối; refresh token cũ bị từ chối theo cơ chế hiện tại.
- Auth cookies bị xoá.

## Tests
- `node --test test/auth.change-password.test.js`: 10 pass.
- `npm test`: 96 pass / 0 fail.
- `npm run test:integration`: 12 pass / 0 fail trên `abmt_shop_test`.
- HTTP test dùng fake User model, chưa phải MongoDB thật.

## Known limitations
- Chưa có integration test MongoDB thật cho đổi mật khẩu (verification gap V2).
- Chưa có test riêng cho refresh token cũ sau đổi mật khẩu.
- Chưa hỗ trợ `confirmPassword`.

## Related task
T4-1-3 — Profile API / đổi mật khẩu (WBS).
```

**Reviewer checklist:**

- [ ] Base `feature/post-phase2-hardening` @ `952b2f3`; head `feature/T4-1-3-change-password` @ `e8e5af3`.
- [ ] Diff đúng 7 file, +346/−8; không lặp PR1.
- [ ] Route có đủ `authenticate`, `csrfProtection`, `validate`.
- [ ] Mật khẩu cũ được xác minh bằng bcrypt.
- [ ] Mật khẩu mới được hash bcrypt (10 rounds).
- [ ] `tokenVersion` tăng sau khi đổi.
- [ ] Access token cũ bị từ chối; refresh token cũ bị từ chối theo thiết kế.
- [ ] Auth cookies bị xoá.
- [ ] Response không chứa password/hash.
- [ ] Không nhận field ngoài scope.
- [ ] Test 10/10, 96/96, integration 12/12 có bằng chứng.
- [ ] Không có secret/URI/`.env` trong diff.
- [ ] Merge bằng **merge commit** — không squash, không rebase.

### 5.2. Sau khi tạo PR

Gửi lại **PR URL**. Không merge ngay — cần bước xác minh PR (base/head/diff/ancestry) trước.

### 5.3. Sau khi merge

Xác nhận "đã merge PR2" để tiếp tục checkpoint: fetch → verify ancestry → chạy `npm test` + `npm run test:integration` trên target → tạo `PHASE2_DEV1_PR2_POSTMERGE_REPORT.md` → chuyển PR4.

---

## 6. Blocker / Caveat

**Blocker (hard gate):**
- PR2 chưa được tạo trên GitHub.
- PR2 chưa được merge vào `feature/post-phase2-hardening`.
- `e8e5af3` không phải ancestor của target (exit 1).

**Caveat đã biết (không chặn tạo PR):**
- V2 (change-password trên MongoDB thật) — NOT VERIFIED.
- Refresh-token test riêng — chưa có.
- Jest (`npm run test:jest`) — NOT VERIFIED (`Missing required sub-document 'driver'`).
- V3 trust proxy staging — NOT VERIFIED.
- EACCES port `50000–50059` từng xuất hiện, lần chạy gần nhất không tái hiện.

---

## 7. Quyết định

- **Không chuẩn bị PR4.** Điều kiện "PR2 merged và verified" chưa đạt.
- **Không sync `main`.**
- **Không merge, không tạo PR hộ.**
- **Next action:** người dùng tạo PR2 theo mục 5.1 rồi gửi URL.

---

## 7b. Cập nhật sau khi người dùng báo "đã tạo PR"

Kiểm tra lại GitHub lúc 22:3x (+07:00): tổng **19 PR**.

PR mới xuất hiện là **#19**, nhưng **không phải PR2**:

| Hạng mục | Giá trị |
|---|---|
| URL | `https://github.com/xn1664494-tech/ABMT-SHOP/pull/19` |
| Title | `Docs/phase2 dev1 pr1 investigation` |
| Head | `docs/phase2-dev1-pr1-investigation` @ `dd3e6cd` |
| Base | **`main`** @ `8a3865c` — sai base dự kiến |
| Commits | 3 (`dd3e6cd`, `952b2f3`, `75c30db`) |
| Files | 5 (báo cáo + 4 file PR1) |
| Mergeable state | **`dirty`** (xung đột với `main`) |

Đây là PR của **nhánh báo cáo PR1**, không phải PR2 Change Password. PR2 (`feature/T4-1-3-change-password` @ `e8e5af3`) **vẫn chưa có PR**.

Hệ quả của base `main`:

- PR kéo theo toàn bộ commit PR1 (`75c30db`, `952b2f3`) vì `main` chưa có merge commit `952b2f3`.
- Diff hiển thị 5 file thay vì đúng 1 file báo cáo.
- Trạng thái `dirty` do `main` đã có thay đổi Category/Product từ PR #17/#18.

Cách xử lý khuyến nghị (không đổi lịch sử Git):

1. Mở PR #19 → **Edit** → đổi **base branch** từ `main` sang `feature/post-phase2-hardening`.
2. Khi đó diff còn đúng 1 file `docs/reports/PHASE2_DEV1_PR1_INVESTIGATION_REPORT.md` và trạng thái mergeable được tính lại.
3. Sau đó tạo PR2 bằng compare URL riêng.

Không merge PR #19 khi base còn là `main`.

---

## 8. Bảo toàn dữ liệu

Hai file untracked được bảo vệ vẫn nguyên vẹn, không stage/commit/sửa/xoá:

- `docs/reports/FINAL_SECURITY_CLEANUP_REPORT.md`
- `docs/reports/PHASE2_DEV1_BAO_CAO_2026-11-15.md`

Hai báo cáo mới không bị ghi đè:

- `docs/reports/PHASE2_DEV1_PR1_CLOSEOUT_REPORT.md`
- `docs/reports/PHASE2_DEV1_PR2_PREFLIGHT_REPORT.md`
