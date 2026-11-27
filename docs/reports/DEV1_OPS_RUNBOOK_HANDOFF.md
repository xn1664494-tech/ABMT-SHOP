# Dev 1 — Ops runbook / bàn giao cho Lead

Tài liệu này **không tự động chạy** gì. Các lệnh dưới đây cần môi trường, credential và phê duyệt của Lead. Không đọc/in `.env`, secret, Mongo URI thật, token hay password.

---

## 1. Job hủy đơn quá hạn (T6-1-3 / PR-5 + PR #106)

Script: `scripts/run-overdue-orders.js` — tự `connectDB()`/`disconnectDB()` khi chạy CLI thật.

```bash
# 1) Luôn chạy dry-run trước: chỉ đếm, không ghi DB
node scripts/run-overdue-orders.js --dry-run

# 2) Chạy thật (cần phê duyệt)
node scripts/run-overdue-orders.js

# Tuỳ chọn batch (mặc định 100)
node scripts/run-overdue-orders.js --batch=500
```

Điều kiện job chọn đơn (`overdueFilter`): `status: 'pending'`, `paymentStatus: 'unpaid'`, `expiresAt <= now`, `stockRestoredAt` null hoặc không tồn tại. CAS chặn race thanh toán; conflict là kết quả bình thường (`skipped`, không `failed`).

### Cron đề xuất

```cron
*/5 * * * * cd /path/to/ABMT-SHOP && node scripts/run-overdue-orders.js >> /var/log/abmt-overdue.log 2>&1
```

Ghi chú:

- Không dùng `setInterval` trong `app.js`.
- Mỗi lần chạy in một dòng `[overdue] che do=APPLY batch=... timThay=... daHuy=... boQua=... loi=...`.
- Từ PR #106, mỗi đơn hủy thành công phát thêm audit `system.order.expired`. Nếu ghi AuditLog lỗi, job vẫn đếm `cancelled` và in dòng log JSON `scope=audit` — cần monitor dòng này.
- Nên có alert khi `loi > 0` hoặc khi xuất hiện log `scope=audit`.

---

## 2. Migration `expiresAt` cho đơn cũ

Script: `scripts/migrate-order-expires-at.js`. **Mặc định dry-run**; chỉ ghi DB khi có `--apply`.

```bash
# DRY-RUN (mặc định) — xem số lượng dự kiến
node scripts/migrate-order-expires-at.js

# APPLY — chỉ sau khi Lead phê duyệt và đã backup/kiểm tra DB
node scripts/migrate-order-expires-at.js --apply
```

- Filter: `status: 'pending'`, `paymentStatus: 'unpaid'`, `expiresAt: null` hoặc không tồn tại.
- `expiresAt = createdAt + ORDER_PENDING_TTL_MINUTES * 60_000` (mặc định 30 phút).
- Đơn thiếu `createdAt` bị `skipped`, không tự đoán.
- Idempotent: chạy lại `--apply` không đổi đơn đã có `expiresAt`.
- Không tự chạy lúc khởi động server; không chạy `--apply` trong CI hay máy local.

**Thứ tự đề xuất:** dry-run migration → phê duyệt/backup → `--apply` → dry-run job → bật cron.

---

## 3. Rate limit dùng chung (T7-1-3 — chưa làm)

Hiện tại `src/middleware/rateLimiters.js` dùng `MemoryStore` mặc định của `express-rate-limit`:

- `AUTH_RATE_LIMIT_WINDOW_MS` (mặc định `900000` = 15 phút), `AUTH_RATE_LIMIT_MAX` (mặc định `20`).
- Bộ đếm chỉ có hiệu lực **trong một process**; restart hoặc multi-instance làm mất giới hạn.
- `src/routes/address.route.js` cũng có limiter riêng: 120 request / 60 giây, cùng dạng MemoryStore.

Việc cần làm khi deploy multi-instance:

1. Chọn store dùng chung (Redis hoặc Mongo) cho `authLimiter` và cân nhắc `addressLimiter`.
2. **Xin Lead phê duyệt thêm dependency** trước khi thêm package (ví dụ adapter Redis). PR này không thêm package.
3. Giữ nguyên response 429 format hiện tại (`success: false`, error tiếng Việt) và các biến window/limit.
4. Test lại `test/auth.rate-limit.test.js` + integration rate-limit sau khi đổi store.

---

## 4. Audit fail-open (PR #106) — vận hành

- Không trả 500 cho client vì lỗi ghi audit; mutation vẫn thành công.
- Log lỗi audit là JSON một dòng qua `console.error`, có `scope: "audit"`, kèm `action`, `targetType`, `targetId`, `actorId`, `actorRole`, `message`. Không chứa `before/after`.
- Chưa có outbox/retry: nếu audit storage downtime lâu, event có thể mất vĩnh viễn. Cần đưa outbox/retry vào backlog riêng theo yêu cầu compliance của Lead.
- Các action hiện có: `admin.user.role.changed`, `admin.order.status.changed`, `system.order.expired`.

---

## 5. Trạng thái bàn giao

- Code/CI: `main` xanh sau PR #105; PR #106 bổ sung audit hardening (xem `PR106_AUDIT_HARDENING.md`).
- Không tự chạy DB thật, migration `--apply`, hoặc đổi hạ tầng tại máy.
- Các quyết định còn chờ Lead: outbox/retry audit, execution cron thật, migration apply, shared rate-limit store.
