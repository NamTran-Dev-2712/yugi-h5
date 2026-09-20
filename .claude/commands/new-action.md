---
description: Thêm 1 Action mới vào engine (type + validator + handler + event + test)
argument-hint: [tên Action, vd NormalSummon]
---

Thêm Action mới: $ARGUMENTS

1. Đọc `docs/design/engine.md` phần Action list — xác nhận Action này đã được lên kế hoạch
   ở milestone nào, và field cần thiết.
2. Thêm type vào `packages/game-engine/src/actions/types.ts` (union `Action`), theo pattern
   `{ type: 'X'; payload: {...} }` đã có (`StartDuelAction`, `DrawAction`).
3. Viết test TRƯỚC (test-first): case hợp lệ + toàn bộ case invalid có thể nghĩ ra (sai
   turn, sai phase, thiếu điều kiện, v.v.) trong `apply-action.test.ts` hoặc file test riêng
   nếu handler phức tạp.
4. Implement handler trong `packages/game-engine/src/actions/handlers/<action>.ts` — pure,
   nhận state hiện tại + action, trả `{ state, events }`. Update state bằng spread, không
   mutate.
5. Đăng ký handler vào `switch` trong `packages/game-engine/src/apply-action.ts` — giữ
   `exhaustiveCheck: never` để TypeScript báo lỗi nếu quên case nào.
6. Thêm `GameEvent` mới nếu cần (`packages/game-engine/src/events/types.ts`) — event mô tả
   fact đã xảy ra, không phải instruction cho FE.
7. Cập nhật `docs/design/engine.md` (bảng Action list: milestone → done) nếu action đã hoàn
   thành đầy đủ theo spec.
8. Chạy `pnpm --filter @yugi/game-engine lint typecheck test`.
