---
description: Xử lý tư liệu tham chiếu người dùng vừa nộp (video/screenshot) và chuyển nhãn G sang [REF]
---

Chạy khi người dùng báo "đã nộp" tư liệu vào `docs/reference/`. Không được bịa chi tiết mà tư liệu không cho thấy.

1. Liệt kê file mới trong `docs/reference/{duel,video,menu,deck-builder,result,card}/`.
2. Video: chạy `ffmpeg -version`. Thiếu → báo người dùng và dừng bước này (không tự cài). Có → cắt frame vào
   `docs/reference/frames/<tên>/` và tạo bảng timestamp `frames-index.md`.
3. Đọc từng ảnh/frame; viết mô tả bố cục (LP, deck, GY, hand, phase bar…) vào `docs/reference/notes/layout-analysis.md` (tỉ lệ % màn hình).
4. Ước lượng thời lượng animation từ timestamp, nêu sai số.
5. Chuyển các G tương ứng từ `[GUESS]` → `[REF]` trong `docs/plan/fidelity-spec.md`, `docs/plan/parity-board.md`,
   `docs/reference/notes/rules.md`; ghi rõ chỗ chắc / không chắc. Mâu thuẫn với `[DECISION]` → nêu ra, chờ chủ dự án quyết.
6. Báo cáo: đã đọc gì, kết luận, phần còn `[GUESS]`, cần thêm tư liệu gì.
