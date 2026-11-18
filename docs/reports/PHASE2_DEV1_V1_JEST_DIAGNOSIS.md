# PHASE 2 DEV 1 — V1 JEST DIAGNOSIS

> **TRẠNG THÁI CUỐI: ĐÃ ĐÓNG (CLOSED) — 2026-11-19**
> Phương án **A** đã được duyệt và triển khai trên branch `fix/V1-jest-vm-modules`, PR **#27**, merge commit `491f9a4`.
> Kết quả sau merge: `npm run test:jest` → **3 suite / 8 test PASS** (~4s), không cần export biến môi trường thủ công.

- **Task ID:** V1 (Phase 1 verification gap)
- **Branch dự kiến:** `chore/V1-jest-diagnosis` (**chưa tạo** — cần bạn duyệt)
- **Môi trường:** Windows 11, Node **v24.14.0**, jest **30.5.2**, mongoose **9.12.0**, mongodb **7.8.0**
- **Ngày:** 2026-11-18
- **Loại:** chẩn đoán read-only; repro đặt tại `%TEMP%\abmt_v1_repro` (ngoài repo). **Không sửa code, không đổi test runner, không commit.**

---

## 1. Triệu chứng ban đầu

```text
npm run test:jest
Test Suites: 2 failed, 2 total
Tests:       7 failed, 7 total
MongooseServerSelectionError: Missing required sub-document 'driver' in the client metadata document
    at tests/setup.js:36  (mongoose.connect)
```

Điểm mâu thuẫn: **cùng URI đó, chạy bằng `node` thường thì kết nối thành công** (db `abmt_shop_test`), và `node --test` integration 12/12 pass.

---

## 2. Quá trình khoanh vùng

| Bước | Thí nghiệm | Kết quả |
|---|---|---|
| 1 | Jest + `mongoose.connect` | ❌ fail như trên |
| 2 | Jest + `MongoClient.connect` (bỏ mongoose) | ❌ fail y hệt → **lỗi ở tầng driver, không phải mongoose** |
| 3 | Jest + đo `client.options.metadata` | ⚠️ metadata **rỗng** (`{}`) dù driver 7.8.0 bình thường gửi `{driver:{name:"nodejs",version:"7.8.0"}, platform, os}` |
| 4 | Bọc `makeClientMetadata` để bắt lỗi bị nuốt | ✅ bắt được: **`TypeError: A dynamic import callback was invoked without --experimental-vm-modules`** |
| 5 | Chạy lại Jest với `NODE_OPTIONS=--experimental-vm-modules` | ✅ **`META_OK {...driver...}` → kết nối thành công** |
| 6 | Áp dụng cho repo thật: `NODE_OPTIONS=--experimental-vm-modules npm run test:jest` | ✅ **2/2 suite pass, 7/7 test pass, 3.11s** (trước đó 71s và fail toàn bộ) |

---

## 3. Nguyên nhân gốc (root cause)

Chuỗi nhân quả chính xác:

1. `mongodb@7.8.0` gọi `resolveRuntimeAdapters()` trong `src/runtime_adapters.ts` — hàm này dùng **dynamic `import()`**.
2. Trong **Jest 30 VM context** (mặc định **không** bật `--experimental-vm-modules`), Node từ chối dynamic import trong VM:
   `TypeError: A dynamic import callback was invoked without --experimental-vm-modules`.
3. Driver tạo metadata handshake bằng `makeClientMetadata(...)`, nhưng trong `MongoClient.appendMetadata` (`lib/mongo_client.js:118`) lỗi bị **nuốt**:
   ```js
   this.options.metadata = makeClientMetadata(...)
     .then(undefined, squashError)
     .then(result => result ?? {});   // <-- lỗi => metadata = {}
   ```
4. Handshake gửi `client: {}` (không có sub-document `driver`).
5. **MongoDB server** (phiên bản nghiêm ngặt, mongod ≥ 8) từ chối handshake:
   `Missing required sub-document 'driver' in the client metadata document`.
6. Driver bọc lỗi đó thành `MongoServerSelectionError` → test fail.

**Kết luận:** lỗi **không phải** do schema/model, không do tên DB, không do `.env.test`, không do network — mà do **Jest VM + dynamic import của driver**, bị driver che lỗi rồi server từ chối.

---

## 4. Bằng chứng

### 4.1. Metadata khi **không** có flag (Jest)

```text
META_ERROR TypeError: A dynamic import callback was invoked without --experimental-vm-modules
  at importModuleDynamicallyCallback (node:internal/modules/esm/utils:277:11)
  at resolveRuntimeAdapters (node_modules/mongodb/src/runtime_adapters.ts:63:41)
  at parseOptions (node_modules/mongodb/src/connection_string.ts:586:48)
  at new MongoClient (node_modules/mongodb/src/mongo_client.ts:484:32)
CONNECT_ERR Missing required sub-document 'driver' in the client metadata document
```

### 4.2. Metadata khi **có** flag

```text
META_OK {"driver":{"name":"nodejs","version":"7.8.0"},"platform":"Node.js v24.14.0, LE",
         "os":{"name":"win32","architecture":"x64","version":"10.0.26200","type":"Windows_NT"}}
Tests: 1 passed
```

### 4.3. Repo thật

```text
NODE_OPTIONS=--experimental-vm-modules npm run test:jest
Test Suites: 2 passed, 2 total
Tests:       7 passed, 7 total
Time:        3.11 s          (so với 71.3 s khi fail)
exit code:   0
```

Lệnh tương đương chạy **không** cần sửa code:

```powershell
$env:NODE_OPTIONS="--experimental-vm-modules"; npm run test:jest
```

---

## 5. Hai phương án (PENDING APPROVAL)

### Phương án A — Giữ Jest, bật VM modules (khuyến nghị)

Sửa **một dòng** trong `package.json`:

```json
"test:jest": "cross-env NODE_ENV=test NODE_OPTIONS=--experimental-vm-modules jest"
```

| Ưu điểm | Nhược điểm |
|---|---|
| Đã **kiểm chứng pass** 2/2 suite, 7/7 test trên repo thật | Cờ `--experimental-vm-modules` vẫn là experimental (cảnh báo in ra, không fail) |
| Không đổi cấu trúc test, không đổi test runner | Phải ghi vào README hướng dẫn |
| Sửa 1 dòng, rủi ro thấp | CI (nếu dựng sau này) phải set cùng biến |
| Giữ được 7 test Jest hiện có (env/infra) | |

**Lưu ý:** không nên set `NODE_OPTIONS` toàn cục trên máy — chỉ set trong script để không ảnh hưởng `node --test`.

### Phương án B — Chuyển chuẩn sang `node:test` (đã là runner chính)

| Ưu điểm | Nhược điểm |
|---|---|
| `node --test` đã là runner chính (96–107 test), không phụ thuộc Jest | Phải **port 7 test** (`tests/env.test.js`, `tests/infra.test.js`) sang `node:test` |
| Bỏ được 2 devDependency nặng (`jest`, `cross-env` vẫn dùng) | Mất `beforeAll/afterEach` toàn cục của `tests/setup.js`, phải viết lại vòng đời |
| Không còn phụ thuộc experimental flag | Cần 1 branch riêng + review kỹ (đổi hạ tầng test) |
| Loại bỏ luôn nguồn lỗi VM/dynamic import | Thời gian ~0.5–1 ngày công |

### So sánh nhanh

| Tiêu chí | A (giữ Jest) | B (bỏ Jest) |
|---|---|---|
| Thời gian | ~5 phút | ~0.5–1 ngày |
| Rủi ro hồi quy | Thấp | Trung bình |
| Nợ kỹ thuật còn lại | Cờ experimental | Không |
| Ảnh hưởng DoD/CI | Jest chạy được ngay | Phải viết lại test hạ tầng |

---

## 6. Khuyến nghị

**Chọn A ngay** (bật cờ trong script `test:jest`) để đóng gap V1 mà không đổi runner; **ghi B vào backlog** như hạng mục "loại bỏ Jest sau khi ổn định" (`POST_PHASE2_HARDENING_BACKLOG.md`).

Điều kiện để ghi **PASS**:
1. Bạn duyệt A.
2. Tôi tạo branch `chore/V1-jest-diagnosis` (hoặc `fix/V1-jest-vm-modules`), sửa 1 dòng `package.json`, cập nhật README (dòng ghi "Jest phụ thuộc toolchain" → hướng dẫn cụ thể).
3. Chạy lại `npm run test:jest` + `npm test` + `npm run test:integration` trên target → ghi kết quả.
4. Người dùng tạo/merge PR.

Hiện trạng V1: **CLOSED** — xem đầu tài liệu (PR #27, merge `491f9a4`).

### 6.1. Kết quả triển khai (2026-11-19)

| Hạng mục | Giá trị |
|---|---|
| Branch | `fix/V1-jest-vm-modules` |
| PR | #27 |
| Merge commit | `491f9a4` |
| Thay đổi | `package.json` (`test:jest`, `test:jest:watch` thêm `NODE_OPTIONS=--experimental-vm-modules`), `README.md` §12 |
| Trước | 3 suites failed / 8 tests failed |
| Sau | **3 suites passed / 8 tests passed / ~4s** |
| Regression | `npm test` 165 pass (16 fail pre-existing Dev 2), integration 20/20 tại thời điểm đó |

---

## 7. Bài học / cảnh báo

- Driver **nuốt lỗi metadata** (`squashError`) khiến triệu chứng bị hiểu sai thành "lỗi DB/handshake". Khi gặp `Missing required sub-document 'driver'` → nghi ngay môi trường VM/VM-modules.
- Không dùng `NODE_OPTIONS` toàn cục để "chữa cháy" — chỉ trong script.
- Lỗi này **không** ảnh hưởng `node --test`/integration → kết luận 12/12 integration vẫn hợp lệ.
