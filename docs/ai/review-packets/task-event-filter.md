### Review Packet — Task event-filter: lọc GameEvent theo viewer (Shared type + API, không đụng engine)

**Đã làm gì:** hàm thuần `toEventView(event, viewerIndex)` / `toEventViews`, type `EventView` ở `packages/shared`, và `DuelManager.submitAction` giờ trả `eventsByViewer` đã lọc thay cho events thô. Bảng phân loại 15 event: `docs/design/event-visibility.md`.

**Kết quả kiểm kê:** chỉ `CardDrawn` là OWNER_ONLY (đối thủ nhận `{hidden:true, instanceId, ownerIndex}`); 14 event còn lại PUBLIC (giữ nguyên shape). Chưa có event HIDDEN, cũng chưa có event xáo bài / tìm bài / Set Spell-Trap trong engine.

**Cách xem:** `pnpm lint && pnpm typecheck && pnpm test` toàn repo xanh; api 62 test (26 mới: `event-view.spec.ts`, `event-visibility.spec.ts`). `git diff packages/game-engine` rỗng.

**Test:** mỗi loại event × cả 2 viewer; JSON không chứa definitionId bị ẩn; deny-by-default (loại lạ → `null`); kết quả `submitAction` chỉ có `view/events/eventsByViewer`; test chéo qua `DuelManager` (4 kịch bản: mở đầu/draw/summon/set/đổi lượt; tấn công lá úp → flip + destroy; direct attack kết thúc trận; tribute lá úp + đổi thế + bỏ bài hand-limit): sau MỖI action, event của từng viewer không mâu thuẫn với `toStateView` của viewer đó.

**Exhaustiveness:** `switch` vét cạn + `never`. Đã kiểm chứng bằng probe: tạm thêm `ProbeEvent` vào union engine → `tsc` đỏ tại `event-view.ts` (`ProbeEvent` không gán được cho `never`) và tại fixture test; đã `git checkout` hoàn tác, build lại engine, engine không đổi (0 file).

**Mutation test thủ công (9):** lộ CardDrawn cho đối thủ; ẩn CardDrawn với chủ; `default` chuyển tiếp event thô; `toEventViews` dùng sai viewer; `eventsByViewer` đảo chỉ số; người gửi nhận event của đối thủ; trả thêm `rawEvents`; hidden card sai `ownerIndex`; bỏ 1 case (typecheck đỏ) → cả 9 bị bắt.

**Cần bạn duyệt (`[ASSUMED]`):**

1. `MonsterSet` PUBLIC (lộ `instanceId` của lá tay vừa Set, khớp StateView; không có definitionId).
2. `MonsterTributed` / `MonsterDestroyed` / `CardDiscarded` PUBLIC: vào mộ là công khai, kể cả lá úp bị tribute/phá.
3. Không có event HIDDEN ở thời điểm này; event PUBLIC giữ nguyên shape engine.
4. Bất biến dựa vào engine: "event không mang definitionId của lá còn ẩn, trừ CardDrawn" — chỉ được bảo vệ bằng test chéo, chưa có fuzz; nên thêm vào fuzz/golden khi P3 có Spell/Trap.
5. `createDuel` chưa trả event mở đầu (`DuelStarted` + 10 `CardDrawn`); FE animate từ view ban đầu. Không lưu event vào session.

**Việc để dành:** `validateDeck` trong shared (dùng ở 2.3); TTL/dọn duel bỏ dở; Extra Deck của chủ sở hữu (task Fusion); lịch sử event / resync; event mở đầu cho animation.

**Task tiếp theo:** 2.3 (`POST /duels/solo` + `/actions` + guest token; chỉ phát `EventView`).
