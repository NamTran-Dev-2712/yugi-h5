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
  chainStack: ChainLink[];              // task 3.3: đáy (link 1) → đỉnh
  chainWindow: { priorityPlayer: 0 | 1; passCount: 0 | 1 } | null; // task 3.3: null ⇔ chainStack rỗng
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

`ChangePosition` (task 1.5): đổi quái **ngửa** của chính người gọi giữa `Attack` ↔ `DefenseUp`; `toPosition` tường minh (không toggle) để client dùng view cũ không đổi nhầm. Chỉ Main1/Main2, turn player, không winner/prompt. Không tiêu tốn quyền Normal Summon. Mỗi quái tối đa 1 lần/lượt; không đổi quái vừa Summon/Tribute/Set trong lượt; không đổi quái đã tấn công trong lượt `[RULE]`. Trạng thái theo quái lưu bằng **dấu lượt** trên `CardInstance` (`summonedTurn`/`positionChangedTurn`/`attackedTurn` = `turnCount`), tự hết hiệu lực khi sang lượt khác, không cần reset (`resetTurnFlags` không đụng tới); `summon.ts` dựng `CardInstance` mới khi đặt quái nên không thừa dấu cũ. Mã lỗi: `INVALID_POSITION` (đích `DefenseDown`), `NOT_A_MONSTER` (lá phép/bẫy trên sân), `CARD_NOT_ON_FIELD` (tay/mộ/quái đối thủ/id lạ), `MONSTER_FACE_DOWN`, `SAME_POSITION`, `POSITION_ALREADY_CHANGED`, `SUMMONED_THIS_TURN`, `ATTACKED_THIS_TURN`. Quái úp: lật bằng `FlipSummon` (task 4.2b), không phải ChangePosition.

`DeclareAttack` (task 1.6, mở rộng flip-on-attack ở task 1.8): payload `{ playerIndex, attackerInstanceId, targetInstanceId?: string | null }` (`targetInstanceId` bỏ trống/`null` = tấn công trực tiếp). Chỉ Battle Phase, turn player, quái **ngửa và đang ở Attack Position** của chính mình, chưa tấn công trong lượt (`attackedTurn`), không vừa Summon/Set trong lượt (`summonedTurn`); lượt 1 bị cấm trừ khi `ruleset.firstTurnAttack`. Tấn công trực tiếp chỉ hợp lệ khi sân đối thủ **không có quái nào** (kể cả úp) `[RULE, RULES-REVIEW-SHEET dòng 29]`; nếu có quái mà không chỉ định target → `MUST_TARGET_MONSTER`. Target là bất kỳ quái nào trên sân đối thủ, **kể cả úp** (task 1.8): nếu target đang face-down (`DefenseDown`), engine lật nó lên (`position: 'DefenseUp'`, giữ Defense — không tự chuyển Attack) trước khi tính damage, phát `MonsterFlipped { ownerIndex, instanceId, definitionId, zoneIndex }` **ngay sau** `AttackDeclared` và **trước** `MonsterDestroyed`/`DamageDealt` (để UI animate lật trước khi thấy kết quả combat). `summonedTurn`/`positionChangedTurn` của quái đối thủ không ảnh hưởng việc nó bị target/lật — hai dấu đó chỉ chặn hành động chủ động của chính quái đó. Chưa làm Flip Effect thật (chờ effect system); event chỉ mang đủ thông tin để hook sau. Damage/destroy sau khi lật dùng nguyên logic ATK-vs-DEF theo `RULES-REVIEW-SHEET.md` dòng 30-34 (không theo bảng brief gốc ở 2 dòng ATK-vs-DEF, xem ADR 2026-09-22): ATK-vs-ATK bên mạnh hơn thắng và đối phương mất hiệu số, bằng nhau cả hai bị phá không ai mất LP; ATK-vs-DEF: ATK>DEF chỉ phá quái thủ không ai mất LP, ATK<DEF không quái nào bị phá và bên tấn công mất hiệu số, ATK==DEF `[ASSUMED]` không gì xảy ra. LP damage clamp về 0 (`Math.max(0, ...)`). Quái tấn công còn sống thì ghi `attackedTurn = turnCount`. Mã lỗi mới (1.6): `FIRST_TURN_ATTACK_BANNED`, `ATTACKER_IN_DEFENSE_POSITION`, `JUST_SUMMONED_CANNOT_ATTACK`, `MUST_TARGET_MONSTER`, `INVALID_TARGET` (tái dùng `ATTACKED_THIS_TURN`, `CARD_NOT_ON_FIELD`, `NOT_A_MONSTER`, `MONSTER_FACE_DOWN` có sẵn); `TARGET_FACE_DOWN` đã bị xoá ở task 1.8 (target úp giờ hợp lệ, không còn reject).

`Surrender` (task 1.9): payload `{ playerIndex }`; bên nào cũng gửi được, ở mọi phase/lượt, kể cả khi có `pendingPrompt`. Reject `DUEL_ENDED` rồi `SURRENDER_DISABLED` (`ruleset.allowSurrender === false`). Kết quả: `winnerIndex` = đối thủ, `version + 1`, event `DuelEnded { winnerIndex, reason: 'SURRENDER' }`; không đổi gì khác. Không cần `ActionContext`.

**Deck-out (task 1.10)**: chỉ xảy ra khi _phải rút_ mà deck thiếu lá — `Draw` action (`deck.length < count`) hoặc lượt rút khi rời Draw phase (lượt 1 bỏ qua nếu `!firstTurnDraw`). Deck rỗng ở thời điểm khác không thua. Người phải rút thua: `winnerIndex` = đối thủ, không rút lá nào, phát `DeckOut {playerIndex}` rồi `DuelEnded {winnerIndex, reason:'DECK_OUT'}` (`DeckOut` giữ lại để UI animate lần rút hụt trước kết quả, giống `DamageDealt` → `DuelEnded`). `Draw` giờ có guard `DUEL_ENDED`.

**Win condition LP ≤ 0 (task 1.7)**: sau khi build xong `players` cuối cùng trong `DeclareAttack`, `state/win-condition.ts`'s `checkLifePointsWinCondition(players)` kiểm tra LP hai bên (đã clamp `>= 0` bởi `damage()`, nên `<= 0` ⇔ `=== 0`, không cần chỉnh clamp). Một bên về 0 → bên kia thắng (`winnerIndex: 0|1`); **cả hai cùng về 0 trong cùng 1 lần damage** `[ASSUMED]` → hòa (`winnerIndex: 'draw'`). Phát event `DuelEnded { winnerIndex: 0|1|null, reason: 'LP_ZERO' }` (`winnerIndex: null` trong event = hòa; khác `state.winnerIndex` vốn không dùng `null` để chỉ hòa, xem lý do bên dưới). Helper tách riêng (không nhét thẳng vào `declare-attack.ts`) để loss condition sau này (deck-out phát `DuelEnded`, effect damage...) tái dùng được, cùng tinh thần với `resetTurnFlags` (`state/turn-flags.ts`). `draw.ts`'s `DeckOut` **chưa đổi** — vẫn set `winnerIndex` trực tiếp, chưa phát `DuelEnded` (ngoài phạm vi task 1.7).

**`EngineError`** (`src/errors.ts`, export từ package): mọi reject là `EngineError` với `code` ổn định (`message` chỉ cho người đọc — test và API dựa vào `code`). Mã hiện có: `NO_STATE`, `UNHANDLED_ACTION`, `INVALID_STARTING_LP`, `DUEL_ENDED`, `PENDING_PROMPT`, `NOT_TURN_PLAYER`, `WRONG_PHASE`, `NORMAL_SUMMON_USED`, `INVALID_ZONE`, `CARD_NOT_IN_HAND`, `NO_CARD_RESOLVER`, `CARD_DEFINITION_NOT_FOUND`, `NOT_A_MONSTER`, `TRIBUTE_COUNT_MISMATCH`, `INVALID_TRIBUTE`, `ZONE_OCCUPIED`, (task 1.5) `INVALID_POSITION`, `CARD_NOT_ON_FIELD`, `MONSTER_FACE_DOWN`, `SAME_POSITION`, `POSITION_ALREADY_CHANGED`, `SUMMONED_THIS_TURN`, `ATTACKED_THIS_TURN`, và (task 1.6) `FIRST_TURN_ATTACK_BANNED`, `ATTACKER_IN_DEFENSE_POSITION`, `JUST_SUMMONED_CANNOT_ATTACK`, `MUST_TARGET_MONSTER`, `INVALID_TARGET`. `TARGET_FACE_DOWN` (task 1.6) đã bị xoá ở task 1.8 — không còn dùng. Test dùng `expectEngineError(fn, code)` (`src/testing/`), không so khớp regex message.

Sẽ thêm dần qua M1/M2 (giữ nguyên tắc: 1 Action = 1 quyết định rời rạc của người chơi/AI):

| Action                 | Milestone                                                  | Ghi chú                                                                                                                                                                                                                                     |
| ---------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ChangePosition`       | M1 (task 1.5 ✅)                                           | `{playerIndex, cardInstanceId, toPosition: 'Attack'\|'DefenseUp'}`; xem chi tiết bên dưới                                                                                                                                                   |
| `DeclareAttack`        | M1 (task 1.6 ✅)                                           | `{playerIndex, attackerInstanceId, targetInstanceId?}` (null = direct attack); xem chi tiết bên dưới                                                                                                                                        |
| `Surrender`            | M1 (task 1.9 ✅)                                           | `{playerIndex}`; mọi phase, cả hai bên; reject `DUEL_ENDED`/`SURRENDER_DISABLED`; xem chi tiết bên dưới                                                                                                                                     |
| `SetSpellTrap`         | M2 (task 3.2 ✅)                                           | `{playerIndex, cardInstanceId, zoneIndex}`; Spell/Trap từ tay vào ô 0–4, úp (`DefenseDown`), ghi `setTurn`; không giới hạn/lượt, không tốn Normal Summon; Main1/Main2; lá Field vào Field Zone (`zoneIndex` 0, task 4.3)                    |
| `ActivateEffect`       | M2 (task 3.2 ✅; lên chain từ 3.3; lá Set từ 3.4)          | `{playerIndex, cardInstanceId, effectId, costInstanceIds?}`; Normal Spell/Quick-Play ở tay, Trap/Quick-Play đã Set (mục C11); target chọn qua prompt `SelectEffectTarget` (không có `targetInstanceIds` trong payload); xem `effect-dsl.md` |
| `ResolvePendingPrompt` | M1 (task 1.11 ✅, hand limit) / M2 (target/chain response) | `{playerIndex, promptId, cardInstanceIds}`; trả lời `PendingPrompt` hiện tại; xem mục PendingPrompt                                                                                                                                         |
| `FlipSummon`           | P4 (task 4.2b ✅, lên wire 4.2d)                           | `{playerIndex, cardInstanceId}`; lật quái úp của mình lên Tư thế Công ở Main Phase; xem mục "Flip Summon + OnFlip"                                                                                                                          |
| `PassPriority`         | M2 (task 3.3 ✅, engine-only)                              | `{playerIndex}`; chỉ `chainWindow.priorityPlayer`; pass thứ 2 liên tiếp resolve cả chain; xem mục Chain stack                                                                                                                               |

### Kích hoạt Trap/Spell — hợp đồng C11 (✅ xong: phần tay ở task 3.2, Trap/Quick-Play đã Set ở task 3.4)

`[DECISION]` Trap phải được Set úp trên sân mới kích hoạt; `[RULE]` Trap vừa Set thì lượt đó chưa kích hoạt; `[RULE]` Spell thường kích hoạt từ tay ở Main Phase của mình; `[RULE]` Quick-Play từ tay chỉ ở lượt mình (mọi phase), đã Set thì dùng được ở lượt đối thủ nhưng không trong lượt vừa Set (chủ dự án chốt 2026-09-27).

- Bẫy Phản công (`subType: 'Counter'`) còn thêm luật "chỉ để đáp trả" (task 4.4): xem mục "Counter Trap + Negate".
- `ActivateEffect` tìm lá ở **tay** hoặc **ô Phép/Bẫy của chính người gọi** (không thấy → `CARD_NOT_IN_HAND`). Lá trên sân phải **úp** (`DefenseDown`); lá đang ngửa (đang trên chain) → `NOT_ACTIVATABLE`.
- **Trap** Normal/Counter đã Set, trigger `Quick`: hợp lệ khi (nếu `ruleset.trapSetTurnDelay`) `setTurn !== turnCount`, không thì `TRAP_SET_THIS_TURN`. **Quick-Play** đã Set: `setTurn === turnCount` → `SPELL_SET_THIS_TURN` (luôn, không phụ thuộc ruleset). Kích hoạt **lá** Continuous Trap/Spell, Field Spell, Normal Spell đã Set: từ task 4.3, xem mục "Field Spell + lá ở lại sân" (Equip đã Set: từ task 4.4c, xem mục "Equip Spell"). Effect `Continuous` → `CONTINUOUS_NOT_ACTIVATABLE` (task 3.6).
- **Ai/khi nào**: ngoài cửa sổ chain chỉ người chơi của lượt (`NOT_TURN_PLAYER`), lá Set kích hoạt được ở **mọi phase**; trong cửa sổ chỉ người giữ ưu tiên (`NOT_PRIORITY_HOLDER`). Lá **trên tay** luôn cần lượt mình (`NOT_TURN_PLAYER`, kể cả khi đang giữ ưu tiên ở lượt đối thủ). Normal Spell từ tay: Main1/Main2 (`WRONG_PHASE`).
- **Vị trí khi chờ resolve** `[RULE]`: lá Set được kích hoạt **lật ngửa tại ô** (`position: 'Attack'` = quy ước "ngửa" của Phép/Bẫy mà StateView đã hiểu), `ChainLink.source = {zone:'SpellTrapZone', zoneIndex}`; resolve xong (kể cả bị vô hiệu / duel kết thúc giữa chain) thì rời ô vào mộ, `CardSentToGraveyard {from:'SpellTrapZone'}`. Bị phá giữa chain → effect **vẫn resolve**, không phát `CardSentToGraveyard` lần hai.
- `ruleset.allowTrapActivationFromHand` (mặc định `false`): khi `false`, Trap trên tay chỉ có `SetSpellTrap`, không có `ActivateEffect` (`TRAP_NOT_SET`); `true` hiện vẫn `NOT_ACTIVATABLE` (chưa hỗ trợ).
- Test: `packages/game-engine/src/rules/trap-activation.test.ts`, `actions/handlers/quick-play-and-speed.test.ts`; golden `set-trap-quickplay-counter-chain`.
- **Cửa sổ phản ứng** (task 3.4c): sau `DeclareAttack` và sau `NormalSummon`/`SetMonster`, đối thủ được một cửa sổ để kích hoạt lá Set — xem mục "Cửa sổ phản ứng" dưới "Chain stack".

### Mã lỗi thêm ở task 4.5

`INVALID_EXTRA_DECK` (`StartDuel`: một Extra Deck dài hơn `ruleset.extraDeckSize`) và `FUSION_NOT_SUMMONABLE` (Normal Summon /
Set một quái `category: Fusion`). Lá dung hợp không kích hoạt được dùng mã có sẵn: `NOT_ACTIVATABLE` (không quái Fusion nào đủ
nguyên liệu) / `NO_FREE_MONSTER_ZONE`; câu trả lời prompt Fusion sai: `INVALID_EFFECT_TARGET`. Xem mục "Fusion".

### Mã lỗi thêm ở task 4.4

`NOTHING_TO_RESPOND_TO` (Bẫy Phản công được kích hoạt khi không có cửa sổ nào đang mở: nó không tự mở chuỗi) và
`NOTHING_TO_NEGATE` (effect có operation Negate mà hiện không có gì để vô hiệu). Xem mục "Counter Trap + Negate".

### Mã lỗi thêm ở task 4.3

`FIELD_ZONE_OCCUPIED` (Set/kích hoạt lá Field khi ô Field của mình đã có lá và `ruleset.fieldSpellReplace === false`).
`NO_FREE_SPELL_TRAP_ZONE` giờ áp dụng cả cho Continuous Spell từ tay. Normal Spell đã Set và lá Continuous Spell/Trap hết
`NOT_ACTIVATABLE` (xem mục "Field Spell + lá ở lại sân").

### Mã lỗi thêm ở task 4.2c

`NO_FREE_SPELL_TRAP_ZONE` (Equip Spell từ tay khi 5 ô Phép/Bẫy đều có lá).

### Mã lỗi thêm ở task 4.2b

`MONSTER_FACE_UP` (FlipSummon lên quái đang ngửa).

### Mã lỗi thêm ở task 4.2a

`NO_FREE_MONSTER_ZONE` (effect có `SpecialSummon` mà số ô quái trống < `target.count`).

### Mã lỗi thêm ở task 3.6

`CONTINUOUS_NOT_ACTIVATABLE` (effect có `trigger.kind === 'Continuous'`: kiểm trước mọi luật kích hoạt khác, kể cả với quái trên sân —
lá khác không ở tay/ô Phép/Bẫy vẫn là `CARD_NOT_IN_HAND`), `UNKNOWN_SCRIPT` (`effect.scriptId` không có trong `EFFECT_SCRIPTS`; trigger
như vậy không kích hoạt).

### Mã lỗi thêm ở task 3.4

`TRAP_SET_THIS_TURN` (Trap Set trong chính lượt này, theo `trapSetTurnDelay`), `SPELL_SET_THIS_TURN` (Quick-Play Set trong chính lượt này). `CARD_NOT_IN_HAND` giờ nghĩa là "không ở tay, cũng không Set trong ô Phép/Bẫy của bạn"; Normal Spell đã Set đổi từ `CARD_NOT_IN_HAND` sang `NOT_ACTIVATABLE`.

### Mã lỗi thêm ở task 3.2

`NOT_A_SPELL_TRAP`, `EFFECT_NOT_FOUND`, `NOT_ACTIVATABLE` (subType/trigger chưa hỗ trợ, Field Spell, effect `Destroy` không khai target Card, target ở zone chưa hỗ trợ), `TRAP_NOT_SET`, `CONDITION_NOT_MET`, `INVALID_COST` (sai số/loại id, trùng, chính lá kích hoạt, không đủ LP), `NO_VALID_TARGET`, `INVALID_EFFECT_TARGET` (đáp án prompt sai số lượng/trùng/ngoài ứng viên). Tái dùng `WRONG_PHASE`, `NOT_TURN_PLAYER`, `INVALID_ZONE`, `ZONE_OCCUPIED`, `CARD_NOT_IN_HAND`...

## Event list

Đã có: `DuelStarted`, `CardDrawn`, `DeckOut`, `CardDiscarded {playerIndex,instanceId,definitionId}` (task 1.11; lá rời tay vào mộ do hand limit, phát trước `PhaseChanged Main2→End`), `PhaseChanged {from,to,turnPlayerIndex}`, `TurnChanged {turnCount,turnPlayerIndex}`, `NormalSummoned {playerIndex,instanceId,definitionId,zoneIndex}`, `MonsterSet {playerIndex,instanceId,zoneIndex}` (không có `definitionId`: lá úp, tránh lộ khi lọc event cho đối thủ). `MonsterTributed {ownerIndex,instanceId,definitionId,zoneIndex}` (task 1.4; có `definitionId` vì mộ là public, kể cả quái úp): phát theo thứ tự mảng tribute, **trước** `NormalSummoned`/`MonsterSet`. `PositionChanged {playerIndex,instanceId,definitionId,zoneIndex,from,to}` (task 1.5; `from`/`to` ∈ `Attack|DefenseUp`; có `definitionId` vì chỉ quái ngửa mới đổi được). `AttackDeclared {playerIndex,attackerInstanceId,targetInstanceId}` (task 1.6; `targetInstanceId: null` = tấn công trực tiếp), `MonsterDestroyed {ownerIndex,instanceId,definitionId,zoneIndex}` (task 1.6; mirror `MonsterTributed`, phát cho mọi quái bị phá bởi combat), `DamageDealt {playerIndex,amount}` (task 1.6; `playerIndex` = bên nhận damage). `DuelEnded {winnerIndex,reason}` (task 1.7; `winnerIndex: 0|1|null` — `null` = hòa trong ngữ cảnh event này, không nhập nhằng với "đang đấu" vì event chỉ phát khi duel thật sự kết thúc; `reason` là string literal union: `'LP_ZERO'` (1.7), `'SURRENDER'` (1.9), `'DECK_OUT'` (1.10); hai reason sau luôn có người thắng). Thứ tự phát trong 1 `DeclareAttack`: `AttackDeclared` → `MonsterDestroyed` (đối thủ trước, mình sau nếu cả hai bị phá) → `DamageDealt` → `DuelEnded` (nếu có).

Task 3.2 thêm: `SpellTrapSet {playerIndex,instanceId,zoneIndex}` (không `definitionId`, lá úp), `EffectActivated`/`EffectResolved {playerIndex,instanceId,definitionId,effectId}`, `CardSentToGraveyard {ownerIndex,instanceId,definitionId,from:'Hand'|'SpellTrapZone'}` (lá dùng xong; `SpellTrapZone` từ task 3.4), `LifePointsRecovered {playerIndex,amount}` (Heal), `LifePointsPaid {playerIndex,amount}` (cost PayLP), `SpellTrapDestroyed {ownerIndex,instanceId,definitionId,zoneIndex}` (Destroy lên Spell/Trap; quái vẫn dùng `MonsterDestroyed`). Thứ tự khi kích hoạt: `EffectActivated` → event của cost (`LifePointsPaid`/`CardDiscarded`/`MonsterTributed`) → event của từng operation (`CardDrawn`, `DamageDealt`, `LifePointsRecovered`, `MonsterDestroyed`…) → `EffectResolved` → `CardSentToGraveyard` → `DuelEnded` (nếu có, luôn cuối). Damage/Heal/Draw dùng lại `DamageDealt`/`CardDrawn`/`DeckOut`+`DuelEnded` sẵn có. **Các event này chưa được API forward** (xem `event-visibility.md`).

Task 3.3 thêm: `ChainLinkAdded {linkId,chainIndex,playerIndex,instanceId,definitionId,effectId,spellSpeed,targetInstanceIds}` (phát ngay sau event cost), `ChainLinkFizzled {linkId,playerIndex,instanceId,definitionId,effectId,reason:'TARGET_GONE'}` (link không còn target nào lúc resolve; thay cho `EffectResolved` của link đó), `ChainResolved {linkCount}` (cả chain xong, cửa sổ đóng; không phát khi duel kết thúc giữa chain). **Chưa được API forward** (xem `event-visibility.md`).

Task 4.5 thêm (**engine-only**: `toEventView` trả `null` cho cả hai ghế tới task 4.5b): `FusionMaterialSent {ownerIndex,instanceId,definitionId,from:'Hand'|'MonsterZone'|'Deck',zoneIndex?}` (một nguyên liệu được gửi vào mộ — không phải `MonsterDestroyed`, không bắn `OnDestroyed`; `zoneIndex` chỉ khi `from` là `MonsterZone`) và `MonsterFusionSummoned {playerIndex,instanceId,definitionId,zoneIndex,position,materialInstanceIds}` (quái Fusion rời Extra Deck lên sân, luôn ngửa; `collectTriggers` coi là Summon ⇒ `OnSummon`). Thứ tự trong bước trả lời prompt nguyên liệu: `FusionMaterialSent`… → `MonsterFusionSummoned` → `EffectResolved` → `CardSentToGraveyard` (lá Phép) → `ChainResolved` → (chain mới của trigger).

Task 4.4 thêm (lên wire từ 4.4b; mức hiển thị ở `event-visibility.md`: cả ba PUBLIC): `ChainLinkNegated {linkId,playerIndex,instanceId,definitionId,effectId,byInstanceId}` (việc kích hoạt của một mắt xích bị vô hiệu; `playerIndex` = người bị vô hiệu, `byInstanceId` = lá vô hiệu; **thay** cho `EffectResolved` của mắt xích đó và được theo ngay bởi `CardSentToGraveyard` của lá bị vô hiệu nếu đó là Phép/Bẫy), `AttackNegated {playerIndex,attackerInstanceId,targetInstanceId}` (đòn tấn công bị vô hiệu: không có lật / phá / sát thương theo sau), `SummonNegated {playerIndex,instanceId,definitionId,zoneIndex}` (Normal/Flip Summon bị vô hiệu, quái rời ô vào mộ chủ; không có `MonsterDestroyed`).

Task 4.3 thêm: `FieldSpellSet {playerIndex,instanceId}` (Set lá Field vào Field Zone; không `definitionId`), `FieldSpellDestroyed {ownerIndex,instanceId,definitionId}` (lá ở Field Zone bị effect phá), và `CardSentToGraveyard.from` thêm `'FieldZone'` (lá Field bị lá mới của chính chủ thay). **Lên wire ở task 4.3b** (cả ba PUBLIC ở `toEventView`, shape giữ nguyên; engine không đổi dòng nào).

Task 4.2c thêm: `CardEquipped {playerIndex,instanceId,definitionId,targetInstanceId}` (lá Equip gắn vào quái). Equip rời sân theo quái dùng lại `CardSentToGraveyard {from:'SpellTrapZone'}`. API forward từ task 4.2d (PUBLIC); `CardInstance.equippedTo` ra wire thành `VisibleCardView.equippedTo`.

Task 4.2b thêm: `FlipSummoned {playerIndex,instanceId,definitionId,zoneIndex}` (Flip Summon; trigger OnFlip/OnSummon theo sau). API forward từ task 4.2d (PUBLIC).

Task 4.2a thêm: `MonsterSpecialSummoned {playerIndex,instanceId,definitionId,zoneIndex,from:'Hand'|'Graveyard',position}`
(phát trong lúc link resolve, giữa `ChainLinkAdded` và `EffectResolved`). API forward từ task 4.2d (PUBLIC); `targetInstanceIds` trỏ vào tay bị API lọc với ghế không được biết (xem `event-visibility.md`).

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

**Prompt Fusion (task 4.5): `SelectFusionMonster` rồi `SelectFusionMaterials`.** Hai prompt duy nhất mở **giữa lúc chain resolve**: chain tạm dừng ở mắt xích của lá dung hợp (mắt xích đó vẫn nằm một mình trên `chainStack`, `chainWindow` do người kích hoạt giữ). Payload: `{ linkId, candidateInstanceIds, count: 1, owedTriggers, linkCount }` rồi `{ linkId, fusionInstanceId, candidateInstanceIds, count, owedTriggers, linkCount }`; `promptId = 'fusion-<turnCount>-<version>'`. Trả lời = đúng `count` id trong `candidateInstanceIds` (`cardInstanceIds`); bộ nguyên liệu còn phải đúng tập `fusionMaterials` và để lại một ô quái trống — sai ⇒ `INVALID_EFFECT_TARGET`, prompt vẫn mở. `decline` ⇒ `INVALID_TRIGGER_ANSWER`. Chi tiết: mục "Fusion".

Khi `pendingPrompt != null`, `EndPhase`, `Draw`, `NormalSummon`/`SetMonster`, `SetSpellTrap`, `ActivateEffect`, `ChangePosition`, `DeclareAttack`, `PassPriority` đều bị **engine** reject `PENDING_PROMPT` (hoặc `CHAIN_WINDOW_OPEN` nếu cửa sổ chain cũng đang mở — kiểm ở `applyAction` trước handler). `Surrender` cố ý bỏ qua prompt (task 1.9). Chỉ `ResolvePendingPrompt` đi tiếp được. Prompt `SelectEffectTarget` có thể mở **trong lúc** cửa sổ chain đang mở (kích hoạt đáp trả có target): trả lời xong mới thêm link.

## Chain stack (task 3.3)

`[RULE]` YGO chuẩn, chủ dự án chốt 2026-09-26 (ADR "Chain stack"). Engine-only: API chưa forward (task 3.3b sau C13).

```ts
interface ChainLink {
  linkId: string;            // `link-<turnCount>-<version của state lúc kích hoạt>` — tất định, không RNG/đồng hồ
  playerIndex: 0 | 1;
  card: CardInstance;        // lá Phép đã rời tay (position null), nằm TRONG link tới khi vào mộ; công khai.
                             // Lá Set (3.4): chỉ là bản sao, lá thật ngửa trong ô Phép/Bẫy
  source: { zone: 'Hand' } | { zone: 'SpellTrapZone'; zoneIndex: number }   // task 3.4
        | { zone: 'MonsterZone'; zoneIndex: number } | { zone: 'Graveyard' };   // trigger (task 3.5): lá không di chuyển
  effectId: string;
  spellSpeed: 1 | 2 | 3;     // Normal Spell 1, Quick-Play/Trap 2, Counter Trap 3, hoặc effect.spellSpeed (3.4)
  costInstanceIds: string[]; // cost Discard/Tribute đã trả lúc kích hoạt
  lpPaid: number;            // cost PayLP đã trả lúc kích hoạt
  targetInstanceIds: string[]; // target chọn lúc kích hoạt
}
GameState.chainStack: ChainLink[];        // [0] = link 1 (đáy)
GameState.chainWindow: { priorityPlayer: 0 | 1; passCount: 0 | 1; reactionTo?: ReactionTo;
                         summoned?: { playerIndex: 0 | 1; instanceId: string } } | null;
                         // null ⇔ chainStack rỗng, trừ cửa sổ phản ứng (3.4c); summoned: task 4.4
```

**Kích hoạt** (`ActivateEffect`): validate (`prepare`, không đổi state) → nếu cần chọn target nhiều hơn `count` thì
mở `SelectEffectTarget` (chưa đổi gì) → lá rời tay → trả cost → đẩy link (`EffectActivated`, event cost,
`ChainLinkAdded`) → ưu tiên sang **đối thủ của người kích hoạt**, `passCount = 0` → _settle_. Operations **chỉ chạy
lúc resolve**. `version` +1 một lần cho cả action.

**Spell Speed** `[RULE]`: chain rỗng → Speed 1 hoặc 2 đều mở chain được (Normal Spell ở Main Phase của mình). Chain
không rỗng → chỉ `priorityPlayer` được kích hoạt (`NOT_PRIORITY_HOLDER`), và speed ≥ 2 và ≥ speed của link trên cùng
(`SPELL_SPEED_TOO_LOW`). Speed lấy từ `EffectDefinition.spellSpeed` nếu có, không thì suy ra (`effects/spell-speed.ts`,
task 3.4): Counter Trap 3, Trap khác 2, Quick-Play 2, còn lại 1. Quick-Play **từ tay** chỉ ở lượt của mình, **mọi phase**
(task 3.4 bỏ giới hạn Main1/Main2 `[ASSUMED]` của 3.3); Trap / Quick-Play đã Set: xem mục C11. **Bẫy Phản công** (Speed 3)
không bao giờ mở chain, chỉ đáp trả (task 4.4, mục "Counter Trap + Negate"); lá thật Speed 3: SMP-209, SMP-210.

**Settle / auto-pass** `[ASSUMED]` (video #3/#4 gợi ý game chỉ dừng khi có lá thoả điều kiện): trong khi người giữ ưu tiên
**không có** activation hợp lệ nào (dry-run `prepare` trên ứng viên của `effects/activation-candidates.ts`, không chép
luật), engine pass thay họ. Không ai phản ứng được ⇒ chain resolve ngay trong cùng lần gọi (luồng HTTP 3.2b giữ nguyên).
Cửa sổ chỉ còn mở khi người giữ ưu tiên thật sự có thể đáp trả. `ruleset.chainPrompt` không được engine đọc (chuyện UI, C13).

**`PassPriority {playerIndex}`**: guard `DUEL_ENDED` → `NO_CHAIN_WINDOW` → `PENDING_PROMPT` → `NOT_PRIORITY_HOLDER`.
`passCount` 0 → 1 và ưu tiên sang người kia (rồi settle); `passCount` 1 (pass thứ hai liên tiếp) → **resolve cả chain**.
Thêm link mới đặt lại `passCount = 0`. Không phát event cho bản thân việc pass.

**Resolve** (`effects/chain.ts` `resolveChain`) `[RULE]`: từ link trên cùng xuống đáy (LIFO), không ai chen link mới
giữa chừng. Mỗi link: target = target đã chọn ∩ `targetCandidates` trên state hiện tại (tái dùng `effects/targets.ts`);
effect có target `Card` mà không còn target nào ⇒ `ChainLinkFizzled` (không throw); còn ít nhất 1 ⇒ chạy operations
trên target còn lại `[ASSUMED]` → `EffectResolved`. Sau mỗi link lá vào mộ chủ sở hữu (`CardSentToGraveyard`,
`from: 'Hand'`; lá Set: `from: 'SpellTrapZone'`, rời ô — nếu đã bị phá giữa chain thì không phát lại). Hết chain: `ChainResolved {linkCount}`, `chainStack = []`, `chainWindow = null`, người chơi của lượt
hành động tiếp. Duel kết thúc giữa chain ⇒ link còn lại **không** resolve, lá của chúng vẫn vào mộ, không có
`ChainResolved`, `DuelEnded` luôn là event cuối.

**Thứ tự event 1 link, không ai đáp trả**: `EffectActivated` → cost → `ChainLinkAdded` → event operation →
`EffectResolved` → `CardSentToGraveyard` → `ChainResolved` → `DuelEnded?`. Sau khi API bỏ 3 event chain, giống hệt 3.2b.

### Cửa sổ phản ứng (task 3.4c)

`[REF]` video #3/#4 (R1–R5): Bẫy kích hoạt ngay sau tuyên bố tấn công (trước damage) và sau triệu hồi. Tái dùng nguyên
`chainWindow` / `PassPriority` / `settle` / `hasLegalActivation` — không có cơ chế ưu tiên thứ hai.

```ts
ChainWindow.reactionTo?:
  | { kind: 'Summon' }
  | { kind: 'Attack'; playerIndex; attackerInstanceId; targetInstanceId: string | null };
```

- **Mở**: `DeclareAttack` (kể cả tấn công trực tiếp) sau `AttackDeclared`, trước lật/phá/damage; `NormalSummon`/`SetMonster`
  (kể cả Tribute) sau khi đặt quái — SetMonster là `[DECISION]` (brief; rules-observed chỉ ghi R2 = Normal Summon). Cửa sổ
  `{priorityPlayer: đối thủ, passCount: 0, reactionTo}` **chỉ khi đối thủ có activation hợp lệ** (dry-run trên state đã có cửa
  sổ) `[ASSUMED]`; không có ⇒ không có cửa sổ, action chạy tiếp y như trước (event/state không đổi). Không bao giờ mở cho
  chính người tấn công/triệu hồi. Không có event riêng cho việc mở/đóng (UI cần thì thêm ở task nối wire).
- **Đóng**: chain rỗng + đối thủ `PassPriority` **một lần** ⇒ đóng `[ASSUMED]`; đối thủ kích hoạt ⇒ chain bình thường (3.3),
  `reactionTo` đi theo cửa sổ qua mọi link/pass, cả chain resolve xong ⇒ đóng.
- **Sau khi đóng**: `Attack` ⇒ `resolveAttack` (`battle/resolve-attack.ts`, đúng logic 1.6–1.8: lật → phá → damage → LP);
  `Summon` ⇒ từ task 4.4c: gom trigger `OnSummon` / `OnFlip` của lần triệu hồi đó nếu nó không bị vô hiệu (mục "Cửa sổ
  Summon đứng trước trigger" ở phần Trigger effect); `SetMonster` ⇒ không gì. Duel đã kết thúc trong chain ⇒ không tiếp. Quái tấn công rời sân hoặc không còn ở Attack ⇒ đòn dừng;
  mục tiêu rời sân (hoặc tấn công trực tiếp mà đối thủ đã có quái) ⇒ đòn dừng, quái tấn công vẫn tính đã tấn công — **không
  replay** `[ASSUMED]` (G14).
- Bất biến: `chainWindow != null` mà `chainStack` rỗng ⇔ cửa sổ phản ứng (`reactionTo` có, `passCount 0`, người giữ ưu tiên
  không phải người chơi của lượt). Khi mở: người chơi của lượt chỉ có `Surrender`; `PassPriority` của họ → `NOT_PRIORITY_HOLDER`.
- `version` +1 một lần cho `DeclareAttack`/Summon ở cả hai nhánh.

**Bảng guard khi `chainWindow != null`** (kiểm ở `applyAction` trước handler, chỉ khi duel đang chạy):

| Action                                                                                              | Khi cửa sổ mở                                        |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `ActivateEffect`                                                                                    | Chỉ `priorityPlayer`, Speed ≥ 2 và ≥ link trên cùng  |
| `PassPriority`                                                                                      | Chỉ `priorityPlayer` (và không có prompt)            |
| `ResolvePendingPrompt`                                                                              | Như thường (prompt target của lần kích hoạt đáp trả) |
| `Surrender`                                                                                         | Luôn được (ADR 1.9)                                  |
| `EndPhase`, `Draw`, `NormalSummon`, `SetMonster`, `ChangePosition`, `DeclareAttack`, `SetSpellTrap` | `CHAIN_WINDOW_OPEN`                                  |

**Kết thúc**: mỗi link tiêu thụ một lá trên tay hoặc một lá úp trên sân (lá ngửa không kích hoạt lại được) ⇒ độ dài chain
≤ số lá trên tay + ô Phép/Bẫy (+ trigger, mỗi lá mỗi sự kiện một lần); settle lặp tới khi cửa sổ đóng, có prompt, hoặc người giữ ưu tiên đáp trả được. Không cần trần độ sâu. Fuzz kiểm `chainWindow === null ⇔ chainStack
rỗng`, lá trong chain từ tay được đếm (bảo toàn lá; link từ sân chỉ giữ bản sao), lá Phép/Bẫy ngửa trên sân ⇔ có link của
chính nó từ ô đó, và cửa sổ mở ⇒ người giữ ưu tiên có activation hợp lệ.

Mã lỗi mới: `NO_CHAIN_WINDOW`, `NOT_PRIORITY_HOLDER`, `CHAIN_WINDOW_OPEN`, `SPELL_SPEED_TOO_LOW`.

## Trigger effect (task 3.5)

`[RULE]` YGO chuẩn, chủ dự án chốt 2026-09-27 (ADR "Trigger OnSummon/OnDestroyed"). Engine-only (chưa lên wire).
Trigger **không** do `ActivateEffect` kích hoạt: engine tự khởi phát từ event của bước vừa chạy, đọc `EffectDefinition` của lá
(`effects/triggers.ts`), rồi đưa lên **chính chain của 3.3** (`pushLink` → `settle`).

- **Khởi phát**: `NormalSummoned` (kể cả Tribute Summon) → effect `OnSummon` của quái đó; `MonsterDestroyed` /
  `SpellTrapDestroyed` (combat 1.6–1.8, operation `Destroy`, lá Set đang chờ trên chain) → effect `OnDestroyed` của lá đó.
  **`SetMonster` không phải triệu hồi** `[RULE]`: không bắn (và không lộ lá úp). Duel đã kết thúc ⇒ không bắn.
- **Điểm kiểm** (không sửa `resolveAttack` / `operations/destroy.ts`, trigger suy từ event họ phát): cuối `NormalSummon` (từ
  task 4.4c: chỉ khi cửa sổ Summon không mở; có cửa sổ thì lúc cửa sổ đó kết thúc — xem dưới); sau damage
  step của `DeclareAttack` (khi không có cửa sổ phản ứng); cuối `resolveChain` (gồm trận đấu mà chain vừa cho qua) và khi cửa
  sổ phản ứng rỗng đóng lại. Trigger sinh ra **trong lúc** chain resolve chờ tới khi cả chain xong rồi mới thành **chain mới**.
- **Thứ tự** `[RULE]`: trigger của người chơi của lượt lên chain trước (link thấp hơn), rồi của đối thủ; trong cùng một người:
  theo thứ tự event `[ASSUMED]` (G15, luật thật cho người chơi tự chọn).
- **Điều kiện**: lá còn ở chỗ khởi phát (quái ngửa ở ô / lá trong mộ chủ), `condition` đúng, cost trả được (chỉ `PayLP`, schema
  chặn Discard/Tribute), đủ ứng viên target — không thì trigger **không kích hoạt** `[RULE]` (kiểm lại lúc tới lượt của nó).
- **mandatory** (`trigger.mandatory: true`) và target cố định (0 hoặc đúng `count` ứng viên) ⇒ tự kích hoạt: `EffectActivated` →
  cost → `ChainLinkAdded` (`linkId = trigger-<turnCount>-<version>-<chainIndex>`). **optional** (mặc định), hoặc cần chọn target ⇒
  `PendingPrompt TriggerActivation` cho **chủ lá** (có thể là người không phải lượt):

  ```ts
  { promptId: 'trigger-<turnCount>-<version>', playerIndex: chủ lá, kind: 'TriggerActivation',
    payload: { trigger: {playerIndex, instanceId, definitionId, effectId, source}, optional, candidateInstanceIds, count,
               remaining: PendingTrigger[], afterward: {kind:'SummonReaction', responder} | null } }
  ```

  Từ task 4.4c engine chỉ còn ghi `afterward: null` (kiểu giữ nguyên vì shape payload đã ở wire).

  Trả lời bằng `ResolvePendingPrompt`: `{decline: true, cardInstanceIds: []}` (chỉ optional) hoặc đúng `count` id trong ứng viên
  (`[]` khi không có target). Sai ⇒ `INVALID_TRIGGER_ANSWER` (kể cả `decline` trên prompt kind khác). Sau đó chạy tiếp
  `remaining`, rồi settle; `version` +1.

- **Link trigger**: `source` = `MonsterZone` / `Graveyard`, lá **không di chuyển** (không `CardSentToGraveyard` sau link;
  `link.card` chỉ là bản sao). Spell Speed theo `spellSpeedOf` (quái/Phép 1; Bẫy có OnDestroyed = 2 theo mặc định 3.4;
  `spellSpeed` tường minh thắng). Đối thủ đáp trả link trigger như link thường.
- **Cửa sổ Summon đứng trước trigger** (task 4.4c, ADR 067; thay thứ tự cũ của 3.5 "trigger trước, cửa sổ Summon chỉ khi
  không trigger nào lên chain") `[RULE]`:
  1. Sau `NormalSummon` (kể cả Tribute) / `FlipSummon`: đối thủ có activation hợp lệ ⇒ mở **cửa sổ Summon** ngay, chưa gom
     trigger. Cửa sổ giữ event triệu hồi còn nợ trigger ở `ChainWindow.summonEvent` (`{type:'NormalSummoned'|'FlipSummoned',
playerIndex, instanceId, definitionId, zoneIndex}`; optional, đi theo cửa sổ qua mọi link/pass như `summoned`; không lên
     wire). Event của bước chỉ là `[MonsterTributed…,] NormalSummoned` / `FlipSummoned`.
  2. Cửa sổ kết thúc (đối thủ pass trên chain rỗng, hoặc chain dựng trong cửa sổ resolve xong) mà không có `SummonNegated`
     của quái đó ⇒ **lúc đó** gom trigger từ `summonEvent` (đứng **trước** các trigger do chính chain đó sinh ra) và chạy như
     trên (mandatory tự lên chain, optional / chọn target ⇒ prompt). Đối thủ lại được đáp **link trigger** (cửa sổ thường,
     không `reactionTo`) ⇒ hai cửa sổ liên tiếp cho cùng đối thủ là đúng.
  3. Có `SummonNegated` ⇒ không gom trigger nào của lần triệu hồi đó (`owedSummonEvents` ở `effects/chain.ts`).
  4. Đối thủ không có gì để kích hoạt ⇒ không có cửa sổ, trigger lên chain ngay trong bước triệu hồi (event y như trước 4.4c).
  5. Trigger optional bị từ chối sau cửa sổ ⇒ cửa sổ Summon **không mở lại** `[ASSUMED]` G25.
  - `[ASSUMED]` G25 (chủ dự án chọn 2026-10-03): cửa sổ này nhận **mọi** lá đáp trả, không chỉ lá vô hiệu triệu hồi ⇒ quái bị
    phá ngay trong cửa sổ thì trigger của nó không kích hoạt (không còn "ở chỗ khởi phát"). Luật chuẩn: Bẫy thường đáp sau
    khi trigger đã lên chuỗi.
  - Test: `rules/summon-window-order.test.ts`, `effects/chain.summon-event.test.ts`; golden `summon-negated-before-trigger`,
    `summon-window-then-trigger`; fuzz `SUMMON_TRIGGER_DECK_POOL`. Mutation: `tools/mutants-4.4c.mjs`.
- `settle` dừng khi có `pendingPrompt`; câu trả lời prompt tự settle. Khi có prompt: `legalActions` = các câu trả lời (+ `Surrender`).
- Mã lỗi mới: `INVALID_TRIGGER_ANSWER`. `ResolvePendingPrompt.payload.decline?: boolean` (mới, optional).
- Test: `rules/trigger-effects.test.ts`, `effects/triggers.test.ts`; golden `on-summon-mandatory`, `on-summon-optional-declined`,
  `on-destroyed-in-combat`.

## Continuous effect + scriptId (task 3.6)

`[RULE]` chủ dự án chốt nguồn 2026-09-28. Engine-only (chưa lên wire).

- **Không có action, không lên chain, không lưu vào state.** `effects/continuous.ts`:
  - `activeContinuousEffects(state, ctx)` — mọi effect `Continuous` đang hiệu lực: lá **ngửa** (quái `Attack`/`DefenseUp`, Phép/Bẫy
    ngửa ở ô) của cả hai bên, thứ tự cố định (người 0 rồi 1; ô quái 0–4 rồi ô Phép/Bẫy 0–4), `condition` đúng **lúc đọc** (theo góc
    nhìn người điều khiển lá nguồn).
  - `effectiveStats(state, card, ctx) → {atk, def}` = chỉ số in trên lá + tổng delta của `CONTINUOUS_HANDLERS`, kẹp ≥ 0. Đọc lá theo
    `instanceId` trên **state truyền vào** (không tin bản sao của caller); quái úp / không ở sân ⇒ chỉ số in.
  - Lá nguồn rời sân (bị phá, …) hoặc bị úp ⇒ lần đọc sau không còn modifier; không có code "gỡ hiệu ứng".
- **Combat**: `battle/resolve-attack.ts` đọc `effectiveStats` một lần, trên bàn **sau khi lật** mục tiêu úp và trước khi phá lá nào,
  cho mọi so sánh/damage (quái vừa lật vừa nhận vừa phát modifier của chính nó `[RULE]`). Không modifier ⇒ y hệt 1.6–1.8.
  Hiện đây là chỗ duy nhất engine đọc ATK/DEF (`legalActions` dry-run nên tự đúng). **`StateView`/AI ở api vẫn đọc chỉ số in** — cần
  thêm chỉ số hiệu lực vào view khi nối wire.
- **Script** (`effects/effect-scripts/`): `EFFECT_SCRIPTS: Record<scriptId, EffectScriptHandler>`, `scriptFor(id)` (chỉ own-property).
  `resolveLink` (`effects/chain.ts`) chạy script **sau** `operations`, nếu duel chưa kết thúc; cùng `OperationContext`
  (`controller`, `targetInstanceIds`). Kiểm tồn tại lúc kích hoạt (`UNKNOWN_SCRIPT`) và ở `readyTrigger`.
- `activation-candidates.ts` bỏ effect `Continuous` (không bao giờ vào `legalActions`).
- Test: `effects/continuous.test.ts`, `effects/effect-scripts/registry.test.ts`, `operations/registry-sync.test.ts`; golden
  `continuous-atk-buff`; fuzz: bất biến "chỉ số hiệu lực ≥ 0 và = chỉ số in khi không có nguồn", thống kê `continuousApplied`.

## Special Summon (task 4.2a)

Lên wire ở task 4.2d (lá thật SMP-111; engine không đổi). Chủ dự án chốt 2026-09-30: **chỉ là operation**, không có action `SpecialSummon` của người chơi
(summon "tự thân" kiểu "được Special Summon nếu…" cần DSL điều kiện riêng, để dành).

- Operation `SpecialSummon{position?: 'Attack' | 'DefenseUp'}` (`effects/operations/special-summon.ts`) tác động lên target `Card`
  của effect. Schema chỉ cho **quái của chính mình ở tay hoặc mộ** (`zone: Hand|Graveyard`, `side: 'self'`, `filter.kind: 'Monster'`)
  `[DECISION]`. Không cho úp (sẽ lộ `definitionId` qua event); mặc định `Attack` `[ASSUMED]` (luật thật: người chơi chọn).
- `targetCandidates` (`effects/targets.ts`) đọc được **tay của mình** và **mộ** (công khai). Tay đối thủ / Deck ⇒ `NOT_ACTIVATABLE`.
- Lúc resolve: mỗi target còn ở tay/mộ được đặt vào ô quái **trống thấp nhất** của controller `[ASSUMED]`, lá dựng mới (không mang
  dấu cũ), `summonedTurn = turnCount` ⇒ không đổi thế và (theo luật hiện có của repo `JUST_SUMMONED_CANNOT_ATTACK`) không tấn công
  trong lượt đó. **Không** tốn quyền Normal Summon `[RULE]`. Hết ô giữa chừng ⇒ lá còn lại ở yên `[ASSUMED]`; target đã rời chỗ ⇒
  bỏ qua (hết target ⇒ `ChainLinkFizzled` như mọi link).
- Lúc kích hoạt (và `readyTrigger`): số ô quái trống < `target.count` ⇒ `NO_FREE_MONSTER_ZONE` (trigger: không kích hoạt) `[RULE]`.
  5 ô, không Extra Monster Zone (C1).
- Event `MonsterSpecialSummoned {playerIndex, instanceId, definitionId, zoneIndex, from: 'Hand'|'Graveyard', position}`.
  `collectTriggers` coi nó là Summon ⇒ bắn `OnSummon` `[RULE]` (chain mới sau chain đang resolve). **Không** mở cửa sổ phản ứng
  Summon 3.4c cho Special Summon giữa chain `[ASSUMED]`.
- Test: `effects/operations/special-summon.test.ts`; golden `special-summon-hand-and-graveyard`; fuzz `SSH`/`SSG`, thống kê
  `specialSummons`, bất biến "chỉ lá Monster đứng trong ô quái" và "Special Summon không tốn Normal Summon".

## Flip Summon + OnFlip (task 4.2b)

Lên wire ở task 4.2d (`PlayerActionSchema`, lá thật SMP-044; engine không đổi). Trước đó API lọc khỏi `legalActions` qua `apps/api/src/modules/duels/wire-actions.ts` (cơ chế giữ lại, danh sách rỗng).

- **`FlipSummon {playerIndex, cardInstanceId}`** `[RULE]`: turn player, Main1/Main2, không prompt/cửa sổ chain; quái **úp** của chính mình
  (ngửa ⇒ `MONSTER_FACE_UP`), không phải quái Set trong lượt này (`SUMMONED_THIS_TURN`), chưa đổi thế trong lượt
  (`POSITION_ALREADY_CHANGED`, phòng thủ: hiện chưa có gì úp quái lại). Lá Phép/Bẫy ⇒ `NOT_A_MONSTER`; tay/quái đối thủ/id lạ ⇒
  `CARD_NOT_ON_FIELD`. Kết quả: `position: 'Attack'`, ghi `positionChangedTurn` (không đổi thế lại trong lượt); `summonedTurn` giữ nguyên
  ⇒ quái Set từ lượt trước **tấn công được** ngay trong lượt Flip Summon. **Không** tốn Normal Summon. Event `FlipSummoned {playerIndex,
instanceId, definitionId, zoneIndex}`; `version` +1.
- Sau đó y như Normal Summon (`summon.ts`), từ task 4.4c: cửa sổ phản ứng `Summon` (3.4c) mở **trước** nếu đối thủ đáp trả
  được; trigger `OnFlip` / `OnSummon` của quái gom sau khi cửa sổ kết thúc và lần triệu hồi không bị vô hiệu (mục Trigger effect).
- **`OnFlip`** (`effects/triggers.ts`), optional/mandatory như 3.5:
  - `FlipSummoned` ⇒ `OnFlip` **và** `OnSummon` của quái (theo thứ tự effect trên lá) `[RULE]`: "khi được triệu hồi" gồm Normal/Special/Flip.
  - `MonsterFlipped` (bị tấn công, 1.8) ⇒ `OnFlip`, kiểm **sau** damage step: quái còn ngửa ở ô ⇒ nguồn `MonsterZone`; đã bị trận đó
    phá (ở mộ chủ) ⇒ nguồn `Graveyard`, **vẫn kích hoạt** `[RULE]`. `OnFlip` và `OnDestroyed` của cùng lá: theo thứ tự event (lật trước) G15.
  - Quái ngửa bị tấn công: không lật ⇒ không bắn.
- Test: `actions/handlers/flip-summon.test.ts`; golden `flip-summon-and-battle-flip-effect`; fuzz `MF`/`MFO` + generator FlipSummon,
  thống kê `flipSummons`/`flipLinks`.

## Equip Spell (task 4.2c)

Lên wire ở task 4.2d (lá thật SMP-112, `equippedTo` trên view; engine không đổi). Chủ dự án chốt 2026-09-30: **không thêm Duration**. Continuous đã có nghĩa "khi lá còn ngửa trên sân" (tính
lại mỗi lần đọc); cái còn thiếu chỉ là phạm vi "quái được trang bị" ⇒ `ModifyStat.equipped`.

- **Kích hoạt**: Spell `subType: 'Equip'` từ **tay**, trigger `Ignition`, Main1/Main2 của mình (như Normal Spell). Cần 1 ô Phép/Bẫy trống
  (`NO_FREE_SPELL_TRAP_ZONE`); lá vào **ô trống thấp nhất** `[ASSUMED]` G18, **ngửa ngay lúc kích hoạt**, `ChainLink.source =
{zone:'SpellTrapZone', zoneIndex}` (đi đường lá Set của 3.4).
- **Equip đã Set** (task 4.4c, ADR 067) `[RULE]`: kích hoạt được như Phép Speed 1 đã Set (4.3) — lượt của chủ lá
  (`NOT_TURN_PLAYER`, kể cả khi chủ lá giữ ưu tiên trong cửa sổ ở lượt đối thủ), Main1/Main2 (`WRONG_PHASE`), `Ignition`,
  **được ngay lượt vừa Set**; cần quái ngửa làm mục tiêu như từ tay (`NO_VALID_TARGET`). Lá **lật ngửa tại ô đang úp** (không
  chuyển sang ô trống thấp nhất — G18 chỉ áp cho Equip từ tay), resolve / fizzle / bị vô hiệu y như Equip từ tay. Test:
  `rules/equip-set-activation.test.ts`; golden `equip-set-then-activate`.
- **Target** (schema): `Card` `MonsterZone`, `count: 1`, `filter.kind: 'Monster'` — filter loại quái úp ⇒ chỉ trang bị quái **ngửa** `[RULE]`,
  bên mình hoặc đối thủ (lá Equip vẫn nằm ở sân người kích hoạt).
- **Resolve** (`effects/operations/equip.ts`): target còn ngửa trên sân và lá Equip còn ngửa ở ô ⇒ ghi `CardInstance.equippedTo =
target.instanceId`, event `CardEquipped {playerIndex, instanceId, definitionId, targetInstanceId}`; `resolveChain` **không** đưa lá có
  `equippedTo` vào mộ. Target mất trước khi resolve ⇒ `ChainLinkFizzled` + lá vào mộ `[RULE]`. Lá Equip bị phá trong lúc chờ ⇒ không làm gì.
- **Hiệu ứng**: effect `Continuous` `ModifyStat{stat, amount, equipped: true}` (không `side`/`filter`/`excludeSource`) — `effectiveStats` chỉ
  cộng cho quái có `instanceId === source.equippedTo`. Lá Equip bị phá riêng ⇒ lần đọc sau hết buff (không có code gỡ).
- **Rời sân theo quái** `[RULE]` (`state/detach-equips.ts`, chạy ở cuối **mọi** `applyAction`): lá có `equippedTo` trỏ tới quái không còn ngửa
  trong ô quái (bị phá, bị Tribute, …) ⇒ vào mộ chủ, `CardSentToGraveyard {from:'SpellTrapZone'}` (trước `DuelEnded` nếu có). `[ASSUMED]`
  G18: "gửi vào mộ", không phải "bị phá" (không bắn `OnDestroyed`). Không chuyển Equip sang quái khác.
- `OperationContext.sourceInstanceId` (mới): lá đang resolve (Equip tự gắn chính nó).
- Test: `effects/operations/equip.test.ts`; golden `equip-buff-and-detach`; fuzz `EQP`/`EQW`, bất biến "Phép/Bẫy ngửa ⇔ có link, hoặc
  đang trang bị cho quái ngửa trên sân" + "`equippedTo` chỉ ở ô Phép/Bẫy", thống kê `equips`/`equipsDetached`.

## Field Spell + lá ở lại sân (task 4.3)

Lên wire ở task 4.3b (event Field Zone trong `EventView`, UI ô Môi trường, lá thật trong `FIELD_DEMO_DECK` + 4 scenario Sandbox; engine không đổi — ADR 064). Chủ dự án chốt 2026-10-01: Field Spell được Set; mỗi bên 1 lá Field riêng; Phép Speed 1 đã Set kích
hoạt được ngay lượt vừa Set; lá bị phá khi link còn chờ xử lý như Equip. Chi tiết + lý do: ADR 063.

- **Lá nào ở lại sân** (đọc từ `subType`, `staysOnField` ở `@yugi/shared`): Spell `Continuous`/`Field`, Trap `Continuous`. Sau khi
  link của nó resolve, lá **ở lại ngửa** (không `CardSentToGraveyard`) và effect `Continuous` của nó áp dụng từ lần đọc kế tiếp.
  Equip: theo `equippedTo` (4.2c). Mọi lá khác vào mộ như cũ.
- **Kích hoạt lá** = `ActivateEffect` với effect kích hoạt của lá (Spell: `Ignition`, Trap: `Quick`; `operations` được rỗng). Effect
  `Continuous` vẫn `CONTINUOUS_NOT_ACTIVATABLE`; lá đã ngửa ⇒ `NOT_ACTIVATABLE` (không có "kích hoạt lại").
- **Ma trận** (bổ sung mục C11):

  | Lá               | Từ tay                                                                                                | Đã Set                                                                                     |
  | ---------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
  | Normal Spell     | `Ignition`, Main Phase lượt mình                                                                      | `Ignition`, Main Phase lượt mình, **được ngay lượt vừa Set** `[RULE]`; resolve xong vào mộ |
  | Continuous Spell | như trên; lá vào **ô Phép/Bẫy trống thấp nhất** ngửa ngay (`NO_FREE_SPELL_TRAP_ZONE`) `[ASSUMED]` G20 | như Normal Spell đã Set; lật tại ô, ở lại                                                  |
  | Field Spell      | như trên; lá vào **Field Zone** ngửa ngay                                                             | như Normal Spell đã Set; lật tại Field Zone, ở lại                                         |
  | Continuous Trap  | `TRAP_NOT_SET` (C11)                                                                                  | `Quick`, mọi phase, người giữ ưu tiên; `TRAP_SET_THIS_TURN` theo `trapSetTurnDelay`; ở lại |
  | Equip Spell      | 4.2c                                                                                                  | như Normal Spell đã Set (task 4.4c); lật tại ô, gắn vào mục tiêu, ở lại theo `equippedTo`  |

  Phép Speed 1 đã Set chỉ của **người chơi của lượt** (`NOT_TURN_PLAYER` kể cả khi đối thủ đang giữ ưu tiên trong cửa sổ), sai phase
  ⇒ `WRONG_PHASE`, nối chain ⇒ `SPELL_SPEED_TOO_LOW`; vì vậy nó không bao giờ giữ cửa sổ chain/phản ứng mở cho đối thủ.
  `SPELL_SET_THIS_TURN` chỉ còn áp dụng cho Quick-Play.

- **Field Zone** (`board.fieldZone`, 1 ô/người): `SetSpellTrap` với lá Field đặt lá úp vào đó (`zoneIndex` phải là `0` `[ASSUMED]`
  G20, khác ⇒ `INVALID_ZONE`), event `FieldSpellSet {playerIndex, instanceId}`. `ChainLink.source = {zone:'FieldZone'}`.
  Lá Field không bao giờ nằm ở ô Phép/Bẫy.
- **Thay lá Field của mình** `[DECISION]`: Set hoặc kích hoạt (từ tay) một lá Field khi ô đã có lá ⇒ lá cũ (ngửa/úp) vào mộ chủ,
  `CardSentToGraveyard {from:'FieldZone'}` (`state/field-zone.ts`); thứ tự event khi kích hoạt: `EffectActivated` →
  `CardSentToGraveyard` → `ChainLinkAdded` → …. `[ASSUMED]` G20: "gửi vào mộ", không bắn `OnDestroyed`. Lá Field của đối thủ không
  bị đụng. `ruleset.fieldSpellReplace === false` ⇒ `FIELD_ZONE_OCCUPIED`.
- **Bị phá**: target `SpellTrapZone` gồm cả lá ở Field Zone (xếp sau 5 ô Phép/Bẫy) `[RULE]`; `Destroy` phát `FieldSpellDestroyed
{ownerIndex, instanceId, definitionId}` (bắn `OnDestroyed`). Lá Continuous ở ô Phép/Bẫy vẫn `SpellTrapDestroyed`. Bị phá khi link
  còn chờ ⇒ link vẫn resolve (việc lá làm lúc kích hoạt), lá không vào mộ lần hai, Continuous không áp dụng.
- **Nguồn Continuous** (`activeContinuousEffects`): quái ngửa → Phép/Bẫy ngửa → lá ngửa ở Field Zone; lá úp không có hiệu lực.
- Test: `rules/field-spell.test.ts`, `rules/continuous-activation.test.ts`, `rules/set-spell-activation.test.ts`,
  `cards/sample/smp-113|114|115|208.test.ts`; golden `field-spell-activate-replace`, `continuous-spell-trap-stay`; fuzz
  `FLD`/`FLD2`/`CSA`/`CTR`/`SPS`. Mutation: `tools/mutants-4.3.mjs`.

## Counter Trap + Negate (task 4.4)

Đã lên wire + UI ở task 4.4b (ADR 066; engine không đổi). Chủ dự án chốt 2026-10-02 (ADR 065): `NegateSummon` chỉ cho
Normal/Flip Summon. Các quy ước chưa có tư liệu gốc gom ở **G23** (`fidelity-spec.md`; chủ dự án chốt giữ 2026-10-02).

- **Bẫy Phản công chỉ để đáp trả** `[RULE]`: lá Trap `subType: 'Counter'` (Spell Speed 3) mà `chainWindow === null` ⇒
  `NOTHING_TO_RESPOND_TO`. Nó chỉ kích hoạt được khi có mắt xích để đáp, hoặc trong cửa sổ phản ứng (tấn công / triệu hồi, kể
  cả khi chain còn rỗng). Luật đọc từ **subType** của lá, không từ Spell Speed (Trap thường khai `spellSpeed: 3` vẫn mở chain
  được). Các luật Trap khác được báo trước (`TRAP_NOT_SET`, `TRAP_SET_THIS_TURN`). Bẫy Phản công đáp được mắt xích mọi Speed;
  chỉ Speed 3 đáp được Speed 3 (`SPELL_SPEED_TOO_LOW`, có từ 3.4).
- **Điều kiện kích hoạt của operation Negate** (`effects/negate.ts`, kiểm trong `prepare` ⇒ `NOTHING_TO_NEGATE`;
  `legalActions`, auto-pass và việc có mở cửa sổ phản ứng hay không tự đúng theo vì đều dry-run `prepare`):

  | Operation                      | Cần                                                                                                |
  | ------------------------------ | -------------------------------------------------------------------------------------------------- |
  | `NegateActivation{cardKinds?}` | mắt xích trên cùng là của **đối thủ**; loại lá (`Monster`/`Spell`/`Trap`) thuộc `cardKinds` nếu có |
  | `NegateAttack`                 | `chainWindow.reactionTo.kind === 'Attack'` và người tấn công là **đối thủ**                        |
  | `NegateSummon`                 | `chainWindow.summoned` của đối thủ, chain **rỗng** (là link 1) `[ASSUMED]`, quái còn ngửa ở ô      |

- **`ChainWindow.summoned?: {playerIndex, instanceId}`**: ghi khi cửa sổ phản ứng Summon mở cho một lần **triệu hồi thật**
  (`NormalSummon` kể cả Tribute, `FlipSummon`; **không** ghi cho `SetMonster` — Set không phải triệu hồi `[RULE]`), đi theo cửa
  sổ qua mọi link/pass như `reactionTo`. Không lên wire (`toStateView` dựng `chainWindow` tường minh). Từ task 4.4c cửa sổ
  Summon luôn mở **trước** trigger nên không còn đường "trigger optional bị từ chối rồi mới mở cửa sổ"; cùng cửa sổ đó mang
  thêm `summonEvent` (mục Trigger effect).
- **Resolve** (`effects/chain.ts`; operation chỉ phát event, chain đọc event — cùng cách với trigger). `OperationContext` thêm
  `respondsTo` (link ngay dưới link đang resolve) và `window` (cửa sổ lúc chain bắt đầu resolve).
  - `NegateActivation` ⇒ `ChainLinkNegated`; ngay sau đó lá nguồn của link bị vô hiệu **vào mộ chủ** (`CardSentToGraveyard`,
    `from` = `Hand` / `SpellTrapZone` / `FieldZone`) — **kể cả** lá Liên tục / Môi trường / Trang bị đã đặt ngửa lúc kích hoạt
    (buff mất ở lần đọc kế). Link bị vô hiệu bị **bỏ qua hoàn toàn**: không operation nào chạy, không `EffectResolved`, không
    gửi mộ lần hai. Cost đã trả (`lpPaid`, `costInstanceIds`) **không hoàn** `[ASSUMED]`. "Gửi vào mộ", không "bị phá" ⇒ không
    bắn `OnDestroyed` `[ASSUMED]`. Link có nguồn là quái (trigger): quái ở yên `[ASSUMED]`.
  - `NegateAttack` ⇒ quái tấn công (nếu còn trên sân) được ghi `attackedTurn = turnCount` `[RULE]` (không replay), phát
    `AttackNegated`; `resolveChain` **không** gọi `continueAfterWindow` ⇒ không lật / phá / sát thương. Battle Phase không kết
    thúc. NegateAttack thứ hai trong cùng chain không làm gì (không event).
  - `NegateSummon` ⇒ quái rời ô vào mộ chủ (dựng mới, không mang dấu), phát `SummonNegated`; **không** `MonsterDestroyed` ⇒
    không bắn `OnDestroyed` `[ASSUMED]`. `hasNormalSummonedThisTurn` và tribute giữ nguyên (không hoàn).
- **Thứ tự event** (Phép bị Bẫy Phản công có cost vô hiệu): `EffectActivated` → `LifePointsPaid` → `ChainLinkAdded` →
  `ChainLinkNegated` → `CardSentToGraveyard` (lá bị vô hiệu) → `EffectResolved` (Bẫy Phản công) → `CardSentToGraveyard` (Bẫy
  Phản công) → `ChainResolved`.
- **Vô hiệu triệu hồi ↔ trigger** (task 4.4c, ADR 067; đóng câu hỏi mở G23 d): cửa sổ Summon mở **trước** trigger
  `OnSummon`/`OnFlip` ⇒ quái có hiệu ứng "khi được triệu hồi / lật" **vô hiệu triệu hồi được**, và khi bị vô hiệu thì hiệu
  ứng đó không xảy ra `[RULE]`. Special Summon bằng effect: vẫn chặn bằng `NegateActivation` lên lá đó.
- Test: `rules/counter-trap.test.ts`, `effects/operations/negate-{activation,attack,summon}.test.ts`,
  `cards/sample/smp-201|209|210.test.ts`; golden `counter-negates-spell`, `counter-negates-continuous-spell`, `negate-attack`,
  `negate-summon`; fuzz `TNA`/`CNA`/`CNS` + `NEGATE_DECK_POOL`. Mutation: `tools/mutants-4.4.mjs`.

## Fusion (task 4.5)

Engine + shared; **chưa lên wire** (task 4.5b). Quyết định: ADR 068; `[ASSUMED]` G26.

- **Extra Deck**: `StartDuel.payload.extraDeckLists?: [string[], string[]]` (bỏ trống = cả hai rỗng). Lá có id `p<seat>-x<i>`,
  đúng thứ tự danh sách, `position: null`; **không xáo, không dùng rng, không event** ⇒ duel không có Extra Deck y hệt trước.
  Dài hơn `ruleset.extraDeckSize` ⇒ `INVALID_EXTRA_DECK`. Engine không kiểm loại lá ở đây (`StartDuel` không có `ctx`):
  `validateDeck(deck, lookup, extraDeck, extraDeckMax)` của `@yugi/shared` làm việc đó (Extra Deck chỉ quái Fusion, ≤ 3 bản;
  Main Deck không có quái Fusion).
- **Dữ liệu lá**: quái `category: 'Fusion'` có `fusionMaterials: string[]` (id đích danh `[DECISION]`, id lặp = cần ngần ấy lá
  khác nhau). Operation `FusionSummon { sources: ('Hand'|'Field'|'Deck')[], position? }` — operation duy nhất của một effect
  `Ignition` trên Phép `Normal` (Speed 1), không `target`.
- **Kích hoạt** (`prepare`, `effects/operations/fusion-summon.ts` `fusionBlocked`): cần ít nhất một quái Fusion trong Extra Deck
  của mình mà mọi nguyên liệu có trong `sources` (`Hand` = tay mình; `Field` = ô quái của mình, kể cả úp; `Deck` = Deck mình) ⇒
  không có: `NOT_ACTIVATABLE`; có nhưng sân đầy và không nguyên liệu nào lấy được từ sân: `NO_FREE_MONSTER_ZONE`. **Không chọn
  gì lúc kích hoạt** (`ChainLinkAdded.targetInstanceIds` rỗng), không cost.
- **Resolve = chain tạm dừng** (`effects/chain.ts` `pauseForFusion`): lá Speed 1 luôn là mắt xích 1 nên resolve cuối và không
  bao giờ ở trong cửa sổ phản ứng. Tới lượt nó mà còn quái Fusion làm được: `chainStack = [link]`, `chainWindow = {
priorityPlayer: người kích hoạt, passCount: 0 }`, `pendingPrompt` `SelectFusionMonster`; trigger do các mắt xích phía trên
  bắn ra nằm trong `payload.owedTriggers` (không field `GameState` mới). Không còn quái Fusion nào làm được ⇒ không prompt, mắt
  xích resolve **không hiệu ứng** (`EffectResolved`, lá vào mộ).
- **Trả lời** (`actions/handlers/fusion-prompt.ts`): chọn quái ⇒ prompt `SelectFusionMaterials` (chưa có gì di chuyển, không
  event); chọn nguyên liệu ⇒ `applyFusion`: nguyên liệu vào mộ theo thứ tự chọn (`FusionMaterialSent`), nguyên liệu từ Deck ⇒
  Deck xáo bằng `state.rng`, quái Fusion vào **ô quái trống thấp nhất** `[ASSUMED]` ngửa (`position` của operation, mặc định
  Attack), `summonedTurn = turnCount`, **không** đụng `hasNormalSummonedThisTurn` `[RULE]`. Rồi `finishFusionLink`: lá Phép vào
  mộ, `ChainResolved { linkCount }`, trigger nợ + `OnSummon` của quái Fusion lên **một** chain mới (nợ trước; người của lượt
  trước), `settle`. `version` +1 mỗi câu trả lời.
- **Không cửa sổ phản ứng triệu hồi** `[ASSUMED]` (như Special Summon, G17): chỉ `NegateActivation` lên lá Phép chặn được; mắt
  xích bị vô hiệu bị bỏ qua như mọi mắt xích ⇒ không prompt, không nguyên liệu nào bị dùng.
- **Quái Fusion**: Normal Summon / Set ⇒ `FUSION_NOT_SUMMONABLE`; operation `SpecialSummon` không lấy nó từ tay / mộ
  (`effectTargetCandidates`); bị phá ⇒ mộ (không về Extra Deck).
- `getLegalActions`: hai prompt dùng chung bộ sinh với `SelectEffectTarget` (tổ hợp `count` id, tối đa 200, lọc bằng dry-run).
- Test: `rules/fusion.test.ts`, `actions/handlers/start-duel.extra-deck.test.ts`; golden `fusion-hand-and-field`,
  `fusion-then-onsummon-trigger`, `fusion-negated-keeps-materials`, `fusion-material-destroyed-in-response`,
  `fusion-owed-trigger-after-pause`; fuzz `FUS`/`FUD`/`FX1`/`FX2`/`FXS` (ngoài pool mặc định) + `FUSION_DECK_POOL` /
  `FUSION_EXTRA_DECK_POOL`, `checkFusion`. Mutation: `tools/mutants-4.5.mjs`.
- **Chưa có**: nguyên liệu "chung"; lá dung hợp Quick-Play / Bẫy (cần tạm dừng giữa chain); cửa sổ triệu hồi cho Fusion; người
  chơi chọn ô / tư thế; trả quái Fusion về Extra Deck.

## Replay

1 ván đấu = `(seed, playerIds, deckLists, actionLog: Action[])`. Replay = chạy lại
`applyAction` tuần tự từ `StartDuel` qua toàn bộ `actionLog` với cùng seed → ra đúng
`GameState` cuối cùng, vì engine deterministic. Đây là lý do DB (`DuelMatch.actionLog`)
lưu action log thay vì state snapshot.
