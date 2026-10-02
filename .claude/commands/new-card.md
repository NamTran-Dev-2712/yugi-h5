---
description: Thêm 1 card definition mới vào packages/shared theo đúng DSL, kèm test
argument-hint: [tên lá bài hoặc mô tả ngắn]
---

Thêm card mới cho: $ARGUMENTS

1. Xác định `kind` (Monster/Spell/Trap) và field bắt buộc theo
   `packages/shared/src/cards/card-definition.ts` (`CardDefinitionSchema`; chú ý các refine: lá
   Continuous/Field phải có effect kích hoạt + effect `Continuous`, Equip có effect `Equip`…).
2. Đặt tên gốc (song ngữ `{vi, en}`), không dùng tên/art bài chính thức của Konami. `id` theo dãy hiện có
   trong `sample-cards.ts`: `SMP-0XX` quái, `SMP-1XX` Phép, `SMP-2XX` Bẫy — **thêm vào CUỐI dãy**,
   không chèn giữa. `STARTER_DECK` không đổi; lá mới đi vào deck demo riêng (`packages/shared/src/deck/`).
3. Effect **mô tả được bằng DSL** (Tier B): viết `EffectDefinition` theo `docs/design/effect-dsl.md`
   (effect engine đã có từ P3) + `effectText` song ngữ. Thiếu primitive → `/new-effect-type` trước.
4. Effect **không map được** (Tier C): dùng `scriptId` trỏ tới handler mới trong
   `packages/game-engine/src/effects/effect-scripts/`, ghi lý do.
5. Card data viết bằng TS trong `sample-cards.ts` (không pipeline CSV — ADR 058).
6. Test:
   - shared: `CardDefinitionSchema.safeParse(card).success === true` + hình dạng effect (mẫu
     `packages/shared/src/cards/mech.test.ts`, `field-continuous.test.ts`);
   - engine: lá có effect phải có test riêng `packages/game-engine/src/cards/sample/<id>.test.ts` chạy lá
     THẬT qua `applyAction` (kích hoạt hợp lệ, sai điều kiện bị chặn, kết quả đúng); vanilla dùng test chung
     `cards/sample/vanilla.test.ts`. Test engine đọc `SAMPLE_CARDS` từ `dist` của shared ⇒ build lại shared trước.
7. Nếu lá có thông tin ẩn mới hoặc cơ chế mới: thêm vào pool `event-visibility.fuzz.spec.ts` (api) và
   kiểm độ phủ fuzz không bị loãng (bộ seed riêng, không sửa engine/checker để "cho qua").
8. Chạy `pnpm --filter @yugi/shared build`, rồi `lint`/`typecheck`/`test` của `@yugi/shared` và
   `@yugi/game-engine`.
