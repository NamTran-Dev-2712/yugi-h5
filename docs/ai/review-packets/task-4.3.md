### Review Packet — Task 4.3: Lá Môi trường (Field Spell) + Phép/Bẫy Liên tục + Phép thường đã úp

**Đã làm gì (1-3 dòng):** Engine giờ chơi được **lá Môi trường** (úp hoặc kích hoạt vào ô Môi trường, ở lại sân, lá mới thay lá cũ
của mình), **kích hoạt lá Phép/Bẫy Liên tục** (lên chuỗi rồi ở lại sân ngửa) và **Phép thường đã úp** (kích hoạt từ ô Phép/Bẫy).
Thêm 4 lá thật. Chỉ engine + dữ liệu lá: chưa có hiệu ứng hình/giao diện ô Môi trường (để task 4.3b).

**Cách xem:**

1. Không đổi giao diện nên không có ảnh chụp. Test theo luật:
   `pnpm --filter @yugi/game-engine test field-spell continuous-activation set-spell-activation` (47 test) và 4 lá thật:
   `pnpm --filter @yugi/game-engine test smp-113 smp-114 smp-115 smp-208`.
2. Ván mẫu `packages/game-engine/src/__golden__/field-spell-activate-replace.json`:
   - Lượt 1: úp lá Môi trường sai ô → bị từ chối; úp đúng ô, gọi quái 1000 ATK, kích hoạt ngay trong lượt → quái thành 1500.
     Kích hoạt lại lá đang ngửa → bị từ chối.
   - Lượt 2: đối thủ dùng Phép "phá 1 Phép/Bẫy" → lá Môi trường bị phá.
   - Lượt 3: kích hoạt lá Môi trường A từ tay, rồi lá B → lá A vào mộ. Lá B trừ 400 ATK quái đối thủ: quái 1000 đánh quái 1800
     (còn 1400) chỉ mất 400 LP thay vì 800.
   - Lượt 4: đối thủ phá lá B, đánh trực tiếp 1800. LP cuối 5800 / 8000.
3. Ván mẫu `continuous-spell-trap-stay.json`: Phép Liên tục từ tay ở lại ô 0 (quái 1000 → 1300); Bẫy Liên tục úp, không kích
   hoạt được trong lượt vừa úp; lượt sau đối thủ úp Phép thường rồi kích hoạt ngay, mình đáp trả bằng Bẫy Liên tục (ở lại sân);
   cuối cùng quái 1300 thắng quái 1000 của đối thủ, đối thủ mất 300 LP.
4. Bảng duyệt luật: 6 dòng mới cuối `docs/reference/notes/RULES-REVIEW-SHEET.md` (ô "Đã duyệt" để trống).

**5 điều cần kiểm tra:**

1. **Phép thường / Liên tục / Môi trường đã úp kích hoạt được ngay trong lượt vừa úp** `[RULE]` — bạn đã chốt trong phiên plan,
   khác brief. Chỉ Phép Tức thời và Bẫy phải chờ sang lượt sau. Chỉ kích hoạt được ở Main Phase lượt mình, không dùng để đáp trả.
2. **Mỗi bên một lá Môi trường riêng** `[DECISION]`: lá mới chỉ thay lá của chính mình; lá của đối thủ không bị đụng. Lá bị thay
   tính là **"gửi vào mộ"**, không phải "bị phá" (hiệu ứng "khi bị phá" của nó không kích hoạt) `[ASSUMED]` G20. Bạn muốn tính là
   "bị phá" không?
3. **Lá Liên tục ở lại sân** sau khi xử lý, không có nút "kích hoạt lại". Bị phá thì hiệu ứng hết ngay. Phép Liên tục từ tay tự vào
   **ô Phép/Bẫy trống thấp nhất** `[ASSUMED]` G20 (khi làm giao diện có thể cho thả vào ô cụ thể).
4. **Lá "phá 1 Phép/Bẫy" phá được lá Môi trường** (kể cả đang úp) `[RULE]`. Kiểm tra bạn có muốn vậy không: các lá SMP-020,
   SMP-105, SMP-204 hiện có đều chọn được lá Môi trường.
5. **4 lá mới** (tên và số liệu tự đặt, không phải lá Konami): SMP-113 "Thảo Nguyên Lộng Gió" (Môi trường: quái hệ GIÓ hai bên
   +300 ATK), SMP-114 "Quân Kỳ Tập Hợp" (Phép Liên tục: Chiến Binh của mình +300 ATK), SMP-115 "Tàn Lửa Âm Ỉ" (Phép thường: 600
   sát thương), SMP-208 "Màn Sương Rã Rời" (Bẫy Liên tục: quái đối thủ −300 ATK). **Lệch brief**: lá Bẫy mang id SMP-208 thay vì
   SMP-116, vì dãy 2xx dành cho Bẫy.

**So với reference:** chưa có video/ảnh bản gốc nào cho lá Môi trường hay lá Liên tục. Mọi thứ theo `[RULE]` luật YGO chuẩn, trừ
các điểm `[ASSUMED]` G20 (mục mới ở `docs/plan/fidelity-spec.md`) và 2 quyết định `[DECISION]` của bạn ở trên. Dòng
"early Master Rule: cả sân chỉ 1 lá Môi trường" ở `docs/plan/rules-coverage.md` đã sửa theo quyết định "mỗi bên 1 lá".

**Kiểm chứng kỹ thuật (số thật):**

- Test đỏ trước: `task-4.3-red.txt` — engine 54/63 test mới fail trước khi cài. Phần schema ở shared tôi viết cùng lúc với test,
  nên **không có bản đỏ riêng cho shared**.
- Sau khi làm: shared 177, engine 895, api 369, web 574 (`pnpm test --force`, 6/6 task). `pnpm lint` 4/4, `pnpm typecheck` 6/6,
  build api + web: xanh.
- Golden: 2 case mới. **1 file cũ đổi có chủ đích**: `spell-set-and-activate` (đối thủ úp Phép rồi kích hoạt cùng lượt: trước bị từ
  chối, nay xử lý thật). 15 file còn lại không đổi nội dung.
- 5 test cũ sửa có chủ đích (trước đây khẳng định "chưa kích hoạt được"): `activate-effect.test.ts` (2 chỗ),
  `trap-activation.test.ts` (2 dòng), `legal-actions.spells.test.ts` (1 dòng); shared `effects.test.ts` (2 chỗ). Một test "bộ kiểm
  bắt được engine hỏng" được thu hẹp phép phá (không nới điều kiện bắt lỗi) — lý do ở ADR 063.
- Fuzz 200 seed × 400 bước với 5 lá mới + 4 bất biến mới: 215/215 (`task-4.3-fuzz-long.txt`). Độ phủ 60 × 400: úp lá Môi trường
  43 lần, kích hoạt 48, thay 2, bị phá 4, lá Liên tục ở lại 35, Phép thường đã úp 29.
- Mutation `tools/mutants-4.3.mjs`: **41/41** bị bắt (`task-4.3-mutants.txt`). Lần chạy đầu 40/41: mutant sống là do mẫu thay thế
  trúng nhầm lá SMP-023 có cùng dòng dữ liệu; đã neo mẫu theo id hiệu ứng và chạy lại toàn bộ.
- **Chưa chạy**: smoke HTTP thật (`tools/smoke-http.ts`, `play-vs-ai`) — task chỉ đổi engine, API chỉ thêm 3 nhánh bỏ event.

**Điều cần biết về "chưa lên wire":**

- Event mới của ô Môi trường chưa gửi cho client. Riêng trạng thái ô Môi trường thì `StateView` đã có sẵn từ task 2.1 (lá úp
  được che với đối thủ), nên tôi không sửa gì ở đó.
- **Phép thường đã úp kích hoạt được qua HTTP/giao diện ngay từ bây giờ**: `Úp` và `Kích hoạt` đã có trên wire từ 3.2b và dùng
  toàn event cũ. Tôi chưa chơi thử trên giao diện.
- Lệch nhỏ khỏi "engine-only": kiểu `ChainLinkSourceView` ở shared thêm giá trị `FieldZone` (chỉ là kiểu dữ liệu, web không đọc).

**Cần bạn cung cấp:** không bắt buộc. Trả lời câu 2 (gửi vào mộ hay bị phá) và câu 4. Video/ảnh bản gốc có lá Môi trường hoặc
Phép/Bẫy Liên tục sẽ giúp đổi G20 sang `[REF]` (thêm vào `docs/plan/human-tasks.md` nếu bạn có).

**Task tiếp theo:** **4.3b** — nối wire 4.3: 3 event ô Môi trường vào `EventView`, giao diện ô Môi trường (kéo thả Úp/Kích hoạt,
animation, log), 4 lá mới vào deck demo + scenario Sandbox, mở rộng fuzz chống rò với lá Môi trường úp. Gộp 3 việc nhỏ còn nợ:
câu log AI "bỏ … xuống mộ" sai với prompt chọn mục tiêu; dải "Chọn từ mộ" che dòng phase; banner chuỗi khi cửa sổ phản ứng đã
có mắt xích. Còn nợ trong engine: lá Trang bị đã úp chưa kích hoạt được. Hướng khác: 4.4 (Counter Trap / Negate).
