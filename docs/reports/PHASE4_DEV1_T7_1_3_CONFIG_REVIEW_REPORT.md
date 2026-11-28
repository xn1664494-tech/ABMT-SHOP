# T7-1-3 — Rà soát cấu hình — Báo cáo hoàn tất (Dev 1, Phase 4)

| Mục | Giá trị |
|---|---|
| Mã công việc | `T7-1-3` / `4.7.03` |
| Tên WBS | Rà soát cấu hình |
| Người làm | Dev 1 (Leader & Lead Backend Core) |
| Worktree | `D:\ABMT_Shop\ABMT-SHOP-PHASE4-T7-1-3` |
| Branch | `feature/phase4-dev1-t7-1-3-config-review` |
| Base | `origin/main` = `9544e76b614bfd5923a969d5633e0424f6b432c6` (sau #109, #112, #113, #114) |
| Dependency | `T6-1-3` — đã DONE |

---

## 1. WBS và mức độ đáp ứng

| Yêu cầu WBS | Trạng thái | Bằng chứng |
|---|---|---|
| Rà soát rate limit | Xong | Checklist §1 — authLimiter, addressLimiter, MemoryStore limitation |
| Rà soát kích thước body | Xong + sửa 2 điểm | Checklist §2 — limit tường minh, 413 thay 500 |
| Rà soát cờ cookie | Xong | Checklist §3 — 4 cookie, ngoại lệ CSRF được ghi nhận |
| Viết checklist bảo mật cho báo cáo | Xong | `PHASE4_DEV1_T7_1_3_CONFIG_REVIEW_CHECKLIST.md` |
| Deliverable "mã nguồn + checklist" | Xong | 2 file mã nguồn + 1 file test + 2 file docs |
| Nghiệm thu "Checklist trong báo cáo" | Đạt | §6 của báo cáo này dẫn tới checklist đầy đủ |

---

## 2. Quyết định chốt

1. **Rate limit store:** giữ MemoryStore mặc định, **ghi rõ limitation** thay vì thêm Redis/Mongo. Lý do: WBS yêu cầu *rà soát*, không yêu cầu triển khai store phân tán; đổi store cần dependency/hạ tầng và phê duyệt riêng. Không tự mở rộng phạm vi.
2. **Kích thước body:** khai báo tường minh **100kb** — đúng default hiện tại của body-parser. Không đổi ngưỡng, không đổi contract; chỉ làm cho cấu hình nhìn thấy được và test được.
3. **Lỗi vượt ngưỡng:** sửa 500 → **413** (`entity.too.large`). Đây là lỗi xử lý sai status, không phải đổi expected result hay đổi business logic.
4. **Cờ cookie:** giữ nguyên; riêng `csrfToken` không `HttpOnly` là thiết kế có chủ đích (frontend phải đọc để gửi `x-csrf-token`), đã ghi nhận cùng biện pháp bù trừ (`SameSite=Strict` + origin allowlist).

---

## 3. Thay đổi mã nguồn

| File | Thay đổi |
|---|---|
| `src/app.js` | Thay `express.json()` / `express.urlencoded({ extended: true })` bằng `BODY_LIMIT = '100kb'` tường minh cho cả hai parser. |
| `src/middleware/errorHandler.js` | Thêm nhánh map `err.type === 'entity.too.large' \|\| err.status === 413` → `ErrorResponse('Payload too large', 413)`. Không sửa nhánh 500 production, không lộ message/stack. |
| `test/config-review.test.js` **(mới)** | 7 test: JSON >100kb → 413; form >100kb → 413; body nhỏ vẫn 400 (không 413 nhầm); cờ HttpOnly/SameSite/Secure/path của access+refresh; Secure bật/tắt theo NODE_ENV; cookie CSRF qua HTTP; quét mã nguồn xác nhận cấu hình. |
| `package.json` | Thêm `test/config-review.test.js` vào `npm test`. **Không đổi dependency hay phiên bản.** |
| `docs/reports/PHASE4_DEV1_T7_1_3_CONFIG_REVIEW_CHECKLIST.md` **(mới)** | Checklist rà soát. |
| `docs/reports/PHASE4_DEV1_T7_1_3_CONFIG_REVIEW_REPORT.md` **(mới)** | Báo cáo này. |

---

## 4. Kết quả kiểm thử (local)

| Lệnh | Kết quả |
|---|---|
| `node --test test/config-review.test.js` (targeted) | **7/7 pass**, 0 fail |
| `npm test` | **378 tests — 372 pass, 0 fail, 6 skip** (6 skip cũ) |
| `npm run test:integration` | **60/60 pass**, 0 fail — trong đó có `IT-RATE-LIMIT: vuot nguong login tra 429` |
| `npm run test:jest` | **4 suites / 11 tests pass**, 0 fail |
| `npm run test:postman` | **264/264 assertions pass**, 0 yêu cầu thất bại |

Không assertion nào bị xóa, không test nào bị skip để đạt kết quả, không đổi expected result.

---

## 5. Giới hạn phạm vi

- Không thêm dependency, không đổi `package-lock.json`.
- Không đổi schema/DB, không migration, không cron, không deployment, không secret/`.env`/Mongo URI thật.
- Không đổi API contract (100kb là default cũ; chỉ sửa status sai 500→413).
- Không đụng worktree `main` hay các worktree khác; không stash, `add .`, `add -A`, cherry-pick, rebase, force push, reset, clean, xóa branch.
- Không push trực tiếp lên `main`; không bắt đầu task khác ngoài T7-1-3.

---

## 6. Checklist bảo mật

Xem **`docs/reports/PHASE4_DEV1_T7_1_3_CONFIG_REVIEW_CHECKLIST.md`** — đầy đủ 4 nhóm (rate limit, body, cookie, cấu hình kế thừa) + bảng trạng thái 7 hạng mục, trong đó 2 limitation/ngoại lệ đều có lý do chấp nhận rõ ràng.

---

## 7. PR, CI và merge

| Mục | Giá trị |
|---|---|
| PR | [#115](https://github.com/xn1664494-tech/ABMT-SHOP/pull/115) — `feature/phase4-dev1-t7-1-3-config-review` → `main` |
| Base trước merge | `9544e76b614bfd5923a969d5633e0424f6b432c6` |
| Head PR | `aaa75f5616472ae9d6d3ce931490ab334142835f` |
| CI PR | [run 46092080940](https://github.com/xn1664494-tech/ABMT-SHOP/actions/runs/46092080940) — **pass**, mọi step xanh |
| Phê duyệt | Người dùng giao toàn quyền thực hiện + merge sau khi CI xanh |
| Merge commit trên `main` | `d9324fcbfc461f12514a297a5c8ef94a680efbd8` (2026-11-28T01:18:11Z) |
| CI `main` sau merge | [run 46092416644](https://github.com/xn1664494-tech/ABMT-SHOP/actions/runs/46092416644) — **pass**, mọi step xanh |

Annotation duy nhất trên cả hai run: Node.js 20 deprecated trên runner (`actions/checkout@v4`, `actions/setup-node@v4` chạy bằng Node.js 24) — không chặn.

Phần cập nhật §7 này được thực hiện qua docs PR riêng từ `origin/main` = `d9324fc`, không push trực tiếp lên `main`.
