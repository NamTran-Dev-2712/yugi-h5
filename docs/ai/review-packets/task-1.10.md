### Review Packet — Task 1.10: Deck-out

**Đã làm gì (1-3 dòng):** Logic rút bài **đã có** (`draw.ts` + `EndPhase` rút khi rời Draw phase), nên không phải làm lại.
Deck-out trước đây chỉ set `winnerIndex` + phát `DeckOut`; nay phát thêm `DuelEnded { winnerIndex: đối thủ, reason: 'DECK_OUT' }`
(chỉ thêm giá trị `reason`). `Draw` được thêm guard `DUEL_ENDED`.

**Cách xem:** `pnpm --filter @yugi/game-engine test` → `src/actions/handlers/deck-out.test.ts` (11 test); toàn engine 308 test xanh.
`lint`/`typecheck` xanh. **2 test cũ phải đổi** (bắt buộc): assertion `events` `[DeckOut]` ở `apply-action.test.ts` và
`end-phase.test.ts` nay là `[DeckOut, DuelEnded]`.

**5 điều cần kiểm tra:**

1. Deck rỗng khi tới lượt rút → thua, đối thủ thắng, phase giữ nguyên `Draw`, events `[DeckOut, DuelEnded DECK_OUT]`.
2. Deck còn đúng 1 lá → rút bình thường (deck về 0), không thua; deck rỗng ở phase khác cũng không thua.
3. Lượt 1 người đi trước: deck rỗng không thua khi `firstTurnDraw=false`; thua khi `true`.
4. Sau deck-out: `EndPhase`, `Draw`, `Surrender` → `DUEL_ENDED`.
5. Mutation test thủ công 9 đột biến — 9/9 bị bắt: bỏ `DuelEnded`, người rút thắng, reason sai, không set `winnerIndex`,
   `<` → `<=`, bỏ guard `DUEL_ENDED`, bỏ điều kiện lượt 1, bỏ `firstTurnDraw`, bỏ early-return của EndPhase.

**So với reference:** `[RULE]` deck-out; lượt 1 không rút là `[REF]` G1 (đã có từ 1.2). Không có `[REF]` cho màn thua vì deck-out.
Mục "Rút bài khi deck rỗng" đã duyệt trong `RULES-REVIEW-SHEET.md` chỉ được cập nhật mô tả/tên test, giữ ☑ — nếu bạn muốn duyệt lại thì bỏ tick.

**Cần bạn cung cấp:** (không chặn) xác nhận giữ cả `DeckOut` lẫn `DuelEnded` (UI animate lần rút hụt trước kết quả) thay vì chỉ `DuelEnded`.

**Task tiếp theo:** Hand limit 6 ở End Phase; sau đó Golden replay + fuzz harness.
