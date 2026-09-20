---
description: Thêm 1 loại effect/operation/condition/cost mới vào effect engine (M2+)
argument-hint: [tên operation/condition/cost và mô tả hành vi]
---

Thêm effect building block mới: $ARGUMENTS

1. Đọc `docs/design/effect-dsl.md` trước — xác nhận operation/condition/cost tương tự chưa
   tồn tại trong `packages/game-engine/src/effects/`.
2. Xác định đây là `TriggerSpec`, `ConditionSpec`, `CostSpec`, hay `OperationSpec` mới.
3. Implement handler pure: nhận `(state, params, ctx)`, trả `{ state, events }` (cùng dạng
   `applyAction`) — không side effect, không random ngoài `ctx.rng`.
4. Đăng ký `kind` mới vào registry tương ứng (không if/else khổng lồ trong 1 file).
5. Viết test Vitest cho handler: case bình thường + case biên (target không hợp lệ, cost
   không đủ trả, v.v.).
6. Cập nhật `docs/design/effect-dsl.md` nếu schema/catalog thay đổi.
7. Cân nhắc: nếu building block này chỉ dùng cho đúng 1 lá bài và không tổng quát hóa được,
   cân nhắc dùng `scriptId` thay vì thêm vào DSL catalog chung (xem nguyên tắc cuối
   `effect-dsl.md`).
8. Chạy `pnpm --filter @yugi/game-engine lint typecheck test`.
