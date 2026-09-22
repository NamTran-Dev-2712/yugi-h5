### Review Packet — Task 1.8: Flip-on-Attack (quái úp bị tấn công)

**Đã làm gì (1-3 dòng):** `DeclareAttack` giờ cho phép target quái úp (Set) của đối thủ — thay vì reject
bằng `TARGET_FACE_DOWN` như task 1.6. Trước khi tính damage, quái đó được lật ngửa (`DefenseDown →
DefenseUp`, giữ Defense Position), phát event `MonsterFlipped {ownerIndex, instanceId, definitionId,
zoneIndex}` ngay sau `AttackDeclared` và trước `MonsterDestroyed`/`DamageDealt`. Damage calc sau đó tái
dùng nguyên logic ATK-vs-DEF của task 1.6, không viết công thức mới. Mã lỗi `TARGET_FACE_DOWN` đã bị xoá
khỏi `errors.ts` (không còn dùng ở đâu khác).

**Cách xem:** `pnpm --filter @yugi/game-engine test` → `src/actions/handlers/declare-attack.test.ts`
(describe mới "Flip-on-Attack (face-down target)", 6 test); toàn bộ engine 276 test xanh (270 cũ + test
mới, 1 test cũ đổi nội dung từ reject sang luồng thành công + đổi tên cho khớp, gộp bớt 1 test trùng lặp
với test có sẵn ở describe "direct attack"). `pnpm --filter @yugi/game-engine lint`/`typecheck` xanh.

**5 điều cần kiểm tra:**

1. Tấn công quái úp duy nhất của đối thủ giờ hợp lệ (không còn bị chặn hoàn toàn như lỗ hổng cố ý ở 1.6) —
   nhưng vẫn phải chỉ định `targetInstanceId`, không được direct-attack (đối thủ có quái úp thì
   `MUST_TARGET_MONSTER`, test không đổi từ 1.6).
2. `MonsterFlipped` luôn xuất hiện trước `MonsterDestroyed`/`DamageDealt` trong mảng events khi target
   đang úp; không xuất hiện khi target đã ngửa từ trước (test `flips the target face-up before
destroy/damage events, in order`).
3. Sau khi lật, quái giữ Defense Position (`DefenseUp`) và **không** tự chuyển Attack — kể cả khi không
   bị destroy (test ATK < DEF: `target stays face-up in Defense`).
4. `summonedTurn`/`positionChangedTurn` của quái đối thủ (dấu lượt task 1.5) không cản việc nó bị
   target/lật — hai dấu đó chỉ chặn hành động chủ động của chính quái đó, không liên quan bị tấn công.
5. Mutation test thủ công trên đoạn code flip mới (9 đột biến: đổi điều kiện `DefenseDown`↔`DefenseUp`,
   đổi position lật thành `Attack`, đảo ternary chọn ô, sai `ownerIndex`, sai `definitionId`, sai
   `zoneIndex`, typo `type` event, xoá guard `target !== null`) — 8/9 bị test bắt (fail); 1 đột biến
   sống (xoá dòng `target = flipped;`) nhưng **không đổi hành vi quan sát được**: nhánh damage hiện tại
   chỉ phân biệt `position === 'Attack'` vs không, và cả `DefenseDown`/`DefenseUp` đều rơi vào nhánh
   "không phải Attack" giống nhau — dòng này giữ để đảm bảo bất biến "`target` phản ánh đúng trạng thái
   sau khi lật" cho tương lai (ví dụ nếu sau này có biến thể luật cho lật sang Attack), không phải bug.

**So với reference:** Toàn bộ `[RULE]` (không có `[REF]` — video #2 không quay cảnh tấn công quái úp).
`DefenseDown → DefenseUp` khi lật là suy diễn từ luật YGO cổ điển chuẩn (Set monster flipped by battle
stays in Defense Position), không phải tư liệu gốc Yugi H5. `RULES-REVIEW-SHEET.md` dòng "Quái úp bị tấn
công" đã đổi tên test thật và nội dung mô tả chi tiết hơn — **để trống ô duyệt lại** (nội dung cụ thể hơn
bản nháp cũ đã từng ☑).

**Cần bạn cung cấp:** (không chặn) duyệt lại dòng "Quái úp bị tấn công" trong `RULES-REVIEW-SHEET.md`
(nội dung đã đổi, không còn là bản nháp cũ được duyệt trước đó). Nếu bạn có tư liệu Yugi H5 cho thấy quái
lật do bị tấn công có hành vi khác (ví dụ tự chuyển Attack Position), báo lại — hiện tại đang theo luật
YGO chuẩn `[RULE]`, không phải `[REF]`.

**Task tiếp theo:** Hand limit 6 + `Surrender` + deck-out phát `DuelEnded` (tái dùng
`checkLifePointsWinCondition`-style helper cho deck-out).
