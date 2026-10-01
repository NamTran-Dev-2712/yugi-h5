> **ADR 003** · 2026-09-19 · Task: P0 · Lớp: API, Shared
> **Trạng thái:** Hiệu lực. Mục lục: `docs/ai/DECISIONS.md`.
>
> Ghi chú đọc kèm (thêm khi tách file 2026-10-01; KHÔNG thuộc ADR gốc, phần dưới giữ nguyên văn):
>
> - Pipe dùng thật là `ZodPipe` tự viết, không phải pipe của `nestjs-zod` — lý do ở ADR 035 (`035-2026-09-24-task-2.3-http-duel-solo.md`).

## 2026-09-19 — Validation dùng Zod, không dùng class-validator

Card definitions, Action/Event contract đã là Zod schema trong `packages/shared` theo yêu
cầu kiến trúc (data-driven). Dùng `nestjs-zod` ở `apps/api` để tái dùng cùng schema, tránh
định nghĩa validation 2 lần (DTO class + Zod schema riêng). **Hệ quả**: mọi DTO API mới nên
ưu tiên Zod schema, không thêm `class-validator` decorator.
