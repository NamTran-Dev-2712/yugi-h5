# Review Packet — Task 4.2d: nối wire Flip Summon / Triệu hồi Đặc biệt / Trang bị (+ 3 lá thật + cổng leak)

**Đã làm gì:** 3 cơ chế engine của 4.2a/b/c giờ chơi được qua HTTP và Phaser: chạm quái úp → "Lật ngửa"; lá Phép
Triệu hồi Đặc biệt chọn quái từ tay hoặc từ mộ (dải "Chọn từ mộ"); lá Trang bị nối với quái bằng đường xanh ngọc, ATK
hiệu lực hiện trên lá. Thêm 3 lá thật SMP-044 / SMP-111 / SMP-112, deck `MECH_DEMO_DECK`, 3 scenario Sandbox. Đóng lỗ rò
ADR 4.2a: đối thủ không còn biết lá nào trên tay bị chọn làm mục tiêu (kể cả khi AI chọn). Engine: 0 dòng logic.

**Cách xem:**

1. Bật Docker Desktop → `docker compose up -d` → `pnpm dev`.
2. Mở `http://localhost:5173/dev/sandbox.html`, chọn scenario rồi bấm **Nạp**:
   - `flip-real`: bấm quái úp giữa hàng dưới → **Lật ngửa** → bảng Kích hoạt/Không → bấm quái đối thủ → Xác nhận.
   - `equip-real`: xem đường nối + số ATK xanh 1700; di chuột lên quái để xem chỉ số in 1200 ở panel trái.
   - `special-summon-real`: kéo lá "Hiệu Triệu Đồng Đội" từ tay lên ô Phép/Bẫy → **Kích hoạt hiệu ứng 2** → dải
     "Chọn từ mộ" → bấm "Rồng Tro Tàn" → Xác nhận.
3. Ảnh thật: `docs/ai/review-packets/task-4.2d-screens/` (01–11, chụp bằng `tools/ui-mech-shots.ts`).

**5 điều cần kiểm tra:**

1. Menu "Lật ngửa" chỉ hiện khi chạm quái **úp** của mình và lá lật lên Tư thế Công (ảnh 02–03).
2. Sau khi lật, hiệu ứng LẬT hỏi Kích hoạt/Không; chọn quái đối thủ thì quái đó bị phá (ảnh 04).
3. Lá Trang bị có đường nối tới đúng quái; ATK trên lá là số hiệu lực (xanh), panel trái ghi cả chỉ số in (ảnh 05–06).
4. Kéo lá có 2 hiệu ứng ra sân → menu có 2 mục "Kích hoạt hiệu ứng 1/2" + "Úp" (ảnh 08).
5. Dải "Chọn từ mộ" chỉ có lá quái trong mộ (không có lá Phép), bấm lá → sáng viền → Xác nhận → quái lên sân (ảnh 09–11).

**So với reference:**

- Luật Flip Summon / Special Summon / Equip: `[RULE]` (đã chốt ở 4.2a/b/c; không đổi).
- Ô đặt lá = ô trống thấp nhất: `[ASSUMED]` G17/G18 (giữ nguyên).
- Đường nối Trang bị, dải "Chọn từ mộ", mục "Lật ngửa", thời lượng animation (1,3 s / 0,9 s / 0,7 s): **`[GUESS]` G19**,
  vì chưa có ảnh/clip bản gốc.
- AI lật quái úp khi ATK của nó lớn hơn quái Tấn công mạnh nhất của đối thủ: `[ASSUMED]`. Đây là thay đổi AI **ngoài dự kiến
  của brief**. Lý do: khi FlipSummon lên wire, đối thủ ngẫu nhiên cũng lật được, tỉ lệ thắng của AI tụt 90% → 77%; có
  luật này thì lên 83% (30 ván).

**Số kiểm chứng thật:**

- Test đỏ trước khi code: `task-4.2d-red.txt` (shared 5, engine 12, api 27, web 31 fail).
- Hiện tại: shared 165, engine 830, api 366, web 574 test xanh. `pnpm test --force` toàn workspace xanh 3/3 lần.
- Golden engine không đổi byte.
- Fuzz leak dài 200 seed × 400 bước + 100 ván AI × 200 bước: **301/301**. Tổng 93.671 bước; có 150 lần Triệu hồi Đặc biệt
  từ tay, 219 lần từ mộ, 73 lần hiệu ứng LẬT khi bị tấn công, 27 lần lọc target thật sự xảy ra. Vitest vẫn báo 1 lỗi RPC
  timeout như đã ghi ở ADR 4.1 (`task-4.2d-fuzz-long.txt`).
- Mutant: **33/33** bị bắt (`task-4.2d-mutants.txt`). Lần đầu 32/33: mutant "aiActions không che" sống, nên đã thêm test
  tất định `duel-manager.ai-redact.spec.ts`.
- Chạy thật trên API:
  - smoke-http 23/23 (`task-4.2d-smoke.md`), smoke-sandbox đạt (`task-4.2d-smoke-sandbox.md`).
  - `play-vs-ai`: mặc định 46/46, `DECK=effect` 68/68, `DECK=batch1` 91/91, `DECK=mech` 68/68
    (`task-4.2d-play-vs-ai-mech.txt`).
  - Build api/web xanh; dữ liệu fixture không có trong `dist`.
- Chore test chập chờn: test chi phí `legalActions` giờ đếm công việc (1712 lần tra lá, trần 3500) thay vì đo thời gian
  (24 ms khi chạy riêng, 277 ms khi cả workspace chạy song song). Các test đồng bộ dài giờ nhường event loop giữa từng seed
  nên hết lỗi `onTaskUpdate` timeout.

**Câu hỏi còn mở / Cần bạn cung cấp:**

1. Bạn có đồng ý cho AI lật quái úp (thay đổi AI ngoài brief, xem trên) không?
2. Nếu có clip bản gốc cảnh Triệu hồi Đặc biệt, Lật hoặc Trang bị, xin gửi để chỉnh G19 (`docs/plan/human-tasks.md`).
3. Luật "quái vừa triệu hồi không tấn công" vẫn giữ nguyên, chờ bạn xác nhận ở task riêng.
4. Việc nhỏ đã thấy nhưng chưa sửa:
   - Log AI ghi "bỏ … xuống mộ" cho **mọi** câu trả lời prompt có id (sai với prompt chọn mục tiêu).
   - Dải "Chọn từ mộ" che một phần dòng chữ lượt/phase.

**Task tiếp theo:** 4.3 (Field Spell + Continuous Spell/Trap đầy đủ, Engine).
