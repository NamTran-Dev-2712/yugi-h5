# Review Packet — Task 3.1: Schema EffectDefinition + registry rỗng + tên lá song ngữ — Shared

## Đã làm

- `packages/shared/src/effects/`: `filter`, `trigger`, `condition`, `cost`, `target`, `operation`, `zone`, `effect-definition`, `registry` (+ `effects.test.ts`). Mỗi kind một `z.object().strict()` trong `z.discriminatedUnion('kind')`, params **phẳng** (không `Record<string, unknown>`).
- Refine: effect phải có `operations` ≥ 1; `condition`/`cost` không rỗng nếu có; `Continuous` không cost/target; `ZoneCount` cần min/max, min ≤ max; filter ≥ 1 tiêu chí, level min ≤ max; id effect không trùng trong card.
- `CardDefinition`: `effects?`, `name`/`effectText?` = `{vi, en}` (cả hai bắt buộc), `pickText`, `Lang`. 22 lá mẫu có đủ vi + en (tên vi tự đặt, không IP Konami).
- Registry: `*_KINDS` (kiểm tra hoàn chỉnh compile-time) + `OPERATION_REGISTRY = {implemented:false}`. **Không thực thi gì; task 3.2 mới cắm handler.**

## Primitive

- **Có (batch 1)**: Trigger `OnSummon OnFlip Continuous Ignition Quick`; Condition `PhaseIs IsMyTurn ZoneCount`; Cost `Discard Tribute PayLP`; Target `Card Player`; Operation `Damage Heal Draw Destroy`; Filter `kind level attribute race`.
- **CHƯA có** (cần `/new-effect-type` trước khi viết 10 lá ở 3.8 nếu lá cần): Trigger `OnDraw OnDestroyed OnSentToGY OnPhaseStart OnDamage OnAttackDeclared OnActivate`; Condition `LPCompare HasCardIn ChainLength PositionIs OncePerTurn`; Cost `Banish SendToGY Reveal`; Target `AllMatching`; Operation `SendToGY Banish Return SpecialSummon ModifyStat ChangePosition Negate(Attack) Shuffle Search Equip SkipPhase`; Filter `atk position nameContains tag`; Duration. Lưu ý: "Negate summon/attack" (Trap mẫu) và `OncePerTurn` (Ignition 1 lần/lượt) đều **chưa có**.

## File

- Mới: `packages/shared/src/effects/*` (9 file + test), `packages/shared/src/cards/attribute.ts`, `apps/web/src/duel/card-text.ts`.
- Sửa: `card-definition.ts` (+test), `sample-cards.ts`, `shared/index.ts`, `docs/design/effect-dsl.md`, ADR/PROGRESS/parity-board.
- **Ngoài shared (bắt buộc do đổi shape `name`)**: `game-engine/.../summon.ts` (1 dòng message), fixture `CardDefinition` trong test/fuzz/golden của engine, `apps/api` (`ai-test-kit.ts`, `event-visibility.spec.ts`), `apps/web` (`presenter.ts`, `labels.ts`, `duel-controller.ts`, `debug-page.ts` + test), `tools/play-duel.ts`. Không đổi logic, không đổi golden.

## Verify

- `pnpm -r lint / typecheck / test`: xanh. shared 103 (74 → +29), engine 381 (+7 todo), api 234, web 390.
- Test-first: file `effects.test.ts` viết trước schema (chạy đỏ: module chưa có); mỗi kind có parse hợp lệ + reject (thiếu field, sai kiểu, kind lạ, key thừa).
- Không có UI đổi → không screenshot (web chỉ đọc `name` qua `card-text.ts`).

## Cần bạn duyệt

1. Params phẳng theo kind + tên `Damage/Heal/Draw/Destroy` (thay `DealDamage/DrawCard` của spec cũ) — ADR 2026-09-25.
2. `Destroy` không field, dùng `target` Card của effect; `Damage/Heal/Draw` có `target: self|opponent` — đủ cho 10 lá mẫu?
3. Sửa 1 dòng trong engine (`summon.ts`) dù brief nói không đụng engine — bắt buộc; TS không báo lỗi ở chỗ này.
4. Bản dịch vi của 22 tên lá mẫu do AI tự đặt.

## Việc tiếp theo đề xuất

3.2 (Set Spell/Trap + `ActivateEffect` Normal Spell, handler cho `Damage/Heal/Draw/Destroy`). **Trước 3.3–3.4 bạn cần gửi video/mô tả flow chain thật của Yugi H5** (không thì em không đoán `[GUESS]`).
