### Review Packet — Task 1.4: Tribute Summon / Tribute Set (level 5+)

**Đã làm gì:** `NormalSummon` và `SetMonster` nhận thêm `tributeInstanceIds` (không có action mới). Level 1–4 cần 0 tribute, 5–6 cần 1, 7+ cần 2; tribute vào mộ theo thứ tự mảng, sinh event `MonsterTributed` trước `NormalSummoned`/`MonsterSet`. Ô của quái bị tribute được dùng lại (sân đầy vẫn Summon được). `PendingPrompt SelectTribute` (overlay/Hủy) đã tách khỏi 1.4 theo yêu cầu, sang task UI.

**Cách xem:** `pnpm --filter @yugi/game-engine test` → `src/actions/handlers/tribute-summon.test.ts` (85 test) và `summon.test.ts` (65 test).

**5 điều cần kiểm tra:**

1. Lv5–6 đúng 1 tribute, Lv7+ đúng 2; thiếu hoặc thừa bị từ chối (`TRIBUTE_COUNT_MISMATCH`), kể cả Lv4 kèm 1 tribute.
2. Tribute chỉ là quái của chính mình trên sân (úp cũng được); quái đối thủ, lá trong tay/mộ, id lạ, id trùng bị từ chối (`INVALID_TRIBUTE`).
3. Sân đầy 5 quái: Summon vào ô của quái bị tribute được; vào ô khác bị từ chối.
4. Vẫn tốn quyền Normal Summon của lượt; từ chối không đổi state; tổng số lá không đổi, mộ tăng đúng số tribute.
5. Thứ tự event: từng `MonsterTributed` (có `definitionId`, kể cả quái úp) rồi mới `NormalSummoned`/`MonsterSet`.

**So với reference:** `[RULE]` cho ngưỡng tribute và ô giải phóng. Overlay chọn lá + "Đồng ý" là `[REF]` nhưng thuộc UI, chưa làm; nút "Hủy" vẫn `[DECISION]`. `docs/reference/02-yugi-h5-mechanics.md` chưa có trong repo nên chưa đối chiếu được.

**Cần bạn cung cấp:** file `docs/reference/02-yugi-h5-mechanics.md` (commit vào repo). Cần bạn xem: `MASTER-PLAN` dòng 54 đã bỏ SelectTribute; mã lỗi `LEVEL_NEEDS_TRIBUTE` bị gỡ; quái vào mộ có `position: null`; 3 test 1.3 "level 5+" đổi mã lỗi sang `TRIBUTE_COUNT_MISMATCH`.

**Task tiếp theo:** 1.5 — `ChangePosition`.
