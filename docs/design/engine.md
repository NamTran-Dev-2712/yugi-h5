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
  winnerIndex: 0 | 1 | 'draw' | null; // null = đang đấu; 'draw' = cả hai LP về 0 cùng lúc (task 1.7)
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
  // Dấu lượt theo quái (task 1.5), = state.turnCount lúc xảy ra; "trong lượt này" ⇔ dấu === state.turnCount.
  summonedTurn?: number;        // Summon/Tribute/Set (ghi bởi summon.ts)
  positionChangedTurn?: number; // ChangePosition
  attackedTurn?: number;        // DeclareAttack (task 1.6 ✅, ghi khi quái còn sống sau combat)
}
```

State phải serialize được 100% (JSON) — không class instance, không `Map`/`Set`. Update bằng
tạo object mới (spread), không mutate.

## Action list

Đã có: `StartDuel` (payload nhận `ruleset?: Partial<RulesetConfig>`, ghi đè lên mặc định early Master Rule), `Draw`, `EndPhase` (`payload.playerIndex` phải là turn player; reject khi đã có winner / có `pendingPrompt`).

`EndPhase`: Draw→Standby→Main1→Battle→Main2→End, rời End thì `turnCount+1`, đổi `turnPlayerIndex`, về Draw, reset `hasNormalSummonedThisTurn`. **Draw của lượt thực hiện khi rời Draw phase** (bỏ qua ở lượt 1 nếu `!ruleset.firstTurnDraw`); deck rỗng → `DeckOut` + `DuelEnded {reason:'DECK_OUT'}` (task 1.10), phase không tiến. **Hand limit (1.11)**: rời `Main2` với tay > `handLimit` mở prompt, không tiến phase (xem mục PendingPrompt). Chuỗi phase không bị cắt ở lượt 1; cấm attack lượt 1 (`firstTurnAttack`) thuộc `DeclareAttack` (task 1.6).

`NormalSummon` / `SetMonster` (task 1.3): payload `{ playerIndex, cardInstanceId, zoneIndex }` (`cardInstanceId` = lá trong tay, `zoneIndex` 0–4 khớp ô kéo thả). Summon → ngửa, `position: 'Attack'`; Set → úp, `position: 'DefenseDown'`. Cả hai tiêu tốn quyền Normal Summon (`hasNormalSummonedThisTurn`). Chỉ Main1/Main2. **Tribute (task 1.4)**: payload thêm `tributeInstanceIds?: string[]` (mặc định `[]`, không có action mới); số tribute bắt buộc theo Level trong definition `[RULE]`: 1–4 → 0, 5–6 → 1, 7+ → 2 (sai → `TRIBUTE_COUNT_MISMATCH`). Tribute phải là quái trên sân của chính người gọi (ngửa/úp), không trùng (sai → `INVALID_TRIBUTE`: quái đối thủ, lá trong tay/mộ, id lạ, trùng, chính lá đang gọi). `zoneIndex` được trỏ vào ô của quái bị tribute (coi như trống sau tribute); ô khác đang có quái → `ZONE_OCCUPIED`. Validate xong mới đổi state; tribute vào mộ theo thứ tự mảng (`position: null`). Reject bằng `throw EngineError` có `code` (winner, prompt, không phải turn player, sai phase, đã dùng quyền, `zoneIndex` sai, lá không ở tay, không phải Monster, sai số tribute, tribute không hợp lệ, ô đã có quái). Cờ theo lượt reset tập trung ở `resetTurnFlags` (`state/turn-flags.ts`).

**`ActionContext.cardDefinitions: (definitionId) => CardDefinition | undefined`** (bắt buộc trong type) — caller (apps/api) truyền resolver tra `packages/shared`; engine không hardcode lá bài. `applyAction` có overload: `StartDuel`/`Draw`/`EndPhase` không cần ctx; mọi Action khác **bắt buộc** ctx (type-level). Caller không qua type (JS/cast) thiếu ctx → `NO_CARD_RESOLVER`; resolver trả `undefined` → `CARD_DEFINITION_NOT_FOUND`.

`ChangePosition` (task 1.5): đổi quái **ngửa** của chính người gọi giữa `Attack` ↔ `DefenseUp`; `toPosition` tường minh (không toggle) để client dùng view cũ không đổi nhầm. Chỉ Main1/Main2, turn player, không winner/prompt. Không tiêu tốn quyền Normal Summon. Mỗi quái tối đa 1 lần/lượt; không đổi quái vừa Summon/Tribute/Set trong lượt; không đổi quái đã tấn công trong lượt `[RULE]`. Trạng thái theo quái lưu bằng **dấu lượt** trên `CardInstance` (`summonedTurn`/`positionChangedTurn`/`attackedTurn` = `turnCount`), tự hết hiệu lực khi sang lượt khác, không cần reset (`resetTurnFlags` không đụng tới); `summon.ts` dựng `CardInstance` mới khi đặt quái nên không thừa dấu cũ. Mã lỗi: `INVALID_POSITION` (đích `DefenseDown`), `NOT_A_MONSTER` (lá phép/bẫy trên sân), `CARD_NOT_ON_FIELD` (tay/mộ/quái đối thủ/id lạ), `MONSTER_FACE_DOWN`, `SAME_POSITION`, `POSITION_ALREADY_CHANGED`, `SUMMONED_THIS_TURN`, `ATTACKED_THIS_TURN`. Quái úp: lật bằng Flip Summon (task sau), không phải ChangePosition.

`DeclareAttack` (task 1.6, mở rộng flip-on-attack ở task 1.8): payload `{ playerIndex, attackerInstanceId, targetInstanceId?: string | null }` (`targetInstanceId` bỏ trống/`null` = tấn công trực tiếp). Chỉ Battle Phase, turn player, quái **ngửa và đang ở Attack Position** của chính mình, chưa tấn công trong lượt (`attackedTurn`), không vừa Summon/Set trong lượt (`summonedTurn`); lượt 1 bị cấm trừ khi `ruleset.firstTurnAttack`. Tấn công trực tiếp chỉ hợp lệ khi sân đối thủ **không có quái nào** (kể cả úp) `[RULE, RULES-REVIEW-SHEET dòng 29]`; nếu có quái mà không chỉ định target → `MUST_TARGET_MONSTER`. Target là bất kỳ quái nào trên sân đối thủ, **kể cả úp** (task 1.8): nếu target đang face-down (`DefenseDown`), engine lật nó lên (`position: 'DefenseUp'`, giữ Defense — không tự chuyển Attack) trước khi tính damage, phát `MonsterFlipped { ownerIndex, instanceId, definitionId, zoneIndex }` **ngay sau** `AttackDeclared` và **trước** `MonsterDestroyed`/`DamageDealt` (để UI animate lật trước khi thấy kết quả combat). `summonedTurn`/`positionChangedTurn` của quái đối thủ không ảnh hưởng việc nó bị target/lật — hai dấu đó chỉ chặn hành động chủ động của chính quái đó. Chưa làm Flip Effect thật (chờ effect system); event chỉ mang đủ thông tin để hook sau. Damage/destroy sau khi lật dùng nguyên logic ATK-vs-DEF theo `RULES-REVIEW-SHEET.md` dòng 30-34 (không theo bảng brief gốc ở 2 dòng ATK-vs-DEF, xem ADR 2026-09-22): ATK-vs-ATK bên mạnh hơn thắng và đối phương mất hiệu số, bằng nhau cả hai bị phá không ai mất LP; ATK-vs-DEF: ATK>DEF chỉ phá quái thủ không ai mất LP, ATK<DEF không quái nào bị phá và bên tấn công mất hiệu số, ATK==DEF `[ASSUMED]` không gì xảy ra. LP damage clamp về 0 (`Math.max(0, ...)`). Quái tấn công còn sống thì ghi `attackedTurn = turnCount`. Mã lỗi mới (1.6): `FIRST_TURN_ATTACK_BANNED`, `ATTACKER_IN_DEFENSE_POSITION`, `JUST_SUMMONED_CANNOT_ATTACK`, `MUST_TARGET_MONSTER`, `INVALID_TARGET` (tái dùng `ATTACKED_THIS_TURN`, `CARD_NOT_ON_FIELD`, `NOT_A_MONSTER`, `MONSTER_FACE_DOWN` có sẵn); `TARGET_FACE_DOWN` đã bị xoá ở task 1.8 (target úp giờ hợp lệ, không còn reject).

`Surrender` (task 1.9): payload `{ playerIndex }`; bên nào cũng gửi được, ở mọi phase/lượt, kể cả khi có `pendingPrompt`. Reject `DUEL_ENDED` rồi `SURRENDER_DISABLED` (`ruleset.allowSurrender === false`). Kết quả: `winnerIndex` = đối thủ, `version + 1`, event `DuelEnded { winnerIndex, reason: 'SURRENDER' }`; không đổi gì khác. Không cần `ActionContext`.

**Deck-out (task 1.10)**: chỉ xảy ra khi _phải rút_ mà deck thiếu lá — `Draw` action (`deck.length < count`) hoặc lượt rút khi rời Draw phase (lượt 1 bỏ qua nếu `!firstTurnDraw`). Deck rỗng ở thời điểm khác không thua. Người phải rút thua: `winnerIndex` = đối thủ, không rút lá nào, phát `DeckOut {playerIndex}` rồi `DuelEnded {winnerIndex, reason:'DECK_OUT'}` (`DeckOut` giữ lại để UI animate lần rút hụt trước kết quả, giống `DamageDealt` → `DuelEnded`). `Draw` giờ có guard `DUEL_ENDED`.

**Win condition LP ≤ 0 (task 1.7)**: sau khi build xong `players` cuối cùng trong `DeclareAttack`, `state/win-condition.ts`'s `checkLifePointsWinCondition(players)` kiểm tra LP hai bên (đã clamp `>= 0` bởi `damage()`, nên `<= 0` ⇔ `=== 0`, không cần chỉnh clamp). Một bên về 0 → bên kia thắng (`winnerIndex: 0|1`); **cả hai cùng về 0 trong cùng 1 lần damage** `[ASSUMED]` → hòa (`winnerIndex: 'draw'`). Phát event `DuelEnded { winnerIndex: 0|1|null, reason: 'LP_ZERO' }` (`winnerIndex: null` trong event = hòa; khác `state.winnerIndex` vốn không dùng `null` để chỉ hòa, xem lý do bên dưới). Helper tách riêng (không nhét thẳng vào `declare-attack.ts`) để loss condition sau này (deck-out phát `DuelEnded`, effect damage...) tái dùng được, cùng tinh thần với `resetTurnFlags` (`state/turn-flags.ts`). `draw.ts`'s `DeckOut` **chưa đổi** — vẫn set `winnerIndex` trực tiếp, chưa phát `DuelEnded` (ngoài phạm vi task 1.7).

**`EngineError`** (`src/errors.ts`, export từ package): mọi reject là `EngineError` với `code` ổn định (`message` chỉ cho người đọc — test và API dựa vào `code`). Mã hiện có: `NO_STATE`, `UNHANDLED_ACTION`, `INVALID_STARTING_LP`, `DUEL_ENDED`, `PENDING_PROMPT`, `NOT_TURN_PLAYER`, `WRONG_PHASE`, `NORMAL_SUMMON_USED`, `INVALID_ZONE`, `CARD_NOT_IN_HAND`, `NO_CARD_RESOLVER`, `CARD_DEFINITION_NOT_FOUND`, `NOT_A_MONSTER`, `TRIBUTE_COUNT_MISMATCH`, `INVALID_TRIBUTE`, `ZONE_OCCUPIED`, (task 1.5) `INVALID_POSITION`, `CARD_NOT_ON_FIELD`, `MONSTER_FACE_DOWN`, `SAME_POSITION`, `POSITION_ALREADY_CHANGED`, `SUMMONED_THIS_TURN`, `ATTACKED_THIS_TURN`, và (task 1.6) `FIRST_TURN_ATTACK_BANNED`, `ATTACKER_IN_DEFENSE_POSITION`, `JUST_SUMMONED_CANNOT_ATTACK`, `MUST_TARGET_MONSTER`, `INVALID_TARGET`. `TARGET_FACE_DOWN` (task 1.6) đã bị xoá ở task 1.8 — không còn dùng. Test dùng `expectEngineError(fn, code)` (`src/testing/`), không so khớp regex message.

Sẽ thêm dần qua M1/M2 (giữ nguyên tắc: 1 Action = 1 quyết định rời rạc của người chơi/AI):

| Action                 | Milestone                                                  | Ghi chú                                                                                                                                                                                                                 |
| ---------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ChangePosition`       | M1 (task 1.5 ✅)                                           | `{playerIndex, cardInstanceId, toPosition: 'Attack'\|'DefenseUp'}`; xem chi tiết bên dưới                                                                                                                               |
| `DeclareAttack`        | M1 (task 1.6 ✅)                                           | `{playerIndex, attackerInstanceId, targetInstanceId?}` (null = direct attack); xem chi tiết bên dưới                                                                                                                    |
| `Surrender`            | M1 (task 1.9 ✅)                                           | `{playerIndex}`; mọi phase, cả hai bên; reject `DUEL_ENDED`/`SURRENDER_DISABLED`; xem chi tiết bên dưới                                                                                                                 |
| `SetSpellTrap`         | M2 (task 3.2 ✅)                                           | `{playerIndex, cardInstanceId, zoneIndex}`; Spell/Trap từ tay vào ô 0–4, úp (`DefenseDown`), ghi `setTurn`; không giới hạn/lượt, không tốn Normal Summon; Main1/Main2; Field Spell chưa hỗ trợ                          |
| `ActivateEffect`       | M2 (task 3.2 ✅, resolve ngay; chain ở 3.3)                | `{playerIndex, cardInstanceId, effectId, costInstanceIds?}`; **Normal Spell ở tay** + trigger `Ignition`; target chọn qua prompt `SelectEffectTarget` (không có `targetInstanceIds` trong payload); xem `effect-dsl.md` |
| `ResolvePendingPrompt` | M1 (task 1.11 ✅, hand limit) / M2 (target/chain response) | `{playerIndex, promptId, cardInstanceIds}`; trả lời `PendingPrompt` hiện tại; xem mục PendingPrompt                                                                                                                     |
| `PassPriority`         | M2                                                         | Dùng trong chain window                                                                                                                                                                                                 |

### Kích hoạt Trap/Spell — hợp đồng C11 (implement ở P3, task 3.4)

`[DECISION]` Trap phải được Set úp trên sân mới kích hoạt; `[RULE]` Trap vừa Set thì lượt đó chưa kích hoạt; `[RULE]` Spell thường kích hoạt từ tay ở Main Phase của mình. Quick-Play Spell (Speed 2): để P3, chưa chốt ở đây.

- `ActivateEffect` cho **Trap** chỉ hợp lệ khi lá đang ở Spell/Trap Zone, úp, và (nếu `ruleset.trapSetTurnDelay`) đã qua lượt Set. Engine ghi lượt Set của lá để so sánh.
- `ruleset.allowTrapActivationFromHand` (mặc định `false`): khi `false`, Trap trên tay chỉ có `SetSpellTrap`, không có `ActivateEffect`.
- Reject bằng mã lỗi tách biệt: `TRAP_NOT_SET` (Trap chưa úp trên sân, vd còn trên tay), `TRAP_SET_THIS_TURN` (Set trong chính lượt này).
- Task 3.2 đã làm phần "ở tay": Trap trên tay → `TRAP_NOT_SET`, `legalActions` không liệt kê `ActivateEffect` cho Trap ở tay (chỉ `SetSpellTrap`), `CardInstance.setTurn` được ghi lúc Set. Còn lại (kích hoạt Trap đã Set, `TRAP_SET_THIS_TURN`) là task 3.4 (`it.todo` ở `packages/game-engine/src/rules/trap-activation.test.ts`).

### Mã lỗi thêm ở task 3.2

`NOT_A_SPELL_TRAP`, `EFFECT_NOT_FOUND`, `NOT_ACTIVATABLE` (subType/trigger chưa hỗ trợ, Field Spell, effect `Destroy` không khai target Card, target ở zone chưa hỗ trợ), `TRAP_NOT_SET`, `CONDITION_NOT_MET`, `INVALID_COST` (sai số/loại id, trùng, chính lá kích hoạt, không đủ LP), `NO_VALID_TARGET`, `INVALID_EFFECT_TARGET` (đáp án prompt sai số lượng/trùng/ngoài ứng viên). Tái dùng `WRONG_PHASE`, `NOT_TURN_PLAYER`, `INVALID_ZONE`, `ZONE_OCCUPIED`, `CARD_NOT_IN_HAND`...

## Event list

Đã có: `DuelStarted`, `CardDrawn`, `DeckOut`, `CardDiscarded {playerIndex,instanceId,definitionId}` (task 1.11; lá rời tay vào mộ do hand limit, phát trước `PhaseChanged Main2→End`), `PhaseChanged {from,to,turnPlayerIndex}`, `TurnChanged {turnCount,turnPlayerIndex}`, `NormalSummoned {playerIndex,instanceId,definitionId,zoneIndex}`, `MonsterSet {playerIndex,instanceId,zoneIndex}` (không có `definitionId`: lá úp, tránh lộ khi lọc event cho đối thủ). `MonsterTributed {ownerIndex,instanceId,definitionId,zoneIndex}` (task 1.4; có `definitionId` vì mộ là public, kể cả quái úp): phát theo thứ tự mảng tribute, **trước** `NormalSummoned`/`MonsterSet`. `PositionChanged {playerIndex,instanceId,definitionId,zoneIndex,from,to}` (task 1.5; `from`/`to` ∈ `Attack|DefenseUp`; có `definitionId` vì chỉ quái ngửa mới đổi được). `AttackDeclared {playerIndex,attackerInstanceId,targetInstanceId}` (task 1.6; `targetInstanceId: null` = tấn công trực tiếp), `MonsterDestroyed {ownerIndex,instanceId,definitionId,zoneIndex}` (task 1.6; mirror `MonsterTributed`, phát cho mọi quái bị phá bởi combat), `DamageDealt {playerIndex,amount}` (task 1.6; `playerIndex` = bên nhận damage). `DuelEnded {winnerIndex,reason}` (task 1.7; `winnerIndex: 0|1|null` — `null` = hòa trong ngữ cảnh event này, không nhập nhằng với "đang đấu" vì event chỉ phát khi duel thật sự kết thúc; `reason` là string literal union: `'LP_ZERO'` (1.7), `'SURRENDER'` (1.9), `'DECK_OUT'` (1.10); hai reason sau luôn có người thắng). Thứ tự phát trong 1 `DeclareAttack`: `AttackDeclared` → `MonsterDestroyed` (đối thủ trước, mình sau nếu cả hai bị phá) → `DamageDealt` → `DuelEnded` (nếu có).

Task 3.2 thêm: `SpellTrapSet {playerIndex,instanceId,zoneIndex}` (không `definitionId`, lá úp), `EffectActivated`/`EffectResolved {playerIndex,instanceId,definitionId,effectId}`, `CardSentToGraveyard {ownerIndex,instanceId,definitionId,from:'Hand'}` (Spell dùng xong), `LifePointsRecovered {playerIndex,amount}` (Heal), `LifePointsPaid {playerIndex,amount}` (cost PayLP), `SpellTrapDestroyed {ownerIndex,instanceId,definitionId,zoneIndex}` (Destroy lên Spell/Trap; quái vẫn dùng `MonsterDestroyed`). Thứ tự khi kích hoạt: `EffectActivated` → event của cost (`LifePointsPaid`/`CardDiscarded`/`MonsterTributed`) → event của từng operation (`CardDrawn`, `DamageDealt`, `LifePointsRecovered`, `MonsterDestroyed`…) → `EffectResolved` → `CardSentToGraveyard` → `DuelEnded` (nếu có, luôn cuối). Damage/Heal/Draw dùng lại `DamageDealt`/`CardDrawn`/`DeckOut`+`DuelEnded` sẵn có. **Các event này chưa được API forward** (xem `event-visibility.md`).

Sẽ thêm dần: `ChainLinkAdded`, `ChainResolved`.

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

**Prompt đầu tiên thật sự được dùng (task 1.11): `DiscardToHandLimit`.** `EndPhase` từ `Main2` khi `hand.length > ruleset.handLimit` **không** tiến phase: nó đặt `pendingPrompt = { promptId: 'discard-<turnCount>', playerIndex: turn player, kind: 'DiscardToHandLimit', payload: { count: hand - handLimit } }` (`promptId` tất định, không RNG). `ResolvePendingPrompt { playerIndex, promptId, cardInstanceIds }` trả lời: đúng `count` lá khác nhau từ tay của người được hỏi → vào mộ (`position: null`), phát `CardDiscarded {playerIndex, instanceId, definitionId}` từng lá theo thứ tự chọn, xoá prompt rồi tiến `Main2 → End` (`PhaseChanged`). Guard theo thứ tự: `DUEL_ENDED` → `NO_PENDING_PROMPT` → `PROMPT_MISMATCH` (sai `promptId` hoặc sai người) → `UNKNOWN_PROMPT_KIND` / `INVALID_DISCARD` (sai số lượng, trùng id, lá không ở tay). `ResolvePendingPrompt` là vỏ chung, dispatch theo `prompt.kind`; prompt mới (target, chain) thêm 1 case.

**Prompt thứ hai (task 3.2): `SelectEffectTarget`.** `ActivateEffect` mà effect có target `Card` với **nhiều hơn `count` ứng viên** không đổi gì ngoài `pendingPrompt = { promptId: 'effect-<turnCount>-<version>', playerIndex: người kích hoạt, kind: 'SelectEffectTarget', payload: { cardInstanceId, effectId, costInstanceIds, candidateInstanceIds, count } }` (`version` +1). `ResolvePendingPrompt.cardInstanceIds` = đúng `count` id khác nhau nằm trong ứng viên (sai → `INVALID_EFFECT_TARGET`); engine **kiểm lại toàn bộ** activation trên state chưa đổi rồi mới trả cost + resolve (một bước, `version` +1). Đúng `count` ứng viên → tự chọn, không prompt; ít hơn → `NO_VALID_TARGET`. `ResolvePendingPrompt` giờ cần `ctx` cho kind này.

Khi `pendingPrompt != null`, `EndPhase`, `Draw`, `NormalSummon`/`SetMonster`, `SetSpellTrap`, `ActivateEffect`, `ChangePosition`, `DeclareAttack` đều bị **engine** reject `PENDING_PROMPT`. `Surrender` cố ý bỏ qua prompt (task 1.9). Chỉ `ResolvePendingPrompt` đi tiếp được.

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
