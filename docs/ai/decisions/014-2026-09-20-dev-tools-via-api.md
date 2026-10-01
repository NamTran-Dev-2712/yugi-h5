> **ADR 014** · 2026-09-20 · Task: Plan · Lớp: API, Web
> **Trạng thái:** Hiệu lực. Mục lục: `docs/ai/DECISIONS.md`.
>
> Ghi chú đọc kèm (thêm khi tách file 2026-10-01; KHÔNG thuộc ADR gốc, phần dưới giữ nguyên văn):
>
> - Hiện thực đầu tiên (Duel Sandbox): ADR 044 (`044-2026-09-25-task-2.11-sandbox.md`).

## 2026-09-20 — Tool dev đi qua API (dev-only), web không import engine

Duel Sandbox, Replay Viewer, Animation Preview cần chạy engine; giữ nguyên nguyên tắc `apps/web` không import `applyAction` bằng cách dùng
dev-endpoint ở `apps/api` (tắt ở production). **Hệ quả**: `StateView` bổ sung `legalActions`/`legalTargets` để FE không suy luận luật.
