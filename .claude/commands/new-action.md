---
description: Thêm 1 Action mới vào engine (type + validator + handler + event + test)
argument-hint: [tên Action, vd NormalSummon]
---

Thêm Action mới: $ARGUMENTS

1. Đọc `docs/design/engine.md` phần Action list + ADR của chủ đề (tra `docs/ai/INDEX.md`) — xác nhận
   Action này thuộc task/phase nào (P0–P9, xem `docs/plan/MASTER-PLAN.md`) và field cần thiết.
2. Thêm type vào `packages/game-engine/src/actions/types.ts` (union `Action`), theo pattern
   `{ type: 'X'; payload: {...} }` đã có.
3. Viết test TRƯỚC (test-first, lưu output đỏ vào `docs/ai/review-packets/task-<số>-red.txt`): case hợp
   lệ + toàn bộ case invalid (sai turn, sai phase, thiếu điều kiện, có prompt treo, cửa sổ chuỗi đang mở,
   duel đã kết thúc…). Test kiểm `EngineError.code` (`expectEngineError`), không kiểm câu chữ.
4. Implement handler trong `packages/game-engine/src/actions/handlers/<action>.ts` — pure,
   nhận state hiện tại + action + ctx, trả `{ state, events }`; từ chối bằng `reject('MÃ_LỖI', …)`
   (mã mới thêm ở `errors.ts`). Update state bằng spread, không mutate.
5. Đăng ký handler vào `switch` trong `packages/game-engine/src/apply-action.ts` — giữ
   `never` để TypeScript báo lỗi nếu quên case nào.
6. Thêm `GameEvent` mới nếu cần (`packages/game-engine/src/events/types.ts`) — event mô tả
   fact đã xảy ra, không phải instruction cho FE; event của lá úp không mang `definitionId`.
7. **`legalActions`**: thêm bộ sinh ứng viên trong `candidates()` ở `legal-actions.ts` (chỉ cấu trúc,
   không chép luật) + mở rộng `perturb`/`junk` ở `legal-actions.property.test.ts`.
8. **Fuzz / golden**: thêm action vào generator ở `testing/fuzz/` (và bất biến nếu có), thêm case golden
   nếu là luồng mới (`UPDATE_GOLDEN=1` rồi `prettier --write` các file golden, đọc diff).
9. **Wire** (cùng task hoặc task "nối wire" riêng — mẫu Containment ở `docs/ai/LESSONS.md`):
   - `packages/shared/src/duel/action-schema.ts` (`PlayerActionSchema`, `.strict()`), hoặc tạm đưa action
     vào `ENGINE_ONLY_ACTIONS` (`apps/api/src/modules/duels/wire-actions.ts`);
   - event mới: `packages/shared/src/duel/event-view.ts` + phân loại ở `apps/api/.../event-view.ts`
     (hoặc trả `null` có test) + bảng `docs/design/event-visibility.md`; mở rộng cổng rò
     `event-visibility.fuzz.spec.ts` nếu có thông tin ẩn (không nới oracle);
   - web: câu i18n mã lỗi `error.engine.*` (vi + en), và các switch vét cạn (`describe-event`,
     `animation-queue`, `log-entries`, `describe-ai-action`, `build-actions`).
10. Cập nhật `docs/design/engine.md`, `docs/reference/notes/RULES-REVIEW-SHEET.md` (dòng luật mới, ô duyệt
    để trống), `CLAUDE.md` của package nếu có luật mới.
11. Chạy `pnpm --filter @yugi/game-engine lint`, `typecheck`, `test` (và của package khác đã đụng).
