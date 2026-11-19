# PHASE 2 DEV 1 — PR1 INVESTIGATION REPORT

- **Ngày kiểm tra:** 2026-11-18 07:25 (+07:00)
- **Người thực hiện:** Dev 1 integration (read-only investigation)
- **Phạm vi:** Điều tra vì sao GitHub Compare báo `There isn't anything to compare` cho PR1.
- **Trạng thái file:** Báo cáo này **chưa được commit và chưa được push** theo yêu cầu.

---

## 1. Trạng thái hiện tại

| Hạng mục | Giá trị |
|---|---|
| Branch hiện tại | `docs/phase2-dev1-git-preflight` |
| HEAD | `e432e8e912444f58931e682979c8cc67887d4cff` |
| Remote | `origin = https://github.com/xn1664494-tech/ABMT-SHOP.git` |

### Working tree trước khi kiểm tra

```
?? docs/reports/FINAL_SECURITY_CLEANUP_REPORT.md
?? docs/reports/PHASE2_DEV1_BAO_CAO_2026-11-15.md
```

### Working tree sau khi kiểm tra

```
?? docs/reports/FINAL_SECURITY_CLEANUP_REPORT.md
?? docs/reports/PHASE2_DEV1_BAO_CAO_2026-11-15.md
?? docs/reports/PHASE2_DEV1_PR1_INVESTIGATION_REPORT.md
```

- Không có file tracked nào bị modified/staged.
- Hai file untracked được bảo toàn; không sửa, không stage, không commit.
- Báo cáo này là file mới, do task yêu cầu tạo.

---

## 2. Local/remote SHA các branch liên quan

`git fetch origin` chạy thành công ở đầu phiên, không có ref mới. Các lần `git ls-remote` sau đó bị lỗi mạng tạm thời (`Failed to connect to github.com:443`), nên bảng dưới dùng remote-tracking refs đã được fetch thành công trong phiên này.

| Branch | Local SHA | Remote tracking SHA | Khớp |
|---|---|---|---|
| `feature/post-phase2-hardening` | `aa2f414a9d4e0b795af290ddc64e62e2e19c7227` (stale) | `952b2f31cb1669e653eaf5ec9acd343377acfb04` | **Không** (local chưa cập nhật) |
| `feature/T4-1-1-rbac-route-integration` | `75c30db7f727aa9741593f90a5ba214562b37cf2` | `75c30db7f727aa9741593f90a5ba214562b37cf2` | Có |
| `feature/T4-1-3-change-password` | `e8e5af354e228747b92da20a72d8b9c6d1482723` | `e8e5af354e228747b92da20a72d8b9c6d1482723` | Có |
| `feature/T2-2-1-category-dependency-review` | `26b0ac9c55d2604e517e6324016d0ca2f3dc4330` | `26b0ac9c55d2604e517e6324016d0ca2f3dc4330` | Có |
| `feature/T5-error-page-hardening` | `6e9063a6f55d1eb85853abda801a56417935d465` | `6e9063a6f55d1eb85853abda801a56417935d465` | Có |
| `feature/T4-1-2-trust-proxy-hardening` | `55274810cdd2174a09b8046abd40f099f52d81ba` | `55274810cdd2174a09b8046abd40f099f52d81ba` | Có |
| `docs/phase2-dev1-readme` | `223a3307af34bc234c1188b99709b684ab295dae` | `223a3307af34bc234c1188b99709b684ab295dae` | Có |
| `docs/phase2-dev1-git-preflight` | `e432e8e912444f58931e682979c8cc67887d4cff` | `e432e8e912444f58931e682979c8cc67887d4cff` | Có |

**Lưu ý:** `origin/feature/post-phase2-hardening` hiện là `952b2f3`, không còn là `aa2f414`. Local branch cùng tên chưa được cập nhật — điều này lý giải vì sao kiểm tra cục bộ trước đó có thể gây nhầm lẫn.

---

## 3. Kết quả kiểm tra ancestry

Commit RBAC:

```
75c30db7f727aa9741593f90a5ba214562b37cf2
feat(auth): integrate RBAC authorize into real admin route
Author: Nguyen Tuan Anh
Date:   Tue Nov 17 07:20:23 2026 +0700
```

| Kiểm tra | Kết quả |
|---|---|
| `git merge-base --is-ancestor 75c30db origin/feature/post-phase2-hardening` | **exit 0 — ĐÃ là ancestor** |
| `git merge-base --is-ancestor 75c30db origin/feature/T4-1-1-rbac-route-integration` | **exit 0 — ancestor** |
| `git branch -a --contains 75c30db` | Có `origin/feature/post-phase2-hardening` và tất cả branch task/docs |

Lịch sử nhánh tích hợp:

```
952b2f3 (origin/feature/post-phase2-hardening) Merge pull request #15 from xn1664494-tech/feature/T4-1-1-rbac-route-integration
75c30db (origin/feature/T4-1-1-rbac-route-integration) feat(auth): integrate RBAC authorize into real admin route
aa2f414 (local feature/post-phase2-hardening) Merge remote-tracking branch 'origin/main' into feature/post-phase2-hardening
```

- `origin/feature/post-phase2-hardening..origin/feature/T4-1-1-rbac-route-integration`: **rỗng** (không có commit nào ở head mà target chưa có).
- `origin/feature/T4-1-1-rbac-route-integration..origin/feature/post-phase2-hardening`: chỉ có `952b2f3` (merge commit của PR #15).

**Kết luận ancestry:** PR1 đã được merge vào nhánh tích hợp bằng merge commit `952b2f3` (PR #15), với hai parent là `aa2f414` và `75c30db`.

---

## 4. Kiểm tra nội dung RBAC trong nhánh tích hợp

Không chỉ dựa vào ancestry; đã kiểm tra trực tiếp nội dung tại `origin/feature/post-phase2-hardening`.

| Hạng mục | Kết quả |
|---|---|
| `src/routes/admin.route.js` tồn tại | **Có** — `GET /access-check` |
| Middleware đúng thứ tự | **Có** — `authenticate, authorize('admin')` |
| Mount vào route index | **Có** — `router.use('/admin', require('./admin.route'))` |
| Endpoint thực tế | `/api/admin/access-check` (qua `/api` mount của app) |
| `test/auth.admin-route.test.js` tồn tại | **Có** (219 dòng, 14 test) |
| `package.json` script `test` chứa test admin route | **Có** |
| Diff nội dung `75c30db` vs `952b2f3` cho 4 file PR1 | **Rỗng — giống hệt** |
| Diff ba chấm `target...head` cho 4 file PR1 | **Rỗng** |

Nội dung guard trong nhánh tích hợp:

```js
router.get('/access-check', authenticate, authorize('admin'), (req, res) =>
  res.status(200).json({
    success: true,
    data: {
      authorized: true,
      role: req.user.role,
      user: {
        id: String(req.user._id || req.user.id),
        role: req.user.role,
      },
    },
  }),
);
```

---

## 5. Kiểm tra cherry-pick / commit tương đương

```bash
git cherry -v origin/feature/post-phase2-hardening origin/feature/T4-1-1-rbac-route-integration
```

Kết quả: **rỗng**.

- Không có commit nào ở head mà target chưa có.
- Đây là quan hệ ancestor thật (không phải chỉ nội dung tương đương).
- Không có commit thay thế/cherry-pick khác cần so sánh.

---

## 6. Nguyên nhân GitHub báo "There isn't anything to compare"

GitHub Compare so sánh:

```
base:  feature/post-phase2-hardening @ 952b2f3
head:  feature/T4-1-1-rbac-route-integration @ 75c30db
```

Vì `75c30db` đã là ancestor của `952b2f3`, **head không còn commit nào ngoài base**. GitHub hiển thị:

- `There isn't anything to compare.`
- `feature/post-phase2-hardening is up to date with all commits from feature/T4-1-1-rbac-route-integration.`

Đây là hành vi đúng của GitHub, không phải lỗi ref hay lỗi mạng. Nguyên nhân gốc: **PR1 đã được merge trước đó** qua PR #15.

---

## 7. Kết luận

### CASE A — ALREADY INTEGRATED

Bằng chứng:

1. `75c30db` là ancestor của `origin/feature/post-phase2-hardening` (exit 0).
2. Merge commit `952b2f3` có subject `Merge pull request #15 from .../feature/T4-1-1-rbac-route-integration`.
3. `git cherry` rỗng; `git log target..head` rỗng.
4. Nội dung 4 file PR1 trong target giống hệt commit `75c30db`.
5. Route, mount, test và script test đều hiện diện trong target.

**PR1 không cần tạo lại.** Việc tạo PR mới sẽ trùng lặp hoặc không có diff.

---

## 8. Ảnh hưởng đến các PR tiếp theo

| Branch | SHA | Là ancestor của target? | Ghi chú |
|---|---|---|---|
| `feature/T4-1-3-change-password` | `e8e5af3` | **Chưa** (exit 1) | PR2 cần tạo, base mới là `feature/post-phase2-hardening` @ `952b2f3` |
| `feature/T2-2-1-category-dependency-review` | `26b0ac9` | Chưa | Chờ PR2 |
| `feature/T5-error-page-hardening` | `6e9063a` | Chưa | Chờ PR4 |
| `feature/T4-1-2-trust-proxy-hardening` | `5527481` | Chưa | Chờ PR5 |
| `docs/phase2-dev1-readme` | `223a330` | Chưa | Chờ PR6 |

Diff `origin/feature/post-phase2-hardening...origin/feature/T4-1-3-change-password` hiện chỉ còn đúng phạm vi PR2:

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

(Không có file nào của PR1 lặp lại.)

---

## 9. Kiểm thử

- Trong phiên làm việc trước đó (cùng ngày, trước khi mạng/port gặp sự cố):
  - `node --test test/auth.admin-route.test.js`: **14 pass / 0 fail**
  - `npm test`: **107 pass / 0 fail / 0 skip**
  - `npm run test:integration`: **12 pass / 0 fail** trên `abmt_shop_test`
- Lần chạy lại trong bước điều tra này: **fail do môi trường**, không phải assertion:
  - `Error: listen EACCES: permission denied 127.0.0.1` (14/14 test fail khi khởi tạo server của supertest).
  - Đã kiểm tra: không có process `node` còn sống; Windows có dải port bị loại trừ `50000–50059`; lỗi lặp lại 3 lần.
  - Đây là lỗi bind port tạm thời của môi trường, không phải regression nghiệp vụ.
- Không chạy `npm run test:jest` (đã biết lỗi driver; ngoài phạm vi điều tra PR1).

---

## 10. Đề xuất bước tiếp theo

1. **Bỏ qua PR1** trong chuỗi PR; không tạo PR trùng.
2. Cập nhật nhận thức: `feature/post-phase2-hardening` hiện là `952b2f3`, không phải `aa2f414`.
3. Chuẩn bị PR2 với:
   - Head: `feature/T4-1-3-change-password` (`e8e5af3`)
   - Base: `feature/post-phase2-hardening` (`952b2f3`)
   - Compare: `https://github.com/xn1664494-tech/ABMT-SHOP/compare/feature/post-phase2-hardening...feature/T4-1-3-change-password?expand=1`
4. Không tự tạo PR2, không merge, không sync `main`; chờ xác nhận của người dùng.
5. Trước khi làm việc với nhánh tích hợp ở local, cần cập nhật an toàn bằng `git pull --ff-only` sau khi được phép (không thực hiện trong task này).

---

## 11. Các thao tác đã thực hiện

Chỉ các lệnh read-only:

```text
git status --short
git branch --show-current
git rev-parse HEAD
git remote -v
git fetch origin
git show --no-patch --format=fuller 75c30db...
git branch -a --contains 75c30db...
git merge-base --is-ancestor 75c30db... origin/feature/post-phase2-hardening
git merge-base --is-ancestor 75c30db... origin/feature/T4-1-1-rbac-route-integration
git log --oneline --decorate -15 origin/feature/post-phase2-hardening
git log --oneline --decorate -15 origin/feature/T4-1-1-rbac-route-integration
git log --oneline origin/feature/post-phase2-hardening..origin/feature/T4-1-1-rbac-route-integration
git log --oneline origin/feature/T4-1-1-rbac-route-integration..origin/feature/post-phase2-hardening
git show origin/feature/post-phase2-hardening:src/routes/admin.route.js
git show origin/feature/post-phase2-hardening:src/routes/index.js
git ls-tree -r --name-only origin/feature/post-phase2-hardening -- test/auth.admin-route.test.js
git show origin/feature/post-phase2-hardening:package.json
git cherry -v origin/feature/post-phase2-hardening origin/feature/T4-1-1-rbac-route-integration
git diff --stat origin/feature/post-phase2-hardening...origin/feature/T4-1-1-rbac-route-integration -- <4 file PR1>
git diff --stat 75c30db 952b2f3 -- <4 file PR1>
node --test test/auth.admin-route.test.js   (chỉ đọc/chạy test)
git ls-remote origin <các branch>           (một số lần lỗi mạng)
```

Các kiểm tra môi trường:

```text
netsh int ipv4 show excludedportrange protocol=tcp
Get-Process node
```

Không có thao tác ghi vào Git.

---

## 12. Xác nhận an toàn

- **Không** merge.
- **Không** tạo Pull Request.
- **Không** push.
- **Không** force-push.
- **Không** rebase.
- **Không** reset.
- **Không** cherry-pick.
- **Không** revert.
- **Không** xóa branch.
- **Không** checkout sang branch khác.
- **Không** commit.
- **Không** sửa/xóa file người dùng.
- **Không** đồng bộ `origin/main` vào nhánh tích hợp.
- **Không** thay đổi lịch sử Git.
- Hai file untracked `FINAL_SECURITY_CLEANUP_REPORT.md` và `PHASE2_DEV1_BAO_CAO_2026-11-15.md` được giữ nguyên.
- Báo cáo này chưa được commit/push.
