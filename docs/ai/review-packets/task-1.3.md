### Review Packet — Task 1.3: NormalSummon / SetMonster (level 1–4)

**Đã làm gì:** Action `NormalSummon` (ngửa, tư thế tấn công) và `SetMonster` (úp, phòng thủ) cho quái level 1–4, chọn ô 0–4. Cả hai dùng chung 1 quyền/lượt. Event `NormalSummoned`, `MonsterSet` (lá úp không lộ `definitionId`). Thêm `resetTurnFlags` và `ActionContext.cardDefinitions` (engine tra level/kind từ `packages/shared` qua resolver do caller truyền).

**Cách xem:** `pnpm --filter @yugi/game-engine test` → `src/actions/handlers/summon.test.ts` (65 test).

**5 điều cần kiểm tra:**

1. Summon/Set chỉ ở Main1/Main2; bị từ chối ở Draw/Standby/Battle/End.
2. Chỉ 1 lần Summon-hoặc-Set mỗi lượt (Summon→Set và Set→Summon cũng bị chặn); sang lượt sau dùng lại được.
3. Level 5/6/7 bị từ chối kèm thông báo nhắc Tribute (chưa hỗ trợ).
4. Ô ngoài 0–4 hoặc ô đã có quái bị từ chối; sân đầy 5 quái không summon thêm được.
5. Lá rời tay đúng, tổng số lá của người chơi không đổi; state đầu vào không bị sửa.

**So với reference:** `[RULE]` toàn bộ. Chưa có tư liệu Yugi H5 về Set / đổi thế (thiếu tư liệu, xem `human-tasks.md`), không chặn.

**Cần bạn cung cấp:** không. Quyết định mới cần bạn xem: `MonsterSet` không có `definitionId`; level ≥ 5 bị chặn cả Set (theo yêu cầu task); `apps/api` phải truyền `cardDefinitions` (P2).

**Task tiếp theo:** 1.4 — Tribute + `PendingPrompt` SelectTribute.
