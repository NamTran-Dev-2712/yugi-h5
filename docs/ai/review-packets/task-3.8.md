### Review Packet — Task 3.8: 10 lá effect thật + chuỗi chạy qua HTTP thật

**Đã làm gì (1-3 dòng):** Thêm 10 lá có hiệu ứng thật (Bẫy, Quick-Play, trigger khi triệu hồi / khi bị phá, quái Liên tục,
Phép có chi phí) vào bộ lá mẫu. Lần đầu tiên chuỗi / cửa sổ phản ứng / hỏi trigger / ATK hiệu lực chạy qua API thật và
Sandbox, không cần fixture DEV. Deck mặc định (`STARTER_DECK`) giữ nguyên theo lựa chọn của bạn; lá mới nằm ở deck demo
`EFFECT_DEMO_DECK` và 3 scenario Sandbox mới.

| Lá                           | Hiệu ứng                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------- |
| SMP-019 Ong Bắp Cày Lửa      | Khi Triệu hồi Thường: gây 300 sát thương (bắt buộc)                           |
| SMP-020 Thợ Săn Rừng Bẫy     | Khi Triệu hồi Thường: có thể phá 1 Phép/Bẫy đối thủ (hỏi Kích hoạt/Không)     |
| SMP-021 Bướm Đêm Tro         | Khi bị phá: chủ rút 1 lá (bắt buộc)                                           |
| SMP-022 Chỉ Huy Cờ Hiệu      | Liên tục: quái mình khác +300 ATK                                             |
| SMP-023 Hồn Ma Đầm Lầy       | Liên tục: quái đối thủ −300 ATK                                               |
| SMP-102 Mũi Tên Chớp Nhoáng  | Quick-Play: 500 sát thương (tay ở lượt mình; úp trước để dùng ở lượt đối thủ) |
| SMP-103 Mạch Nước Ấm         | Phép: hồi 1000 LP                                                             |
| SMP-104 Kho Báu Chiến Trường | Phép: bỏ 1 lá (chi phí) → rút 2                                               |
| SMP-202 Hố Sụt Bất Ngờ       | Bẫy: phá 1 quái đối thủ                                                       |
| SMP-203 Tia Lửa Phản Công    | Bẫy: 800 sát thương                                                           |

**Cách xem:**

1. `docker compose up -d`, rồi `pnpm dev` (API :3000, web :5173). _Lần chạy của AI dùng API :3100 / web :5174 vì máy đang có
   project khác chiếm :3000/:5173 — nếu bạn cũng vậy: chạy API với `PORT=3100 CORS_ORIGIN=http://localhost:5173,http://localhost:5174`
   và web với `VITE_API_BASE_URL=http://localhost:3100 npx vite --port 5174`._
2. Mở `http://localhost:5173/dev/sandbox.html`, chọn scenario rồi bấm **Nạp**:
   - `chain-reaction-real`: AI tấn công → bạn thấy banner phản ứng, 2 lá úp viền tím. Chạm **Hố Sụt Bất Ngờ** → nút **Bỏ qua** → quái AI bị phá.
   - `trigger-optional-real`: vừa triệu hồi Thợ Săn Rừng Bẫy → hộp **Kích hoạt / Không**; chọn lá úp của AI → Kích hoạt → AI đáp trả bằng Tia Lửa Phản Công (bạn mất 800).
   - `continuous-real`: số ATK xanh (tăng) / đỏ (giảm) trên lá; rê chuột xem "chỉ số in" ở panel trái.
3. Ảnh chụp thật: `docs/ai/review-packets/task-3.8-screens/` (01–10).

**5 điều cần kiểm tra:**

1. (Checklist #3) Chạm lá Bẫy úp trong cửa sổ phản ứng có kích hoạt ngay, kết quả sát thương/phá đúng như bảng trên?
2. (Checklist #10) Log panel ghi đúng thứ tự: kích hoạt → vào chuỗi → hiệu ứng → vào mộ → chuỗi xong?
3. Hộp Kích hoạt/Không của SMP-020: "Không" có bỏ qua được, "Kích hoạt" chỉ sáng khi đã chọn mục tiêu?
4. ATK xanh/đỏ trên lá (continuous-real) dễ đọc không, khớp panel chi tiết?
5. (Checklist #5) Nhịp animation khi AI đáp trả bằng Bẫy: có kịp nhìn thấy lá AI lật lên không?

**So với reference:**

- Bẫy phản ứng sau tuyên bố tấn công/triệu hồi: khớp `[REF]` video #3/#4. Chạm lá, không hộp thoại: `[DECISION]` C13.
- Chuỗi 2 mắt xích (AI đáp trả trigger của bạn), LIFO, Quick-Play chỉ từ tay ở lượt mình: `[RULE]` — chưa có tư liệu Yugi H5.
- Tên, chỉ số, hiệu ứng 10 lá: placeholder tự đặt (không có lá gốc để đối chiếu), không phải `[REF]`.
- Bố cục banner/ATK màu: `[GUESS]` G16.
- **Lệch nhỏ đã thấy (chưa sửa)**: khi cửa sổ phản ứng đã có 1 mắt xích, banner vẫn ghi "Đối thủ tấn công…" thay vì "chuỗi 1 mắt xích" (ảnh 03).

**Kiểm chứng kỹ thuật:** test đỏ trước (`task-3.8-red.txt`); shared 135, engine 647 (+41, 1 file test/lá), api 320, web 534;
lint/typecheck/build xanh; mutation dữ liệu lá 25/25 (`task-3.8-mutants.txt`); smoke-http 23/23 (`task-3.8-smoke.md`);
smoke-sandbox đạt (`task-3.8-smoke-sandbox.md`); `play-vs-ai` 52/52 và `DECK=effect` 58/58 — 3 chain link thật, 0 lộ bài
(`task-3.8-play-vs-ai-effect.txt`); cổng fuzz leak có lá thật (8×120 trong suite xanh; bản dài 200 seed × 400 bước: 201/201 test xanh, 0 vi phạm — nhưng lệnh vitest thoát mã 1, dòng lỗi
không được giữ lại; nghi là lỗi RPC timeout của vitest với test đồng bộ chạy lâu, chưa xác minh).
Mã engine/API/web: 0 dòng đổi (chỉ thêm test, dữ liệu, tool).

**Cần bạn cung cấp:** không bắt buộc. Nếu có: video Yugi H5 có chuỗi 2+ lá (mục chain trong `docs/plan/human-tasks.md`) để đối
chiếu nhịp/thứ tự; và ý kiến có muốn đưa Phép/Bẫy vào deck mặc định sau khi AI biết tự dùng (P8) không.

**Task tiếp theo:** P4 — card batches + Special Summon / Equip / Field / Counter Trap / Fusion (`docs/plan/MASTER-PLAN.md`);
có thể gộp sửa nhỏ banner chuỗi trong cửa sổ phản ứng.
