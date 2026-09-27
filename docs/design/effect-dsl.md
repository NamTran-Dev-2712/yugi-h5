# Effect DSL

Mục tiêu: thêm lá bài mới = thêm data vào `packages/shared`, không sửa `packages/game-engine`
core cho phần lớn trường hợp. Lá quá phức tạp để mô tả bằng DSL dùng `scriptId` trỏ tới 1
handler function đăng ký sẵn trong engine.

> Trạng thái: **schema Zod đã có (task 3.1, batch 1)** ở `packages/shared/src/effects/`;
> **engine chạy được 4 operation `Damage`/`Heal`/`Draw`/`Destroy` (task 3.2)** qua `ActivateEffect` cho Normal Spell
> từ tay. Registry ở shared chỉ là metadata (`implemented: true` cho 4 kind này, không giữ hàm); handler thật ở
> `packages/game-engine/src/effects/operations/<kind>.ts` (`OPERATION_HANDLERS`, thiếu kind = `tsc` đỏ; test đối chiếu
> hai phía). Từ task 3.3 effect lên **chain** (resolve LIFO); task 3.4 thêm lá Set; task 3.5 thêm trigger tự khởi phát
> `OnSummon`/`OnDestroyed` (optional/mandatory). Thêm kind mới: `/new-effect-type`.

## Engine chạy effect thế nào (task 3.2, chain từ task 3.3)

- `ActivateEffect {playerIndex, cardInstanceId, effectId, costInstanceIds?}`: lá ở **TAY** hoặc **đã Set** trong ô Phép/Bẫy
  của mình (task 3.4) `[RULE]`:
  - **Normal Spell** từ tay ↔ `trigger.kind === 'Ignition'`, Main1/Main2 của mình `[DECISION]` (map vào `Ignition`).
  - **Quick-Play Spell** (`subType: 'QuickPlay'`) ↔ `trigger.kind === 'Quick'`: từ tay ở **lượt mình, mọi phase**; đã Set thì
    kích hoạt được ở cả lượt đối thủ (qua cửa sổ chain), **trừ lượt vừa Set** (`SPELL_SET_THIS_TURN`).
  - **Trap** Normal/Counter đã Set ↔ `trigger.kind === 'Quick'`; trên tay → `TRAP_NOT_SET` (C11); Set trong lượt này →
    `TRAP_SET_THIS_TURN` (nếu `ruleset.trapSetTurnDelay`).
  - Lá Set được kích hoạt **lật ngửa và ở lại ô** tới khi link resolve rồi vào mộ (`CardSentToGraveyard.from: 'SpellTrapZone'`).
  - Ngoài cửa sổ chain chỉ người chơi của lượt kích hoạt (mọi phase với lá Set); trong cửa sổ chỉ người giữ ưu tiên.
  - Continuous Spell/Trap, Normal Spell đã Set, Field → `NOT_ACTIVATABLE` (chưa làm); trigger không khớp → `NOT_ACTIVATABLE`.
- **Spell Speed** (task 3.4): `EffectDefinition.spellSpeed?: 1 | 2 | 3`; bỏ trống = engine suy ra (`effects/spell-speed.ts`):
  Counter Trap 3, Trap khác 2, Quick-Play 2, còn lại 1 `[RULE]`. Chỉ khai báo tường minh cho lá lệch mặc định. Nối chain cần
  Speed ≥ 2 và ≥ link trên cùng (`SPELL_SPEED_TOO_LOW`).
- Thứ tự (task 3.3): kiểm tra (phase, condition, cost trả được, target, Spell Speed) → **không đổi state** tới lúc kích hoạt →
  lá rời tay (lá Set: lật ngửa tại ô), **trả cost, chốt target** → đẩy `ChainLink` (`ChainLinkAdded`) → cửa sổ ưu tiên (auto-pass người không đáp trả được).
  `operations[]` chỉ chạy **lúc chain resolve** (LIFO), trên target còn hợp lệ (hết target → `ChainLinkFizzled`), dừng nếu duel
  kết thúc giữa chừng → lá vào mộ. Event: `EffectActivated`, (cost), `ChainLinkAdded`, (operation), `EffectResolved`,
  `CardSentToGraveyard`, `ChainResolved`; `DuelEnded` luôn cuối. Chi tiết: `engine.md` mục "Chain stack".
- `costInstanceIds` tiêu thụ tuần tự theo `cost[]`: mỗi `Discard`/`Tribute` lấy `count` id; `PayLP` không id (cần LP **lớn hơn**
  số trả `[ASSUMED]`). `Discard` từ tay (không phải chính lá kích hoạt), `Tribute` từ quái của mình.
- `target` kiểu `Card` (chỉ `MonsterZone`/`SpellTrapZone` ở 3.2): đúng `count` ứng viên → tự chọn; ít hơn → `NO_VALID_TARGET`;
  nhiều hơn → `PendingPrompt SelectEffectTarget`, trả lời bằng `ResolvePendingPrompt.cardInstanceIds`. Lá úp chỉ là target khi effect
  không có `filter`. `Destroy` bắt buộc có target `Card`.

## Trigger effect (task 3.5)

- `OnSummon` (quái được **Normal Summon**, kể cả Tribute; **Set không phải triệu hồi** `[RULE]`) và `OnDestroyed` (lá bị phá bởi
  combat hoặc effect, đang ở mộ chủ) **không** kích hoạt bằng `ActivateEffect`: engine tự khởi phát từ event rồi đưa lên chain
  của 3.3 (đối thủ đáp trả như link thường). Chi tiết: `engine.md` mục "Trigger effect".
- `trigger.mandatory?: boolean` — **đặt trên trigger object** (chỉ `OnSummon`/`OnDestroyed` có; `.strict()` chặn ở kind khác)
  `[DECISION]`. `true` = tự kích hoạt; bỏ trống/`false` = optional, engine hỏi chủ lá qua prompt `TriggerActivation`.
- Refine: effect `OnSummon`/`OnDestroyed` chỉ được cost `PayLP` (engine không tự chọn lá trả cost; chưa có prompt cost).
- Trigger không kích hoạt nếu lá đã rời chỗ, `condition` sai, cost không trả được, hoặc thiếu target `[RULE]`.

```json
{
  "id": "on-destroyed-burn",
  "trigger": { "kind": "OnDestroyed", "mandatory": true },
  "operations": [{ "kind": "Damage", "amount": 400, "target": "opponent" }]
}
```

## Schema (nguồn thật: `packages/shared/src/effects/*.ts`)

Mỗi `kind` là một `z.object({ kind: z.literal(...), ...field })` `.strict()` gộp bằng
`z.discriminatedUnion('kind', …)`; **params phẳng theo kind** (không còn `params: Record<string, unknown>`),
nên gõ sai kind/field là lỗi `tsc`/parse. `[DECISION]`

```ts
interface EffectDefinition {
  id: string; // unique trong 1 CardDefinition (CardDefinition.effects refine)
  trigger: Trigger;
  spellSpeed?: 1 | 2 | 3; // task 3.4; bỏ trống = suy ra từ lá (Counter Trap 3, Trap/Quick-Play 2, còn lại 1)
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
| Trigger   | `OnSummon{mandatory?}`, `OnDestroyed{mandatory?}` (task 3.5), `OnFlip`, `Continuous`, `Ignition`, `Quick`                  |
| Condition | `PhaseIs{phase}`, `IsMyTurn`, `ZoneCount{zone, side, min?, max?}`                                                          |
| Cost      | `Discard{count, filter?}`, `Tribute{count, filter?}`, `PayLP{amount}`                                                      |
| Target    | `Card{zone, side, count, filter?}`, `Player{who}`                                                                          |
| Operation | `Damage{amount, target}`, `Heal{amount, target}`, `Draw{count, target}`, `Destroy` (tác động lên `target` Card của effect) |
| Filter    | `kind` (Monster/Spell/Trap), `level{min?,max?}`, `attribute`, `race`                                                       |

`zone`: `Hand|Deck|Graveyard|MonsterZone|SpellTrapZone`; `side`/`who`/operation `target`: `self|opponent`;
`phase`: `Draw|Standby|Main1|Battle|Main2|End`.

## Kind CHƯA có (thêm qua `/new-effect-type`, theo `docs/plan/card-and-effect-plan.md`)

- **Trigger**: `OnDraw`, `OnDestroyed` tham số `by` (Battle/Effect) — kind đã có ở 3.5, `by` chưa, `OnSentToGY`, `OnPhaseStart`, `OnDamage`, `OnAttackDeclared`, `OnActivate`.
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
