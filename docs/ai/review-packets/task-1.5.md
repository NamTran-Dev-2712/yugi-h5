### Review Packet — Task 1.5: ChangePosition (đổi thế)

**Đã làm gì:** Action `ChangePosition { playerIndex, cardInstanceId, toPosition }` đổi quái **ngửa** của mình giữa Tấn công ↔ Phòng thủ ngửa (`toPosition` tường minh, không toggle). Event `PositionChanged { from, to, definitionId, ... }`. Trạng thái theo quái lưu bằng dấu lượt trên `CardInstance` (`summonedTurn`/`positionChangedTurn`/`attackedTurn`), tự hết hiệu lực khi sang lượt khác. `summon.ts` chỉ được thêm dấu `summonedTurn`, hành vi cũ giữ nguyên.

**Cách xem:** `pnpm --filter @yugi/game-engine test` → `src/actions/handlers/change-position.test.ts` (43 test); toàn bộ engine 226 test xanh, không sửa test cũ nào.

**5 điều cần kiểm tra:**

1. Chỉ đổi được ở Main1/Main2, chỉ turn player, chỉ quái ngửa của chính mình; quái úp, lá trên tay/mộ, quái đối thủ, lá phép/bẫy đều bị từ chối bằng mã lỗi riêng.
2. Mỗi quái đổi tối đa 1 lần/lượt (kể cả đổi ngược lại); sang lượt sau của chủ quái thì đổi lại được.
3. Quái vừa Normal/Tribute Summon (hoặc Set) trong lượt không đổi được; lượt kế tiếp thì đổi được.
4. Quái đã tấn công không đổi được — hiện chỉ đọc `attackedTurn`, `DeclareAttack` (1.6) sẽ ghi.
5. Đổi thế không tốn quyền Normal Summon (đổi trước rồi Summon được, và ngược lại); reject không đổi state.

**So với reference:** toàn bộ `[RULE]`. **Không có `[REF]`**: video #2 không thấy thao tác đổi thế/lật (`rules-observed.md` mục 5); `02-yugi-h5-mechanics.md` không nói gì về đổi thế nên không mâu thuẫn. `[ASSUMED]` (thiết kế): `toPosition` tường minh; Tribute/Set cũng tính "vừa Summon"; tách `NOT_A_MONSTER` và `CARD_NOT_ON_FIELD`.

**Cần bạn cung cấp:** (không chặn) video có thao tác đổi thế/lật để nâng nhãn lên `[REF]`. Cần bạn xem: 5 dòng mới trong `RULES-REVIEW-SHEET` (ô tick để trống); tôi chỉ đổi cột "Tên test" ở 2 dòng đã tick sẵn (Summon/Set, đã tấn công); event dùng `instanceId` thay cho `cardInstanceId`; 7 mã lỗi mới.

**Task tiếp theo:** 1.6 — `DeclareAttack`.
