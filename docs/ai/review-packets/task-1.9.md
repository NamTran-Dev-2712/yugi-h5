### Review Packet — Task 1.9: Surrender

**Đã làm gì (1-3 dòng):** Thêm action `Surrender { playerIndex }`: bên nào cũng đầu hàng được ở mọi phase
(kể cả khi có prompt treo), đối thủ thắng ngay. Phát `DuelEnded { winnerIndex: <đối thủ>, reason: 'SURRENDER' }`
— chỉ mở rộng union `reason`, không đổi shape event/`winnerIndex`. Reject `DUEL_ENDED`/`SURRENDER_DISABLED`; state chỉ đổi
`winnerIndex` và `version`.

**Cách xem:** `pnpm --filter @yugi/game-engine test` → `src/actions/handlers/surrender.test.ts` (21 test);
toàn engine 297 test xanh (276 cũ + 21 mới, không sửa test cũ). `lint`/`typecheck` xanh.

**5 điều cần kiểm tra:**

1. Non-turn player đầu hàng hợp lệ và turn player thắng (không có `NOT_TURN_PLAYER`).
2. Đầu hàng hợp lệ ở cả 6 phase (không có `WRONG_PHASE`).
3. Đầu hàng khi đã có người thắng/hòa hoặc đã đầu hàng → `DUEL_ENDED`; sau đầu hàng, `EndPhase` bị `DUEL_ENDED`.
4. **Đầu hàng vẫn được khi có `pendingPrompt`** — khác các action khác (bị `PENDING_PROMPT`). Đây là thiết kế của AI
   (`[ASSUMED]`), brief chỉ nói "mọi phase".
5. Mutation test thủ công 10 đột biến trên `surrender.ts` — 10/10 bị test bắt: đảo người thắng, cố định winner = 0,
   bỏ guard `DUEL_ENDED`, thêm check `NOT_TURN_PLAYER`, thêm `WRONG_PHASE`, thêm `PENDING_PROMPT`, đổi reason thành
   `LP_ZERO`, không tăng `version`, không phát event, đổi LP ngoài ý muốn.

**Sửa trước khi commit (theo review):** engine giờ **cưỡng chế** `ruleset.allowSurrender` (field có sẵn, mặc định
`true`): `false` → `SURRENDER_DISABLED`, kiểm sau `DUEL_ENDED`. Bản đầu để API kiểm là sai (lệch dòng sheet đã duyệt và
nguyên tắc "thay đổi qua engine"). +5 test, +4 mutation (bỏ check, đảo điều kiện, luôn từ chối, đảo thứ tự guard): 4/4
bị bắt. Các mục bên dưới nói "engine không đọc `allowSurrender`" / "cần bạn quyết" đã được thay bằng ghi chú này.

**So với reference:** `[RULE]` cho "bên nào cũng đầu hàng, đối thủ thắng"; không có `[REF]` (chưa thấy màn/thao tác
đầu hàng trong tư liệu). Đã thêm dòng mới trong sheet, ô duyệt để trống.

**Cần bạn cung cấp:** (không chặn) duyệt dòng mới trong `RULES-REVIEW-SHEET.md`.

**Task tiếp theo:** 1.10 Deck-out phát `DuelEnded`; sau đó hand limit 6 ở End Phase, rồi Golden replay + fuzz harness.
