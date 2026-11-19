# PHASE 2 DEV 1 — V4 TEST ENV VARIABLE CONSISTENCY

> **TRẠNG THÁI CUỐI: ĐÃ ĐÓNG (CLOSED) — 2026-11-19**
> Chuẩn hoá theo `MONGODB_URI_TEST` + fail-fast, triển khai trên `fix/V4-test-env-consistency`, PR **#28**, merge `7985e9e`.
> `npm run test:integration` → **20/20 pass**; xoá `.env.test` → dừng ngay với thông báo rõ.

- **Task ID:** V4 (Phase 1 verification gap)
- **Branch dự kiến:** `fix/V4-test-env-variable-consistency` (**chưa tạo** — chờ duyệt)
- **Ngày:** 2026-11-18
- **Trạng thái:** **PENDING APPROVAL** — chưa sửa code/config nào.
- **Loại:** read-only audit + đề xuất.

---

## 1. Hiện trạng: hai tên biến cho cùng một mục đích

| File | Biến dùng | Hành vi khi thiếu | DB mặc định |
|---|---|---|---|
| `test/integration/mongodb.integration.test.js:27` | **`TEST_MONGODB_URI`** | **im lặng fallback** `mongodb://127.0.0.1:27017/abmt_shop_test` | `abmt_shop_test` |
| `test/integration/rate-limit.integration.test.js` | dùng lại module trên | như trên | `abmt_shop_test` |
| `tests/setup.js:10` (Jest) | **`MONGODB_URI_TEST`** | **throw** (fail-fast) | không có default |
| `.env.test.example:5` | **`MONGODB_URI_TEST`** | — | `.../urbanminimal_test` ⚠️ **sai tên** |
| `.env.test` (local, gitignored) | **cả hai** | — | (không nêu trong báo cáo) |
| `README.md` (branch PR7) | chỉ `MONGODB_URI_TEST` | — | — |
| `docs/reports/POST_PHASE2_HARDENING_REPORT.md` | `TEST_MONGODB_URI` | — | — |

### 1.1. Vấn đề cụ thể

| # | Vấn đề | Tác động |
|---|---|---|
| V4-1 | Hai tên biến cho cùng mục đích | Người mới clone đọc `.env.test.example` → set `MONGODB_URI_TEST`; integration test lại đọc `TEST_MONGODB_URI` → **im lặng chạy localhost**, không ai biết đang test DB nào |
| V4-2 | Integration **không fail-fast** khi thiếu biến | Có thể "pass" trên DB local không mong muốn; che giấu lỗi cấu hình CI |
| V4-3 | `.env.test.example` dùng DB name `urbanminimal_test` | Không khớp `abmt_shop_test` đang dùng trong code/report → dễ gây nhầm |
| V4-4 | `.env.test.example` dùng `mongodb+srv` Atlas | Trái khuyến nghị "test local"; nếu ai đó chạy với Atlas test thì cleanup `deleteMany({})` vẫn chạy trên DB có chữ "test" — chấp nhận được nhưng cần cảnh báo |
| V4-5 | Không có kiểm tra DB name ở integration (chỉ Jest có) | Sai tên DB ở integration chỉ bị `skipReason` khi tên không chứa "test" — nhưng default vẫn được dùng |

> Ghi chú an toàn: cả hai đường đều **có guard** không dùng DB production (Jest: throw nếu tên không chứa "test"; integration: skip nếu tên không chứa "test"). Rủi ro chính là **cấu hình im lặng**, không phải xoá nhầm production.

---

## 2. Đề xuất chuẩn hoá

### 2.1. Tên biến chuẩn

**Khuyến nghị: `MONGODB_URI_TEST`**

| Lý do | Chi tiết |
|---|---|
| Đã được document trong `.env.test.example` | Ít phải sửa tài liệu nhất |
| Đang được Jest dùng với fail-fast | Giữ nguyên hành vi an toàn |
| Tên nói rõ "test" ở cuối | Khớp convention dễ đọc `*_TEST` |
| `TEST_MONGODB_URI` chỉ xuất hiện 1 file code | Chi phí migrate thấp |

**Phương án thay thế: `TEST_MONGODB_URI`** — nếu bạn muốn giữ tên đang dùng trong integration test; khi đó phải sửa `tests/setup.js`, `.env.test.example`, README, các report.

### 2.2. Hành vi khi thiếu biến (đề xuất)

| Runner | Hành vi đề xuất |
|---|---|
| Integration (`node --test`) | **Fail-fast**: báo lỗi rõ `Thiếu MONGODB_URI_TEST...` thay vì fallback im lặng |
| Jest | Giữ fail-fast như hiện tại |
| Cả hai | Vẫn giữ guard "tên DB phải chứa `test`" |

**Giai đoạn chuyển tiếp (1 sprint):**

```js
const uri = process.env.MONGODB_URI_TEST
  || process.env.TEST_MONGODB_URI            // deprecated
  || fail('Thiếu MONGODB_URI_TEST');
```

Nếu dùng biến deprecated → in **cảnh báo** `console.warn` một lần.

---

## 3. Phạm vi file cần sửa (khi được duyệt)

| File | Thay đổi | Loại |
|---|---|---|
| `test/integration/mongodb.integration.test.js` | đọc `MONGODB_URI_TEST`, fallback deprecated, **fail-fast** nếu thiếu, giữ guard tên DB | code test |
| `.env.test.example` | đổi DB mẫu `urbanminimal_test` → **`abmt_shop_test`**; local là mặc định, Atlas để dạng comment | config mẫu |
| `README.md` (trên branch PR7) | thêm mục biến test + cách chạy | docs |
| `docs/reports/PHASE2_DEV1_*` (mới) | ghi nhận chuẩn biến | docs |
| `package.json` | không cần đổi | — |

**Không sửa:** code `src/`, `.env.test` local (gitignored), model/service của Dev 1/Dev 2.

---

## 4. Rủi ro tương thích

| # | Rủi ro | Giảm thiểu |
|---|---|---|
| R1 | Máy/CI đang set `TEST_MONGODB_URI` | Giữ fallback deprecated 1 sprint + cảnh báo |
| R2 | Fail-fast làm hỏng script chạy "tiện" trước đây | Ghi rõ trong README; đây là thay đổi **có chủ đích** để tránh test nhầm DB |
| R3 | `.env.test.example` đổi DB name gây lệch tài liệu cũ | Ghi chú trong báo cáo; không sửa report lịch sử |
| R4 | Ai đó dùng Atlas test → cleanup `deleteMany` | Guard tên DB vẫn giữ; thêm cảnh báo trong example |

---

## 5. Điều kiện để chuyển từ PENDING APPROVAL → thực thi

1. Bạn chốt tên biến chuẩn: **`MONGODB_URI_TEST`** (khuyến nghị) hay `TEST_MONGODB_URI`.
2. Bạn duyệt fail-fast cho integration (bỏ fallback im lặng).
3. Tôi tạo branch `fix/V4-test-env-variable-consistency`, sửa đúng phạm vi trên, chạy:
   - `npm test`
   - `npm run test:integration` (trên `abmt_shop_test`)
   - `npm run test:jest` (sau khi V1 được duyệt)
4. Bạn review → tạo PR → merge.

---

## 6. Kết luận

| Hạng mục | Trạng thái |
|---|---|
| Audit hiện trạng | **HOÀN THÀNH** |
| Đề xuất chuẩn | **ĐÃ DUYỆT** (`MONGODB_URI_TEST` + fail-fast) |
| Thay đổi code/config | **ĐÃ THỰC HIỆN** (PR #28, merge `7985e9e`) |
| Rủi ro dữ liệu production | **THẤP** (guard tên DB chứa "test" ở cả integration và Jest) |

### 6.1. Kết quả triển khai (2026-11-19)

| File | Thay đổi |
|---|---|
| `test/integration/mongodb.integration.test.js` | tự nạp `.env.test`; bắt buộc `MONGODB_URI_TEST`, **không** fallback im lặng; legacy `TEST_MONGODB_URI` + cảnh báo deprecated |
| `tests/setup.js` | thêm fallback legacy có cảnh báo |
| `.env.test.example` | `abmt_shop_test` local, Atlas để dạng comment |
| `README.md` §12 | 1 biến chuẩn + quy tắc an toàn + hướng dẫn copy `.env.test` |

Bằng chứng:

| Tình huống | Kết quả |
|---|---|
| Có `.env.test` | integration **20/20 pass** (sau V2: **32/32**) |
| Xoá `.env.test` | `Error: Thiếu MONGODB_URI_TEST. Tạo file .env.test từ .env.test.example rồi chạy lại.` |
| DB name không chứa `test` | test skip/từ chối chạy |

**Còn lại (Dev 2):** `catalog.integration.test.js` và `checkout.integration.test.js` vẫn đọc `TEST_MONGODB_URI` + default localhost → đề nghị chuyển sang `MONGODB_URI_TEST`.
