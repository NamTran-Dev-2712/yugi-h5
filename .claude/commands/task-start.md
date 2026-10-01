---
description: Đọc PROGRESS + xác định phạm vi task + lên plan ngắn trước khi code
---

Trước khi viết bất kỳ dòng code nào cho task này:

1. Đọc `docs/ai/PROGRESS.md` — phase hiện tại, việc đang dở, giới hạn đã biết. Chi tiết bàn giao của
   task trước: mục cuối `docs/ai/progress/p<phase>.md`.
   Rồi tra `docs/ai/INDEX.md`: đọc các ADR (`docs/ai/decisions/NNN-*.md`) của chủ đề task sẽ đụng
   — ADR không được tự nạp; chú ý khối "Ghi chú đọc kèm" (phần đã bị ADR sau thay) — và
   `docs/ai/LESSONS.md`.
2. Đọc `CLAUDE.md` root + `CLAUDE.md` của package/app sẽ đụng vào (`packages/game-engine`,
   `packages/shared`, `apps/api`, `apps/web`).
3. Xác định task này thuộc lớp nào: **Engine / API / Frontend / Realtime / Shared** — nói rõ
   ra trước khi bắt đầu.
4. Nếu task đụng vào contract (Action/Event/API endpoint/Zod schema dùng chung), đọc
   `docs/design/engine.md`, `docs/design/effect-dsl.md`, hoặc `docs/design/protocol.md`
   tương ứng trước.
5. Viết plan ngắn (vài bước), ưu tiên: nếu là task ở `game-engine`, viết test trước
   (test-first) rồi mới implement.

Không bắt đầu sửa file cho tới khi plan ngắn này rõ ràng.
