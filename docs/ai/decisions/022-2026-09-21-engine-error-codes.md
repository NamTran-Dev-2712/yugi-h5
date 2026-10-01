> **ADR 022** · 2026-09-21 · Task: củng cố trước 1.4 · Lớp: Engine
> **Trạng thái:** Hiệu lực. Mục lục: `docs/ai/DECISIONS.md`.

## 2026-09-21 — `EngineError` có mã lỗi + `ActionContext.cardDefinitions` bắt buộc

Reject bằng `throw new EngineError(code, message)` thay cho `Error` trần: `code` là union string literal ổn định (API map sang HTTP/socket error, test kiểm `code`, không kiểm text message — regex ngắn kiểu `/already/i` từng dễ trùng nhầm/vỡ khi đổi câu chữ). `message` giữ nguyên nội dung. `ActionContext.cardDefinitions` thành bắt buộc trong type; `applyAction` dùng overload để `StartDuel`/`Draw`/`EndPhase` vẫn gọi không cần ctx, còn lại bắt buộc ctx, kèm guard runtime `NO_CARD_RESOLVER` cho caller không qua type. `LP override` sai cũng dùng `INVALID_STARTING_LP`. **Hệ quả:** action mới phải khai báo code trong `errors.ts`; `apps/api` (P2) phải truyền resolver. Mutation test 17 đột biến trên `summon.ts`: 0 sống.
