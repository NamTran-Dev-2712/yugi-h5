### Review Packet — Task 1.11: Hand limit 6 (prompt thật đầu tiên)

**Đã làm gì (1-3 dòng):** Khi rời Main2 mà tay > `ruleset.handLimit` (6), `EndPhase` **không tiến** mà mở
`PendingPrompt { kind: 'DiscardToHandLimit', payload: { count: tay − 6 } }`. Người chơi trả lời bằng action mới
`ResolvePendingPrompt { playerIndex, promptId, cardInstanceIds }`: các lá vào mộ, phát `CardDiscarded` từng lá, rồi sang End.
Trước task này chưa handler nào tạo prompt — đây là lần đầu cơ chế prompt được dùng thật (theo lựa chọn của bạn).

**Cách xem:** `pnpm --filter @yugi/game-engine test` → `src/actions/handlers/hand-limit.test.ts` (29 test); toàn engine
337 test xanh (308 cũ + 29 mới, **không sửa test cũ**). `lint`/`typecheck` xanh.

**6 điều cần kiểm tra:**

1. Tay ≤ 6 ở Main2 → sang End như cũ, không prompt; tay 7 → prompt `count: 1`, tay 9 → `count: 3`, phase vẫn `Main2`.
2. Chỉ kiểm khi rời Main2 (Standby/Main1/Battle/End không bị hỏi).
3. Người chơi **tự chọn** lá bỏ; lá còn lại giữ nguyên thứ tự; lá vào mộ `position: null`; events `[CardDiscarded…, PhaseChanged]`.
4. Reject không đổi state: không có prompt, sai `promptId`/sai người (`PROMPT_MISMATCH`), sai số lượng/trùng id/lá không ở tay/lá đối thủ (`INVALID_DISCARD`), `DUEL_ENDED`.
5. Trong lúc chờ prompt: `EndPhase`, `Draw`, `NormalSummon`, `SetMonster`, `ChangePosition`, `DeclareAttack` → `PENDING_PROMPT`;
   `Surrender` vẫn được. **`Draw` trước đó thiếu guard này — đã thêm** (thay đổi nhỏ ngoài phần lõi).
6. Mutation test thủ công 17 đột biến: 16 bị bắt. 1 sống là **mutant tương đương**: bỏ `position: null` khi vào mộ không đổi
   quan sát được vì lá trên tay luôn `position: null` (giữ dòng để phòng thủ).

**So với reference:** `handLimit` 6 và overlay bỏ bài là `[REF]` thấy 1 lần (video #2 18:36: tay 7, bấm "Kết thúc"). "Rời Main2"
là `[ASSUMED]` (theo brief); người chơi chọn lá bỏ và số lá = tay − 6 là `[RULE]`. Dòng "End Phase, tay > 6 lá" trong
`RULES-REVIEW-SHEET.md` (đã ☑) chỉ đổi mô tả + tên test thật, giữ nguyên tick.

**Cần bạn cung cấp:** (không chặn) xác nhận thời điểm hỏi là Main2→End (video chỉ thấy lúc bấm nút Kết thúc; UI 1 nút hex C4 có thể
gộp Main2 và End). UI sau này: overlay kéo bài (`[REF]`) gửi `ResolvePendingPrompt`.

**Task tiếp theo:** 1.12 Golden replay + fuzz harness (hết task luật P1).
