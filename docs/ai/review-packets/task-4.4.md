### Review Packet — Task 4.4: Bẫy Phản công (Counter Trap) + vô hiệu kích hoạt / tấn công / triệu hồi

**Đã làm gì (1-3 dòng):** Engine giờ có **Bẫy Phản công** (Spell Speed 3: chỉ kích hoạt để đáp trả, không tự mở chuỗi) và ba hiệu
ứng **vô hiệu**: vô hiệu việc kích hoạt một lá Phép/Bẫy, vô hiệu một đòn tấn công, vô hiệu một lần triệu hồi. Thêm 3 lá thật
(SMP-201 hết là placeholder, SMP-209, SMP-210). Chỉ engine + dữ liệu lá: giao diện chưa có dòng log / hiệu ứng hình "vô hiệu"
(để task 4.4b).

**Cách xem:**

1. Không đổi giao diện nên không có ảnh chụp. Test theo luật (55 test):
   `pnpm --filter @yugi/game-engine test counter-trap negate-activation negate-attack negate-summon` và 3 lá thật (14 test):
   `pnpm --filter @yugi/game-engine test smp-201 smp-209 smp-210`.
2. Bốn ván mẫu ở `packages/game-engine/src/__golden__/` (cùng một lần chia bài; đọc `steps[].events` và `finalState`):
   - `counter-negates-spell.json` — P1 úp 2 Bẫy Phản công (kích hoạt ngay trong lượt úp: bị từ chối). Lượt sau P0 dùng Phép "rút 1
     lá"; P1 đáp bằng Bẫy Phản công, trả 1000 LP: Phép bị vô hiệu, vào mộ, **không rút lá nào**. Lượt của P1: thử tự kích hoạt Bẫy
     Phản công còn lại → bị từ chối (`NOTHING_TO_RESPOND_TO`). LP cuối 8000 / 7000.
   - `counter-negates-continuous-spell.json` — P0 kích hoạt Phép Liên tục (+300 ATK, lá nằm ngửa ở ô Phép/Bẫy); P1 vô hiệu: lá
     **rời sân vào mộ**. Quái 1800 của P0 đánh trực tiếp đúng **1800** (không phải 2100). LP cuối 8000 / 5200.
   - `negate-attack.json` — P0 đánh trực tiếp; P1 lật Bẫy thường "vô hiệu đòn tấn công": không mất LP. Quái đó đánh lại trong
     lượt → bị từ chối (đã tính là tấn công rồi). LP cuối 8000 / 8000.
   - `negate-summon.json` — P0 Lật quái úp (P1 cho qua), rồi Triệu hồi Thường quái thứ hai; P1 vô hiệu: quái đó **vào mộ**, quyền
     Triệu hồi Thường của lượt vẫn mất. Quái vừa Lật đánh trực tiếp 1800.
3. Bảng duyệt luật: 5 dòng mới cuối `docs/reference/notes/RULES-REVIEW-SHEET.md` (2 dòng thuần `[RULE]` AI duyệt thay theo ủy
   quyền; 3 dòng có `[ASSUMED]` để trống cho bạn).

**5 điều cần kiểm tra:**

1. **Bẫy Phản công không bao giờ tự mở chuỗi** `[RULE]` — ở mọi phase, kể cả lượt mình. Nó chỉ kích hoạt khi đang có một lá để
   đáp, hoặc ngay sau đòn tấn công / lần triệu hồi của đối thủ. Bẫy thường (như SMP-201) thì vẫn theo luật Bẫy cũ.
2. **Lá bị vô hiệu kích hoạt đi vào mộ, cost không hoàn** `[ASSUMED]` G23: người bị vô hiệu vẫn mất LP / lá đã trả làm chi phí.
   Lá Phép Liên tục / Môi trường / Trang bị vừa đặt ngửa cũng vào mộ và chỉ số cộng thêm biến mất ngay. Lá bị vô hiệu tính là
   **"gửi vào mộ"**, không phải "bị phá" (hiệu ứng "khi bị phá" của nó không kích hoạt). Bạn muốn giữ như vậy không?
3. **Vô hiệu triệu hồi chỉ áp dụng cho Triệu hồi Thường (kể cả hiến tế) và Triệu hồi Lật** — bạn đã chốt trong phiên plan (khác
   brief). Quái bị vô hiệu **vào mộ** (không tính "bị phá"), không được Triệu hồi Thường lại trong lượt, quái đã hiến tế không
   trả lại `[ASSUMED]` G23. Úp quái thì không vô hiệu được.
4. **Giới hạn cần bạn quyết** (câu hỏi mở): quái có hiệu ứng "khi được triệu hồi" mà hiệu ứng đó đã lên chuỗi thì **không** vô
   hiệu triệu hồi được nữa — vì engine hiện đưa hiệu ứng đó lên chuỗi trước rồi mới cho đối thủ phản ứng (từ task 3.5). Luật
   chuẩn thì ngược lại (được vô hiệu triệu hồi trước). Đổi thứ tự là một task engine riêng, sẽ đổi hành vi cũ. Giữ hay đổi?
5. **3 lá** (tên tự đặt, không phải lá Konami): SMP-201 "Rào Chắn Hộ Vệ" (Bẫy thường: vô hiệu đòn tấn công của đối thủ — không
   kết thúc Battle Phase, quái khác vẫn đánh được), SMP-209 "Ấn Chú Phong Tỏa" (Bẫy Phản công, trả 1000 LP: vô hiệu việc kích
   hoạt một lá Phép/Bẫy của đối thủ — không đáp được hiệu ứng của quái), SMP-210 "Cổng Khước Từ" (Bẫy Phản công: vô hiệu Triệu
   hồi Thường / Lật). Chưa lá nào nằm trong deck demo.

**So với reference:** chưa có video/ảnh bản gốc nào về Bẫy Phản công hay việc vô hiệu. "Chỉ đáp trả", "chỉ Speed 3 đáp Speed 3",
"Bẫy Phản công đáp được mọi Speed" theo `[RULE]` luật YGO chuẩn (dòng Speed 3 bạn đã ☑ từ task 3.4). Các điểm chưa có tư liệu gom
vào **G23** mới ở `docs/plan/fidelity-spec.md`, đều nhãn `[ASSUMED]`:
(a) cost không hoàn; (b) lá bị vô hiệu "gửi vào mộ"; (c) quái bị vô hiệu triệu hồi "gửi vào mộ", không hoàn quyền triệu hồi / hiến
tế; (d) lá vô hiệu triệu hồi phải là mắt xích đầu tiên, và giới hạn ở điều 4; (e) hiệu ứng của quái bị vô hiệu thì quái ở yên;
(f) đòn bị vô hiệu vẫn tính là đã tấn công; chỉ vô hiệu được thứ của đối thủ.

**Kiểm chứng kỹ thuật (số thật):**

- Test đỏ trước: `task-4.4-red.txt` — shared 10 test fail, engine 63 test fail (11 file) trước khi viết code.
- Sau khi làm (`pnpm test --force`, 6/6 task): shared **193**, engine **975**, api **415**, web **636** (trước: 183 / 895 / 412 /
  636). `pnpm lint` 4/4, `pnpm typecheck` 6/6, `pnpm build` 4/4.
- Golden: 4 case mới; **18 file cũ không đổi byte**.
- Test cũ sửa có chủ đích: 2 test Bẫy Phản công ở `quick-play-and-speed.test.ts` (trước khẳng định "tự mở chuỗi được"); 3 chỗ so
  sánh cửa sổ Summon nay có thêm thông tin "quái vừa triệu hồi"; shared `effects.test.ts` 2 chỗ (danh sách operation; ví dụ "kind
  lạ" trước dùng đúng tên `NegateAttack`).
- Fuzz engine dài: 200 seed bộ bài đầy đủ + 200 seed bộ bài thiên về lá vô hiệu, mỗi seed 400 bước — **417/417**, 0 vi phạm
  (`task-4.4-fuzz-long.txt`). Độ phủ 80 seed × 400 bước: 10 lần Bẫy Phản công lên chuỗi, 5 lần vô hiệu kích hoạt (2 lần là lá ở
  lại sân), 6 lần vô hiệu tấn công, 5 lần vô hiệu triệu hồi. Con số nhỏ: với bộ bài ngẫu nhiên đầy đủ gần như không bao giờ có
  lần vô hiệu nào, nên tôi thêm một bộ bài fuzz riêng.
- Fuzz chống rò của api chạy lại bản dài (100 seed × 400 bước): **202/202**, 65.652 bước, 0 vi phạm (`task-4.4-fuzz-leak.txt`).
- Mutation `tools/mutants-4.4.mjs`: **40/40** bị bắt ngay lần đầu (`task-4.4-mutants.txt`) — gồm: bỏ luật "chỉ đáp trả", bỏ
  kiểm Speed 3, vô hiệu sai mắt xích, lá Liên tục / Môi trường không bị gỡ, hoàn cost, đòn bị vô hiệu vẫn gây sát thương.
- **Chưa chạy**: smoke HTTP thật (`tools/smoke-http.ts`, `play-vs-ai`) và chưa chơi thử trên giao diện — task chỉ đổi engine.

**Lệch brief / điều cần biết:**

- **Có đụng `apps/api` và `apps/web`** dù brief ghi không sửa — bạn đã đồng ý qua 2 lần hỏi: (1) api thêm 3 nhánh "bỏ event" +
  web thêm 2 câu báo lỗi vi/en, vì thiếu chúng thì typecheck / test đỏ; (2) sửa 2 file **test** của api vì SMP-201 nay có hiệu
  ứng thật (một bộ fuzz cũ tính sai "ai đến lượt" khi cửa sổ phản ứng mở; một bộ fuzz tự gom mọi lá có hiệu ứng nên mất độ phủ
  khi thêm 3 lá). Code chạy thật của api và bộ kiểm chống rò không đổi.
- **SMP-201 đã có hiệu ứng trên server ngay bây giờ**: scenario Sandbox cũ có SMP-201 đã úp (vd `chain-basic`) — nếu bên kia tấn
  công thì chủ lá sẽ thấy cửa sổ phản ứng và kích hoạt được. Kết quả đúng, nhưng giao diện chưa có dòng log "đã vô hiệu".
- Brief hỏi "Bẫy Phản công có chồng được lên mắt xích Speed 1 không": được, và đây là `[RULE]` bạn đã ☑ ("đáp được mọi Speed")
  nên tôi không ghi thành `[GUESS]`.
- Chi tiết thiết kế: ADR `docs/ai/decisions/065-2026-10-02-task-4.4-counter-trap-negate.md`.

**Cần bạn cung cấp:** không bắt buộc. Trả lời điều 2, 3 (giữ quy ước G23?) và điều 4 (giữ hay đổi thứ tự). Video/ảnh bản gốc có
Bẫy Phản công hoặc lá vô hiệu sẽ giúp đổi G23 sang `[REF]`.

**Task tiếp theo:** **4.4b** — nối wire + giao diện cho 4.4: gửi 3 event "vô hiệu" cho client, dòng log + hiệu ứng hình, mở rộng
fuzz chống rò với lá vô hiệu, deck demo + scenario Sandbox cho SMP-201/209/210, AI biết dùng lá vô hiệu. Hướng khác: lá Trang bị
đã úp chưa kích hoạt được (task engine nhỏ); 4.5 Fusion.
