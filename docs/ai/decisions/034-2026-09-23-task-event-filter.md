> **ADR 034** · 2026-09-23 · Task: event-filter · Lớp: Shared, API
> **Trạng thái:** Hiệu lực — một phần đã thay. Mục lục: `docs/ai/DECISIONS.md`.
>
> Ghi chú đọc kèm (thêm khi tách file 2026-10-01; KHÔNG thuộc ADR gốc, phần dưới giữ nguyên văn):
>
> - Số event đã tăng sau ADR này: ADR 048 (`048-2026-09-26-task-3.2b-wire-spell-trap.md`) (+7), ADR 055 (`055-2026-09-28-task-3.4b-wire-chain.md`) (+3 chain), ADR 062 (`062-2026-10-01-task-4.2d-wire-4.2.md`) (+3). Bảng hiện hành: `docs/design/event-visibility.md`.
> - "Quyết định chỉ theo loại event": `toEventView` nay có tham số `hidden` tường minh — ADR 062 (`062-2026-10-01-task-4.2d-wire-4.2.md`).

## 2026-09-23 — Event filter (task event-filter): phân loại theo loại event, deny by default, `eventsByViewer`

- **Bảng phân loại** (`docs/design/event-visibility.md`): trong 15 event của engine chỉ `CardDrawn` là OWNER_ONLY (chủ thấy `card` đầy đủ, đối thủ nhận `HiddenCardView` `{hidden:true, instanceId, ownerIndex}` dùng lại kiểu của StateView); 14 event còn lại PUBLIC và giữ nguyên shape engine (FE đọc cùng field). Chưa có event HIDDEN.
- **Quyết định chỉ theo loại event, không cần state trước/sau**: engine đã phát event với ngữ nghĩa lộ/ẩn dựng sẵn (vd `MonsterSet` không mang `definitionId`). **Bất biến engine**: event không mang `definitionId` của lá còn ẩn với đối thủ, trừ `CardDrawn`. Nếu sau này cần trạng thái để lọc, thêm tham số tường minh vào `toEventView`, không suy đoán.
- **Deny by default**: `switch` vét cạn + `const x: never = event`; thêm loại event mới mà chưa phân loại làm `tsc` đỏ (đã kiểm chứng bằng probe tạm rồi hoàn tác), runtime loại lạ trả `null` (bị bỏ). Type `EventView` khai báo lại trong `packages/shared` (shared không import engine); test `Record<GameEvent['type'], …>` và phép gán compile-time giữ hai bên đồng bộ shape.
- **`DuelManager.submitAction` trả `{view, events, eventsByViewer}`**; events thô của engine không còn ra khỏi lớp. `events` = `eventsByViewer[người gửi]` (giữ tương thích test 2.2). Không lưu event vào session.
- **`[ASSUMED]`**: `MonsterSet` PUBLIC (lộ `instanceId` lá tay vừa Set, khớp StateView); tribute/phá/bỏ bài lá úp công khai danh tính vì vào mộ; `instanceId` `p<i>-<n>` không rò nội dung (đối thủ không biết decklist).
  **Hệ quả:** 2.3 chỉ phát `eventsByViewer[i]` cho người chơi `i`. Test chéo (replay qua `DuelManager`, so event với `toStateView` sau mỗi action) là lưới an toàn cho bất biến engine; nên mở rộng khi P3 thêm Spell/Trap. Mutation test thủ công 9 đột biến: 0 sống.
