# Review Packet — Task 4.4b: nối wire + giao diện cho Bẫy Phản công / vô hiệu

**Đã làm gì:** (1) Ghi các quyết định bạn chốt 2026-10-02 vào tài liệu (G23 giữ, buff có hiệu lực ngay khi lá ngửa giữ,
thứ tự "vô hiệu triệu hồi ↔ hiệu ứng khi triệu hồi" hoãn), gỡ thư viện không dùng `nestjs-zod`. (2) Ba lá vô hiệu
(Rào Chắn Hộ Vệ — vô hiệu đòn tấn công; Cổng Khước Từ — vô hiệu triệu hồi; Ấn Chú Phong Tỏa — trả 1000 LP, vô hiệu
Phép/Bẫy) giờ **chơi được trên giao diện thật**: nhật ký có dòng "bị vô hiệu", có animation dấu X đỏ, thêm deck
`NEGATE_DEMO_DECK` và 3 màn Sandbox. (3) Sửa nợ cũ: dải chú thích animation không còn đè dòng "Lượt N · … · phase".
Engine: 0 dòng (không file nào dưới `packages/game-engine` đổi).

**Cách xem:**

1. Bật Docker Desktop → `docker compose up -d` → `pnpm dev`.
2. Mở `http://localhost:5173/dev/sandbox.html?slow=1` (`?slow=1` = animation chậm 3 lần cho dễ nhìn; bỏ đi để xem tốc độ
   thật), chọn màn rồi bấm **Nạp**. Cả 3 màn đều để máy đi trước, nạp xong là tới lượt bạn phản ứng:
   - `negate-attack-real`: máy tấn công → dải tím "Đối thủ tấn công…" → chạm lá úp sáng viền tím ở hàng dưới.
   - `counter-summon-real`: máy triệu hồi → dải tím "Đối thủ triệu hồi…" → chạm lá úp sáng viền.
   - `counter-spell-real`: máy đã kích hoạt Phép Liên tục "Quân Kỳ Tập Hợp" (2 quái của nó đã +300, số màu xanh) → chạm
     lá úp sáng viền (mất 1000 LP). Muốn xem trường hợp không vô hiệu: bấm **Bỏ qua**.
3. Chơi cả ván với deck mới: `DECK=negate node --experimental-strip-types tools/play-vs-ai.ts` (máy tự chơi, in kết quả).
4. Ảnh thật: `docs/ai/review-packets/task-4.4b-screens/` (01–14, chụp bằng `tools/ui-negate-shots.ts`).

**5 điều cần kiểm tra bằng mắt:**

1. **Bẫy Phản công không kích hoạt được ở Main Phase của mình**: lá úp không sáng viền, chạm vào không có gì xảy ra, không
   có mục "Kích hoạt"; kéo lá Phản công từ tay vào ô Phép/Bẫy thì úp luôn (ảnh 11–14).
2. **Đòn bị vô hiệu không mất LP**: mũi tên tấn công khựng lại, quái tấn công có dấu X đỏ; LP vẫn 8000, quái của bạn còn
   nguyên, lá bẫy vào mộ (ảnh 03–04).
3. **Lá Liên tục bị vô hiệu thì buff biến mất**: trước khi đáp trả 2 quái của máy là 1500 / 1900 (ảnh 08); sau khi vô
   hiệu lá Phép vào mộ, số trở lại 1200 / 1600, bạn còn 7000 LP (ảnh 09–10).
4. **Quái bị vô hiệu triệu hồi vào mộ và máy không triệu hồi lại**: dấu X trên quái, ô Mộ của máy tăng 1, máy vẫn còn 1
   lá trên tay nhưng kết thúc lượt (ảnh 06–07).
5. **Nhật ký có dòng "bị vô hiệu"** cho cả ba trường hợp, và dải chú thích animation nằm **dưới** dòng lượt/phase, không
   đè chữ (ảnh 03, 06, 09).

**So với reference:**

- Luật vô hiệu: không đổi so với 4.4. **G23** (`[ASSUMED]`: cost không hoàn; lá / quái bị vô hiệu "gửi vào mộ", không "bị
  phá") — bạn đã chốt **giữ** 2026-10-02; chưa có `[REF]`.
- Hình thức và thời lượng animation vô hiệu (0,5 s, dấu X đỏ, mũi tên khựng, chữ gạch ngang), nhóm nhật ký, vị trí dải
  chú thích: **`[GUESS]` G24** — chưa có clip bản gốc về Bẫy Phản công.
- **Giới hạn đã biết (hoãn theo quyết định của bạn):** quái có hiệu ứng "khi được triệu hồi" đã lên chuỗi thì **không** vô
  hiệu triệu hồi được (luật chuẩn: vô hiệu triệu hồi đứng trước). Sẽ sửa ở task engine nhỏ trước 4.5.
- Buff có hiệu lực ngay khi lá Liên tục nằm ngửa (kể cả lúc còn chờ đáp trả): giữ như bạn chốt — thấy rõ ở ảnh 08.

**Số kiểm chứng thật:**

- Test đỏ trước khi code: `task-4.4b-red.txt` (shared: chưa có file deck; api 16 fail / 4 file; web 23 fail / 6 file).
- Hiện tại: shared **200** (+7), engine **975** (không đổi), api **466** (+51), web **674** (+38); lint 4/4, typecheck
  6/6, build 4/4 xanh. Engine: 0 file đổi, golden không đổi byte.
- Fuzz chống rò dài: **553/553** test xanh (200 seed × 400 bước + 100 seed đấu AI + 100 seed deck Môi trường + 100 seed
  deck vô hiệu + 50 seed deck vô hiệu đấu AI), 188.542 bước, 1.114 ván, **0 vi phạm**. Đã phủ: vô hiệu kích hoạt 267 lần,
  vô hiệu tấn công 432 (51 lần mục tiêu là quái úp), vô hiệu triệu hồi 372, Bẫy Phản công kích hoạt 978, Bẫy úp bị phá khi
  đang úp 525, người vô hiệu việc của AI 263 (`task-4.4b-fuzz-long.txt`). Vitest vẫn báo 1 lỗi RPC timeout quen thuộc và
  thoát mã 1 dù mọi test xanh.
- Mô phỏng AI 100 ván với deck vô hiệu (`task-4.4b-ai-sim.txt`): 100/100 ván kết thúc; AI **0 lần** tự úp/kích hoạt
  Phép/Bẫy (3.831 lượt có lá vô hiệu để úp); khi có lá vô hiệu úp sẵn AI giữ 844 cửa sổ và cho qua cả 844; bị một ghế thử
  nghiệm vô hiệu 72 lần vẫn 100/100 ván kết thúc.
- Mutant: **37/37** bị bắt (`task-4.4b-mutants.txt`: 33 trong lần chạy chính + 4 mutant rò chạy lại chỉ với cổng fuzz để
  chắc chính oracle bắt được), gồm các mutant bắt buộc: event vô hiệu mang tên lá úp / lá trên tay, quên gửi 1 trong 3
  event, animation bỏ bước vô hiệu, giao diện cho kích hoạt Bẫy Phản công ở Main Phase.
- Chạy thật trên API: smoke-http 23/23, smoke-sandbox 71/71 (10 màn, có 3 màn mới), `play-vs-ai` mặc định 81/81,
  `DECK=negate` 67/67 (`task-4.4b-smoke-*.md`, `task-4.4b-play-vs-ai*.txt`).

**Chưa làm / lệch kế hoạch (nói thẳng):**

- **Chưa chụp** ảnh trang debug cho câu báo lỗi "Bẫy Phản công chỉ kích hoạt được để đáp trả…": giao diện chính không bao
  giờ gửi hành động sai nên không gặp lỗi này; câu vi/en có test, API trả đúng mã lỗi (có test).
- Kế hoạch ghi sẽ đổi câu toast khi chạm lá úp chưa dùng được; đọc lại thì chạm lá như vậy vốn **không làm gì, không
  toast** nên không đổi.
- Trong ván `DECK=negate` chạy thật, máy chỉ bị vô hiệu 1 lần triệu hồi (0 lần tấn công) — đủ đạt kiểm tra nhưng ít; các
  trường hợp còn lại được phủ bởi 3 màn Sandbox và fuzz.
- Thêm ngoài brief: `?slow=1` (animation chậm 3 lần) để nhìn và chụp được bước 0,5 s.

**Câu hỏi còn mở / Cần bạn cung cấp:**

1. Nếu có clip bản gốc có Bẫy Phản công hoặc một lá bị vô hiệu: xin gửi (`docs/plan/human-tasks.md`, dòng P4 mới) — để
   thay G23 / G24 bằng tư liệu thật.
2. Việc nhỏ thấy nhưng chưa sửa (ngoài phạm vi): panel Nhật ký tràn lên trên tiêu đề khi log dài (thấy ở ảnh 09, 10).
   Sửa luôn ở task UI kế tiếp hay để P6?
3. Còn chờ từ trước: G22 (quái vừa triệu hồi chưa tấn công ngay) và bảng DB cho P10 (`docs/ai/OPEN-ISSUES.md`).

**Task tiếp theo (đề xuất):**

- **Trước:** task engine nhỏ gồm (a) đưa cửa sổ vô hiệu triệu hồi lên **trước** hiệu ứng "khi triệu hồi" và (b) cho kích
  hoạt Equip Spell đã úp. Lý do đi trước: (a) đổi hành vi của 3.5 và phải ghi lại một số golden cũ — làm trước khi Fusion
  thêm một loại triệu hồi mới thì ít thứ phải ghi lại hơn, và Fusion cũng cần cửa sổ triệu hồi đúng thứ tự.
- **Sau:** 4.5 Fusion (cần thêm: Extra Deck của chủ sở hữu trên `StateView`).
- Chi tiết kỹ thuật: ADR 066, `docs/ai/progress/p4.md` mục "Task 4.4b".
