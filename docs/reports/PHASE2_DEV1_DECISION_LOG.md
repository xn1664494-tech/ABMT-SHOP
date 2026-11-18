# PHASE 2 DEV 1 — DECISION LOG

Cập nhật: 2026-11-19

| # | Quyết định | Phương án đã chọn | Lý do | Hệ quả | Ngày |
|---|---|---|---|---|---|
| D1 | Base của PR hardening | `feature/post-phase2-hardening` (không phải `main`) | Không merge vào `main` khi chưa review; cần nhánh tích hợp | 11 PR stack vào nhánh này | 2026-11-18 |
| D2 | Merge policy | Merge commit, không squash | Giữ lịch sử từng PR/task | Lịch sử nhiều merge commit | 2026-11-18 |
| D3 | Đổi base PR #19 | `main` → `feature/post-phase2-hardening` qua GitHub API | PR mở nhầm base | PR #19 merge đúng nhánh | 2026-11-18 |
| D4 | Phạm vi WBS Phase 2 Dev 1 | 6 task `T3-1-1, T3-1-2, T3-1-3, T4-1-1, T4-1-2, T4-1-3`; `T2-1-x` là Phase 1 | WBS sheet `02_WBS` | % tính trên 6 task | 2026-11-18 |
| D5 | T5 / trust proxy / README | Xếp vào **hardening ngoài WBS** | Không có dòng WBS tương ứng | Không dùng để tính % | 2026-11-18 |
| D6 | Sync `main` | Merge `main` vào nhánh tích hợp bằng merge commit | `main` đi trước 17 commit; PR #21 dirty | Phát sinh conflict ở 3 file + lỗi `server.js` | 2026-11-19 |
| D7 | `src/server.js` | Cho `server.js` delegate sang `app.js` | Entry cũ tự tạo app → hardening Dev 1 không chạy khi `npm start` | Một nguồn app duy nhất | 2026-11-19 |
| D8 | Test `category.api.test.js` | **Không sửa** trong PR sync | Thuộc Dev 2, ngoài scope; đã chứng minh fail y hệt trên `main` | 16 test đỏ, ghi P0-1 backlog | 2026-11-19 |
| D9 | V1 (Jest) | Chọn phương án A: giữ Jest + `NODE_OPTIONS=--experimental-vm-modules` trong script | Đã chứng minh 8/8 pass; sửa 1 dòng; rủi ro thấp | Jest xanh; nợ "cờ experimental" → P2-1 | 2026-11-19 |
| D10 | V4 (env var) | Chuẩn `MONGODB_URI_TEST` + **fail-fast**, legacy `TEST_MONGODB_URI` 1 sprint | `.env.test.example` và Jest đã dùng tên này; tránh test nhầm DB | Integration dừng ngay nếu thiếu biến | 2026-11-19 |
| D11 | V2 (integration change-password) | 12 case MongoDB thật, không mock | Fake model không chứng minh được `tokenVersion`/thu hồi token | Integration 20 → 32 test | 2026-11-19 |
| D12 | Category CSRF | **Không tự sửa** route của Dev 2, chỉ báo cáo | Ngoài scope Dev 1 | P0-2 backlog | 2026-11-19 |
| D13 | PR #21 (→ `main`) | Không tự merge | Cần người dùng quyết định release | PR vẫn mở | 2026-11-19 |
| D14 | File báo cáo được bảo vệ | Không sửa `FINAL_SECURITY_CLEANUP_REPORT.md`, `PHASE2_DEV1_BAO_CAO_2026-11-15.md` | Yêu cầu của người dùng | 2 file vẫn untracked | 2026-11-19 |
