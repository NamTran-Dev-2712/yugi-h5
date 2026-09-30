### Review Packet — Task 4.2b: Flip Summon + hiệu ứng Lật (`OnFlip`)

**Đã làm gì (1-3 dòng):** Thêm hành động **Triệu hồi Lật** (Flip Summon): ở Main Phase, lật quái úp của mình lên Tư thế Công.
Hiệu ứng **Lật** (`OnFlip`) giờ chạy thật: kích hoạt khi quái được Flip Summon hoặc bị lật do bị tấn công. Chỉ engine, chưa lên
HTTP/giao diện. API chặn hành động này tới task nối wire.

**Cách xem:**

1. Không đổi giao diện nên không có ảnh chụp. Test: `pnpm --filter @yugi/game-engine test flip-summon` (15 test).
2. Ván mẫu: `packages/game-engine/src/__golden__/flip-summon-and-battle-flip-effect.json`.
   - Lượt 1: úp quái Lật, rồi thử lật ngay → bị từ chối (`SUMMONED_THIS_TURN`).
   - Lượt 3: Flip Summon → hiệu ứng Lật gây 400 cho đối thủ. Thử đổi thế lại → bị từ chối. Quái đó tấn công quái úp của đối
     thủ → quái kia bị lật → hiệu ứng Lật của đối thủ gây 400 cho mình. LP cuối 7600/7600.
3. Bảng duyệt luật: 2 dòng mới cuối `docs/reference/notes/RULES-REVIEW-SHEET.md` (ô "Đã duyệt" để trống).

**5 điều cần kiểm tra:**

1. Flip Summon **không tính** vào lượt Normal Summon. Không lật được quái vừa úp trong lượt này, và quái đã ngửa cũng không
   lật được `[RULE]`.
2. Sau Flip Summon quái **không đổi thế lại** trong lượt, nhưng **tấn công được** ngay (nếu nó được úp từ lượt trước) `[RULE]`.
   Khác Special Summon (4.2a): quái Special Summon không tấn công được trong lượt theo luật hiện có của game.
3. Quái Lật **bị tấn công và bị phá** vẫn kích hoạt hiệu ứng Lật, sau khi tính sát thương `[RULE]`. Đúng như bản gốc bạn nhớ?
4. Flip Summon cũng tính là **"được triệu hồi"**: hiệu ứng "khi được triệu hồi" (`OnSummon`) của quái cũng kích hoạt `[RULE]`.
   Nếu bạn muốn "khi được triệu hồi" chỉ áp dụng cho Normal Summon thì sửa 1 dòng.
5. Lá có cả hiệu ứng Lật và hiệu ứng "khi bị phá": hiệu ứng Lật lên chuỗi trước, theo thứ tự sự kiện `[ASSUMED]` G15.

**So với reference:**

- Chưa có `[REF]` Yugi H5 cho Flip Summon/hiệu ứng Lật (video #1–#4 chưa thấy). Toàn bộ theo `[RULE]` YGO chuẩn; thứ tự nhiều
  trigger vẫn `[ASSUMED]` G15. Không phát sinh `[GUESS]` mới (không cần G18).
- Primitive DSL: trigger `OnFlip{mandatory?}` (schema có từ 3.1, nay chạy thật; chỉ cost `PayLP` như trigger khác). Action mới
  `FlipSummon`, event `FlipSummoned`, mã lỗi `MONSTER_FACE_UP`.

**Kiểm chứng kỹ thuật (số thật):**

- Test đỏ trước: `task-4.2b-red.txt`. Shared 2/41 fail; engine 14/15 fail. Test còn lại (quái ngửa bị tấn công không bắn) đúng
  sẵn.
- Một test shared cũ của 3.5 ("`mandatory` chỉ ở OnSummon/OnDestroyed") được sửa có chủ đích: OnFlip giờ nhận `mandatory`.
- Sau khi làm: shared 148, engine 799, api 323, web 534. `pnpm lint` + `pnpm typecheck` toàn workspace xanh.
- Golden: case mới `flip-summon-and-battle-flip-effect`, 16 case cũ không đổi.
- Fuzz dài 200 seed × 400 bước (thêm `MF`/`MFO` + FlipSummon trong generator): 213/213 (`task-4.2b-fuzz-long.txt`).
- Thêm FlipSummon vào hỗn hợp action làm một seed không còn gặp cửa sổ chuỗi đang mở. Vì vậy test "checker bắt engine hỏng" giờ
  thử tối đa 30 seed cố định; checker không bị nới.
- Mutation `tools/mutants-4.2b.mjs`: **22/22** bị bắt (engine + schema + chặn ở API), kết quả ở `task-4.2b-mutants.txt`.
- API: `wire-actions.ts` gom 3 chỗ lọc action trước đây chép tay, thêm `FlipSummon` vào danh sách engine-only; có test
  `FORBIDDEN_ACTION` + không có trong `legalActions`. Web: 1 câu i18n.

**Cần bạn cung cấp:** không bắt buộc. Trả lời câu 3 và 4. Nếu có video bản gốc cảnh lật quái (bị tấn công hoặc tự lật), nộp vào
`docs/reference/` (mục "Set / đổi thế / Lật" đang chờ trong `docs/plan/human-tasks.md`).

**Task tiếp theo:** 4.2c — Equip Spell (`Equip` + `ModifyStat.equipped`, lá Equip rời sân theo quái).
