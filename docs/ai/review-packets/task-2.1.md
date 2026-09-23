### Review Packet — Task 2.1: StateView filter (Shared type + API, không đụng engine)

**Đã làm gì:** `toStateView(state, viewerIndex)` — bản `GameState` gửi cho 1 người chơi, ẩn thông tin đối thủ. Type `StateView`/`CardView` ở `packages/shared`; hàm thuần ở `apps/api/src/modules/duels/state-view.ts`.
Phần dọn dẹp kèm theo: P1 tick ✅ + ánh xạ số task (PROGRESS, MASTER-PLAN); sửa hook Stop.

**Cách xem:** `pnpm --filter @yugi/shared test` (11 xanh), `pnpm --filter @yugi/api lint/typecheck/test` (17 xanh, trong đó 12 test mới ở `state-view.spec.ts`).

**Bảng ẩn/hiện (đã test cả 2 viewer):** tay mình đủ / tay đối thủ chỉ số lượng + lá ẩn (giữ `instanceId`); deck chỉ count; mộ + bị loại công khai; quái ngửa công khai; quái úp: chủ thấy, đối thủ chỉ thấy có lá; Spell/Trap/Field của đối thủ ẩn trừ khi có position ngửa; LP/phase/turn/winner/pendingPrompt công khai; duel đã kết thúc (0/1/draw) vẫn hoạt động. Test quét `JSON.stringify` không chứa `definitionId` bị ẩn, `rng`, `chainStack`; input không bị mutate.

**Cần bạn duyệt (`[ASSUMED]`):** (1) Spell/Trap úp fail-closed vì engine chưa có marker ngửa/úp — chốt ở 3.4; (2) Extra Deck ẩn nội dung với cả hai; (3) `pendingPrompt` gửi nguyên (mới có prompt hand-limit, không nhạy cảm).

**Chưa làm / để dành:** lọc `GameEvent` theo viewer (cần cho 2.3: xem `CardDrawn`, `CardDiscarded`, `MonsterFlipped`...). Nếu 2.3 phát event thô cho đối thủ thì vẫn lộ.

**Mutation test thủ công (5):** bỏ điều kiện úp quái, bỏ ẩn tay, bỏ fail-closed Spell/Trap, ẩn mộ, đảo `isOwner` → cả 5 bị test bắt.

**Hook lỗi:** `.claude/hooks/remind-progress.js` KHÔNG mất (có trong git từ commit đầu); lỗi MODULE_NOT_FOUND do `settings.json` gọi bằng đường dẫn tương đối khi cwd ≠ root. Đã đổi sang `node "$CLAUDE_PROJECT_DIR/.claude/hooks/..."` (cả 2 hook) và xác nhận chạy được từ `apps/api`.

**Task tiếp theo:** 2.2 (DuelService + phiên duel) hoặc task lọc event trước 2.3.
