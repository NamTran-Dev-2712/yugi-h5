> **ADR 012** · 2026-09-20 · Task: Plan · Lớp: Plan, Shared, Engine
> **Trạng thái:** Hiệu lực — một phần đã thay. Mục lục: `docs/ai/DECISIONS.md`.
>
> Ghi chú đọc kèm (thêm khi tách file 2026-10-01; KHÔNG thuộc ADR gốc, phần dưới giữ nguyên văn):
>
> - "OUT story mode" và phạm vi liên quan: mở rộng ở ADR 043 (`043-2026-09-25-scope-expansion-p10-p15.md`).
> - `chainPrompt` không dùng cho phản ứng: ADR 054 (`054-2026-09-28-c13-no-activation-dialog.md`) (C13).

## 2026-09-20 — Phạm vi luật v1 và `RulesetConfig`

IN: Normal/Tribute/Set/Flip/Special, Fusion (Ritual bỏ khỏi v1, xem ADR G1–G12); Spell/Trap đủ loại (Counter, Field làm ở P4). OUT: Synchro/Xyz/Pendulum/Link, ban-list.
Luật cổ điển (early Master Rule) là mặc định qua `RulesetConfig` nằm trong `state.ruleset` (để replay tái lập). **Hệ quả**: thêm Zod
schema ở `packages/shared`; các hành vi chưa xác nhận Yugi H5 (chain prompt, timer, starting LP) là config `[GUESS]`.
