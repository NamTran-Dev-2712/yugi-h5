### Review Packet — Task 1.2: EndPhase + đổi lượt + luật lượt 1

**Đã làm gì:** Action `EndPhase` đi Draw→Standby→Main1→Battle→Main2→End rồi đổi lượt (reset cờ theo lượt). Rút bài của lượt thực hiện khi rời Draw phase; lượt 1 người đi trước không rút (`firstTurnDraw=false`). Event `PhaseChanged`, `TurnChanged`; deck rỗng → `DeckOut`.

**Cách xem:** `pnpm --filter @yugi/game-engine test` → `src/actions/handlers/end-phase.test.ts` (16 test). Đã kiểm mutation: 9 đột biến đều làm test đỏ.

**5 điều cần kiểm tra:**

1. Người đi trước lượt 1 không rút; người đi sau rút ở lượt đầu của mình (`first player does not draw on turn 1`, `second player draws on their first turn`).
2. Thứ tự phase đúng, hết End thì đổi người và `turnCount+1`.
3. Rút ở lượt 3 của người đi trước hoạt động bình thường.
4. Deck rỗng khi rút → thua ngay, phase không tiến.
5. Chỉ turn player được `EndPhase`; bị từ chối khi đã có winner / đang có prompt.

**So với reference:** lượt 1 không rút `[REF, 4/4 ván]`; chuỗi phase + đổi lượt `[RULE]`. Chưa chặn tấn công lượt 1 (`firstTurnAttack`, task 1.6).

**Cần bạn cung cấp:** không. (Nút hex 1 lần bấm = nhiều `EndPhase` hay server auto-advance: quyết ở P2.)

**Task tiếp theo:** 1.3 — NormalSummon / SetMonster (level 1–4).
