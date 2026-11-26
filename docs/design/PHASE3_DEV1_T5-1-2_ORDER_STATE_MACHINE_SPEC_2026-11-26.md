# T5-1-2 — ORDER STATE MACHINE SPEC (DESIGN ONLY)

> **Trạng thái: ĐỀ XUẤT / CHỜ DEV 2 CHỐT.** Tài liệu này là contract thiết kế, **không phải implementation**. Không tạo file code, không sửa `Order.js`, không chạy test DB, không merge.

| Item | Giá trị |
|---|---|
| Ngày | 2026-11-26 |
| Snapshot đối chiếu | `main` @ `67be29ab8dc1c478039c644c02cc8d38aaf8268e` |
| Audit gốc | `4503220` (xem `docs/reports/PHASE3_DEV1_READINESS_AUDIT_AFTER_MAIN_PULL_2026-11-26.md`) |
| Owner WBS | Dev 1 (reviewer: Dev 2) |
| Dependency WBS | T5-1-1 → T5-1-2 → T6-1-1 → T6-1-3 |
| File dự kiến (mới) | `src/services/orderStateMachine.js`, `test/order.state-machine.test.js` |
| File hiện có bị ảnh hưởng | `src/model/Order.js` (chỉ nếu bổ sung marker/idempotency — cần Dev 2 duyệt) |

---

## 1. Baseline đã verify trên `main` @ `67be29a`

- `src/model/Order.js:4-10` — enum: `pending, confirmed, shipping, delivered, cancelled`.
- `src/model/Order.js:12-18` — flow khai báo:
  - `pending → [confirmed, cancelled]`
  - `confirmed → [shipping, cancelled]`
  - `shipping → [delivered]`
  - `delivered → []`, `cancelled → []` (terminal)
- `src/model/Order.js:133-152` — `statusHistorySchema`: `{ status, at, by(User ref), note }`.
- `src/model/Order.js:315-316` — `orderSchema.statics.canTransition = (from, to) => (ORDER_STATUS_FLOW[from] || []).includes(to)`.
- `test/order.model.test.js:202-209` — chỉ test static `canTransition`.
- **Chưa có** `assertTransition`, service state machine, hook `pre('save'|'updateOne'|'findOneAndUpdate')`, hay caller nào gọi `canTransition` trong `src/**`.
- `src/routes/order.route.js` chỉ có `POST /`, `GET /`, `GET /:id`; chưa có route đổi status/hủy đơn.
- `Order` **không có `expiresAt`** (chỉ `Cart` có TTL guest).

Kết luận: model đã có primitives, nhưng **enforcement runtime = 0**. Service thiết kế dưới đây là phần còn thiếu.

---

## 2. Mục tiêu / không làm

**Mục tiêu**
1. Mọi thay đổi `Order.status` đều đi qua một chốt kiểm tra hợp lệ.
2. Chặn chuyển lùi và chuyển từ trạng thái terminal.
3. Mỗi transition thành công append đúng một entry `statusHistory` kèm actor.
4. An toàn khi hai request cùng đổi một đơn (CAS theo `status` cũ).

**Không làm (design-only)**
- Không tự động ghi DB trong service; quyền ghi thuộc caller/route để caller dùng transaction/CAS.
- Không định nghĩa endpoint mới ở tài liệu này (thuộc T6-1-1).
- Không định nghĩa TTL/job (thuộc T6-1-3).
- Không sửa `ORDER_STATUS_FLOW` trừ khi Dev 2 yêu cầu.

---

## 3. Contract đề xuất

Module mới: `src/services/orderStateMachine.js` (chưa tồn tại).

```text
canTransition(from, to) -> boolean
  // tái dùng Order.ORDER_STATUS_FLOW, giữ nguyên hành vi static hiện tại

assertTransition({ from, to, actorRole, actorId, isOwner }) -> void | throws OrderStateError
  // actorRole: 'customer' | 'admin' | 'system'
  // isOwner: chỉ có ý nghĩa với actorRole === 'customer'
  // Không đụng DB. Throw khi sai flow, sai role, hoặc trạng thái terminal.

buildStatusHistoryEntry({ to, actorId, note }) -> { status, at, by, note }
  // at = new Date().toISOString(); by = actorId ('system' cho scheduler)

createStatusUpdate({ from, to, actorRole, actorId, isOwner, note }) -> {
  filter: { _id: <orderId>, status: from },
  update: { $set: { status: to }, $push: { statusHistory: <entry> } }
}
  // Trả filter/update để caller dùng findOneAndUpdate; không tự execute.
```

**Nguyên tắc:** service trả về **filter + update**, route/service gọi thực thi bằng CAS:

```text
Order.findOneAndUpdate(filter, update, { new: true, runValidators: true })
modifiedCount === 0 -> 409 ORDER_STATUS_CONFLICT
```

Không được phép ghi `order.status = to` rồi `save()` ở bất kỳ nơi nào ngoài chốt này.

---

## 4. Ma trận transition đề xuất

| Từ → Đến | `customer` (owner) | `admin` | `system` (scheduler) | Ghi chú |
|---|---|---|---|---|
| `pending → confirmed` | ❌ | ✅ | ⏳ OPEN | Xác nhận đơn; Dev 2 chốt có cho `system` không |
| `pending → cancelled` | ✅ | ✅ | ✅ | Khách tự hủy / admin hủy / job quá hạn (T6-1-3) |
| `confirmed → shipping` | ❌ | ✅ | ❌ | Chỉ admin |
| `confirmed → cancelled` | ⏳ OPEN | ✅ | ❌ | WBS ghi "hủy ở 2 trạng thái đầu" → cần chốt khách có được hủy ở `confirmed` không |
| `shipping → delivered` | ❌ | ✅ | ❌ | Không cho system tự giao |
| `delivered → *` | ❌ | ❌ | ❌ | Terminal |
| `cancelled → *` | ❌ | ❌ | ❌ | Terminal |
| Bất kỳ chuyển lùi | ❌ | ❌ | ❌ | `canTransition` trả `false` |

Mọi ô ❌ phải trả lỗi có `code` ổn định (xem mục 5), không chỉ trả `false` im lặng.

---

## 5. Error contract

| `code` | HTTP | Ý nghĩa |
|---|---|---|
| `ORDER_INVALID_TRANSITION` | 409 | Không nằm trong `ORDER_STATUS_FLOW` (kể cả chuyển lùi/terminal) |
| `ORDER_FORBIDDEN_ROLE` | 403 | Role không được phép thực hiện transition này |
| `ORDER_NOT_OWNER` | 403 | `customer` nhưng `isOwner === false` (tránh IDOR) |
| `ORDER_STATUS_CONFLICT` | 409 | CAS thất bại: đơn đã bị đổi status bởi request/job khác |
| `ORDER_VALIDATION_ERROR` | 422 | `to` không nằm trong `ORDER_STATUSES` |

Response shape nhất quán: `{ success: false, error: { code, message, details? } }`.

---

## 6. `statusHistory` contract

- Entry mới: `{ status: to, at: <ISO UTC>, by: <actorId|'system'>, note: <string|undefined> }`.
- `by` hiện tại là `User ref` trong schema; cần Dev 2 chốt một trong hai:
  1. đổi `by` sang `Mixed`/String để lưu `'system'`; hoặc
  2. dùng một user hệ thống có `_id` cố định (cần seed, không khuyến khích).
- Không ghi đè entry cũ; chỉ `$push`.
- Không đưa password/token/hash vào `note`.

---

## 7. Test matrix (DB-free, chưa chạy)

| Case | Kỳ vọng |
|---|---|
| `pending→confirmed`, admin | `assertTransition` không throw; update chứa `$set.status` + `$push.history` |
| `pending→shipping`, admin | throw `ORDER_INVALID_TRANSITION` |
| `shipping→confirmed`, admin | throw `ORDER_INVALID_TRANSITION` (chặn lùi) |
| `delivered→cancelled`, admin | throw `ORDER_INVALID_TRANSITION` (terminal) |
| `cancelled→pending`, system | throw `ORDER_INVALID_TRANSITION` |
| `pending→cancelled`, customer không owner | throw `ORDER_NOT_OWNER` |
| `confirmed→shipping`, customer owner | throw `ORDER_FORBIDDEN_ROLE` |
| `pending→cancelled`, system | hợp lệ (dùng cho T6-1-3) |
| `createStatusUpdate` | `filter.status === from`; update chỉ có `$set.status` và `$push.statusHistory` |
| Actor vào history | `by === actorId`; `by === 'system'` khi scheduler |

Chạy dự kiến: `node --test test/order.state-machine.test.js` + 22 file DB-free đã liệt kê trong báo cáo audit (bổ sung `admin.users.test.js`, `admin.audit-event.test.js` sau khi xác minh fake model). **Không** chạy integration DB.

---

## 8. Quyết định cần Dev 2 trả lời trước khi implement

1. Ma trận quyền ở mục 4 — đặc biệt `pending→confirmed` có cho `system` không và khách có hủy được ở `confirmed` không.
2. Kiểu của `statusHistory.by` khi actor là `system` (mục 6).
3. Có cho phép đổi `src/model/Order.js` để thêm marker/idempotency (`stockRestoredAt`, `overdueClaimedAt`) hay không.
4. Caller hợp lệ của service: T6-1-1 (Dev 1) và T6-2-2 (Dev 2) cùng dùng một service này — ai là owner file service sau khi merge?
5. Có chấp nhận CAS `findOneAndUpdate` làm cơ chế chống race duy nhất, hay cần transaction (`withTransaction`) bao cả hoàn kho?

---

## 9. Điều kiện sang T6-1-1

- Dev 2 trả lời mục 8.
- T5-1-1 đã xong contract cart (xem banner trong báo cáo audit).
- Service state machine có caller thật (route admin/customer), không chỉ test static.
- Không ghi status trực tiếp ở bất kỳ route/controller nào khác.
