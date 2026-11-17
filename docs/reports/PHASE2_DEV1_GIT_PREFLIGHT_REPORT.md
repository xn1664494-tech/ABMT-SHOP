# PHASE 2 DEV 1 — GIT PREFLIGHT REPORT

- **Ngày:** 2026-11-17
- **Branch thực hiện báo cáo:** `docs/phase2-dev1-git-preflight` (tạo từ `223a3307af34bc234c1188b99709b684ab295dae`)
- **Phạm vi:** Giai đoạn A — read-only preflight trước khi tạo PR / tích hợp stacked branches.
- **Nguyên tắc:** Không merge, không push vào `main`/`develop`, không force-push, không reset/clean/rebase, không sửa file untracked có sẵn.

> Báo cáo này chỉ ghi nhận trạng thái quan sát được. Không có thay đổi lịch sử Git nào được thực hiện trong quá trình kiểm tra.
>
> **Cập nhật sau preflight:** `origin/main` tiếp tục thay đổi trong lúc review. Tại lần kiểm tra mới nhất, `origin/main` = `3d33a23` và đã tiến **11 commit** so với base (không còn là 5). Chi tiết cập nhật, PR dossier và merge runbook nằm ở **Phụ lục A**; snapshot cuối, acceptance matrix, sync runbook và decision log nằm ở **Phụ lục B**.
>
> Bản này là bản finalize để commit riêng trên `docs/phase2-dev1-git-preflight`. Không tạo PR, không merge, không release, không sync `main`.

---

## 1. Trạng thái working tree

```
?? docs/reports/FINAL_SECURITY_CLEANUP_REPORT.md
?? docs/reports/PHASE2_DEV1_BAO_CAO_2026-11-15.md
```

- Không có thay đổi staged/unstaged ngoài 2 file untracked nêu trên.
- 2 file untracked là tài liệu có sẵn từ trước, **không do preflight tạo ra**.
- **Quyết định:** giữ nguyên, không commit/xóa/sửa. Cần Lead/chủ file quyết định (xem Decision Log).

---

## 2. Branch, commit và remote

### 2.1. Base và integration target

| Vai trò | Branch | Local SHA | Remote SHA | Ghi chú |
|---|---|---|---|---|
| Base / integration target | `feature/post-phase2-hardening` | `aa2f414a9d4e0b795af290ddc64e62e2e19c7227` | `aa2f414a9d4e0b795af290ddc64e62e2e19c7227` | Khớp |
| Release branch hiện tại | `main` | — | `4248234ec552c139ec25d25dd853cedb494d8c23` | Đã tiến 5 commit so với base |

### 2.2. Stacked task branches

| # | Branch | Commit dự kiến | Local SHA | Remote SHA | Khớp remote |
|---|---|---|---|---|---|
| 1 | `feature/T4-1-1-rbac-route-integration` | `75c30db` | `75c30db7f727aa9741593f90a5ba214562b37cf2` | `75c30db7f727aa9741593f90a5ba214562b37cf2` | Có |
| 2 | `feature/T4-1-3-change-password` | `e8e5af3` | `e8e5af354e228747b92da20a72d8b9c6d1482723` | `e8e5af354e228747b92da20a72d8b9c6d1482723` | Có |
| 3 | `feature/T2-1-3-env-test-integration` | Không có commit | `e8e5af3` (trùng TASK 2) | **Không có remote branch** | N/A |
| 4 | `feature/T2-2-1-category-dependency-review` | `26b0ac9` | `26b0ac9c55d2604e517e6324016d0ca2f3dc4330` | `26b0ac9c55d2604e517e6324016d0ca2f3dc4330` | Có |
| 5 | `feature/T5-error-page-hardening` | `6e9063a` | `6e9063a6f55d1eb85853abda801a56417935d465` | `6e9063a6f55d1eb85853abda801a56417935d465` | Có |
| 6 | `feature/T4-1-2-trust-proxy-hardening` | `5527481` | `55274810cdd2174a09b8046abd40f099f52d81ba` | `55274810cdd2174a09b8046abd40f099f52d81ba` | Có |
| 7 | `docs/phase2-dev1-readme` | `6e4c127` + `223a330` | `223a3307af34bc234c1188b99709b684ab295dae` | `223a3307af34bc234c1188b99709b684ab295dae` | Có |

- `feature/T2-1-3-env-test-integration` không có commit riêng và không có remote branch → **không tạo PR**, không tạo commit rỗng.
- Tất cả branch còn lại: local SHA = remote SHA.
- Không có branch nào đã được merge một phần vào `feature/post-phase2-hardening` (target vẫn ở `aa2f414`).

### 2.3. Ancestry thực tế

Đã xác minh bằng `git merge-base --is-ancestor`:

| Parent | Child | Kết quả |
|---|---|---|
| `aa2f414` | `feature/T4-1-1-rbac-route-integration` | OK |
| `75c30db` | `feature/T4-1-3-change-password` | OK |
| `e8e5af3` | `feature/T2-2-1-category-dependency-review` | OK |
| `26b0ac9` | `feature/T5-error-page-hardening` | OK |
| `6e9063a` | `feature/T4-1-2-trust-proxy-hardening` | OK |
| `5527481` | `docs/phase2-dev1-readme` | OK |
| `6e4c127` | `docs/phase2-dev1-readme` | OK |

Số commit mỗi branch so với base: 1 → 2 → 3 → 4 → 5 → 7 (branch 3 không có commit). Chuỗi ancestry khớp sơ đồ dự kiến.

### 2.4. Phạm vi file của từng commit

| Commit | File thay đổi |
|---|---|
| `75c30db` | `package.json` (M), `src/routes/admin.route.js` (A), `src/routes/index.js` (M), `test/auth.admin-route.test.js` (A) |
| `e8e5af3` | `package.json` (M), `src/controllers/profileController.js` (M), `src/routes/profile.route.js` (M), `src/services/profileService.js` (M), `src/validators/authValidator.js` (M), `test/auth.change-password.test.js` (A), `test/support/fakeUserModel.js` (M) |
| `26b0ac9` | `docs/reports/T2-2-1_CATEGORY_DEPENDENCY_REVIEW.md` (A) |
| `6e9063a` | `package.json` (M), `src/middleware/errorHandler.js` (M), `src/views/error.ejs` (A), `test/error-handler.test.js` (A) |
| `5527481` | `package.json` (M), `src/app.js` (M), `test/trust-proxy.test.js` (A) |
| `6e4c127` | `README.md` (A) |
| `223a330` | `docs/reports/PHASE2_DEV1_COMPLETION_REPORT.md` (A) |

- Không phát hiện file ngoài phạm vi task.
- `package.json` được sửa ở 4 commit (thêm test script) — thay đổi additive, có khả năng conflict thấp nhưng cần kiểm tra khi merge tuần tự.

---

## 3. Kiểm tra bảo mật (secret scan)

Đã quét toàn bộ commit trong `aa2f414..HEAD` với các mẫu: MongoDB URI có credential, MongoDB SRV URI thực, giá trị JWT secret, private key, AWS access key.

Kết quả:

- Không phát hiện MongoDB URI/password thật, JWT secret thật, private key hay AWS key.
- Chỉ có placeholder MongoDB SRV URI (dạng `<scheme>://<...>`) trong:
  - `docs/reports/POST_PHASE2_HARDENING_REPORT.md`
  - `scripts/check-env.js`
- `.env` và `.env.test` không được track. `.env.test` khớp rule `.gitignore:6 .env.*`.
- Chỉ đọc **tên biến** trong `.env`/`.env.test`, không đọc/in giá trị.

**Trạng thái credential Atlas lịch sử:** vẫn phải coi là đã lộ; báo cáo này không in URI/password. Việc rotate/revoke không thực hiện trong preflight.

---

## 4. Môi trường kiểm thử

| Thành phần | Phiên bản / ghi chú |
|---|---|
| Node.js | `v24.14.0` |
| npm | `11.9.0` |
| Mongoose | `9.12.0` |
| MongoDB driver | `7.8.0` |
| Jest | `30.5.2` |
| Git | `2.55.0.windows.5` |
| GitHub CLI (`gh`) | **Không có** (`gh` not recognized) |
| `GH_TOKEN` / `GITHUB_TOKEN` | **Không có** trong môi trường |
| Git credential helper | `manager` |

---

## 5. Kết quả test hiện tại (trên `223a330`)

| Bộ test | Kết quả |
|---|---|
| `npm test` (node:test) | **107 pass / 0 fail / 0 skip** |
| `npm run test:integration` (MongoDB thật `abmt_shop_test`) | **12 pass / 0 fail / 0 skip** |
| `npm run test:jest` | **FAIL 7/7 test, 2/2 suite** — lỗi driver: `MongooseServerSelectionError: Missing required sub-document 'driver'`; chưa phải assertion nghiệp vụ |

Ghi chú: đây là baseline trước integration; sau mỗi merge phải chạy lại, không dùng số liệu này thay cho merged state.

---

## 6. Phát hiện quan trọng — `origin/main` đã phân kỳ

`origin/main` hiện tại `4248234ec552c139ec25d25dd853cedb494d8c23`, gồm 5 commit không có trong base:

| Commit | Nội dung |
|---|---|
| `4605333` | Merge PR #5 từ `feature/post-phase2-hardening` (chính là base `aa2f414`) |
| `2a0c2a2` | `GET /health` |
| `0c1fd18` | Merge PR #9 (health) |
| `94ed049` | T2-2-1 Category + chuẩn hóa Product schema (Dev 2) |
| `bccae61` | Merge PR #10 (T2-2-1 schema) |
| `52bb616` | Home service lấy dữ liệu trang chủ |
| `4248234` | Merge PR #11 (home-service) |

Diff `aa2f414..origin/main` (10 file): `src/model/Category.js` (mới), `src/model/Products.js` (chuẩn hóa), `src/utils/sku.js`, test model/catalog, `tests/health.test.js`, `src/app.js`, `package.json`, tài liệu T2-2-1.

Hệ quả:

1. **T2-2-1 Category đã được Dev 2 triển khai và merge vào `main`** (PR #10). Báo cáo dependency `T2-2-1_CATEGORY_DEPENDENCY_REVIEW.md` phản ánh trạng thái trước thời điểm đó (Category chưa tồn tại trên nhánh Dev 1). Báo cáo không sai tại thời điểm viết, nhưng đã bị **superseded một phần** bởi delivery của Dev 2.
2. Chuỗi Dev 1 vẫn **không chứa** Category/Product schema mới. Việc re-verify T2-2-1 của Dev 1 **chưa thể thực hiện** trên chuỗi này cho đến khi có quyết định tích hợp.
3. Integration target theo yêu cầu (`feature/post-phase2-hardening` @ `aa2f414`) vẫn hợp lệ về ancestry, nhưng release về `develop`/`main` sẽ phải xử lý phân kỳ với `main` (dự kiến conflict ở `package.json`, `src/app.js`; docs/test phần lớn additive).

**Cần Lead quyết định trước khi merge:**
- (A) Giữ nguyên kế hoạch: PR vào `feature/post-phase2-hardening`, sau đó merge `main` → `feature/post-phase2-hardening` (hoặc ngược lại) để đồng bộ trước release.
- (B) Tạo integration branch mới từ `origin/main` và merge các task branch vào đó (thay đổi target so với master prompt).
- (C) Trì hoãn integration, chỉ hoàn tất preflight + PR chuẩn bị.

---

## 7. Khả năng tạo PR

- `gh` CLI **không có**; không có `GH_TOKEN`/`GITHUB_TOKEN`.
- Do đó **không thể tạo PR bằng CLI/API từ môi trường này**.
- Có thể tạo PR thủ công bằng GitHub UI qua compare URL, hoặc cài/ủy quyền `gh` sau khi được approval.
- Không tuyên bố PR tồn tại cho đến khi có URL xác minh được.

---

## 8. Danh sách PR chuẩn bị (chưa tạo)

Target cuối cùng: `feature/post-phase2-hardening`.

Để mỗi PR chỉ hiển thị diff của một task, dùng base tạm thời là branch trước (theo mục 3.4 của master prompt), sau đó retarget về `feature/post-phase2-hardening` sau khi PR trước được merge. Không rebase, không force-push.

| PR | Source (head) | Base tạm thời | Commit | Compare URL |
|---|---|---|---|---|
| PR 1 | `feature/T4-1-1-rbac-route-integration` | `feature/post-phase2-hardening` | `75c30db` | https://github.com/xn1664494-tech/ABMT-SHOP/compare/feature/post-phase2-hardening...feature/T4-1-1-rbac-route-integration?expand=1 |
| PR 2 | `feature/T4-1-3-change-password` | `feature/T4-1-1-rbac-route-integration` | `e8e5af3` | https://github.com/xn1664494-tech/ABMT-SHOP/compare/feature/T4-1-1-rbac-route-integration...feature/T4-1-3-change-password?expand=1 |
| PR 3 | — | — | — | **BỎ QUA** (`T2-1-3` không có commit/remote branch) |
| PR 4 | `feature/T2-2-1-category-dependency-review` | `feature/T4-1-3-change-password` | `26b0ac9` | https://github.com/xn1664494-tech/ABMT-SHOP/compare/feature/T4-1-3-change-password...feature/T2-2-1-category-dependency-review?expand=1 |
| PR 5 | `feature/T5-error-page-hardening` | `feature/T2-2-1-category-dependency-review` | `6e9063a` | https://github.com/xn1664494-tech/ABMT-SHOP/compare/feature/T2-2-1-category-dependency-review...feature/T5-error-page-hardening?expand=1 |
| PR 6 | `feature/T4-1-2-trust-proxy-hardening` | `feature/T5-error-page-hardening` | `5527481` | https://github.com/xn1664494-tech/ABMT-SHOP/compare/feature/T5-error-page-hardening...feature/T4-1-2-trust-proxy-hardening?expand=1 |
| PR 7 | `docs/phase2-dev1-readme` | `feature/T4-1-2-trust-proxy-hardening` | `6e4c127`, `223a330` | https://github.com/xn1664494-tech/ABMT-SHOP/compare/feature/T4-1-2-trust-proxy-hardening...docs/phase2-dev1-readme?expand=1 |

Lưu ý khi dùng base tạm thời:
- Sau khi PR N được merge vào `feature/post-phase2-hardening`, retarget PR N+1 về `feature/post-phase2-hardening` và xác nhận diff chỉ còn commit của task N+1.
- Không merge PR N+1 trước khi PR N được merge và verify.
- Không squash merge.

---

## 9. Điều kiện dừng / cần approval

Đã hoàn tất phần read-only an toàn. **Không thực hiện merge.**

Cần Lead/reviewer quyết định:

1. Chọn phương án tích hợp do `origin/main` phân kỳ (mục 6).
2. Chấp thuận cách tạo PR (GitHub UI thủ công, hoặc cài/ủy quyền `gh`).
3. Xác nhận 2 file untracked (`FINAL_SECURITY_CLEANUP_REPORT.md`, `PHASE2_DEV1_BAO_CAO_2026-11-15.md`) có được commit hay không.
4. Xác nhận T2-2-1 vẫn giữ **BLOCKED** cho phần Dev 1 verification cho đến khi dependency được tích hợp và re-verify.

Sau khi có các quyết định trên mới chuyển sang Giai đoạn B (tạo PR) và Giai đoạn C (merge tuần tự).

---

# PHỤ LỤC A — PR DOSSIER, MERGE RUNBOOK VÀ RỦI RO PHÂN KỲ

> Phụ lục này bổ sung sau khi Lead xác nhận: giữ target `feature/post-phase2-hardening`, tạo PR thủ công qua GitHub UI, giữ nguyên 2 file untracked, chờ tích hợp P0 xong mới làm Phase D.
>
> **Trạng thái thực hiện:** tài liệu local, **chưa commit, chưa push** theo yêu cầu. Không merge, không release, không tạo commit nào.

## A.1. Cập nhật phân kỳ `origin/main` (tại thời điểm lập phụ lục)

`origin/main` = `3d33a23` — **11 commit** ngoài base `aa2f414`:

| Commit | Nội dung |
|---|---|
| `4605333` | Merge PR #5 (`feature/post-phase2-hardening` → main; chứa base `aa2f414`) |
| `2a0c2a2` | `GET /health` |
| `0c1fd18` | Merge PR #9 (health) |
| `94ed049` | T2-2-1 Category + chuẩn hóa Product schema |
| `bccae61` | Merge PR #10 (schema) |
| `52bb616` | Home service (MongoDB) |
| `4248234` | Merge PR #11 (home-service) |
| `828e46d` | HomeController dùng homeService, bỏ dữ liệu giả |
| `c287853` | Merge PR #12 (home-controller) |
| `12cefd9` | T2-2-1 Order + Cart + Review schema |
| `3d33a23` | Merge PR #13 (order-cart-review) |

Diff `aa2f414..origin/main`: 21 file, +2928/−191. Gồm `src/model/Category.js`, `src/model/Orders.js`-tương đương (`Order.js`, `Cart.js`, `Review.js`), `src/services/homeService.js`, `src/controllers/HomeController.js`, `src/utils/sku.js`, `src/utils/orderCode.js`, các test model/integration và tài liệu T2-2-1.

**Hệ quả:** rủi ro phân kỳ tăng so với báo cáo ban đầu. `main` vẫn đang thay đổi trong thời gian review PR, nên mọi kết luận về diff `main` chỉ có giá trị tại SHA kiểm tra.

## A.2. Danh sách 6 PR (base/head chính xác)

| PR | Title đề xuất | Base ban đầu | Head | Commit | Diff |
|---|---|---|---|---|---|
| 1 | `feat(auth): integrate RBAC authorize into real admin route (T4-1-1)` | `feature/post-phase2-hardening` | `feature/T4-1-1-rbac-route-integration` | `75c30db` | 4 file, +252/−1 |
| 2 | `feat(profile): add secure password change API (T4-1-3)` | `feature/T4-1-1-rbac-route-integration` → retarget sau PR1 | `feature/T4-1-3-change-password` | `e8e5af3` | 7 file, +346/−8 |
| 3 | — | — | — | — | **BỎ QUA** (T2-1-3 không có commit/remote branch) |
| 4 | `docs(category): add T2-2-1 Category dependency review` | `feature/T4-1-3-change-password` → retarget sau PR2 | `feature/T2-2-1-category-dependency-review` | `26b0ac9` | 1 file, +63 |
| 5 | `fix(errors): harden error handling and add HTML error page (T5)` | `feature/T2-2-1-category-dependency-review` → retarget sau PR4 | `feature/T5-error-page-hardening` | `6e9063a` | 4 file, +221/−5 |
| 6 | `chore(security): harden trust proxy configuration (T4-1-2)` | `feature/T5-error-page-hardening` → retarget sau PR5 | `feature/T4-1-2-trust-proxy-hardening` | `5527481` | 3 file, +142/−1 |
| 7 | `docs: add Phase 2 Dev 1 README and completion report` | `feature/T4-1-2-trust-proxy-hardening` → retarget sau PR6 | `docs/phase2-dev1-readme` | `6e4c127`, `223a330` | 2 file, +436 |

Lưu ý: `docs/phase2-dev1-git-preflight` (`5e03d4a`) **không nằm trong 6 PR trên**. Cần quyết định đưa vào PR7 (sau approval, tạo thêm commit docs) hoặc PR docs riêng.

## A.3. Compare URL từng PR

```
PR1:
https://github.com/xn1664494-tech/ABMT-SHOP/compare/feature/post-phase2-hardening...feature/T4-1-1-rbac-route-integration?expand=1

PR2:
https://github.com/xn1664494-tech/ABMT-SHOP/compare/feature/T4-1-1-rbac-route-integration...feature/T4-1-3-change-password?expand=1

PR4:
https://github.com/xn1664494-tech/ABMT-SHOP/compare/feature/T4-1-3-change-password...feature/T2-2-1-category-dependency-review?expand=1

PR5:
https://github.com/xn1664494-tech/ABMT-SHOP/compare/feature/T2-2-1-category-dependency-review...feature/T5-error-page-hardening?expand=1

PR6:
https://github.com/xn1664494-tech/ABMT-SHOP/compare/feature/T5-error-page-hardening...feature/T4-1-2-trust-proxy-hardening?expand=1

PR7:
https://github.com/xn1664494-tech/ABMT-SHOP/compare/feature/T4-1-2-trust-proxy-hardening...docs/phase2-dev1-readme?expand=1
```

Sau khi PR N được merge vào target, **retarget PR N+1** về `feature/post-phase2-hardening` trên GitHub UI. Khi đó diff phải chỉ còn commit của task N+1 (vì commit trước đã là ancestor của target). Không rebase, không force-push.

## A.4. Nội dung mô tả PR (copy-paste)

### PR 1 — T4-1-1 RBAC/IDOR

```
## Mục tiêu
Tích hợp authorize('admin') vào route thật thay vì chỉ test mini-app.

## Thay đổi
- Thêm GET /api/admin/access-check với authenticate + authorize('admin').
- Mount /admin trong src/routes/index.js.
- Quyền lấy từ User trong DB, không tin role từ body/header/JWT.
- Test RBAC/IDOR: 401/403/200, token giả role admin, user inactive/soft-deleted, tokenVersion lệch.
- Không thêm Admin CRUD ngoài scope.

## Test
- node --test test/auth.admin-route.test.js: 14 pass.
- npm test tại thời điểm branch: 86 pass (baseline hiện tại 107 pass/0 fail).

## Reviewer cần kiểm tra
- Không có đường nâng quyền qua request body/header.
- Route admin thực sự được mount và bảo vệ.
- Không phát sinh secret.
```

### PR 2 — T4-1-3 Change Password

```
## Mục tiêu
Bổ sung PATCH /api/profile/me/password đúng DoD T4-1-3.

## Thay đổi
- authenticate + csrfProtection + Zod validation.
- Xác minh currentPassword bằng bcrypt; hash newPassword.
- Tăng tokenVersion, xóa auth cookies.
- Không trả password/password hash trong response.
- Test: 10 pass + 96 regression tại thời điểm branch.

## Giới hạn đã biết
- HTTP test dùng fake model, chưa phải MongoDB thật. Integration MongoDB thật được theo dõi ở Phase D (V2).

## Reviewer cần kiểm tra
- Thiếu CSRF → 403; sai mật khẩu cũ → 401; token cũ bị từ chối.
- Không log/lộ credential.
```

### PR 4 — T2-2-1 Category dependency (docs-only)

```
## Mục tiêu
Ghi nhận dependency Category thuộc Dev 2 theo WBS T2-2-1 và đề xuất contract tối thiểu.

## Phạm vi
- Chỉ thêm docs/reports/T2-2-1_CATEGORY_DEPENDENCY_REVIEW.md.
- Không tạo/sửa src/model/Category.js, không sửa Products.js.

## Trạng thái
- T2-2-1 vẫn BLOCKED cho Dev 1 verification.
- Merge PR này KHÔNG có nghĩa T2-2-1 đã PASS.
- Ghi chú: Dev 2 đã merge Category/Product schema vào main qua PR #10; báo cáo phản ánh trạng thái trước thời điểm đó và cần được đối chiếu lại khi đồng bộ main.
```

### PR 5 — T5 Error hardening

```
## Mục tiêu
Chuẩn hóa 404/error response và không lộ stack/message nội bộ ở production.

## Thay đổi
- API /api/* trả JSON; request HTML render error.ejs.
- Production 500 trả message chung, không trả error.message/stack.
- Server log vẫn giữ thông tin debugging nhưng không log secret.
- Test: 8 error-handler + 104 regression tại thời điểm branch.

## Reviewer cần kiểm tra
- Không làm hỏng response API hiện tại.
- Không rò rỉ stack ở production.
```

### PR 6 — T4-1-2 Trust proxy

```
## Mục tiêu
Cấu hình trust proxy opt-in, không tin X-Forwarded-For tùy tiện.

## Thay đổi
- Đọc TRUST_PROXY từ env; mặc định không bật.
- Hỗ trợ số hop hoặc giá trị named của Express.
- Test: 3 trust-proxy + 107 regression tại thời điểm branch.

## Giới hạn đã biết
- Chưa xác minh trên staging thật (NOT VERIFIED). Không tuyên bố đã test production.
- Cần Lead xác nhận deployment target/hạ tầng trước khi đặt giá trị TRUST_PROXY.
```

### PR 7 — README + Completion report

```
## Mục tiêu
Tài liệu hóa cài đặt, env, MongoDB, JWT, CSRF, chạy server/test và API cơ bản; cập nhật completion report.

## Thay đổi
- README.md (170 dòng).
- docs/reports/PHASE2_DEV1_COMPLETION_REPORT.md (266 dòng).

## Lưu ý
- Không chứa credential/URI thật.
- Không tuyên bố T2-2-1 PASS; giữ BLOCKED.
- Jest vẫn ghi nhận chưa xanh.
- Preflight report hiện ở branch riêng, chưa nằm trong PR này.
```

## A.5. Thứ tự merge và gate bắt buộc

Thứ tự: **PR1 → PR2 → (bỏ PR3) → PR4 → PR5 → PR6 → PR7**. Merge tuần tự, không song song, không nhảy cóc, không squash.

Trước mỗi lần merge:

```bash
git fetch origin
git rev-parse origin/feature/post-phase2-hardening
git rev-parse origin/<head-branch>
git merge-base --is-ancestor <previous-commit> <head-commit>
git diff --name-only <previous-commit>..<head-commit>
```

- `git diff --name-only` phải khớp đúng danh sách file trong mục 2.4.
- Nếu GitHub hiển thị lặp thay đổi của task trước, retarget base về `feature/post-phase2-hardening` và kiểm tra lại; **không rebase/force-push**.

Sau mỗi lần merge (dùng merge commit, không squash):

```bash
git fetch origin
git merge-base --is-ancestor <expected-commit> origin/feature/post-phase2-hardening
git checkout feature/post-phase2-hardening
git pull --ff-only origin feature/post-phase2-hardening
npm test
npm run test:integration
```

- Integration test chỉ chạy trên DB test riêng `abmt_shop_test`.
- Nếu fail: **dừng**, không merge PR tiếp theo; tạo commit fix trên branch phù hợp. Không reset/rewrite history.
- Ghi lại số pass/fail thực tế sau từng merge; không dùng số liệu cũ.

## A.6. Rủi ro do `origin/main` đã có 11 commit mới

| # | Rủi ro | Mức độ | Xử lý đề xuất |
|---|---|---|---|
| R1 | `main` tiếp tục thay đổi trong lúc review (đã từ 5 → 11 commit) | Cao | Chốt SHA `main` tại thời điểm sync; lặp lại kiểm tra trước release |
| R2 | Conflict `package.json` ở cả `test` và `test:integration` (Dev 1 thêm test file, main thêm schema/integration test) | Cao | Resolve bằng **hợp nhất danh sách test**, không lấy một bên; chạy lại toàn bộ |
| R3 | `src/app.js` bị sửa bởi cả main (health route) và Dev 1 (trust proxy) | Trung bình | Auto-merge có thể ổn vì khác vùng; review thủ công thứ tự middleware |
| R4 | `src/routes/index.js` không đổi trên main, PR1 mount admin an toàn | Thấp | Sau sync kiểm tra lại route admin vẫn mount đúng |
| R5 | Sau sync, `npm test` chạy thêm model test; `npm run test:integration` chạy thêm `catalog` và `checkout` | Trung bình | Cần MongoDB test sẵn sàng; chạy lại và ghi nhận thời gian/kết quả |
| R6 | `src/model/Products.js`, `Category.js`, `Order.js`, `Cart.js`, `Review.js` chỉ có trên main | Trung bình | Không merge task branch vào main; phải sync main → feature branch trước release |
| R7 | README/completion report có thể lệch so với route/home-service mới sau sync | Thấp | Rà lại mô tả API, không mô tả chức năng chưa có |
| R8 | T2-2-1 Category đã có trên main nhưng chưa có trong chuỗi Dev 1 | Cao | Giữ BLOCKED cho Dev 1 verification đến khi sync; không tự đánh PASS |
| R9 | Release `feature/post-phase2-hardening` → `develop` → `main` sẽ cần một lần sync `main` → feature | Cao | Tạo branch sync riêng, merge `origin/main` vào, resolve conflict, PR vào feature branch; không rebase |
| R10 | GitHub UI có thể cảnh báo branch behind/conflict khi tạo PR | Thấp | PR vào feature branch vẫn hợp lệ; không merge `main` vào task branch |

## A.7. Điểm dừng hiện tại

- Không tạo PR (không có `gh`/token), không merge, không release, không push thêm commit.
- Chờ Lead review 6 PR dossier và xác nhận:
  1. Tạo PR theo đúng base/head/URL ở A.2–A.3.
  2. Thời điểm sync `main` → `feature/post-phase2-hardening`: trước PR1, sau PR7, hay trước release.
  3. Có đưa preflight report (`5e03d4a`) vào PR7 hay tạo PR docs riêng.
- Sau khi có PR URL thực tế, cập nhật lại báo cáo này và bắt đầu Giai đoạn C khi có approval từng PR.

---

# PHỤ LỤC B — SNAPSHOT CUỐI, ACCEPTANCE MATRIX, SYNC RUNBOOK, DECISION LOG

## B.1. Snapshot trạng thái tại thời điểm finalize (2026-11-17)

| Hạng mục | Giá trị |
|---|---|
| Branch làm việc | `docs/phase2-dev1-git-preflight` |
| HEAD | `5e03d4a8d802e39bfdf378790719872a9a355b14` (commit báo cáo trước đó) |
| Remote cùng branch | `origin/docs/phase2-dev1-git-preflight` = `5e03d4a8d802e39bfdf378790719872a9a355b14` |
| Working tree | 1 file modified: `docs/reports/PHASE2_DEV1_GIT_PREFLIGHT_REPORT.md`; 2 file untracked được bảo toàn |
| Integration target | `origin/feature/post-phase2-hardening` = `aa2f414a9d4e0b795af290ddc64e62e2e19c7227` |
| `origin/main` | `3d33a2370fa28df5734b5ea33c8f85a1e69145bf` (11 commit ngoài base) |
| Unit test (`npm test`) | **107 pass / 0 fail / 0 skip** |
| Integration (`npm run test:integration`, DB `abmt_shop_test`) | **12 pass / 0 fail / 0 skip** |
| Jest (`npm run test:jest`) | Không chạy lại trong bước finalize; lần gần nhất **7/7 fail** do lỗi driver, không phải assertion |

Không có branch nào lệch SHA giữa local và remote. Không có thay đổi lạ ngoài báo cáo và 2 file untracked được bảo toàn.

## B.2. Acceptance matrix theo từng PR

### PR1 — T4-1-1 RBAC/IDOR

- **WBS:** T4-1-1 (RBAC/IDOR).
- **Head/base:** `feature/T4-1-1-rbac-route-integration` ← `feature/post-phase2-hardening`.
- **Commit:** `75c30db7f727aa9741593f90a5ba214562b37cf2`.
- **File:** `src/routes/admin.route.js` (A), `src/routes/index.js` (M), `test/auth.admin-route.test.js` (A), `package.json` (M).
- **Test:** 14 admin-route + 86 regression tại thời điểm branch; baseline hiện tại 107 pass.
- **Điều kiện nghiệm thu:** route admin được mount thật; customer bị 403; admin hợp lệ 200; inactive/soft-deleted bị từ chối; không nâng quyền qua body/header/JWT; không có Admin CRUD ngoài scope; không có secret.
- **Dependency:** không.
- **Trạng thái:** PASS.

### PR2 — T4-1-3 Change Password

- **WBS:** T4-1-3 (Profile API, bao gồm "đổi mật khẩu").
- **Head/base:** `feature/T4-1-3-change-password` ← `feature/T4-1-1-rbac-route-integration`.
- **Commit:** `e8e5af354e228747b92da20a72d8b9c6d1482723`.
- **File:** `src/validators/authValidator.js`, `src/services/profileService.js`, `src/controllers/profileController.js`, `src/routes/profile.route.js`, `test/support/fakeUserModel.js`, `package.json` (M); `test/auth.change-password.test.js` (A).
- **Test:** 10 change-password + 96 regression tại thời điểm branch; **dùng fake model, chưa phải MongoDB thật**.
- **Điều kiện nghiệm thu:** 401 chưa đăng nhập; 403 thiếu/sai CSRF; 401 sai mật khẩu cũ; 400 mật khẩu mới không hợp lệ/trùng cũ/field ngoài scope; 200 thành công; bcrypt hash được lưu; `tokenVersion` tăng; cookie bị xóa; token cũ bị từ chối; response không lộ password/hash.
- **Dependency:** PR1 phải merge trước.
- **Trạng thái:** PASS (HTTP/fake model); **real MongoDB integration: NOT VERIFIED** (theo dõi ở Phase D — V2).

### PR4 — T2-2-1 Category Dependency Review (docs-only)

- **WBS:** T2-2-1 (schema User/Category/Product) — owner **Dev 2**.
- **Head/base:** `feature/T2-2-1-category-dependency-review` ← `feature/T4-1-3-change-password`.
- **Commit:** `26b0ac9c55d2604e517e6324016d0ca2f3dc4330`.
- **File:** `docs/reports/T2-2-1_CATEGORY_DEPENDENCY_REVIEW.md` (A).
- **Test:** không có (docs-only).
- **Điều kiện nghiệm thu:** xác nhận ownership Dev 2; không tạo/sửa Category/Products code; ghi rõ dependency và contract tham khảo; giữ trạng thái **BLOCKED**.
- **Dependency:** PR2 phải merge trước; Dev 2 phải cung cấp model + PR riêng.
- **Trạng thái:** **BLOCKED** cho Dev 1 verification. Merge PR này **không** làm T2-2-1 PASS. Lưu ý: Dev 2 đã merge Category/Product schema vào `main` (PR #10); cần sync và re-verify sau này.

### PR5 — T5 Error Hardening

- **WBS:** T5 (hardening error handling; liên quan T2-1-2 foundation).
- **Head/base:** `feature/T5-error-page-hardening` ← `feature/T2-2-1-category-dependency-review`.
- **Commit:** `6e9063a6f55d1eb85853abda801a56417935d465`.
- **File:** `src/middleware/errorHandler.js` (M), `src/views/error.ejs` (A), `test/error-handler.test.js` (A), `package.json` (M).
- **Test:** 8 error-handler + 104 regression tại thời điểm branch.
- **Điều kiện nghiệm thu:** 404 HTML/JSON đúng theo request; production 500 không trả `error.message`/stack; log server vẫn đủ debug; không đổi format lỗi 4xx API; không lộ secret trong log.
- **Dependency:** PR4 phải merge trước.
- **Trạng thái:** PASS.

### PR6 — T4-1-2 Trust Proxy Hardening

- **WBS:** T4-1-2 (Rate limit/CSRF + hardening proxy).
- **Head/base:** `feature/T4-1-2-trust-proxy-hardening` ← `feature/T5-error-page-hardening`.
- **Commit:** `55274810cdd2174a09b8046abd40f099f52d81ba`.
- **File:** `src/app.js` (M), `test/trust-proxy.test.js` (A), `package.json` (M).
- **Test:** 3 trust-proxy + 107 regression tại thời điểm branch.
- **Điều kiện nghiệm thu:** trust proxy mặc định tắt; chỉ bật khi có `TRUST_PROXY`; không tin `X-Forwarded-For` từ client trực tiếp; rate-limit key đúng khi tin 1 hop; không mở trust proxy rộng hơn cần thiết; memory store được ghi nhận là nợ kỹ thuật.
- **Dependency:** PR5 phải merge trước; giá trị `TRUST_PROXY` thực tế phụ thuộc quyết định deployment target (Lead/DevOps).
- **Trạng thái:** PASS về code/test; **staging verification: NOT VERIFIED**.

### PR7 — README + Completion Report

- **WBS:** T7 (tài liệu).
- **Head/base:** `docs/phase2-dev1-readme` ← `feature/T4-1-2-trust-proxy-hardening`.
- **Commit:** `6e4c12731064a039215d02e13003a15aa0e20445`, `223a3307af34bc234c1188b99709b684ab295dae`.
- **File:** `README.md` (A, 170 dòng), `docs/reports/PHASE2_DEV1_COMPLETION_REPORT.md` (A, 266 dòng).
- **Test:** 107 unit + 12 integration (tại thời điểm branch).
- **Điều kiện nghiệm thu:** hướng dẫn cài đặt/env/MongoDB/JWT/CSRF/chạy server/test/API khớp code; không có credential; không mô tả chức năng chưa có; completion report khớp test thực tế; T2-2-1 vẫn ghi BLOCKED; Jest ghi nhận chưa xanh.
- **Dependency:** PR6 phải merge trước.
- **Trạng thái:** PASS.

## B.3. Sync `origin/main` sau PR7 — runbook

Chỉ thực hiện sau khi **cả 6 PR đã merge**, người dùng xác nhận PR7 đã merge và cho phép bắt đầu sync. Không sync trong lúc PR đang review.

1. `git fetch origin`; ghi lại:
   - `M = git rev-parse origin/main`
   - `I = git rev-parse origin/feature/post-phase2-hardening`
2. Tạo branch sync riêng từ nhánh tích hợp:
   ```bash
   git switch -c chore/sync-main-into-post-phase2-hardening origin/feature/post-phase2-hardening
   ```
3. Merge `origin/main` bằng merge thường (không rebase, không force-push):
   ```bash
   git merge --no-ff origin/main
   ```
4. Nếu conflict, xử lý từng file; **không chọn nguyên một phía**:
   - `package.json`: hợp nhất toàn bộ scripts + dependencies của cả hai phía. Đặc biệt `test` và `test:integration` phải chứa **hợp** danh sách test của Dev 1 và Dev 2 (schema, catalog, checkout).
   - `package-lock.json`: chỉ regenerate bằng `npm install` sau khi đã review `package.json`; không copy thủ công.
   - `src/app.js`: giữ cả health route của main và trust proxy opt-in của Dev 1; kiểm tra thứ tự middleware.
   - `src/server.js`, `src/routes/index.js`: giữ route admin của Dev 1, route hiện có của main; không mất route nào.
   - `src/model/Products.js`, `src/model/Category.js`, `Order/Cart/Review`: lấy theo main (Dev 2), không sửa schema.
   - `HomeController.js`, `homeService.js`: lấy theo main.
   - `src/middleware/errorHandler.js`: giữ bản Dev 1 đã hardening.
   - `README.md`/docs: hợp nhất, rà lại mô tả API mới.
5. Chạy `npm install` chỉ khi `package.json`/lock thay đổi; ghi nhận thay đổi lock.
6. Chạy lại:
   ```bash
   npm test
   npm run test:integration   # chỉ trên abmt_shop_test
   ```
7. Push branch sync và tạo PR vào `feature/post-phase2-hardening`; chờ review/approval; merge; xác minh `M` là ancestor của nhánh tích hợp.
8. Cập nhật báo cáo completion/preflight với SHA sync và kết quả test thực tế.

**Không** merge `main` vào các branch task stacked; **không** rebase; **không** force-push. Nếu `main` tiếp tục tiến trong lúc sync, lặp lại bước 1 và đánh giá lại conflict.

## B.4. Decision log

| # | Quyết định | Trạng thái | Ghi chú |
|---|---|---|---|
| D1 | Giữ integration target `feature/post-phase2-hardening` | **Đã xác nhận (user)** | Không đổi target |
| D2 | Tạo 6 PR thủ công qua GitHub UI | **Đã xác nhận (user)** | Không cài `gh`, không tạo token |
| D3 | Giữ nguyên 2 file untracked | **Đã xác nhận (user)** | Không sửa/commit/xóa |
| D4 | Phase D chỉ sau khi tích hợp P0 xong | **Đã xác nhận (user)** | Không làm trước |
| D5 | Không squash merge | **Đã xác nhận (user)** | Giữ merge commit/FF |
| D6 | Giữ Jest hay chuyển `node:test` | **Chờ Lead** | Jest hiện fail do driver |
| D7 | Node.js LTS chuẩn của dự án | **Chờ Lead** | Hiện dùng v24.14.0 |
| D8 | Deployment target thực tế | **Chờ Lead/DevOps** | Ảnh hưởng `TRUST_PROXY` |
| D9 | Multi-instance / Redis rate limit | **Chờ Lead/DevOps** | Memory store hiện tại |
| D10 | Có release Dev 1 scope khi T2-2-1 BLOCKED | **Chờ Lead** | Không che giấu trạng thái |
| D11 | CI bắt buộc trước merge release | **Chờ Lead** | Chưa có workflow |
| D12 | `confirmPassword` cho API đổi mật khẩu | **Chờ Dev 3/4 + Lead** | Chưa thêm |
| D13 | Thời điểm sync `main` → feature branch | **Chờ Lead** | Đề xuất: sau PR7 |
| D14 | Vị trí preflight report | **Chờ Lead** | Hiện ở branch riêng, chưa trong PR7 |
| D15 | Rotate credential Atlas lịch sử | **Chờ chủ dự án** | Không in URI/password |

## B.5. Các hạng mục chưa xác minh

1. Jest xanh trong môi trường hiện tại (lỗi driver/mongoose).
2. Trust proxy sau reverse proxy/TLS termination thật (chưa có staging).
3. Integration MongoDB thật cho luồng đổi mật khẩu (hiện chỉ fake model).
4. Category/populate thật thuộc phạm vi Dev 1 sau khi sync main và re-verify.
5. Redis/distributed rate limit.
6. UI đổi mật khẩu (Dev 3/4).
7. CI gate và release approval.
8. Hành vi sau khi sync `main`: chưa chạy được vì PR chưa merge.

> Báo cáo này **không** tuyên bố Phase 2 hoàn tất. Trạng thái tổng: integration **chưa bắt đầu**, T2-2-1 **BLOCKED**, release **chưa được phép**.
