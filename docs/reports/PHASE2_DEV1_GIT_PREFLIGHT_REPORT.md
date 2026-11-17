# PHASE 2 DEV 1 — GIT PREFLIGHT REPORT

- **Ngày:** 2026-11-17
- **Branch thực hiện báo cáo:** `docs/phase2-dev1-git-preflight` (tạo từ `223a3307af34bc234c1188b99709b684ab295dae`)
- **Phạm vi:** Giai đoạn A — read-only preflight trước khi tạo PR / tích hợp stacked branches.
- **Nguyên tắc:** Không merge, không push vào `main`/`develop`, không force-push, không reset/clean/rebase, không sửa file untracked có sẵn.

> Báo cáo này chỉ ghi nhận trạng thái quan sát được. Không có thay đổi lịch sử Git nào được thực hiện trong quá trình kiểm tra.

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

Đã quét toàn bộ commit trong `aa2f414..HEAD` với các mẫu: MongoDB URI có credential, `mongodb+srv://` thực, `JWT_SECRET=<giá trị>`, private key, AWS access key.

Kết quả:

- Không phát hiện MongoDB URI/password thật, JWT secret thật, private key hay AWS key.
- Chỉ có placeholder dạng `mongodb+srv://<...>` trong:
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
