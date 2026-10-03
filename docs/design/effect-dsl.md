# Effect DSL

Mục tiêu: thêm lá bài mới = thêm data vào `packages/shared`, không sửa `packages/game-engine`
core cho phần lớn trường hợp. Lá quá phức tạp để mô tả bằng DSL dùng `scriptId` trỏ tới 1
handler function đăng ký sẵn trong engine.

> Trạng thái: **schema Zod đã có (task 3.1, batch 1)** ở `packages/shared/src/effects/`;
> **engine chạy được 4 operation `Damage`/`Heal`/`Draw`/`Destroy` (task 3.2)** qua `ActivateEffect` cho Normal Spell
> từ tay. Registry ở shared chỉ là metadata (`implemented: true` cho 4 kind này, không giữ hàm); handler thật ở
> `packages/game-engine/src/effects/operations/<kind>.ts` (`OPERATION_HANDLERS`, thiếu kind = `tsc` đỏ; test đối chiếu
> hai phía). Từ task 3.3 effect lên **chain** (resolve LIFO); task 3.4 thêm lá Set; task 3.5 thêm trigger tự khởi phát
> `OnSummon`/`OnDestroyed` (optional/mandatory); task 3.6 thêm **Continuous effect** (`ModifyStat`, tính lại mỗi lần đọc) và
> **`scriptId` ở mức effect** (registry `EFFECT_SCRIPTS`); task 4.4 thêm **Counter Trap + 3 operation Negate**. Thêm kind
> mới: `/new-effect-type`.

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
  - Kích hoạt **lá** Continuous Spell/Trap (để nó nằm ngửa trên sân), Normal Spell đã Set, Field → `NOT_ACTIVATABLE` (P4);
    trigger không khớp → `NOT_ACTIVATABLE`. Effect có `trigger.kind === 'Continuous'` → `CONTINUOUS_NOT_ACTIVATABLE` (task 3.6,
    kể cả quái trên sân); effect có `scriptId` chưa đăng ký → `UNKNOWN_SCRIPT`.
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

## Continuous effect (task 3.6)

- `[RULE]` Không kích hoạt, không lên chain, không có `cost`/`target`. Có hiệu lực **khi lá nằm ngửa trên sân** (quái `Attack`/
  `DefenseUp`, Phép/Bẫy ngửa ở ô Phép/Bẫy) và `condition` (nếu có) đúng **tại thời điểm đọc**; mất hiệu lực ngay khi lá rời sân hoặc úp.
- **Không lưu vào state**: engine tính lại mỗi lần cần (`effects/continuous.ts`: `activeContinuousEffects`, `effectiveStats`), nên không
  có code "gỡ hiệu ứng". Hiện chỉ combat (`battle/resolve-attack.ts`) đọc ATK/DEF; chỉ số đọc trên bàn **sau khi lật** mục tiêu úp.
- Operation Continuous (`CONTINUOUS_OPERATION_KINDS`, `OPERATION_REGISTRY[kind].timing === 'continuous'`) chỉ nằm trong effect
  `Continuous`, và effect `Continuous` chỉ chứa chúng (refine). Handler ở `CONTINUOUS_HANDLERS` (engine), không ở `OPERATION_HANDLERS`.
- `ModifyStat{stat: 'atk'|'def', amount (≠ 0, ±10000), side, filter?, excludeSource?}`: quái **ngửa** ở `side` (tương đối người điều
  khiển lá nguồn) khớp `filter`, trừ chính lá nguồn nếu `excludeSource`. Cộng dồn nhiều nguồn; kết quả kẹp ≥ 0 `[RULE]`.
- Kích hoạt lá Continuous Spell/Trap để đặt ngửa: **task 4.3** — xem mục "Lá ở lại sân" ngay dưới. Nguồn Continuous từ 4.3 gồm cả
  lá ngửa ở Field Zone.

## Lá ở lại sân: Continuous Spell/Trap, Field Spell (task 4.3)

- **Không có field schema mới**: lá ở lại sân sau khi resolve được đọc từ `subType` — Spell `Continuous`/`Field`, Trap `Continuous`
  (`staysOnField(card)` ở `cards/card-definition.ts`).
- Lá gồm **2 effect** (cùng mẫu Equip): (1) effect **kích hoạt lá** — Spell: `Ignition`, Trap: `Quick` — `operations` **được rỗng**
  khi lá không làm gì lúc kích hoạt (có thể có operation/cost/target như effect thường: "khi kích hoạt: hồi 500"); (2) effect
  `Continuous` (`ModifyStat…`) có hiệu lực khi lá đã ngửa trên sân.
- Refine: effect rỗng (không operation, không `scriptId`) chỉ hợp lệ với trigger `Ignition`/`Quick` **và** trên lá ở lại sân có effect
  `Continuous`; Field Spell phải có effect `Continuous` hoặc `scriptId`; Spell/Trap có effect `Continuous` phải có effect kích hoạt
  (Spell `Ignition`, Trap `Quick`) — ngoại lệ không cần ghi: Equip đã có effect `Ignition` `Equip`.
- Engine (kích hoạt từ tay/đã Set, Field Zone, thay lá Field, bị phá): `engine.md` mục "Field Spell + lá ở lại sân".

```json
{
  "id": "SMP-113",
  "kind": "Spell",
  "subType": "Field",
  "effects": [
    { "id": "activate", "trigger": { "kind": "Ignition" }, "operations": [] },
    {
      "id": "gale-boost",
      "trigger": { "kind": "Continuous" },
      "operations": [
        {
          "kind": "ModifyStat",
          "stat": "atk",
          "amount": 300,
          "side": "self",
          "filter": { "attribute": "WIND" }
        },
        {
          "kind": "ModifyStat",
          "stat": "atk",
          "amount": 300,
          "side": "opponent",
          "filter": { "attribute": "WIND" }
        }
      ]
    }
  ]
}
```

```json
{
  "id": "warrior-aura",
  "trigger": { "kind": "Continuous" },
  "operations": [
    {
      "kind": "ModifyStat",
      "stat": "atk",
      "amount": 500,
      "side": "self",
      "filter": { "race": "Warrior" },
      "excludeSource": true
    }
  ]
}
```

## Counter Trap + Negate (task 4.4)

- **Bẫy Phản công** = Trap `subType: 'Counter'`: Spell Speed 3 (suy từ subType, không cần `spellSpeed`), và engine **chỉ cho
  kích hoạt để đáp trả** (đang có mắt xích hoặc cửa sổ phản ứng; không thì `NOTHING_TO_RESPOND_TO`) `[RULE]`. Không có field
  schema mới cho việc này.
- Ba operation (chạy lúc resolve). Refine: effect chứa một operation Negate phải có trigger `Quick`; có thể kèm `cost` và
  operation khác; không cần `target` (cái bị vô hiệu là thứ effect đang đáp, không phải thứ người chơi chọn).
  - `NegateActivation{cardKinds?: ('Monster' | 'Spell' | 'Trap')[]}` — vô hiệu việc kích hoạt của **mắt xích ngay dưới**. Kích
    hoạt được khi mắt xích trên cùng là của đối thủ và (nếu có `cardKinds`) lá của nó thuộc loại đó. Lá Phép/Bẫy bị vô hiệu vào
    mộ (kể cả lá ở lại sân); cost của nó không hoàn `[ASSUMED]` G23.
  - `NegateAttack` — vô hiệu đòn tấn công đối thủ vừa tuyên bố (chỉ kích hoạt được trong cửa sổ phản ứng tấn công).
  - `NegateSummon` — vô hiệu Normal / Flip Summon của đối thủ (chỉ kích hoạt được là mắt xích đầu tiên trong cửa sổ phản ứng
    triệu hồi; không áp dụng cho Set và Special Summon bằng effect — chủ dự án chốt 2026-10-02). Quái vào mộ `[ASSUMED]` G23.
- **`FusionSummon { sources, position? }`** (task 4.5, ADR 068) — Triệu hồi Dung hợp 1 quái Fusion từ Extra Deck của người
  kích hoạt. `sources`: nguyên liệu lấy từ đâu (`'Hand'` / `'Field'` = ô quái của mình / `'Deck'`; ≥ 1, không lặp). Phải là
  **operation duy nhất** của một effect `Ignition` trên Phép `Normal`, không `target`, không `scriptId`, `spellSpeed` bỏ trống
  hoặc 1 (refine). Quái Fusion và nguyên liệu do người chơi chọn **lúc resolve** (2 prompt) — operation duy nhất cần input lúc
  resolve; chi tiết ở `engine.md` mục "Fusion". Quái Fusion khai `fusionMaterials: string[]` (id đích danh) trên
  `CardDefinition`.
- Thiếu thứ để vô hiệu ⇒ `NOTHING_TO_NEGATE` (đọc từ operation trong effect, không từ id lá). Chi tiết resolve + event:
  `engine.md` mục "Counter Trap + Negate".

```json
{
  "id": "SMP-209",
  "kind": "Trap",
  "subType": "Counter",
  "effects": [
    {
      "id": "sealing-rune",
      "trigger": { "kind": "Quick" },
      "cost": [{ "kind": "PayLP", "amount": 1000 }],
      "operations": [{ "kind": "NegateActivation", "cardKinds": ["Spell", "Trap"] }]
    }
  ]
}
```

## Equip Spell (task 4.2c)

- Lá `subType: 'Equip'` gồm 2 effect: (1) `Ignition` + target `Card` `MonsterZone` `count: 1` `filter: {kind: 'Monster'}` + operation `Equip`;
  (2) `Continuous` + `ModifyStat{…, equipped: true}`. Refine: `Equip` cần đúng target đó; `ModifyStat` có đúng một trong `side` / `equipped`
  (`equipped` không kèm `filter`/`excludeSource`); `Equip`/`equipped` chỉ được có trên Equip Spell (refine ở `CardDefinitionSchema`).
- Engine: lá ngửa vào ô Phép/Bẫy lúc kích hoạt, gắn vào quái lúc resolve, ở lại sân; quái rời sân (hoặc bị úp) ⇒ lá Equip vào mộ.
  Chi tiết: `engine.md` mục "Equip Spell".

```json
[
  {
    "id": "e1",
    "trigger": { "kind": "Ignition" },
    "target": {
      "kind": "Card",
      "zone": "MonsterZone",
      "side": "self",
      "count": 1,
      "filter": { "kind": "Monster" }
    },
    "operations": [{ "kind": "Equip" }]
  },
  {
    "id": "e2",
    "trigger": { "kind": "Continuous" },
    "operations": [{ "kind": "ModifyStat", "stat": "atk", "amount": 500, "equipped": true }]
  }
]
```

## Flip effect (task 4.2b)

- `OnFlip{mandatory?}` giờ chạy thật: bắn khi quái được **Flip Summon** (action `FlipSummon`) hoặc **bị lật do bị tấn công**, kể cả khi trận
  đó phá nó (kích hoạt từ mộ) `[RULE]`. Flip Summon cũng bắn `OnSummon`. Như trigger khác: chỉ cost `PayLP`; optional thì hỏi chủ lá.
  Chi tiết: `engine.md` mục "Flip Summon + OnFlip".

## Special Summon (task 4.2a)

- Operation `SpecialSummon{position?: 'Attack' | 'DefenseUp'}` chạy lúc resolve, tác động lên target `Card` của effect. Refine: target
  phải là `Card` ở `Hand` hoặc `Graveyard`, `side: 'self'`, `filter.kind === 'Monster'` `[DECISION]` (chưa đổi người điều khiển).
- Target `Card` giờ đọc được **tay của mình** và **mộ** (hai bên, công khai); tay đối thủ và Deck vẫn không (thông tin ẩn).
- Engine: ô quái trống thấp nhất `[ASSUMED]`; không tốn Normal Summon `[RULE]`; bắn `OnSummon` `[RULE]`; thiếu ô ⇒
  `NO_FREE_MONSTER_ZONE`. Chi tiết: `engine.md` mục "Special Summon".
- Không có **action** Special Summon (chủ dự án chốt 2026-09-30); summon "tự thân" cần DSL điều kiện riêng, chưa có.

```json
{
  "id": "revive",
  "trigger": { "kind": "Ignition" },
  "target": {
    "kind": "Card",
    "zone": "Graveyard",
    "side": "self",
    "count": 1,
    "filter": { "kind": "Monster" }
  },
  "operations": [{ "kind": "SpecialSummon", "position": "DefenseUp" }]
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
  operations: Operation[]; // thực thi tuần tự khi resolve (Continuous: modifier đang hiệu lực); rỗng khi có scriptId, hoặc effect kích hoạt lá ở lại sân (4.3)
  scriptId?: string; // task 3.6: script engine chạy lúc resolve, SAU operations; không cho Continuous
}
```

Ràng buộc (`.refine`): `operations` ≥ 1 hoặc có `scriptId` (trừ effect `Ignition`/`Quick` kích hoạt lá ở lại sân, task 4.3 — kiểm ở mức lá); `condition`/`cost` không rỗng nếu có; `Continuous` không có
`cost`/`target`/`scriptId` (không lên chain) và chỉ chứa operation continuous, effect khác không chứa operation continuous; `ZoneCount` cần `min` và/hoặc `max`, `min ≤ max`; `filter` cần ≥ 1
tiêu chí, `level.min ≤ level.max`.

`CardDefinition` có thêm `effects?: EffectDefinition[]` (id không trùng), `name`/`effectText?` là
`{ vi, en }` (cả hai bắt buộc, không fallback; helper `pickText(text, lang)`).

## Kind đã có (batch 1)

| Loại      | Kind → field                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trigger   | `OnSummon{mandatory?}`, `OnDestroyed{mandatory?}` (task 3.5), `OnFlip{mandatory?}` (task 4.2b), `Continuous`, `Ignition`, `Quick`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Condition | `PhaseIs{phase}`, `IsMyTurn`, `ZoneCount{zone, side, min?, max?}`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Cost      | `Discard{count, filter?}`, `Tribute{count, filter?}`, `PayLP{amount}`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Target    | `Card{zone, side, count, filter?}`, `Player{who}`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Operation | `Damage{amount, target}`, `Heal{amount, target}`, `Draw{count, target}`, `Destroy` (tác động lên `target` Card của effect), `SpecialSummon{position?}` (task 4.2a, target Card ở tay/mộ của mình), `Equip` (task 4.2c, gắn chính lá Equip Spell vào 1 quái ngửa), `NegateActivation{cardKinds?}` / `NegateAttack` / `NegateSummon` (task 4.4, chỉ trong effect `Quick`), `FusionSummon{sources, position?}` (task 4.5, một mình trong effect `Ignition` của Phép Thường); continuous: `ModifyStat{stat, amount, side, filter?, excludeSource?}` (task 3.6) hoặc `ModifyStat{stat, amount, equipped: true}` (task 4.2c) |
| Filter    | `kind` (Monster/Spell/Trap), `level{min?,max?}`, `attribute`, `race`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

`zone`: `Hand|Deck|Graveyard|MonsterZone|SpellTrapZone`; `side`/`who`/operation `target`: `self|opponent`;
`phase`: `Draw|Standby|Main1|Battle|Main2|End`.

## Kind CHƯA có (thêm qua `/new-effect-type`, theo `docs/plan/card-and-effect-plan.md`)

- **Trigger**: `OnDraw`, `OnDestroyed` tham số `by` (Battle/Effect) — kind đã có ở 3.5, `by` chưa, `OnSentToGY`, `OnPhaseStart`, `OnDamage`, `OnAttackDeclared`, `OnActivate`.
- **Condition**: `LPCompare`, `HasCardIn(zone, filter)`, `ChainLength`, `PositionIs`, `OncePerTurn`.
- **Cost**: `Banish`, `SendToGY`, `Reveal`.
- **Target**: `AllMatching(filter)`.
- **Operation**: `SendToGY`, `Banish`, `Return(hand/deck)`, `ChangePosition`, `Shuffle`, `Search`, `SkipPhase` (`Negate*` đã có ở task 4.4; "vô hiệu **hiệu ứng**" — khác "vô hiệu việc kích hoạt" — chưa có). (`ModifyStat` continuous đã có ở 3.6; bản
  "tới hết lượt" chạy lúc resolve cần Duration, chưa có.) Continuous "chặn một loại hành động" (vd cấm tấn công) chưa có.
- **Filter**: `atk(min/max)`, `position`, `nameContains`, `tag`.
- **Duration**: `ThisTurn`, `UntilEndPhase`, `Permanent` (batch 3; cần lưu modifier vào state). **`WhileOnField` cố ý không thêm** (chủ dự án
  chốt 2026-09-30, task 4.2c): effect `Continuous` đã là "khi lá còn ngửa trên sân"; Equip dùng `ModifyStat.equipped`.

Ví dụ trong bản spec cũ dùng tên `DrawCard`/`DealDamage`/`ModifyAtk`/`NegateAttack`: batch 1 dùng `Draw`/`Damage`
(theo bảng plan); `NegateAttack` giữ đúng tên đó khi được thêm ở task 4.4; các kind còn lại đổi tên/định hình khi được thêm.

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

**scriptId** (task 3.6) — effect quá đặc thù (không map được vào operation catalog). `operations` được rỗng khi có `scriptId`:

```json
{
  "id": "halve-lp",
  "trigger": { "kind": "Ignition" },
  "scriptId": "test.halve-opponent-lp",
  "operations": []
}
```

- `scriptId` nằm ở **mức `EffectDefinition`** `[DECISION]`; chạy lúc link resolve, **sau** `operations`, chỉ khi duel chưa kết thúc.
  Không cho effect `Continuous` (script là việc chạy một lần).
- Engine: `EFFECT_SCRIPTS: Record<scriptId, EffectScriptHandler>` (`packages/game-engine/src/effects/effect-scripts/registry.ts`);
  handler `(state, ctx: {controller, targetInstanceIds}) → {state, events}`, thuần như operation, không bump `version`.
  `scriptId` chưa đăng ký → `UNKNOWN_SCRIPT` (ActivateEffect) / trigger không kích hoạt. Test: mọi `scriptId` trong `SAMPLE_CARDS`
  phải có trong registry.
- Hiện registry chỉ có `test.halve-opponent-lp` (LP đối thủ giảm một nửa, làm tròn xuống, như effect damage) — chỉ lá test dùng.
- `CardDefinition.scriptId` (trường cũ ở mức lá, task 1.x) **không được engine đọc**; lá mới dùng `scriptId` ở mức effect.

## Nguyên tắc thêm operation/condition/cost mới

1. Kiểm tra catalog hiện có (bảng trên) trước khi thêm — tránh trùng lặp.
2. Thêm schema kind ở `packages/shared/src/effects/`, thêm vào danh sách `*_KINDS` + `OPERATION_REGISTRY` ở
   `registry.ts` (thiếu = `tsc` đỏ), test parse hợp lệ + reject.
3. Operation mới phải pure + deterministic, nhận `(state, params, ctx)` trả `{state, events}` (handler ở engine, task 3.2+).
4. Nếu > 1 lá cần cùng 1 hành vi đặc thù, ưu tiên khái quát hoá thành operation thay vì copy-paste `scriptId`.
5. Xem `.claude/commands/new-effect-type.md` cho quy trình cụ thể.
