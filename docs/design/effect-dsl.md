# Effect DSL

Mục tiêu: thêm lá bài mới = thêm data vào `packages/shared`, không sửa `packages/game-engine`
core cho phần lớn trường hợp. Lá quá phức tạp để mô tả bằng DSL dùng `scriptId` trỏ tới 1
handler function đăng ký sẵn trong engine.

> Trạng thái: **schema Zod đã có (task 3.1, batch 1)** ở `packages/shared/src/effects/`;
> **engine chạy được 4 operation `Damage`/`Heal`/`Draw`/`Destroy` (task 3.2)** qua `ActivateEffect` cho Normal Spell
> từ tay. Registry ở shared chỉ là metadata (`implemented: true` cho 4 kind này, không giữ hàm); handler thật ở
> `packages/game-engine/src/effects/operations/<kind>.ts` (`OPERATION_HANDLERS`, thiếu kind = `tsc` đỏ; test đối chiếu
> hai phía). Resolve **ngay lập tức**, chưa có chain (task 3.3). Thêm kind mới: `/new-effect-type`.

## Engine chạy effect thế nào (task 3.2)

- `ActivateEffect {playerIndex, cardInstanceId, effectId, costInstanceIds?}`: chỉ **Spell `Normal` ở TAY**, Main1/Main2,
  turn player, effect có `trigger.kind === 'Ignition'` `[DECISION]` (Normal Spell "kích hoạt chủ động" map vào `Ignition`,
  không thêm trigger kind). Trap ở tay → `TRAP_NOT_SET`; Spell khác subType / trigger khác → `NOT_ACTIVATABLE`; lá đã Set
  trên sân chưa kích hoạt được (task 3.4).
- Thứ tự: kiểm tra (phase, condition, cost trả được, target) → **không đổi state** cho tới bước cuối → trả cost →
  chạy `operations[]` tuần tự (dừng nếu duel kết thúc giữa chừng) → Spell vào mộ. Event: `EffectActivated`, (event của
  cost/operation), `EffectResolved`, `CardSentToGraveyard`; `DuelEnded` luôn cuối.
- `costInstanceIds` tiêu thụ tuần tự theo `cost[]`: mỗi `Discard`/`Tribute` lấy `count` id; `PayLP` không id (cần LP **lớn hơn**
  số trả `[ASSUMED]`). `Discard` từ tay (không phải chính lá kích hoạt), `Tribute` từ quái của mình.
- `target` kiểu `Card` (chỉ `MonsterZone`/`SpellTrapZone` ở 3.2): đúng `count` ứng viên → tự chọn; ít hơn → `NO_VALID_TARGET`;
  nhiều hơn → `PendingPrompt SelectEffectTarget`, trả lời bằng `ResolvePendingPrompt.cardInstanceIds`. Lá úp chỉ là target khi effect
  không có `filter`. `Destroy` bắt buộc có target `Card`.

## Schema (nguồn thật: `packages/shared/src/effects/*.ts`)

Mỗi `kind` là một `z.object({ kind: z.literal(...), ...field })` `.strict()` gộp bằng
`z.discriminatedUnion('kind', …)`; **params phẳng theo kind** (không còn `params: Record<string, unknown>`),
nên gõ sai kind/field là lỗi `tsc`/parse. `[DECISION]`

```ts
interface EffectDefinition {
  id: string; // unique trong 1 CardDefinition (CardDefinition.effects refine)
  trigger: Trigger;
  condition?: Condition[]; // AND; không được rỗng nếu có
  cost?: Cost[]; // trả khi activate; không được rỗng nếu có
  target?: Target; // chọn lúc activate
  operations: Operation[]; // thực thi tuần tự khi resolve; KHÔNG được rỗng
}
```

Ràng buộc (`.refine`): `operations` ≥ 1; `condition`/`cost` không rỗng nếu có; `Continuous` không có
`cost`/`target` (không lên chain); `ZoneCount` cần `min` và/hoặc `max`, `min ≤ max`; `filter` cần ≥ 1
tiêu chí, `level.min ≤ level.max`.

`CardDefinition` có thêm `effects?: EffectDefinition[]` (id không trùng), `name`/`effectText?` là
`{ vi, en }` (cả hai bắt buộc, không fallback; helper `pickText(text, lang)`).

## Kind đã có (batch 1)

| Loại      | Kind → field                                                                                                               |
| --------- | -------------------------------------------------------------------------------------------------------------------------- |
| Trigger   | `OnSummon`, `OnFlip`, `Continuous`, `Ignition`, `Quick`                                                                    |
| Condition | `PhaseIs{phase}`, `IsMyTurn`, `ZoneCount{zone, side, min?, max?}`                                                          |
| Cost      | `Discard{count, filter?}`, `Tribute{count, filter?}`, `PayLP{amount}`                                                      |
| Target    | `Card{zone, side, count, filter?}`, `Player{who}`                                                                          |
| Operation | `Damage{amount, target}`, `Heal{amount, target}`, `Draw{count, target}`, `Destroy` (tác động lên `target` Card của effect) |
| Filter    | `kind` (Monster/Spell/Trap), `level{min?,max?}`, `attribute`, `race`                                                       |

`zone`: `Hand|Deck|Graveyard|MonsterZone|SpellTrapZone`; `side`/`who`/operation `target`: `self|opponent`;
`phase`: `Draw|Standby|Main1|Battle|Main2|End`.

## Kind CHƯA có (thêm qua `/new-effect-type`, theo `docs/plan/card-and-effect-plan.md`)

- **Trigger**: `OnDraw`, `OnDestroyed(by)`, `OnSentToGY`, `OnPhaseStart`, `OnDamage`, `OnAttackDeclared`, `OnActivate`.
- **Condition**: `LPCompare`, `HasCardIn(zone, filter)`, `ChainLength`, `PositionIs`, `OncePerTurn`.
- **Cost**: `Banish`, `SendToGY`, `Reveal`.
- **Target**: `AllMatching(filter)`.
- **Operation**: `SendToGY`, `Banish`, `Return(hand/deck)`, `SpecialSummon`, `ModifyStat`/`ModifyAtk`, `ChangePosition`, `Negate`/`NegateAttack`, `Shuffle`, `Search`, `Equip`, `SkipPhase`.
- **Filter**: `atk(min/max)`, `position`, `nameContains`, `tag`.
- **Duration**: `ThisTurn`, `UntilEndPhase`, `WhileOnField`, `Permanent` (batch 3).

Ví dụ trong bản spec cũ dùng tên `DrawCard`/`DealDamage`/`ModifyAtk`/`NegateAttack`: batch 1 dùng `Draw`/`Damage`
(theo bảng plan); các kind còn lại đổi tên/định hình khi được thêm.

## Ví dụ (parse được ở batch 1)

**Trigger** — "Khi lá này được Summon, rút 1 lá":

```json
{
  "id": "on-summon-draw",
  "trigger": { "kind": "OnSummon" },
  "operations": [{ "kind": "Draw", "count": 1, "target": "self" }]
}
```

**Ignition** — "Trả 500 LP: gây 500 damage cho đối thủ" (chưa có `OncePerTurn`):

```json
{
  "id": "ignition-burn",
  "trigger": { "kind": "Ignition" },
  "condition": [{ "kind": "IsMyTurn" }, { "kind": "PhaseIs", "phase": "Main1" }],
  "cost": [{ "kind": "PayLP", "amount": 500 }],
  "operations": [{ "kind": "Damage", "amount": 500, "target": "opponent" }]
}
```

**Quick + target** — "Phá huỷ 1 quái của đối thủ":

```json
{
  "id": "destroy-one",
  "trigger": { "kind": "Quick" },
  "target": { "kind": "Card", "zone": "MonsterZone", "side": "opponent", "count": 1 },
  "operations": [{ "kind": "Destroy" }]
}
```

**scriptId** — effect quá đặc thù (không map được vào operation catalog):

```json
{
  "id": "complex-fusion-search",
  "trigger": { "kind": "OnSummon" },
  "scriptId": "ashfall-wyrm-on-summon"
}
```

> Ví dụ `scriptId` chưa hợp lệ với `EffectDefinitionSchema` (chưa có trường `scriptId` trong effect; hiện `scriptId` chỉ ở mức
> `CardDefinition`). Quyết định vị trí `scriptId` khi làm task có script đầu tiên.

Engine giữ 1 registry `Record<scriptId, EffectScriptHandler>` — handler nhận `(state, ctx)`,
trả `{ state, events }` giống `applyAction`, chỉ chạy trong scope resolve của effect đó.

## Nguyên tắc thêm operation/condition/cost mới

1. Kiểm tra catalog hiện có (bảng trên) trước khi thêm — tránh trùng lặp.
2. Thêm schema kind ở `packages/shared/src/effects/`, thêm vào danh sách `*_KINDS` + `OPERATION_REGISTRY` ở
   `registry.ts` (thiếu = `tsc` đỏ), test parse hợp lệ + reject.
3. Operation mới phải pure + deterministic, nhận `(state, params, ctx)` trả `{state, events}` (handler ở engine, task 3.2+).
4. Nếu > 1 lá cần cùng 1 hành vi đặc thù, ưu tiên khái quát hoá thành operation thay vì copy-paste `scriptId`.
5. Xem `.claude/commands/new-effect-type.md` cho quy trình cụ thể.
