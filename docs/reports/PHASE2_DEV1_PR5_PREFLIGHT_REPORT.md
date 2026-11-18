# PHASE 2 DEV 1 — PR5 PREFLIGHT REPORT

- **Task ID:** T5 (hardening error handling — **ngoài WBS Phase 2**, xem `PHASE2_DEV1_WBS_SCOPE_MAPPING.md` §2.5)
- **Branch:** `feature/T5-error-page-hardening`
- **Head commit:** `6e9063a6f55d1eb85853abda801a56417935d465` (`fix(errors): harden error handling and add HTML error page`)
- **Base đề xuất:** `feature/post-phase2-hardening` @ `b4be920e6112ff41b241d2a3feca919dd30476a4`
- **Ngày preflight:** 2026-11-18
- **Loại:** read-only. Test chạy trong **git worktree tạm** (`%TEMP%\abmt_wt_pr5`), không đụng working tree chính, không commit, không push.

---

## 1. Điều kiện tiên quyết

| Điều kiện | Kết quả |
|---|---|
| PR2 đã merge | ✅ `e8e5af3` ∈ target `b4be920` |
| PR4 đã merge | ❌ **chưa** — PR4 chưa được tạo |
| Branch PR5 tồn tại | ✅ remote = local = `6e9063a` |
| PR5 đã tồn tại | ❌ chưa có PR |
| CI | ❌ không có CI |

> **Lưu ý phụ thuộc:** vì PR4 chưa merge, diff của PR5 so với target hiện **bao gồm commit docs PR4** (`26b0ac9`). Khi merge phải theo đúng thứ tự PR4 → PR5.

---

## 2. Diff so với target (`b4be920`)

```text
A  docs/reports/T2-2-1_CATEGORY_DEPENDENCY_REVIEW.md      <- của PR4 (chưa merge)
M  package.json
M  src/middleware/errorHandler.js
A  src/views/error.ejs
A  test/error-handler.test.js
```

Diff **thuần PR5** (bỏ phần PR4): 4 file = `package.json` (+1/−1: thêm test vào script), `errorHandler.js`, `error.ejs` (mới), `test/error-handler.test.js` (mới).

| Kiểm tra | Kết quả |
|---|---|
| Chỉ file thuộc T5 | ✅ |
| Có sửa code Dev 2 | ❌ không |
| Có sửa auth/RBAC/CSRF ngoài phạm vi | ❌ không |
| Có secret trong diff | ❌ không |

---

## 3. Kiểm tra implementation

`src/middleware/errorHandler.js` (đọc toàn bộ):

| Yêu cầu | Kết quả |
|---|---|
| API (`/api/*`) trả JSON thống nhất | ✅ `{ success: false, error }` |
| HTML route render trang lỗi | ✅ `res.render('error', { title, statusCode, message })` |
| Production 500 không lộ `message` | ✅ `GENERIC_SERVER_ERROR` khi `NODE_ENV=production && status >= 500` |
| Không lộ stack | ✅ stack chỉ `console.error` ở non-production |
| Production log tối thiểu | ✅ chỉ `[ERROR status] METHOD URL` |
| Map lỗi Mongoose/JWT/JSON | ✅ CastError→404, 11000→409, ValidationError→400, JWT→401, SyntaxError→400 |
| `details` chỉ trả cho non-5xx | ✅ |
| `headersSent` → `next(err)` | ✅ |
| Trang lỗi không lộ thông tin nội bộ | ✅ chỉ hiển thị `statusCode` + message đã lọc |

`src/views/error.ejs`: HTML tĩnh, include header/footer, có nút về trang chủ, không render stack/`err`.

**Quan sát nhỏ (không chặn):**
- Phân loại API dựa vào `req.originalUrl.startsWith('/api')` → một route `/apixyz` sẽ bị coi là API. Không ảnh hưởng route hiện có.
- Chuỗi `GENERIC_SERVER_ERROR` hiển thị mojibake trong console Windows nhưng nội dung file là UTF-8 (test không phụ thuộc chuỗi này).

---

## 4. Test đã chạy (worktree PR5, Node v24.14.0)

| Lệnh | Kết quả |
|---|---|
| `npm test` | **104 pass / 0 fail / 0 skip** (96 cũ + 8 mới) |
| `node --test test/error-handler.test.js` | **8 pass / 0 fail** |

8 test bao phủ đúng các nhánh yêu cầu:

1. HTML 404 → error page
2. API 404 → JSON
3. validation 400 → JSON
4. 401 → JSON
5. 403 → JSON
6. 409 → JSON
7. **500 production API không lộ `error.message`/stack**
8. **500 production HTML không lộ `error.message`/stack**

---

## 5. Security checks

| Kiểm tra | Kết quả |
|---|---|
| 500 production API lộ message | ✅ không (có test) |
| 500 production HTML lộ stack | ✅ không (có test) |
| Log production chứa message/stack | ✅ không |
| Log chứa password/token/cookie/URI | ✅ không |
| Thay đổi ngoài scope | ✅ không |

---

## 6. Known limitations

| # | Hạn chế |
|---|---|
| L1 | Chưa merge (phụ thuộc PR4) |
| L2 | Chưa verify trên staging thật (V3 NOT VERIFIED) |
| L3 | Không có review approval / CI (DoD #4) |
| L4 | T5 **không có trong WBS**; không dùng để tính % Phase 2 |

---

## 7. PR đề xuất

- **Compare URL:** `https://github.com/xn1664494-tech/ABMT-SHOP/compare/feature/post-phase2-hardening...feature/T5-error-page-hardening?expand=1`
- **Title:** `fix(errors): harden error handling and add HTML error page`
- **Description (đề xuất):**

```markdown
## Mục tiêu
Gia cố xử lý lỗi (T5, hardening ngoài WBS Phase 2):
- API /api/* luôn JSON thống nhất; HTML route render trang lỗi thân thiện
- Production 500 KHÔNG lộ error.message / stack trace
- Log production tối thiểu, không log secret

## Phạm vi
- src/middleware/errorHandler.js
- src/views/error.ejs (mới)
- test/error-handler.test.js (mới, 8 test)
- package.json (thêm test file vào script test)

## Bằng chứng
- `npm test` → 104/104 pass
- `node --test test/error-handler.test.js` → 8/8 pass
- Diff so với target: 4 file, không đụng code Dev 2

## Checklist reviewer
- [ ] 500 production API không trả message/stack
- [ ] 500 production HTML không render stack
- [ ] 404/400/401/403/409 giữ nguyên hành vi
- [ ] Không có secret trong diff
```

---

## 8. Kết luận

| Hạng mục | Trạng thái |
|---|---|
| Docs/code đúng scope | **PASS** |
| Test trên branch | **PASS** (104/104, 8/8) |
| Security behavior | **PASS** |
| Tích hợp | **BLOCKED** (chờ PR4 merge + người dùng tạo/merge PR) |
| Staging | **NOT VERIFIED** |

**Trạng thái tổng:** **READY — chờ PR4 merge và người dùng tạo PR.**
