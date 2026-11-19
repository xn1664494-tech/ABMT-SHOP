# PHASE 2 DEV 1 — PR6 PREFLIGHT REPORT

- **Task ID:** Trust proxy hardening (**hardening ngoài WBS Phase 2**; WBS `T4-1-2` = rate limit + CSRF, đã có trên target)
- **Branch:** `feature/T4-1-2-trust-proxy-hardening`
- **Head commit:** `55274810cdd2174a09b8046abd40f099f52d81ba` (`chore(security): harden trust proxy configuration`)
- **Base đề xuất:** `feature/post-phase2-hardening` (sau khi PR4 + PR5 merge)
- **Ngày preflight:** 2026-11-18
- **Loại:** read-only; test chạy trong worktree tạm `%TEMP%\abmt_wt_pr6`.

---

## 1. Điều kiện tiên quyết

| Điều kiện | Kết quả |
|---|---|
| PR4 merge | ❌ chưa |
| PR5 merge | ❌ chưa |
| Branch PR6 tồn tại | ✅ `5527481` (local = remote) |
| PR6 tồn tại | ❌ chưa có PR |
| CI | ❌ không có |

Diff so với target hiện gồm cả PR4 (docs) + PR5 (error handling) → **phải merge theo thứ tự PR4 → PR5 → PR6**.

---

## 2. Diff riêng của PR6

```text
M  src/app.js
A  test/trust-proxy.test.js
```

| Kiểm tra | Kết quả |
|---|---|
| Chỉ 2 file thuộc phạm vi trust proxy | ✅ |
| Không đụng route/controller/service | ✅ |
| Không đụng code Dev 2 | ✅ |
| Có secret | ❌ không |

---

## 3. Kiểm tra implementation (`src/app.js`)

```js
const configureTrustProxy = (expressApp) => {
  const raw = process.env.TRUST_PROXY;
  if (raw === undefined || raw === null || raw === '') return;      // mặc định: TẮT
  const normalized = String(raw).trim();
  if (normalized === '' || normalized === '0' || normalized.toLowerCase() === 'false') return;
  const numeric = Number(normalized);
  expressApp.set('trust proxy', Number.isInteger(numeric) ? numeric : normalized);
};
configureTrustProxy(app);
```

| Yêu cầu | Kết quả |
|---|---|
| Opt-in (không bật mặc định) | ✅ |
| Không trust-all mặc định | ✅ không có `true`/`app.enable('trust proxy')` không điều kiện |
| Chỉ nhận số hop hoặc giá trị Express hợp lệ | ✅ số nguyên → number; khác → string cho Express tự xử lý |
| `TRUST_PROXY=0/false` → tắt | ✅ |
| Không ảnh hưởng `req.ip` khi không bật | ✅ có test |
| Không phá `/health` | ⚠️ **`/health` chưa tồn tại trên target** (chỉ có sau sync `main`) → chưa kiểm chứng được, ghi NOT VERIFIED |
| Secure cookie behavior | ⚠️ `cookie.secure` lấy từ `NODE_ENV === 'production'`; khi bật trust proxy sau proxy HTTPS, Express tin `X-Forwarded-Proto` — **chưa verify trên proxy thật** (V3) |

**Rủi ro cần biết (không chặn merge):** đặt `TRUST_PROXY=true` (chuỗi) → `Number.isInteger(NaN)=false` → `set('trust proxy', 'true')`; Express coi đây là danh sách subnet, giá trị `"true"` không phải IP → hành vi không xác định. README/PR description nên ghi rõ **chỉ dùng số hop** (vd `1`) hoặc subnet.

---

## 4. Test đã chạy (worktree PR6)

| Lệnh | Kết quả |
|---|---|
| `npm test` | **107 pass / 0 fail / 0 skip** (104 của PR5 + 3 mới) |
| `node --test test/trust-proxy.test.js` | **3 pass / 0 fail** |

3 test bao phủ:

1. Không tin proxy → `X-Forwarded-For` **không** làm đổi `req.ip` / rate-limit key
2. Tin đúng 1 hop → `req.ip` và rate-limit key lấy từ client IP forward
3. Auth rate limit trên app thật vẫn hoạt động

---

## 5. Security checks

| Kiểm tra | Kết quả |
|---|---|
| Mặc định không tin `X-Forwarded-For` | ✅ (test 1) |
| Không trust-all | ✅ |
| Không log/không lộ env | ✅ |
| Ảnh hưởng rate limit | ✅ có test riêng |

---

## 6. Known limitations

| # | Hạn chế |
|---|---|
| L1 | Chưa merge (phụ thuộc PR4, PR5) |
| L2 | **Staging: NOT VERIFIED** — không có môi trường thật để kiểm tra proxy chain, `X-Forwarded-Proto`, secure cookie |
| L3 | `/health` chưa có trên target → chưa kiểm tra được endpoint sau trust proxy |
| L4 | Không có CI/review approval (DoD #4) |
| L5 | Trust proxy không có dòng WBS Phase 2 → không tính % Phase 2 |

### 6.1. Checklist staging (người dùng thực hiện khi có môi trường)

1. Deploy với `TRUST_PROXY=1` sau reverse proxy.
2. Gửi request qua proxy với `X-Forwarded-For: 203.0.113.7` → log `req.ip` phải là `203.0.113.7`.
3. Gửi **trực tiếp** (không qua proxy) kèm `X-Forwarded-For` giả → `req.ip` phải là IP kết nối, **không** phải header.
4. Kiểm tra `Set-Cookie` có `Secure` khi `NODE_ENV=production` qua HTTPS.
5. Kiểm tra rate limit 429 dựa trên client IP thật, không phải IP proxy.
6. Kiểm tra `/health` trả 200 sau khi sync `main`.

---

## 7. PR đề xuất

- **Compare URL:** `https://github.com/xn1664494-tech/ABMT-SHOP/compare/feature/post-phase2-hardening...feature/T4-1-2-trust-proxy-hardening?expand=1`
- **Title:** `chore(security): harden trust proxy configuration`
- **Description (đề xuất):**

```markdown
## Mục tiêu
Trust proxy opt-in, không bật mặc định, không trust-all.
Chỉ cấu hình qua TRUST_PROXY (số hop hoặc giá trị Express hợp lệ).

## Phạm vi
- src/app.js (configureTrustProxy)
- test/trust-proxy.test.js (mới, 3 test)

## Bằng chứng
- `npm test` → 107/107 pass
- `node --test test/trust-proxy.test.js` → 3/3 pass
- Diff riêng: 2 file, không đụng route/controller/service

## Giới hạn
- Staging: NOT VERIFIED (chưa có môi trường)
- Chỉ nên đặt TRUST_PROXY là số hop (vd 1), không dùng "true"

## Checklist reviewer
- [ ] Mặc định không tin X-Forwarded-For
- [ ] Không có trust-all
- [ ] Rate limit không bị ảnh hưởng khi tắt trust proxy
- [ ] Không có secret trong diff
```

---

## 8. Kết luận

| Hạng mục | Trạng thái |
|---|---|
| Implementation đúng yêu cầu | **PASS** |
| Test trên branch | **PASS** (107/107, 3/3) |
| Staging verification | **NOT VERIFIED** |
| Tích hợp | **BLOCKED** (chờ PR4, PR5) |

**Trạng thái tổng:** **READY — chờ PR4 + PR5 merge và người dùng tạo PR.**
