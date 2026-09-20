# Effect DSL Spec

Mục tiêu: thêm lá bài mới = thêm data vào `packages/shared`, không sửa `packages/game-engine`
core cho phần lớn trường hợp. Lá quá phức tạp để mô tả bằng DSL dùng `scriptId` trỏ tới 1
handler function đăng ký sẵn trong engine.

> Trạng thái: **spec cho M2**, chưa implement (M0 chỉ có card content tĩnh, chưa có effect
> engine). Khi bắt đầu M2, review lại spec này, chốt schema thật bằng Zod trong
> `packages/shared`, và cập nhật file này nếu có thay đổi.

## Schema tổng quát

```ts
interface EffectDefinition {
  id: string; // unique trong phạm vi 1 CardDefinition
  trigger: TriggerSpec;
  condition?: ConditionSpec[]; // AND — tất cả phải đúng mới activate/resolve được
  cost?: CostSpec[]; // trả trước khi effect lên chain (vd discard, tribute)
  target?: TargetSpec; // chọn target lúc activate (không phải lúc resolve)
  operations: OperationSpec[]; // thực thi tuần tự khi effect resolve
}

type TriggerSpec =
  | { kind: 'OnSummon' }
  | { kind: 'OnDraw' }
  | { kind: 'OnDestroyed'; by?: 'Battle' | 'Effect' | 'Any' }
  | { kind: 'OnPhaseStart'; phase: Phase }
  | { kind: 'Continuous' } // không lên chain
  | { kind: 'Ignition' } // chủ động activate ở Main Phase
  | { kind: 'Quick' }; // activate bất kỳ lúc nào có priority

interface ConditionSpec {
  kind: string;
  params: Record<string, unknown>;
}
interface CostSpec {
  kind: 'Discard' | 'Tribute' | 'PayLP' | 'Banish';
  params: Record<string, unknown>;
}
interface TargetSpec {
  kind: 'Card' | 'Player';
  count: number;
  filter: Record<string, unknown>;
}
interface OperationSpec {
  kind: string;
  params: Record<string, unknown>;
}
```

`condition`/`cost`/`target`/`operations` dùng danh sách `kind` mở rộng dần — mỗi `kind` mới
implement bằng 1 handler nhỏ trong engine (`effects/operations/<kind>.ts`), không phải
if/else khổng lồ. Effect quá đặc thù (không map được vào operation có sẵn) dùng `scriptId`
thay vì cố nhét vào DSL:

```ts
interface CardDefinitionWithScript {
  // ...CardDefinition base
  scriptId: string; // vd 'wandering-squire-on-summon'
}
```

Engine giữ 1 registry `Record<scriptId, EffectScriptHandler>` — handler nhận `(state, ctx)`,
trả `{ state, events }` giống `applyAction`, nhưng chỉ chạy trong scope resolve của effect đó.

## 5 ví dụ mẫu

**1. Trigger** — "Khi lá này được Summon, rút 1 lá":

```json
{
  "id": "on-summon-draw",
  "trigger": { "kind": "OnSummon" },
  "operations": [{ "kind": "DrawCard", "params": { "count": 1, "target": "self" } }]
}
```

**2. Continuous** — "Trong khi lá này trên sân, các monster Warrior khác +200 ATK":

```json
{
  "id": "warrior-buff",
  "trigger": { "kind": "Continuous" },
  "operations": [
    {
      "kind": "ModifyAtk",
      "params": { "amount": 200, "filter": { "race": "Warrior" }, "scope": "otherOwnedMonsters" }
    }
  ]
}
```

**3. Ignition** — "1 lần/turn, trả 500 LP: gây 500 damage cho đối thủ":

```json
{
  "id": "ignition-burn",
  "trigger": { "kind": "Ignition" },
  "condition": [{ "kind": "OncePerTurn", "params": { "scopeId": "ignition-burn" } }],
  "cost": [{ "kind": "PayLP", "params": { "amount": 500 } }],
  "operations": [{ "kind": "DealDamage", "params": { "amount": 500, "target": "opponent" } }]
}
```

**4. Quick** — "Trap thường: Negate 1 lần tấn công":

```json
{
  "id": "negate-attack",
  "trigger": { "kind": "Quick" },
  "target": { "kind": "Card", "count": 1, "filter": { "state": "attackingMonster" } },
  "operations": [{ "kind": "NegateAttack", "params": {} }]
}
```

**5. scriptId** — effect quá đặc thù (vd tương tác nhiều bước, tùy chọn phức tạp):

```json
{
  "id": "complex-fusion-search",
  "trigger": { "kind": "OnSummon" },
  "scriptId": "ashfall-wyrm-on-summon"
}
```

```ts
// engine/effects/scripts/ashfall-wyrm-on-summon.ts
export const ashfallWyrmOnSummon: EffectScriptHandler = (state, ctx) => {
  // logic tùy chỉnh không map được vào operation catalog hiện có
};
```

## Nguyên tắc thêm operation/condition/cost mới

1. Kiểm tra operation catalog hiện có (`packages/game-engine/src/effects/operations/`) trước
   khi thêm — tránh trùng lặp.
2. Operation mới phải pure + deterministic, nhận `(state, params, ctx)` trả `{state, events}`.
3. Nếu > 1 lá cần cùng 1 hành vi đặc thù, ưu tiên khái quát hóa thành operation thay vì
   copy-paste `scriptId` nhiều lần.
4. Xem `.claude/commands/new-effect-type.md` cho quy trình cụ thể.
