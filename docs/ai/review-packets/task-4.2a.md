### Review Packet — Task 4.2a: Special Summon (operation)

**Đã làm gì (1-3 dòng):** Task 4.2 (L) được tách thành 4.2a Special Summon, 4.2b Flip Summon + hiệu ứng Lật, 4.2c Equip Spell
(bạn đã chốt). 4.2a thêm loại hiệu ứng mới `SpecialSummon`: một lá hiệu ứng đưa quái **của bạn** từ **tay hoặc mộ** lên sân
ngửa, không tính vào lượt Normal Summon. Chỉ engine, chưa lên HTTP/giao diện.

**Cách xem:**

1. Không có thay đổi giao diện nên không có ảnh chụp. Luật được kiểm bằng test:
   `pnpm --filter @yugi/game-engine test special-summon` (16 test, tên test tiếng Anh mô tả đúng tình huống).
2. Ván mẫu ghi sẵn: `packages/game-engine/src/__golden__/special-summon-hand-and-graveyard.json`. Lượt 1: Phép gọi quái từ
   tay (hỏi chọn 1 trong 3 quái), quái đó có hiệu ứng "khi được triệu hồi" gây 300 sát thương, rồi vẫn Normal Summon được
   thêm 1 quái. Lượt 3: hai quái 1800 đánh nhau, cả hai bị phá, rồi Phép gọi lại quái từ mộ.
3. Bảng duyệt luật: 2 dòng mới cuối `docs/reference/notes/RULES-REVIEW-SHEET.md` (ô "Đã duyệt" để trống).

**5 điều cần kiểm tra:**

1. Special Summon **không tốn** lượt Normal Summon, và hiệu ứng "khi được triệu hồi" **có** kích hoạt `[RULE]`. Đúng ý bạn?
2. Quái được gọi vào **ô trống thấp nhất**, **Tư thế Công** nếu lá không ghi. Luật thật cho người chơi chọn ô và tư thế
   `[ASSUMED]` G17. Chấp nhận tạm, hay cần hộp chọn?
3. Quái vừa Special Summon **không tấn công và không đổi thế** trong lượt đó. Lý do: luật sẵn có của game (quái vừa
   triệu hồi không tấn công), áp dụng giống Normal Summon. Theo luật YGO chuẩn thì quái Special Summon **được** tấn công.
   Bạn muốn giữ như game hiện tại hay đổi?
4. Chỉ gọi quái **của chính mình** (không lấy từ mộ đối thủ) `[DECISION]`. Lấy của đối thủ cần luật "đổi người điều khiển",
   để task sau.
5. Không đủ ô trống thì **không kích hoạt được** lá (`NO_FREE_MONSTER_ZONE`) `[RULE]`. Special Summon giữa chuỗi **không** mở
   cửa sổ phản ứng triệu hồi cho đối thủ `[ASSUMED]` G17.

**So với reference:**

- Không có `[REF]` Yugi H5 về Special Summon (video chưa thấy). Toàn bộ theo `[RULE]` YGO chuẩn, trừ các điểm `[ASSUMED]` G17
  (ô/tư thế tự chọn, không cửa sổ phản ứng) và `[DECISION]` (chỉ quái của mình; không có action "Special Summon" riêng).
- Primitive DSL mới: operation `SpecialSummon{position?: 'Attack'|'DefenseUp'}` (+ target `Card` đọc được tay mình và mộ).
  Mã lỗi mới `NO_FREE_MONSTER_ZONE`, event mới `MonsterSpecialSummoned` (API chưa gửi ra ngoài).

**Kiểm chứng kỹ thuật (số thật):**

- Test đỏ trước: `task-4.2a-red.txt`. Shared 3/39 fail; engine 14/14 fail với hàm rỗng. 2 test thêm sau khi code xanh
  (trigger thiếu ô, tay đối thủ không là mục tiêu) để giết mutant; chúng xanh ngay.
- Sau khi làm: shared 146, engine 783, api 321, web 534 test xanh. `pnpm lint` + `pnpm typecheck` toàn workspace xanh.
- Một lần `pnpm test` toàn workspace có 1 test engine fail. Chạy riêng engine thì xanh; 3 lần chạy lại toàn workspace đều xanh
  783/783. Không bắt được tên test, nghi test thời gian `legalActions` (< 300 ms) khi máy tải nặng.
- Golden: case mới `special-summon-hand-and-graveyard`, 15 case cũ không đổi byte nào.
- Fuzz dài 200 seed × 400 bước (lá `SSH`/`SSG` + bất biến "chỉ lá quái đứng trong ô quái", "Special Summon không tốn Normal
  Summon"): 213/213 xanh. Test độ phủ fuzz chuyển sang 30 seed riêng: thêm lá làm loãng chuỗi 2 mắt xích; trước đó đã sát ngưỡng.
- Mutation `tools/mutants-4.2a.mjs`: 17/18 bị bắt, kết quả ở `task-4.2a-mutants.txt`. Con sống duy nhất là mutant tương đương
  cố ý: `continue` thay `break` khi hết ô cho cùng kết quả.
- API/web: chỉ containment. `toEventView` trả `null` cho event mới, thêm 1 câu i18n vi/en cho mã lỗi.

**Cần bạn cung cấp:** không bắt buộc. Trả lời 5 câu trên, nhất là câu 3 (quái Special Summon có được tấn công ngay không).
Nếu có video bản gốc cảnh gọi quái từ mộ, thêm vào `docs/reference/` để thay `[ASSUMED]` G17.

**Task tiếp theo:** 4.2b — Flip Summon (action mới) + hiệu ứng Lật `OnFlip` (Engine), rồi 4.2c — Equip Spell.
