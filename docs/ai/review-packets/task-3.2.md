# Review Packet — Task 3.2: SetSpellTrap + ActivateEffect (Normal Spell) + 4 operation — Engine

## Đã làm

- **Engine** (`packages/game-engine`): action `SetSpellTrap` (Spell/Trap từ tay → ô Spell/Trap, úp `DefenseDown`, ghi `setTurn`, không tốn Normal Summon) và `ActivateEffect {playerIndex, cardInstanceId, effectId, costInstanceIds?}` cho **Normal Spell ở tay** (trigger `Ignition`), **resolve ngay, chưa chain** (`chainStack` không đụng).
- Pipeline: `prepare` (mọi kiểm tra, không đổi state) → `execute` (trả cost → operations tuần tự → Spell vào mộ, `version` +1 một lần). Target `Card`: đúng `count` ứng viên tự chọn, nhiều hơn mở prompt `SelectEffectTarget` (`ResolvePendingPrompt` kiểm lại toàn bộ), ít hơn `NO_VALID_TARGET`.
- Operation thật đầu tiên: `Damage` (tái dùng `DamageDealt` + win check), `Heal` (`LifePointsRecovered`), `Draw` (tái dùng `applyDraw`, deck-out y hệt), `Destroy` (`MonsterDestroyed` / `SpellTrapDestroyed`). Cost `Discard`/`Tribute`/`PayLP`; condition `PhaseIs`/`IsMyTurn`/`ZoneCount`; filter `kind/level/attribute/race`.
- 7 event mới (`SpellTrapSet`, `EffectActivated`, `EffectResolved`, `CardSentToGraveyard`, `LifePointsRecovered`, `LifePointsPaid`, `SpellTrapDestroyed`), 8 mã lỗi mới (`NOT_A_SPELL_TRAP`, `EFFECT_NOT_FOUND`, `NOT_ACTIVATABLE`, `TRAP_NOT_SET`, `CONDITION_NOT_MET`, `INVALID_COST`, `NO_VALID_TARGET`, `INVALID_EFFECT_TARGET`).
- `getLegalActions`: ứng viên cho `SetSpellTrap`, `ActivateEffect` (tổ hợp cost) và đáp án prompt target; vẫn lọc bằng dry-run.

## Card mẫu — xác nhận ý đồ

- **SMP-101 "Tiếp Viện Bất Ngờ"** (Spell Normal): `Ignition` + `Draw{count:1, target:self}` = **rút 1 lá**. effectText đổi từ placeholder sang "Rút 1 lá bài." / "Draw 1 card."
- **SMP-201 "Rào Chắn Hộ Vệ" là Trap, không phải Spell** (brief gọi cả hai là Spell). Trap chưa kích hoạt được tới 3.4 và Negate chưa có ở batch 1 → **giữ nguyên placeholder, không gán effect giả**. Chưa đổi nghĩa lá.
- Damage/Heal/Destroy được test bằng Spell định nghĩa trong test (`testing/effect-fixtures.ts`), không thêm lá vào `SAMPLE_CARDS` (đó là 3.8).

## Lệch brief — cần bạn biết

1. **API/web/shared không thể bất động** dù brief nói vậy: event/action/mã lỗi mới làm vỡ `tsc`/test ở đó. Chọn **containment (engine-only)**:
   - shared: `OperationEntry.implemented` `false` → `boolean` (+ `true` cho 4 op), `SMP-101.effects`;
   - api: `toEventView` phân loại 7 event mới nhưng trả `null` (chưa forward); `DuelManager` ẩn `SetSpellTrap`/`ActivateEffect` khỏi `legalActions` và từ chối `submitAction` (`FORBIDDEN_ACTION`); `PlayerActionSchema` không đổi ⇒ HTTP/AI/web không thể tới prompt mới;
   - web: chỉ 8 khoá i18n `error.engine.*` (vi + en), không đổi scene/logic.
     Nối wire + UI = **task 3.2b** (đã thêm vào MASTER-PLAN/PROGRESS), sau cổng fuzz "không lộ thông tin qua HTTP".
2. Tên action là `SetSpellTrap` (theo `engine.md`), không phải `Set`.
3. `engine.md` cũ ghi `targetInstanceIds?`/`costPayload?` trong payload; theo brief target đi qua prompt, cost qua `costInstanceIds` — đã sửa doc.
4. Fuzz/golden: fuzz sinh 2 action mới + trả lời prompt target (thêm 4 Spell vào `FUZZ_DEFS`); golden **thêm** case `spell-set-and-activate`, 5 case cũ không đổi.

## File

- Mới (engine): `actions/handlers/{set-spell-trap,activate-effect}.ts`, `effects/{filter,conditions,costs,targets}.ts`, `effects/operations/{types,damage,heal,draw,destroy,index}.ts`, `testing/effect-fixtures.ts`; test: `set-spell-trap.test.ts`, `activate-effect.test.ts`, `effects/conditions.test.ts`, `effects/operations/registry-sync.test.ts`, `legal-actions.spells.test.ts`, `__golden__/spell-set-and-activate.json`.
- Sửa (engine): `actions/types.ts`, `events/types.ts`, `errors.ts`, `state/types.ts` (`setTurn`), `apply-action.ts`, `resolve-pending-prompt.ts` (+ctx), `legal-actions.ts`, `testing/fuzz/fuzz.ts` (+test), `testing/golden/cases.ts`, `legal-actions.property.test.ts`, `rules/trap-activation.test.ts` (3 todo → test thật).
- Ngoài engine: `packages/shared` (`effects/registry.ts` + test, `cards/sample-cards.ts`), `apps/api` (`event-view.ts` + spec, `duel-manager.ts`, mới `duel-manager.engine-only.spec.ts`), `apps/web` (`locales/{vi,en}.json`), `tools/mutants-3.2.mjs`, docs (`effect-dsl.md`, `engine.md`, `event-visibility.md`, ADR, PROGRESS, MASTER-PLAN, parity-board, `apps/api/CLAUDE.md`, `packages/game-engine/CLAUDE.md`).

## Verify

- `pnpm -r lint / typecheck / test` xanh: shared 103, engine 436 (+3 todo), api 244, web 390.
- Test viết **trước** khi cài đặt (chưa chạy đỏ riêng để lưu log — khác các task trước, không có `task-3.2-red.txt`); 35 đột biến thủ công (`tools/mutants-3.2.mjs`, `task-3.2-mutants.txt`): **35/35 bị bắt** (lần đầu 30/35 → thêm test target count-2, Discard 2, level filter, IsMyTurn, Draw đối thủ). Đột biến trên api (lọc `legalActions`, chặn `submitAction`) cũng bị bắt.
- Fuzz: suite thường xanh và xác nhận `SetSpellTrap`/`ActivateEffect` được chấp nhận ít nhất một lần; chạy dài `FUZZ_SEEDS=200 FUZZ_STEPS=800` sạch. Property test `getLegalActions` (8 seed × 200 bước) xanh với action mới.
- Không đổi UI → không screenshot.

## Cần bạn duyệt

1. Normal Spell map vào trigger **`Ignition`** (không thêm kind mới).
2. **`PayLP` cần LP lớn hơn số trả** `[ASSUMED]` (không tự thua khi trả cost).
3. Lá úp chỉ là target khi effect **không có `filter`** `[ASSUMED]` (tránh lộ danh tính qua filter/legalActions).
4. **SMP-201 giữ nguyên** (Trap, chờ 3.4 + Negate) thay vì gán effect tạm.
5. Hướng containment (3.2 chưa lên wire) và việc tách **3.2b**.
6. Field Spell bị `NOT_ACTIVATABLE` khi Set (chờ P4).

## Việc tiếp theo đề xuất

- **3.2b** (không cần tư liệu): cổng fuzz "không lộ thông tin" qua HTTP → nối wire → UI Set/kích hoạt/chọn target.
- **3.3 Chain stack + PassPriority**: cần **video/mô tả flow chain thật của Yugi H5** từ bạn (không tự đoán `[GUESS]`).
