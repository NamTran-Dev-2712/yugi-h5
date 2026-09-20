# Frames index — video #1

Frame lấy mẫu bằng `ffmpeg -vf fps=1/12` → `docs/reference/frames/main/s_NNNN.jpg` (ảnh 960px; thư mục frames không commit).

**Quy đổi thời gian:** `s_NNNN` ≈ `(NNNN−1) × 12 s`. **Lưu ý sai số:** khi seek trực tiếp `-ss 636` (đúng thời điểm của `s_0054`) tôi nhận
được cảnh khác (cảnh của `s_0054` xuất hiện quanh 645–650 s). Vì vậy coi thời điểm của frame lấy mẫu là **±12 s**. Thời lượng animation dưới đây **chỉ** dùng
clip 4 fps cắt bằng seek trực tiếp (`frames/clips/*`), không dùng mốc lấy mẫu.

| Frame       | ≈ Thời điểm  | Nội dung                                                                        |
| ----------- | ------------ | ------------------------------------------------------------------------------- |
| s_0001      | 0:00         | Menu chính                                                                      |
| s_0002–0012 | 0:12–2:12    | Bộ Bài (Deck Builder): tab Quái/Phép/Bẫy/Dung Hợp, thanh deck 40–50/60          |
| s_0013–0014 | ~2:24        | Vào ván 1 (đối thủ "S06_St.Dragon 5"): board trống, tay 5 lá, LP 10000 vs 10000 |
| s_0015–0016 | ~3:00        | Prompt "Chọn 1 mục tiêu" (chọn lá)                                              |
| s_0019      | ~3:36        | Panel "Kỹ năng chủ động" khi chạm quái                                          |
| s_0021      | ~4:00        | Kích hoạt Phép (lá lớn bên phải)                                                |
| s_0023–0024 | ~4:24        | Prompt chọn mục tiêu dùng hợp                                                   |
| s_0031      | ~6:00        | Chuyển vào ván 2 (đối thủ "Song Sinh Yêu Tinh"), LP 10000 vs 8000               |
| s_0034      | ~6:36        | Flash triệu hồi/lật lá giữa màn                                                 |
| s_0040      | ~7:48        | "Chọn 2 nguyên liệu dung hợp" (nguồn: Bộ bài / Bài trên tay)                    |
| s_0044      | ~8:36        | Panel thông tin lá (Tộc/Từ khóa/Miêu tả/Hạn chế/Kỹ năng)                        |
| s_0054      | ~10:30–10:50 | Số sát thương "-1600", 3 quái trên sân, Phép lớn bên phải                       |
| s_0065      | ~12:48       | Kích hoạt Phép, xoáy hiệu ứng toàn màn                                          |
| s_0081–0096 | 16:00–19:00  | Deck Builder, Tiệm Bài (gacha)                                                  |
| s_0104–0131 | ~20:30–26:00 | Menu, Deck Builder (Fusion/Link), Quỹ Đầu Tư, shop                              |

## Thời lượng animation (từ clip 4 fps, sai số ±0.25 s mỗi mốc; ±0.5 s cho mỗi khoảng)

| Animation                                                               | Quan sát                                                                       | Ước lượng          | Chắc                        |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------ | --------------------------- |
| Kích hoạt Phép Dung Hợp (từ lúc lá Phép hiện đến khi quái mới trên sân) | lá hiện → xoáy toàn màn 2 frame → quái mới hiện + ánh vàng 1–2 frame → ổn định | **~1.25–1.5 s**    | Trung bình (1 lần quan sát) |
| Xoáy hiệu ứng toàn màn                                                  | 2 frame liên tiếp                                                              | ~0.5–0.75 s        | Thấp–TB                     |
| Hiện lá lớn khi kích hoạt skill/hiệu ứng                                | 1 frame mỗi lá (2 lá liên tiếp, bên phải rồi bên trái)                         | ~0.25–0.5 s mỗi lá | Thấp                        |
| Số sát thương nổi ("-1600")                                             | thấy ở 1 frame                                                                 | ≤ ~0.5 s           | Thấp                        |
| Attack / Draw / Normal Summon / Set / Flip / Destroy / Phase / Win-Lose | **không nằm trong clip nào tôi kiểm tra**                                      | **chưa có**        | —                           |
