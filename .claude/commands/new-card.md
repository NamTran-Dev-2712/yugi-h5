---
description: Thêm 1 card definition mới vào packages/shared theo đúng DSL, kèm test
argument-hint: [tên lá bài hoặc mô tả ngắn]
---

Thêm card mới cho: $ARGUMENTS

1. Xác định `kind` (Monster/Spell/Trap) và field bắt buộc theo
   `packages/shared/src/cards/card-definition.ts` (`CardDefinitionSchema`).
2. Đặt tên gốc, không dùng tên/art bài chính thức của Konami. Đặt `id` theo pattern hiện có
   trong `sample-cards.ts` (vd `SMP-0XX` cho monster, `SMP-1XX` cho spell, `SMP-2XX` cho trap
   — điều chỉnh prefix nếu đã có set khác).
3. Nếu lá có effect **đơn giản** (map được vào 1-2 operation có sẵn): mô tả effect bằng
   `EffectDefinition` theo `docs/design/effect-dsl.md` (chỉ áp dụng khi effect engine đã có
   ở M2 — trước đó chỉ cần `effectText` placeholder).
4. Nếu effect **phức tạp**: dùng `scriptId` trỏ tới 1 handler mới trong
   `packages/game-engine/src/effects/scripts/` (chỉ khi effect engine đã tồn tại).
5. Thêm card vào danh sách export (`sample-cards.ts` hoặc file set tương ứng).
6. Thêm/mở rộng test trong `card-definition.test.ts` (hoặc file test riêng nếu set lớn) xác
   nhận `CardDefinitionSchema.safeParse(card).success === true`.
7. Chạy `pnpm --filter @yugi/shared lint typecheck test`.
