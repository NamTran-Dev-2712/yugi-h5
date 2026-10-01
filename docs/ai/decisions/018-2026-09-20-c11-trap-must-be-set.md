> **ADR 018** · 2026-09-20 · Task: C11 · Lớp: Luật, Shared, Engine
> **Trạng thái:** Hiệu lực. Mục lục: `docs/ai/DECISIONS.md`.
>
> Ghi chú đọc kèm (thêm khi tách file 2026-10-01; KHÔNG thuộc ADR gốc, phần dưới giữ nguyên văn):
>
> - Hành vi engine đã làm ở ADR 047 (`047-2026-09-25-task-3.2-set-spelltrap-activate.md`) (từ tay) và ADR 050 (`050-2026-09-27-task-3.4-spell-speed-set-cards.md`) (lá đã Set).

## 2026-09-20 — C11: Trap phải Set mới kích hoạt được

`[DECISION]` (chủ dự án): Trap **không** kích hoạt từ tay; phải Set úp trên sân. Trap vừa Set ở lượt nào thì lượt đó chưa được kích hoạt `[RULE]`. Bài Phép thường vẫn kích hoạt từ tay ở Main Phase `[RULE]`. Quan sát video #2 15:17 ("Chuẩn Bị Dung Hợp" dùng từ tay, thấy 1 lần) chỉ vào backlog, không đổi quyết định.
**Hệ quả:** `RulesetConfig` thêm 2 khóa: `allowTrapActivationFromHand` (mặc định `false`, `[DECISION]`) và `trapSetTurnDelay` (mặc định `true`, `[RULE]`) — **đã làm 2026-09-20** (shared + test; thay tên đề xuất cũ `allowTrapFromHand`/`trapSetDelayTurns`). Hành vi engine chưa đổi; hợp đồng trong `docs/design/engine.md`/`protocol.md` (mã lỗi `TRAP_NOT_SET`, `TRAP_SET_THIS_TURN`; `legalActions` không liệt kê "Kích hoạt" cho Trap trên tay), implement ở task 3.4. **C11 đóng.** Quan sát 15:17 → backlog trong `rules-observed.md`.
