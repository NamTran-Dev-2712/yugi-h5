# Review Packet — Task 4.3b: dọn nợ duyệt + nối wire 4.3 (ô Môi trường, lá ở lại sân)

> **Đọc trước:** kết quả Phase 0 (dọn nợ duyệt) nằm gọn trong một trang —
> [`task-4.3b-triage.md`](./task-4.3b-triage.md): AI tự xử lý 25 mục, bạn chọn 13 mục (8 câu trắc nghiệm), còn chờ 5.

**Đã làm gì:** (1) Dọn nợ duyệt: sửa tài liệu lệch code, đánh dấu 21 dòng luật còn trống trong bảng duyệt (10 dòng AI duyệt
thay, 11 dòng theo câu trả lời của bạn), thêm 1 dòng "quái vừa triệu hồi chưa tấn công" để trống chờ video. (2) Lá Môi trường,
lá Phép/Bẫy Liên tục và Phép thường đã úp giờ **chơi được trên giao diện thật**: kéo lá Môi trường vào ô Môi trường, chạm lá úp
để kích hoạt, lá ở lại sân có dấu "đang hiệu lực", số ATK đổi màu theo buff. Thêm deck `FIELD_DEMO_DECK` và 4 màn Sandbox.
(3) Sửa 3 việc nhỏ còn nợ: câu nhật ký của AI, thanh "Xác nhận" đè dòng lượt, banner chuỗi. Engine: 0 dòng.

**Cách xem:**

1. Bật Docker Desktop → `docker compose up -d` → `pnpm dev`.
2. Mở `http://localhost:5173/dev/sandbox.html`, chọn màn rồi bấm **Nạp**:
   - `field-real`: kéo lá "Thảo Nguyên Lộng Gió" từ tay → chỉ ô **Môi trường** (bên trái hàng quái) sáng lên → thả → chọn
     **Kích hoạt**. Kéo tiếp lá thứ hai vào đó → lá cũ vào mộ.
   - `field-set-real`: lá Môi trường đang úp sẵn (viền tím) → chạm vào là kích hoạt.
   - `continuous-real-2`: kéo "Quân Kỳ Tập Hợp" vào ô Phép/Bẫy → **Kích hoạt**; chạm lá Bẫy úp; bấm **Bỏ qua** nếu chuỗi còn chờ.
   - `normal-set-real`: kéo "Tàn Lửa Âm Ỉ" vào ô Phép/Bẫy → **Úp** → chạm lá vừa úp → đối thủ mất 600 LP ngay trong lượt.
3. Chơi cả ván với deck mới: `DECK=field node --experimental-strip-types tools/play-vs-ai.ts` (máy tự chơi, in kết quả).
4. Ảnh thật: `docs/ai/review-packets/task-4.3b-screens/` (01–17, chụp bằng `tools/ui-field-shots.ts`).

**5 điều cần kiểm tra bằng mắt:**

1. Kéo lá Môi trường: **chỉ ô Môi trường của mình** sáng viền; thả ra có menu "Kích hoạt" / "Úp" (ảnh 02–03).
2. Lá Môi trường ngửa có viền xanh + hình thoi + chấm vàng; quái hệ GIÓ của **cả hai bên** +300 ATK, số màu xanh (ảnh 04–06).
3. Kéo lá Môi trường thứ hai vào: lá cũ vào mộ (ô Mộ tăng 1), nhật ký ghi "Lá Môi trường … bị thay, vào mộ" (ảnh 07).
4. Lá Phép/Bẫy Liên tục kích hoạt xong **ở lại sân, ngửa**, có chấm vàng; Chiến Binh của mình +300, quái đối thủ −300
   (ảnh 12–14). Phép thường úp rồi kích hoạt ngay trong lượt (ảnh 15–16).
5. Khi phải chọn mục tiêu, thanh "Xác nhận" nằm **dưới** dòng "Lượt N · Lượt của bạn · Main 1", không đè lên chữ (ảnh 17).

**So với reference:**

- Luật Field / Continuous / Phép đã úp: không đổi so với 4.3 (`[RULE]` + `[DECISION]` + `[ASSUMED]` G20 — bạn đã chấp nhận
  qua hộp thoại 2026-10-01).
- Vị trí và hình thức ô Môi trường, dấu "đang hiệu lực", thanh chọn, thời lượng animation (0,5 s / 0,35 s / 0,375 s):
  **`[GUESS]` G21** — chưa có ảnh/clip bản gốc về lá Môi trường.
- "Quái vừa triệu hồi chưa tấn công trong lượt đó": **`[GUESS]` G22** (bạn chọn "giữ tạm"; khác luật Yu-Gi-Oh chuẩn).

**Số kiểm chứng thật:**

- Test đỏ trước khi code: `task-4.3b-red.txt` (shared: chưa có file deck; api 21 fail; web 41 fail).
- Hiện tại: shared 183, engine 895 (không đổi), api 412, web 636 test xanh; lint, typecheck, build api + web xanh.
- Engine: 0 file đổi; golden không đổi byte.
- Fuzz chống rò dài: **402/402** (200 seed × 400 bước + 100 seed deck Môi trường + 100 seed đấu AI), 131.164 bước, 0 vi
  phạm. Đã phủ: úp lá Môi trường 719 lần, kích hoạt từ tay 259 / từ ô 375, thay lá 225, phá lá Môi trường **đang úp** 247
  (`task-4.3b-fuzz-long.txt`). Vitest vẫn báo 1 lỗi RPC timeout quen thuộc và thoát mã 1 dù mọi test xanh.
- Mô phỏng AI 100 ván với deck Môi trường: 100/100 ván kết thúc, AI **0 lần** tự úp/kích hoạt Phép/Bẫy.
- Mutant: **39/39** bị bắt (lần đầu 38/39: 1 mutant chưa áp được vì formatter đổi dòng mẫu thay thế, sửa mẫu rồi chạy lại: bị bắt) (`task-4.3b-mutants.txt`), gồm mutant bắt buộc "gửi `FieldSpellSet` kèm tên lá".
- Chạy thật trên API: smoke-http 23/23 (`task-4.3b-smoke-http.md`), smoke-sandbox đạt với 7 màn
  (`task-4.3b-smoke-sandbox.md`), `play-vs-ai` mặc định 55/55, `DECK=field` 68/68 (`task-4.3b-play-vs-ai*.txt`).

**Câu hỏi còn mở / Cần bạn cung cấp:**

1. **Buff có hiệu lực ngay khi lá Liên tục/Môi trường nằm ngửa**, kể cả khi đối thủ còn được đáp trả (ảnh 12: chuỗi còn chờ
   mà ATK đã +300). Luật chuẩn là sau khi lá xử lý xong mới có hiệu lực. Giữ như hiện tại hay đổi? (đổi = task engine riêng)
2. 5 mục còn chờ ở `docs/ai/OPEN-ISSUES.md`: gỡ thư viện không dùng `nestjs-zod`; id SMP-208; AI tự lật quái úp; G22; mở rộng
   danh sách bảng DB cho P10.
3. Nếu có clip bản gốc có lá Môi trường / lá Liên tục, hoặc cảnh quái vừa triệu hồi tấn công ngay: xin gửi
   (`docs/plan/human-tasks.md`, dòng P4 mới).
4. Việc nhỏ thấy nhưng chưa sửa: dải chú thích animation giữa bàn vẫn đè lên dòng lượt/phase **trong lúc đang phát animation**;
   màn Sandbox chưa đặt sẵn được lá ở ô Môi trường (phải bắt đầu từ tay).

**Bàn giao cho task sau:**

- Đề xuất **4.4 — Counter Trap / Negate** (SMP-201 vẫn là lá giữ chỗ), lớp Engine.
- Hoặc task engine nhỏ: **Equip Spell đã úp** vẫn chưa kích hoạt được (`NOT_ACTIVATABLE`).
- Nếu bạn trả lời câu 1 là "đổi": task engine riêng "hiệu ứng liên tục chỉ có hiệu lực sau khi lá xử lý xong".
- Luật tấn công (G22) giữ nguyên; nếu sau này chọn "được tấn công ngay" thì là task đổi luật riêng.
- Chi tiết kỹ thuật: ADR 064, `docs/ai/progress/p4.md` mục "Task 4.3b".
