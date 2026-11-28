# T1-4-3 — Tài liệu: khung `docs/`, sơ đồ và mục lục báo cáo

- **Ngày:** 2026-11-21
- **Nhánh:** `docs/T1-4-3-docs-index`
- **Phạm vi:** Vẽ/giữ sơ đồ use case + máy trạng thái đơn hàng, dựng khung `docs/` và mục lục báo cáo. Không sửa code ứng dụng.
- **Sản phẩm bàn giao theo WBS:** `Tài liệu (tài liệu)` — **Sơ đồ + mục lục**.
- **Trạng thái:** Phần tài liệu hoàn thành; chờ Dev 3 review chéo (DoD #4) trước khi đánh dấu task Hoàn thành trong workbook.
- **Phụ thuộc:** không có. Đây là gate của `T2-4-1`, `T2-4-2`, `T2-4-3` theo sheet `06_Phụ thuộc`.
- **Reviewer:** Dev 3 (cột S sheet `02_WBS`, RACI `03_RACI`).

---

## 1. Sơ đồ có sẵn trong repo

| Sơ đồ | File | Nội dung chính | Đối chiếu |
|---|---|---|---|
| Use case tổng quát | [`use-case.svg`](../thiet-ke-csdl/use-case.svg) · [`use-case.png`](../thiet-ke-csdl/use-case.png) | 3 tác nhân Guest / Customer / Admin, đúng 4 phân hệ: Xác thực & Bảo mật, Danh mục sản phẩm, Giỏ hàng & Đơn hàng, Quản trị | `Bao_cao_do_an_UrbanMinimal.docx` §1.2, Hình 1 |
| Ma trận phân quyền | [`rbac-matrix.png`](../thiet-ke-csdl/rbac-matrix.png) | Quyền theo Guest / Customer / Admin | `docs/reports/T1-4-1_REQUIREMENTS_SURVEY.md` |
| Vòng đời đơn hàng | [`order-lifecycle.svg`](../thiet-ke-csdl/order-lifecycle.svg) · [`order-lifecycle.png`](../thiet-ke-csdl/order-lifecycle.png) | `pending → confirmed → shipping → delivered`, `cancelled` từ `pending`/`confirmed` + hoàn kho | `src/model/Order.js:4-18` (`ORDER_STATUSES`, `ORDER_STATUS_FLOW`) |
| ERD / dữ liệu | [`erd.svg`](../thiet-ke-csdl/erd.svg), [`erd.png`](../thiet-ke-csdl/erd.png), [`data-dictionary-1.png`](../thiet-ke-csdl/data-dictionary-1.png), [`data-dictionary-2.png`](../thiet-ke-csdl/data-dictionary-2.png), [`business-rules.png`](../thiet-ke-csdl/business-rules.png), [`data-rules.png`](../thiet-ke-csdl/data-rules.png), [`Mô hình thực thể.png`](../thiet-ke-csdl/Mô hình thực thể.png) | User / Category / Product / Cart / Order / Review | `T2-2-1_MONGOOSE_SCHEMA.md`, `T2-2-2_INDEX_SEED.md` |
| Kiến trúc | [`Kiến trúc tổng thể.png`](../thiet-ke-csdl/Kiến trúc tổng thể.png) | Request → middleware → controller → service → model | [`README.md`](../../README.md) §1, §13 |

Sơ đồ use case và vòng đời đơn đã đúng phạm vi WBS. **Không vẽ lại**; khi cần đổi chỉ cập nhật cả bản `.svg` lẫn `.png` để báo cáo không lệch minh chứng.

### Đối chiếu tên trạng thái

| Sơ đồ (`order-lifecycle.svg`) | Enum trong code | Mô tả docx §4.5 |
|---|---|---|
| `pending` | `pending` | Chờ xác nhận |
| `confirmed` | `confirmed` | Đã xác nhận |
| `shipping` | `shipping` | Đang giao |
| `delivered` | `delivered` | Đã giao |
| `cancelled` | `cancelled` | Đã hủy |

Quy tắc `ORDER_STATUS_FLOW` chặn chuyển lùi: `delivered: []`, `cancelled: []`; hủy chỉ hợp lệ từ `pending`/`confirmed`. Docx dùng tên tiếng Việt, code dùng enum — giữ nguyên và dùng bảng này khi đối chiếu.

---

## 2. Khung thư mục `docs/`

```text
docs/
├── ABMT_Phan_chia_cong_viec.xlsx         # nguồn dữ liệu 96 đầu việc, 8 tuần
├── Bao_cao_do_an_UrbanMinimal.docx       # báo cáo chính (có mục lục tự động)
├── pdf/
│   ├── ABMT_Lo_trinh_8_tuan.pdf
│   └── Báo cáo hướng làm ... thời.pdf    # tài liệu phân tích gốc
├── thiet-ke-csdl/                        # 13 ảnh/sơ đồ CSDL + kiến trúc (mục 1)
├── thiet-ke-ui/
│   ├── components-demo.html              # demo component giao diện
│   └── .gitkeep
└── reports/                              # báo cáo minh chứng theo task/phase
    ├── T1-4-1_REQUIREMENTS_SURVEY.md     # (task T1-4-1)
    ├── T1-4-2_NFR_TEST_PLAN.md           # (task T1-4-2)
    ├── T1-4-3_DOCS_INDEX.md              # file này
    └── ...                               # 36 báo cáo hiện có
```

File này đóng vai trò **index**: mọi minh chứng mới nên được tạo dưới `docs/reports/` theo cú pháp `<TaskID>_<TEN>.md` rồi link từ bảng mục lục bên dưới.

---

## 3. Mục lục báo cáo ↔ minh chứng

| Mục docx | Nội dung | Minh chứng |
|---|---|---|
| Mở đầu §1–5 | Lý do, mục tiêu, phạm vi, bố cục | [`Bao_cao_do_an_UrbanMinimal.docx`](../Bao_cao_do_an_UrbanMinimal.docx), [`ABMT_Lo_trinh_8_tuan.pdf`](../pdf/ABMT_Lo_trinh_8_tuan.pdf) |
| CHƯƠNG 1 §1.2–1.6 | Tác nhân, YC chức năng, NFR, phạm vi, tiêu chí thành công | [`use-case.svg`](../thiet-ke-csdl/use-case.svg), [`rbac-matrix.png`](../thiet-ke-csdl/rbac-matrix.png), [`T1-4-1_REQUIREMENTS_SURVEY.md`](T1-4-1_REQUIREMENTS_SURVEY.md), [`T1-4-2_NFR_TEST_PLAN.md`](T1-4-2_NFR_TEST_PLAN.md) |
| CHƯƠNG 2 §2.1–2.5 | Kiến trúc, luồng request, bảo mật, mô hình triển khai | [`Kiến trúc tổng thể.png`](../thiet-ke-csdl/Kiến trúc tổng thể.png), [`README.md`](../../README.md), [`POST_PHASE2_HARDENING_REPORT.md`](POST_PHASE2_HARDENING_REPORT.md) |
| CHƯƠNG 3 §3.1–3.5 | Mô hình dữ liệu, API, middleware, lỗi | [`erd.svg`](../thiet-ke-csdl/erd.svg), [`T2-2-1_MONGOOSE_SCHEMA.md`](T2-2-1_MONGOOSE_SCHEMA.md), [`T2-2-2_INDEX_SEED.md`](T2-2-2_INDEX_SEED.md), [`T3-2-2_PRODUCT_API.md`](T3-2-2_PRODUCT_API.md), [`T3-2-3_QUERY_HELPER.md`](T3-2-3_QUERY_HELPER.md) |
| CHƯƠNG 4 §4.1–4.7 | Giao diện, luồng mua, trạng thái đơn | [`components-demo.html`](../thiet-ke-ui/components-demo.html), [`order-lifecycle.svg`](../thiet-ke-csdl/order-lifecycle.svg), [`T4-2-1_PRODUCT_FILTER.md`](T4-2-1_PRODUCT_FILTER.md), `src/views/`, `src/public/` |
| CHƯƠNG 5 §5.1–5.8 | Chiến lược test, 8 kịch bản, nghiệm thu, bảo mật, deploy | [`T1-4-2_NFR_TEST_PLAN.md`](T1-4-2_NFR_TEST_PLAN.md), sheet `09_Kiểm thử & DoD` của [`workbook`](../ABMT_Phan_chia_cong_viec.xlsx), [`PHASE2_DEV1_CI_SETUP_REPORT.md`](PHASE2_DEV1_CI_SETUP_REPORT.md), `postman/` |
| CHƯƠNG 5 — Test đồng thời kho | T7-2-1: 1 biến thể còn 1 sản phẩm, nhiều request đồng thời, đúng 1 đơn thành công, tồn kho 0 | [`T7-2-1_CONCURRENCY_STOCK.md`](T7-2-1_CONCURRENCY_STOCK.md) |
| CHƯƠNG 5 — Tối ưu truy vấn P0 | T7-2-2: before/after trên Atlas, explain, test đếm query/chống N+1 | [`T7-2-2_QUERY_OPTIMIZATION.md`](T7-2-2_QUERY_OPTIMIZATION.md) |
| CHƯƠNG 5 — Cache cây danh mục | T7-2-3: cache snapshot chung cho API tree/Mega Menu, before/after trên Atlas | [`T7-2-3_CATEGORY_CACHE.md`](T7-2-3_CATEGORY_CACHE.md) |
| CHƯƠNG 6 §6.1–6.10 | Kế hoạch 8 tuần, mốc, RACI, rủi ro, điểm chốt | [`workbook`](../ABMT_Phan_chia_cong_viec.xlsx), [`PHASE2_DEV1_WBS_SCOPE_MAPPING.md`](PHASE2_DEV1_WBS_SCOPE_MAPPING.md), [`PHASE2_DEV1_BACKLOG.md`](PHASE2_DEV1_BACKLOG.md) |
| Kết luận / Phụ lục A–D | Kết quả, hạn chế, ma trận 96 task, DoD, checklist bảo mật | [`Bao_cao_do_an_UrbanMinimal.docx`](../Bao_cao_do_an_UrbanMinimal.docx), [`PHASE2_DEV1_FINAL_REPORT.md`](PHASE2_DEV1_FINAL_REPORT.md) |

Hai link `T1-4-1_REQUIREMENTS_SURVEY.md` và `T1-4-2_NFR_TEST_PLAN.md` nằm trên hai branch riêng; chúng hợp lệ sau khi cả ba branch `docs/T1-4-*` được merge vào `main`.

Lưu ý docx có thông báo nội bộ: *"Mục lục là trường tự động. Trong Microsoft Word, nhấn Ctrl+A rồi F9 để cập nhật số trang và tiêu đề."* Cần làm thao tác này trước khi nộp; file này chỉ ánh xạ nội dung sang minh chứng, không thay thế mục lục Word.

---

## 4. Checklist đồng bộ sơ đồ ↔ code

| Kiểm tra | Kết quả hiện tại | Hành động khi thay đổi |
|---|---|---|
| 4 phân hệ use case có route tương ứng | Auth/Catalog/Quản trị SP có (`src/routes/`); Giỏ hàng & Đơn hàng chỉ có Cart route chạy chưa ổn, Order API chưa có | Cập nhật use case + `T1-4-1_REQUIREMENTS_SURVEY.md` khi order/cart vào code |
| 5 trạng thái đơn khớp enum | Khớp (`Order.js:4-18`) | Đổi cả `.svg`/`.png` nếu thêm trạng thái |
| Số liệu báo cáo khớp workbook | 96 task / 548 giờ / 47 phụ thuộc / 8 mốc / 10 rủi ro / 8 quyết định / 8 test case / 6 DoD | Đối chiếu lại sheet `01_Tổng quan`, `06_Phụ thuộc`, `07_Rủi ro`, `08_Điểm cần chốt`, `09_Kiểm thử & DoD` |
| Link minh chứng trong docx | Các bảng/hình còn thiếu ảnh chụp kết quả thật (docx §5.8 đã nêu) | Bổ sung ảnh/log khi có kết quả chạy thật, giữ nguyên cách diễn đạt "đề xuất" nếu chưa kiểm chứng |

---

## 5. DoD — đối chiếu sheet `09_Kiểm thử & DoD`

| Tiêu chí | Bằng chứng |
|---|---|
| Đúng yêu cầu | WBS `T1-4-3`: sơ đồ use case + máy trạng thái đơn + khung `docs/` + mục lục — xem mục 1–3 |
| Code chạy ổn định | Không đổi code; kiểm tra mọi link trong file này trỏ tới file tồn tại |
| Test pass | Không có test code; chạy `npm test` làm regression (docs-only, kỳ vọng không đổi kết quả) |
| Review chéo | Dev 3 (chưa có → chưa chuyển `Hoàn thành` trong workbook) |
| Tài liệu / minh chứng | File này + sơ đồ mục 1 + docx/pdf mục 3 |
| Không regression | Chỉ thêm 1 file Markdown |

Sau khi Dev 3 xác nhận: cập nhật `02_WBS` dòng 13 (`Q13=Hoàn thành`, `R13=100`, `T13=link file này`).
