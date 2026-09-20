# Engine Design

`packages/game-engine` — pure TypeScript, deterministic, server-authoritative. Xem luật bất
biến trong `CLAUDE.md` root và `packages/game-engine/CLAUDE.md`.

## Public API

```ts
function applyAction(
  state: GameState | null, // null chỉ hợp lệ cho action đầu tiên: StartDuel
  action: Action,
  ctx: ActionContext,
): { state: GameState; events: GameEvent[] };
```

Mọi thứ khác trong package không phải contract ổn định — import qua `@yugi/game-engine`
(root export), không import sâu vào `src/`.

## GameState

```ts
interface GameState {
  matchId: string;
  rng: RngState;                        // seeded, xem rng/seeded-rng.ts
  ruleset: RulesetConfig;               // resolved lúc StartDuel (packages/shared), replay tái lập
  turnCount: number;
  turnPlayerIndex: 0 | 1;
  phase: Phase;                         // Draw|Standby|Main1|Battle|Main2|End
  players: [PlayerState, PlayerState];
  chainStack: ChainLink[];              // M2
  pendingPrompt: PendingPrompt | null;
  winnerIndex: 0 | 1 | null;
  version: number;                      // bump mỗi applyAction — dùng cho desync detection
}

interface PlayerState {
  playerId: string;
  lifePoints: number;
  board: { monsterZones: [5 slots]; spellTrapZones: [5 slots]; fieldZone: 1 slot };
  hand, deck, graveyard, banished, extraDeck: CardInstance[];
  hasNormalSummonedThisTurn: boolean;
}

interface CardInstance {
  instanceId: string;      // runtime id, khác CardDefinition.id
  definitionId: string;    // trỏ tới @yugi/shared CardDefinition
  position: 'Attack' | 'DefenseUp' | 'DefenseDown' | null;
  ownerIndex: 0 | 1;
}
```

State phải serialize được 100% (JSON) — không class instance, không `Map`/`Set`. Update bằng
tạo object mới (spread), không mutate.

## Action list

Đã có: `StartDuel` (payload nhận `ruleset?: Partial<RulesetConfig>`, ghi đè lên mặc định early Master Rule), `Draw`.

Sẽ thêm dần qua M1/M2 (giữ nguyên tắc: 1 Action = 1 quyết định rời rạc của người chơi/AI):

| Action                 | Milestone                                               | Ghi chú                                                          |
| ---------------------- | ------------------------------------------------------- | ---------------------------------------------------------------- |
| `NormalSummon`         | M1                                                      | Kèm `tributeInstanceIds` nếu level 5+                            |
| `SetMonster`           | M1                                                      | Face-down defense                                                |
| `ChangePosition`       | M1                                                      | Chỉ 1 lần/turn/monster, không đổi lượt vừa summon (trừ effect)   |
| `DeclareAttack`        | M1                                                      | `attackerInstanceId`, `targetInstanceId?` (null = direct attack) |
| `ActivateEffect`       | M2                                                      | Kèm `cardInstanceId`, `targetInstanceIds?`, `costPayload?`       |
| `ResolvePendingPrompt` | M1 (cho tribute selection) / M2 (target/chain response) | Trả lời `PendingPrompt` hiện tại                                 |
| `PassPriority`         | M2                                                      | Dùng trong chain window                                          |
| `EndPhase`             | M1                                                      | Chuyển sang phase kế tiếp                                        |

### Kích hoạt Trap/Spell — hợp đồng C11 (implement ở P3, task 3.4)

`[DECISION]` Trap phải được Set úp trên sân mới kích hoạt; `[RULE]` Trap vừa Set thì lượt đó chưa kích hoạt; `[RULE]` Spell thường kích hoạt từ tay ở Main Phase của mình. Quick-Play Spell (Speed 2): để P3, chưa chốt ở đây.

- `ActivateEffect` cho **Trap** chỉ hợp lệ khi lá đang ở Spell/Trap Zone, úp, và (nếu `ruleset.trapSetTurnDelay`) đã qua lượt Set. Engine ghi lượt Set của lá để so sánh.
- `ruleset.allowTrapActivationFromHand` (mặc định `false`): khi `false`, Trap trên tay chỉ có `SetSpellTrap`, không có `ActivateEffect`.
- Reject bằng mã lỗi tách biệt: `TRAP_NOT_SET` (Trap chưa úp trên sân, vd còn trên tay), `TRAP_SET_THIS_TURN` (Set trong chính lượt này).
- Hiện chỉ lưu 2 khoá config trong `state.ruleset`; chưa có hành vi nào đổi (test `it.todo` ở `packages/game-engine/src/rules/trap-activation.test.ts`).

## Event list

Đã có (M0): `DuelStarted`, `CardDrawn`, `DeckOut`.

Sẽ thêm dần: `CardSummoned`, `CardSet`, `PositionChanged`, `AttackDeclared`, `DamageDealt`,
`MonsterDestroyed`, `PhaseChanged`, `TurnChanged`, `ChainLinkAdded`, `ChainResolved`,
`EffectActivated`, `DuelEnded`.

Event là **fact đã xảy ra**, không phải instruction cho FE — FE tự quyết định animate thế nào
từ fact đó.

## PendingPrompt

Khi engine cần input từ người chơi (chọn tribute, chọn target, chọn chain response...) mà
không thể tự quyết định, nó trả về `state.pendingPrompt` thay vì throw hay block:

```ts
interface PendingPrompt {
  promptId: string;
  playerIndex: 0 | 1;
  kind: string; // vd 'SelectTribute', 'SelectChainResponse'
  payload: unknown; // options cụ thể theo kind
}
```

Khi `pendingPrompt != null`, engine chỉ chấp nhận `ResolvePendingPrompt` (khớp `promptId` và
`playerIndex`) từ phía server — action khác bị reject ở tầng `apps/api` (không phải lỗi
runtime của engine, service kiểm tra trước khi gọi `applyAction`).

## Chain stack (M2)

Mỗi effect activate được push vào `chainStack` (LIFO). Resolve theo thứ tự ngược (activate
sau cùng resolve trước). Spell Speed quyết định effect nào được phép activate để đáp trả:

- Speed 1 (Normal Spell/Trap): chỉ activate khi chain rỗng.
- Speed 2 (Quick-Play, most Trigger/Ignition): activate được để đáp Speed 1 hoặc 2.
- Speed 3 (Counter Trap): activate được để đáp bất kỳ speed nào.

Chi tiết cấu trúc `ChainLink` + resolve algorithm sẽ chốt khi bắt đầu implement M2 (ghi ADR
tương ứng vào `docs/ai/DECISIONS.md` lúc đó).

## Replay

1 ván đấu = `(seed, playerIds, deckLists, actionLog: Action[])`. Replay = chạy lại
`applyAction` tuần tự từ `StartDuel` qua toàn bộ `actionLog` với cùng seed → ra đúng
`GameState` cuối cùng, vì engine deterministic. Đây là lý do DB (`DuelMatch.actionLog`)
lưu action log thay vì state snapshot.
