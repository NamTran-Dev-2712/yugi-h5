### Review Packet — Task 4.2c: Equip Spell (lá Trang bị) + tổng kết 4.2

**Đã làm gì (1-3 dòng):** Lá **Trang bị** (Equip Spell) chạy được trong engine. Kích hoạt từ tay, gắn vào 1 quái ngửa (của mình
hoặc đối thủ), cộng/trừ chỉ số đúng quái đó, và **vào mộ theo** khi quái rời sân. Theo bạn chốt: không thêm "Duration", dùng
`ModifyStat.equipped`. Chỉ engine, chưa lên HTTP/giao diện.

**Cách xem:**

1. Không đổi giao diện nên không có ảnh chụp. Test: `pnpm --filter @yugi/game-engine test equip` (16 test).
2. Ván mẫu: `packages/game-engine/src/__golden__/equip-buff-and-detach.json`.
   - Lượt 1: thử Trang bị khi chưa có quái → bị từ chối (`NO_VALID_TARGET`). Triệu hồi quái 1000 ATK, rồi Trang bị (+500):
     lá nằm ngửa ở ô Phép/Bẫy 0, quái thành 1500.
   - Lượt 3: quái 1500 tấn công quái 1800 → quái của mình bị phá, mất 300 LP, lá Trang bị vào mộ theo. LP cuối 7700/8000.
3. Bảng duyệt luật: 2 dòng mới cuối `docs/reference/notes/RULES-REVIEW-SHEET.md` (ô "Đã duyệt" để trống).

**5 điều cần kiểm tra:**

1. Quái được trang bị rời sân (bị phá, bị hiến tế…) ⇒ lá Trang bị **vào mộ theo** `[RULE]`. Tính là **"gửi vào mộ"**, không
   phải **"bị phá"**: hiệu ứng "khi bị phá" của lá Trang bị (nếu có) không kích hoạt `[ASSUMED]` G18. Bạn muốn tính là "bị phá"
   không?
2. Chỉ trang bị được cho quái **ngửa** `[RULE]`. Lá Trang bị bị phá riêng thì quái mất buff ngay.
3. Lá vào **ô Phép/Bẫy trống thấp nhất**, tự chọn `[ASSUMED]` G18. Khi làm giao diện có thể cho kéo thả vào ô cụ thể.
4. Lá Trang bị **không chuyển** sang quái khác. **Úp rồi kích hoạt** lá Trang bị chưa hỗ trợ (backlog, cùng Phép thường đã úp).
5. Mục tiêu của lá đã rời sân trước khi hiệu ứng xử lý ⇒ lá không gắn gì và vào mộ `[RULE]`. Lá Trang bị bị phá trong lúc chờ
   ⇒ không có gì xảy ra.

**Tổng kết 4.2 — 3 primitive DSL mới (4.2a + 4.2b + 4.2c):**

| Primitive                                 | Task | Làm gì                                                                                                | Nhãn                                               |
| ----------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Operation `SpecialSummon`                 | 4.2a | Gọi quái của mình từ tay/mộ lên sân ngửa, không tốn Normal Summon, bắn "khi được triệu hồi"           | `[RULE]`; ô/tư thế tự chọn `[ASSUMED]` G17         |
| Trigger `OnFlip{mandatory?}`              | 4.2b | Hiệu ứng Lật: khi Flip Summon (action mới `FlipSummon`) hoặc bị lật do bị tấn công (kể cả khi bị phá) | `[RULE]`; thứ tự nhiều trigger `[ASSUMED]` G15     |
| Operation `Equip` + `ModifyStat.equipped` | 4.2c | Gắn lá Trang bị vào 1 quái ngửa; buff/debuff đúng quái đó; lá vào mộ khi quái rời sân                 | `[RULE]`; "gửi vào mộ" + ô tự chọn `[ASSUMED]` G18 |

Không thêm **Duration** (bạn đã chốt): `WhileOnField` trùng nghĩa với hiệu ứng Liên tục có sẵn. `ThisTurn`/`UntilEndPhase` để dành
tới khi có lá cần.

**Luật chưa có `[REF]` cần bạn xác nhận (cả 4.2):** không có video bản gốc nào cho 3 cơ chế này. Tất cả theo `[RULE]` YGO chuẩn,
trừ G17 (Special Summon: ô/tư thế tự chọn), G18 (Equip: ô tự chọn, "gửi vào mộ") và các câu hỏi trong packet
`task-4.2a.md` (quái Special Summon có tấn công ngay được không) và `task-4.2b.md` (Flip Summon có tính "được triệu hồi" không).

**Kiểm chứng kỹ thuật (số thật):**

- Test đỏ trước: `task-4.2c-red.txt`. Shared 4/44 fail; engine 15/16 fail với hàm gỡ rỗng. Test còn lại ("trả đúng state khi
  không có gì để gỡ") đúng sẵn với stub.
- Một test shared cũ sửa có chủ đích: ModifyStat thiếu `side` giờ bị bắt ở mức effect, vì `equipped` là lựa chọn còn lại.
- Sau khi làm: shared 151, engine 817, api 324, web 534 (toàn workspace, `pnpm test --force`). `pnpm lint` + `pnpm typecheck` toàn workspace: xanh (4/4 và 6/6 task).
- Golden: case mới `equip-buff-and-detach`, 17 case cũ không đổi byte nào.
- Fuzz dài 200 seed × 400 bước (thêm `EQP`/`EQW` + bất biến "Phép/Bẫy ngửa ⇔ có link hoặc đang trang bị quái ngửa" +
  "`equippedTo` chỉ ở ô Phép/Bẫy"): 214/214 (`task-4.2c-fuzz-long.txt`).
- "Trang bị vào mộ theo quái" hiếm trong fuzz ngẫu nhiên: 5 lần trên 25 lần Trang bị, 60 seed × 400 bước. Vì vậy có test độ phủ
  riêng 60 × 400 (~3 giây).
- Mutation `tools/mutants-4.2c.mjs`: **18/18** bị bắt (engine + schema), kết quả ở `task-4.2c-mutants.txt`.
- API: event `CardEquipped` chưa gửi ra ngoài (`null`), `equippedTo` không lọt vào StateView (view dựng tường minh). Web: 1 câu i18n.

**Cần bạn cung cấp:** không bắt buộc. Trả lời câu 1 (gửi vào mộ hay bị phá) và các câu mở ở 4.2a/4.2b. Video bản gốc có lá Trang
bị / gọi quái từ mộ / lật quái sẽ giúp đổi G17/G18 sang `[REF]`.

**Task tiếp theo:** hai hướng, bạn chọn thứ tự.

- **4.3** — Field Spell + Continuous Spell/Trap đầy đủ (Engine).
- **Task nối wire gộp 4.2a/b/c**: `FlipSummon` + 3 event lên `PlayerActionSchema`/`EventView`, `equippedTo` trong `StateView`, UI chạm quái
  úp → "Lật", mũi tên Trang bị. Nên làm trước khi đưa lá thật dùng 3 cơ chế này vào bộ bài.
