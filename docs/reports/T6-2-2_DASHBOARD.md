# T6-2-2 — DASHBOARD AGGREGATION

- **Task ID:** T6-2-2
- **Dev:** Dev 2 — Backend Business & Database.
- **Nhánh:** `feat/t6-2-2-dashboard` (base `origin/main` = `8731ad8`).
- **Trạng thái:** DONE — chờ review.

## 1. API trả JSON cho biểu đồ

Tất cả endpoint đều `GET`, yêu cầu `authenticate` + `authorize('admin')`, không cần CSRF. Query được validate bằng Zod (`src/validators/dashboardValidator.js`): `from`, `to` (`YYYY-MM-DD`), `granularity` (`day|week|month`), `limit` (1–20), `threshold` (0–100).

| Endpoint | Payload |
|---|---|
| `GET /api/admin/dashboard` | `{ success, data: { revenue, topCategories, lowStock, meta } }` — gộp 3 chart (`src/routes/admin.route.js:59`) |
| `GET /api/admin/dashboard/revenue` | `{ success, data: { labels, datasets, series } }` (`src/routes/admin.route.js:70`) |
| `GET /api/admin/dashboard/top-categories` | `{ success, data: { labels, datasets, items } }` (`src/routes/admin.route.js:81`) |
| `GET /api/admin/dashboard/low-stock` | `{ success, data: { labels, datasets, items } }` (`src/routes/admin.route.js:92`) |

Mỗi chart dùng cấu trúc `labels` + `datasets[].data` để frontend đổ thẳng vào Chart.js; kèm `series`/`items` để tooltip và bảng chi tiết.

Ví dụ:
```bash
GET /api/admin/dashboard?from=2026-11-23&to=2026-11-26&granularity=day&limit=5&threshold=5
```

```json
{
  "success": true,
  "data": {
    "revenue": {
      "labels": ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26"],
      "datasets": [{ "label": "Doanh thu (VND)", "data": [428000, 509000, 0, 0] }],
      "series": [
        { "date": "2026-11-23", "revenue": 428000, "orders": 1 },
        { "date": "2026-11-24", "revenue": 509000, "orders": 2 }
      ]
    },
    "topCategories": {
      "labels": ["... Áo", "... Quần"],
      "datasets": [{ "label": "Doanh thu theo danh mục (VND)", "data": [597000, 250000] }],
      "items": [{ "categoryId": "...", "name": "... Áo", "revenue": 597000, "qty": 3 }]
    },
    "lowStock": {
      "labels": ["... Áo da · SP-AO-001-M-DEN", "... Quan jean · SP-QU-003-M-XAM"],
      "datasets": [{ "label": "Tồn kho ≤ 5", "data": [2, 0] }],
      "items": [
        {
          "productId": "...",
          "name": "... Áo da",
          "sku": "SP-AO-001-M-DEN",
          "size": "M",
          "color": "DEN",
          "stock": 2
        }
      ]
    },
    "meta": { "from": "2026-11-23", "to": "2026-11-26", "granularity": "day", "threshold": 5, "limit": 5 }
  }
}
```

## 2. Aggregation

| Chức năng | Vị trí | Quyết định |
|---|---|---|
| Doanh thu theo thời gian | `src/services/dashboardService.js:111` | Chỉ đơn `delivered`; group theo ngày UTC rồi roll-up theo `day/week/month`; **điền 0** cho bucket không có đơn; tối đa 400 bucket; ISO week dạng `YYYY-Www` |
| Danh mục bán chạy | `src/services/dashboardService.js:166` | `$unwind items` → group theo `items.product` → `$lookup products` lấy `category` → `$lookup categories` lấy tên; sort `revenue desc`, `qty desc`; limit 1–20 |
| Biến thể chạm ngưỡng tồn kho | `src/services/dashboardService.js:248` | `$unwind variants`, lọc `isDeleted:false`, `isActive:true`, `stock <= threshold`; **bao gồm cả stock = 0**; sort tăng dần; trả `sku/size/color/stock` |
| Gộp payload | `src/services/dashboardService.js:291` | `Promise.all` 3 aggregation; meta clamp về range chung |

`GET /api/admin/stats` và trang admin HTML giữ nguyên; dashboard JSON là endpoint mới, không phá response cũ. Khác với stats cũ (`stock > 0`), endpoint mới tính cả biến thể đã hết hàng.

## 3. Test & minh chứng

| Lệnh | Kết quả |
|---|---|
| `npm test` (đã thêm `test/dashboard.service.test.js`) | 341 tests, 286 pass, 0 fail, 55 skipped |
| `npm run test:integration` (đã thêm `test/integration/dashboard.integration.test.js`) | 57 tests, 13 pass, 0 fail, 44 skipped — **5/5 case T6-2-2 pass** (fallback `MongoMemoryServer`) |
| `npm run test:postman` | 204/204 assertions, 0 request fail |

Unit (6/6): roll-up tuần ISO + điền 0; roll-up tháng; top categories sort/limit; low-stock nhận `stock=0` và map đủ field; `getDashboard` gộp 3 payload + clamp meta; `from > to` → 400.

Integration (5/5):
- Admin gọi `/api/admin/dashboard` nhận đúng 4 labels ngày, doanh thủ 2 ngày đầu, bỏ đơn `pending` và đơn ngoài khoảng; low-stock trả `[0, 2]`.
- `/top-categories`: chỉ đơn `delivered`, category có `qty=3` đứng đầu.
- `/low-stock`: có `SP-AO-001-M-DEN` (stock 2) và `SP-QU-003-M-XAM` (stock 0), không có variant stock 50.
- Customer → 403; thiếu token → 401.

## 4. Ghi chú

- Múi giờ chuẩn UTC để tránh lệch bucket khi client ở khác timezone.
- Nếu sau này cần chart theo `paid` thay vì `delivered`, chỉ đổi `$match.status` ở 2 aggregation; test đã chờ theo contract `delivered`.
- `$lookup categories` dùng collection name mặc định của Mongoose; nếu đổi model collection thì cập nhật cùng chỗ.
