### Review Packet — Task 2.2: DuelService bọc `applyAction` (API, không đụng engine/shared)

**Đã làm gì:** vòng lặp duel server-authoritative: giữ phiên duel, kiểm tra ai được hành động, chạy engine, lưu state, trả view đã lọc. File mới ở `apps/api/src/modules/duels/`: `duel-manager.ts` (logic thuần), `duel-store.ts` (interface + in-memory), `duel-errors.ts`, `duel.service.ts` (Nest mỏng), `duels.module.ts` (đã nối DI). Chưa controller/socket.

**Cách xem:** `pnpm lint && pnpm typecheck && pnpm test` toàn repo xanh; api 36 test (19 mới: `duel-manager.spec.ts` 18 + `duels.module.spec.ts` 1). `git diff packages/` rỗng.

**Hành vi đã test:** tạo duel (config sai/card lạ bị từ chối, không tạo phiên); action hợp lệ → `{view của người gửi, events}` + log; sai lượt → `ACTION_REJECTED/NOT_TURN_PLAYER`; mạo danh → `PLAYER_MISMATCH`; client gửi `StartDuel`/`Draw` → `FORBIDDEN_ACTION`; pendingPrompt (chỉ bên bị hỏi trả lời được, Surrender vẫn chạy); reject/lỗi lạ không đổi state (cùng tham chiếu, log không đổi); duel không tồn tại; 2 action đồng thời cùng duel (store chậm) → đúng 1 thành công, 1 `NORMAL_SUMMON_USED`, duel khác không bị chặn, hàng đợi không kẹt sau lỗi; view không lộ bài đối thủ; replay `startAction + actionLog` = state cuối; `closeDuel`.

**Mutation test thủ công (9):** bỏ mutex, bỏ log, bỏ `PLAYER_MISMATCH`, cho `Draw`, view sai người, `closeDuel` không kiểm tra, hàng đợi kẹt khi lỗi, bỏ validate card, nuốt `EngineError` → cả 9 bị bắt.

**Cần bạn duyệt (`[ASSUMED]`):**

1. `submitAction` trả **events thô** (theo yêu cầu). Chỉ nội bộ; nếu 2.3 gửi cho đối thủ sẽ lộ bài → cần task lọc event trước 2.3.
2. Service nhận `playerIndex` trực tiếp; ánh xạ guest/user → playerIndex là việc 2.3.
3. Chưa validate cỡ deck 40–60/≤3 (chỉ cấu trúc + card tồn tại).
4. `closeDuel` id lạ → `DUEL_NOT_FOUND`; `getView`/`getDuel` không xếp hàng theo mutex.
5. Mutex chỉ đúng cho 1 process; store in-memory mất phiên khi restart, chưa TTL/dọn duel bỏ dở.

**Task tiếp theo:** lọc event theo viewer, rồi 2.3 (`POST /duels/solo`, `/actions`, guest token).
