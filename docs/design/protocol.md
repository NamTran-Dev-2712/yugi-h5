# Protocol Spec (client ↔ server)

## Nguyên tắc

- Server là nguồn sự thật. Client gửi **Action intent**, nhận về **GameEvent[] + StateView**.
- `StateView` = `GameState` đã lọc: ẩn `hand`/`deck` order của đối thủ, ẩn face-down card
  identity trừ khi đã lật. Việc lọc xảy ra ở `apps/api` (service layer), không phải trong
  `packages/game-engine`.
  Contract cụ thể: type `StateView`/`CardView` ở `packages/shared/src/duel/state-view.ts`; hàm `toStateView` ở `apps/api/src/modules/duels/state-view.ts`. Lá ẩn = `{hidden:true, instanceId, ownerIndex}` (không `definitionId`/`position`); tay đối thủ = toàn lá ẩn + `handCount`; deck/extra deck chỉ có count; `rng` không gửi; `chainStack` thô không gửi — thay bằng `chain` công khai + `chainWindow` (task 3.4b, xem dưới); Spell/Trap/Field của đối thủ ẩn trừ khi có position ngửa (fail-closed). Event lọc riêng bằng `toEventView` (xem dưới).
- Versioning: mọi `StateView` mang `version` (từ `GameState.version`). Client so sánh với
  version cục bộ; lệch → yêu cầu full re-sync thay vì áp partial update.

## Event gửi cho client (`EventView`)

Client chỉ nhận `EventView` (`packages/shared/src/duel/event-view.ts`), không bao giờ `GameEvent` thô. Gửi `eventsByViewer[i]` cho người chơi `i` (không gửi chéo). Event PUBLIC giữ nguyên shape engine; `CardDrawn` có dạng `{type, playerIndex, card: CardView}` — đối thủ nhận lá ẩn `{hidden:true, instanceId, ownerIndex}`. Bảng phân loại, bất biến engine và cách thêm event mới: [`event-visibility.md`](./event-visibility.md). Loại event chưa phân loại bị bỏ (deny by default). Từ task 3.2b có thêm 7 event Spell/Trap (`SpellTrapSet` không có `definitionId`; `EffectActivated`/`EffectResolved`/`CardSentToGraveyard`/`SpellTrapDestroyed` có `definitionId` vì lá đã công khai; `LifePointsRecovered`/`LifePointsPaid` không có dữ liệu lá), đều PUBLIC.

**Chain trong `StateView` (task 3.4b):** `chain: ChainLinkView[]` (đáy → đỉnh; `{linkId, playerIndex, card: VisibleCardView, source, effectId, spellSpeed, targetInstanceIds}`, giống nhau cho cả hai ghế — lá đã công khai lúc kích hoạt; không có `costInstanceIds`/`lpPaid`) và `chainWindow: {priorityPlayer, passCount, reactionTo?} | null` (`reactionTo` = `{kind:'Summon'}` hoặc `{kind:'Attack', playerIndex, attackerInstanceId, targetInstanceId}`). Người giữ ưu tiên có `PassPriority {playerIndex}` trong `legalActions` (cùng các `ActivateEffect` đáp trả được); C13: UI không có hộp thoại "Kích hoạt?" — chạm lá có `ActivateEffect` hợp lệ là kích hoạt, "Bỏ qua" là nút gửi `PassPriority`. Quái **ngửa** trên ô quái có thêm `effectiveStats: {atk, def}` (sau Continuous, kẹp ≥ 0, do engine tính); chỉ số in vẫn lấy từ card data; lá úp/tay/mộ không có field này.

**Task 4.2d (nối wire 4.2a/b/c):** `PlayerActionSchema` có `FlipSummon {playerIndex, cardInstanceId}` (có trong `legalActions`, hết engine-only). `EventView` có `MonsterSpecialSummoned {playerIndex, instanceId, definitionId, zoneIndex, from:'Hand'|'Graveyard', position}`, `FlipSummoned {playerIndex, instanceId, definitionId, zoneIndex}`, `CardEquipped {playerIndex, instanceId, definitionId, targetInstanceId}` (PUBLIC). `VisibleCardView.equippedTo?: string` chỉ có trên lá Trang bị **ngửa** ở ô Phép/Bẫy, trỏ tới quái **ngửa** (hai phía sân). **Target bị lọc theo ghế**: id của lá người xem không được biết (tay đối thủ, deck) bị bỏ khỏi `ChainLinkAdded.targetInstanceIds`, `chain[].targetInstanceIds` và khỏi câu trả lời prompt/id cost trong `aiActions` — nên `chain` có thể khác nhau giữa hai ghế ở đúng field này (người kích hoạt thấy đủ). Mục tiêu ở mộ được client chọn qua dải "Chọn từ mộ" (không có trên bàn).

**Task 4.3b (nối wire 4.3 — ô Môi trường và lá ở lại sân):** `EventView` có thêm `FieldSpellSet {playerIndex, instanceId}` (Set lá Field úp vào Field Zone; **không** `definitionId`, không `zoneIndex`), `FieldSpellDestroyed {ownerIndex, instanceId, definitionId}` (lá ở Field Zone bị effect phá, vào mộ công khai) và `CardSentToGraveyard.from` nhận thêm `'FieldZone'` (lá Field cũ bị lá mới của chính chủ thay: "gửi vào mộ") — cả ba PUBLIC, giữ shape engine. `PlayerActionSchema` **không đổi**: Set lá Field là `SetSpellTrap` với `zoneIndex: 0` (Field Zone chỉ có 1 ô; `zoneIndex` khác → `409 INVALID_ZONE`), kích hoạt lá Field/Continuous/Phép đã Set là `ActivateEffect` như mọi lá; `legalActions` liệt kê đúng 1 action Set cho mỗi lá Field trên tay. `StateView.players[].board.fieldZone` có từ 2.1 (lá úp: đối thủ nhận `{hidden:true, instanceId, ownerIndex}`); `chain[].source` có thể là `{zone:'FieldZone'}`. `AiActionView` thêm `promptKind?: string` — **chỉ** trên action `ResolvePendingPrompt`: `kind` của prompt mà AI vừa trả lời (`DiscardToHandLimit` / `SelectEffectTarget` / `TriggerActivation`…), để client viết câu log đúng loại (bỏ bài ≠ chọn mục tiêu) mà không đoán từ id; kind prompt vốn đã công khai ở `StateView.pendingPrompt.kind`. Deck demo: `FIELD_DEMO_DECK` (gửi qua body `deck`; `DECK=field` ở `tools/play-vs-ai.ts`).

**Task 4.4b (nối wire 4.4 — Bẫy Phản công / vô hiệu):** `EventView` có thêm `ChainLinkNegated {linkId, playerIndex, instanceId, definitionId, effectId, byInstanceId}` (việc kích hoạt của mắt xích bị vô hiệu; `playerIndex` = người bị vô hiệu; lá đó vào mộ ngay sau bằng `CardSentToGraveyard`, mắt xích không có `EffectResolved`), `AttackNegated {playerIndex, attackerInstanceId, targetInstanceId|null}` (**chỉ id, không bao giờ có `definitionId`** — mục tiêu có thể là quái úp; sau nó không có lật / phá / `DamageDealt` của đòn đó) và `SummonNegated {playerIndex, instanceId, definitionId, zoneIndex}` (quái bị vô hiệu Normal/Flip Summon rời ô vào mộ; không `MonsterDestroyed`) — cả ba PUBLIC, cả hai ghế nhận giống nhau, giữ shape engine. `PlayerActionSchema` và `StateView` **không đổi**: lá vô hiệu là `ActivateEffect` thường và chỉ có trong `legalActions` khi đang có thứ để đáp (Bẫy Phản công ở Main Phase của mình ⇒ không được liệt kê; gửi cứng ⇒ `409` `NOTHING_TO_RESPOND_TO` / `NOTHING_TO_NEGATE`); cửa sổ phản ứng vẫn là `chainWindow.reactionTo` (`Attack` / `Summon`). Deck demo: `NEGATE_DEMO_DECK` (body `deck`; `DECK=negate` ở `tools/play-vs-ai.ts`); scenario Sandbox `negate-attack-real` / `counter-summon-real` / `counter-spell-real` (AI đi trước ⇒ response nạp đã có `chainWindow.priorityPlayer` = ghế người).

**Task 4.5 (Fusion — engine + shared, CHƯA lên wire):** `PlayerActionSchema`, `EventView`, `StateView` **không đổi**. Hai event `FusionMaterialSent` / `MonsterFusionSummoned` bị `toEventView` loại (`null`) cho cả hai ghế; `StateView` vẫn chỉ có `extraDeckCount`; không duel nào tạo qua HTTP có Extra Deck (`POST /duels/solo` không nhận Extra Deck, `scenarioToState` dựng rỗng) nên lá SMP-116 trong một deck không bao giờ nằm trong `legalActions`. Hai prompt mới `SelectFusionMonster` / `SelectFusionMaterials` không thuộc `PUBLIC_PROMPT_KINDS` ⇒ ghế không được hỏi nhận `payload: null`. Việc của **task 4.5b**: nạp Extra Deck ở `DuelManager` (+ `validateDeck` có Extra Deck), Extra Deck của chủ sở hữu trên `StateView`, 2 event vào `EventView`, type payload của 2 prompt ở shared, luật oracle cho con trỏ vào Extra Deck của chính chủ lá.

**Prompt `TriggerActivation` (task 3.5, lên wire 3.4b):** hỏi CHỦ lá có trigger. Payload (`TriggerActivationPromptPayload` ở shared) = `{trigger, optional, candidateInstanceIds, count, remaining, afterward}`, chỉ người được hỏi nhận (người kia `payload: null`); từ task 4.4c `afterward` luôn `null` (cửa sổ phản ứng triệu hồi nay đứng **trước** prompt này: với quái có hiệu ứng "khi triệu hồi / lật", đối thủ có lá đáp trả sẽ nhận `chainWindow` `reactionTo: {kind:'Summon'}` trước, prompt chỉ tới sau khi họ `PassPriority` — shape wire không đổi). Trả lời `ResolvePendingPrompt` với đúng `count` id trong `candidateInstanceIds` để kích hoạt, hoặc `{cardInstanceIds: [], decline: true}` khi `optional` (chỉ kind này nhận `decline`). Không thuộc C13 (lá của chính mình): 3.7 dùng overlay Có/Không.

**`pendingPrompt` trong `StateView` (task 3.2b):** người được hỏi nhận nguyên `payload`; người kia vẫn thấy prompt (`promptId`, `playerIndex`, `kind`) nhưng `payload` chỉ giữ với kind công khai (`DiscardToHandLimit` → `{count}`), mọi kind khác (`SelectEffectTarget`, kind tương lai) → `payload: null` (deny by default). Payload `SelectEffectTarget` = `{cardInstanceId, effectId, costInstanceIds, candidateInstanceIds, count}` (type `SelectEffectTargetPromptPayload` ở shared); trả lời bằng `ResolvePendingPrompt` với đúng `count` id trong `candidateInstanceIds` (engine không có huỷ prompt).

## Lỗi tầng service (`DuelService`, task 2.2)

`DuelServiceError.code`: `DUEL_NOT_FOUND`, `INVALID_CONFIG`, `UNKNOWN_CARD`, `PLAYER_MISMATCH` (payload.playerIndex ≠ người gọi), `FORBIDDEN_ACTION` (client gửi `StartDuel`/`Draw`), `ACTION_REJECTED` (kèm `engineCode` = `EngineErrorCode`, state không đổi), `INTERNAL_ERROR`. Controller/gateway (2.3+) map các mã này sang HTTP/`duel:error`. Action của 1 duel xử lý tuần tự; log lưu action được chấp nhận + `version`. `submitAction` trả `{view (của người gửi), events (đã lọc cho người gửi), eventsByViewer}`; events thô của engine không ra khỏi `DuelManager`.

## Mã lỗi Action & `legalActions` cho Trap (C11)

- Action bị reject trả `code` riêng để UI hiện đúng thông báo: `TRAP_NOT_SET` (Trap chưa Set trên sân), `TRAP_SET_THIS_TURN` (Trap vừa Set lượt này). Đi qua `duel:error` và response lỗi REST.
- `legalActions` trong `StateView` **không bao giờ** liệt kê "Kích hoạt" cho Trap trên tay (khi `allowTrapActivationFromHand=false`); Trap trên tay chỉ có "Set". Trap úp trên sân chỉ có "Kích hoạt" khi đã qua lượt Set (nếu `trapSetTurnDelay`).
- Spell thường trên tay vẫn có "Kích hoạt" ở Main Phase của mình.

## REST endpoints (M3+)

| Method                  | Path                     | Mô tả                                                         |
| ----------------------- | ------------------------ | ------------------------------------------------------------- |
| `GET`                   | `/health`                | Liveness + DB check (đã có từ M0)                             |
| `GET`                   | `/cards`                 | List CardDefinition (đã có từ M0, dùng sample data tới M2)    |
| `POST`                  | `/auth/guest`            | Tạo guest + JWT (**đã có, task 2.3**, stateless, chưa lưu DB) |
| `POST`                  | `/auth/register`         | Đăng ký account (email/password)                              |
| `POST`                  | `/auth/login`            | Login, trả access + refresh token                             |
| `POST`                  | `/auth/refresh`          | Đổi refresh token lấy access token mới                        |
| `POST`                  | `/auth/upgrade`          | Guest → Account (giữ nguyên userId/collection)                |
| `GET`                   | `/users/me`              | Profile hiện tại                                              |
| `GET/POST/PATCH/DELETE` | `/decks`                 | CRUD deck (M6)                                                |
| `GET`                   | `/collections/me`        | Card collection của user (M6)                                 |
| `POST`                  | `/duels/solo`            | **Đã có (2.3)**: duel solo-debug, xem "HTTP duel solo" dưới   |
| `GET`                   | `/duels/:id?viewer=0\|1` | **Đã có (2.3)**: `StateView` của 1 phía                       |
| `POST`                  | `/duels/:id/actions`     | **Đã có (2.3)**: gửi 1 Action                                 |

## HTTP duel solo (task 2.3)

Mọi route `/duels/*` cần `Authorization: Bearer <accessToken>` (token từ `POST /auth/guest`); thiếu/sai chữ ký/hết hạn/không phải token guest → `401`. Body JSON tối đa **100kb** (`413`), JSON hỏng → `400`. CORS theo env `CORS_ORIGIN` (nhiều origin cách nhau bằng dấu phẩy).

**Chế độ `solo-debug`** (mặc định): guest tạo duel sở hữu **cả hai ghế** (playerIndex 0 và 1), tự gửi action cho từng ghế và chọn `viewer` khi xem. Người khác → `403 NOT_OWNER`. Ánh xạ guest → ghế nằm ở `apps/api/src/modules/duels/duel-access.ts` (thêm `pvp` = thêm nhánh ở đó; `solo-vs-ai` xem mục "Chế độ `solo-vs-ai`" bên dưới). Engine `playerIds` = `["<guestId>:0", "<guestId>:1"]`.

| Endpoint                             | Body / query                                                                                                                                                                                 | Trả về                                                                                                                                                                 |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /auth/guest` → `201`           | (không)                                                                                                                                                                                      | `{ guestId, accessToken }` (JWT `sub=guestId`, `kind:"guest"`, TTL env `GUEST_TOKEN_TTL`, mặc định 12h)                                                                |
| `POST /duels/solo` → `201`           | `{ mode?: "solo-debug" \| "solo-vs-ai", deck?: string[], decks?: [string[], string[]], viewer?: 0 \| 1 }` (không có `deck`/`decks` = starter deck; không được gửi cả hai; key lạ bị từ chối) | `{ duelId, mode, aiSeat?, viewer, view, events, legalActions, aiActions? }` — `events` gồm `DuelStarted` + 10 `CardDrawn` (5 của đối thủ là lá ẩn) đã lọc cho `viewer` |
| `GET /duels/:id?viewer=0\|1` → `200` | `viewer` mặc định 0                                                                                                                                                                          | `{ view, legalActions }`                                                                                                                                               |
| `POST /duels/:id/actions` → `200`    | `{ playerIndex: 0 \| 1, action: { type, payload: { playerIndex, ... } } }`                                                                                                                   | `{ view, events, legalActions, aiActions }` — của ghế `playerIndex` (không bao giờ của ghế kia)                                                                        |

### Chế độ `solo-vs-ai` (task 2.6)

`POST /duels/solo { mode: "solo-vs-ai" }`: người chơi ngồi **ghế 0** (đi trước), server chơi **ghế 1** (`aiSeat: 1` trong response; engine `playerIds` = `["<guestId>", "<guestId>:ai"]`). Deck AI = `decks[1]` / `deck` / starter deck. Quy tắc:

- **Quyền**: chủ duel chỉ điều khiển/xem ghế của mình. Gửi action cho ghế AI, hoặc `GET ?viewer=<ghế AI>` → `403 NOT_OWNER` (không cho nhìn trộm tay AI); tạo duel với `viewer` = ghế AI → `400 INVALID_VIEWER`. `DuelManager` cũng tự chặn ghế AI (phòng thủ nhiều lớp).
- **Driver**: sau mỗi action hợp lệ của người (và ngay khi tạo duel nếu AI đi trước), server lặp _trong cùng khoá duel_: khi ghế phải hành động (turn player, hoặc người mà `pendingPrompt` chờ) là AI và duel chưa kết thúc → lấy **StateView + legalActions của ghế AI** → `chooseAction` → áp qua đúng đường `applyAndSave` của `DuelManager` (validate, action log, replay). Dừng khi tới lượt người hoặc duel kết thúc. Tối đa `MAX_AI_ACTIONS_PER_REQUEST = 200` action AI mỗi request; chạm trần → `500 AI_LOOP_LIMIT` (state đã lưu tới bước đó vẫn hợp lệ, replay được). AI không bao giờ `Surrender` (policy + guard ở manager → `INTERNAL_ERROR`).
- **Response** vẫn chỉ của ghế người: `events` = event của người **rồi** event do AI gây ra, tất cả đã lọc cho ghế người (`toEventView`). `aiActions` liệt kê từng action AI theo thứ tự: `{ action, eventsFrom, eventsTo, promptKind? }` (`promptKind` từ task 4.3b, chỉ có khi action là câu trả lời prompt), trong đó `[eventsFrom, eventsTo)` là lát của `events` do action đó tạo ra (để client animate/ghi log từng bước); `[]` khi AI không đi (`solo-debug` luôn `[]`). Action chỉ chứa `instanceId`/ô/tư thế, không `definitionId`; danh tính lá của AI vẫn chỉ lộ qua event công khai. `POST /duels/solo` có `aiActions` khi AI đi trước (lát của `events` sau các event mở đầu).
- `legalActions` trong response luôn của ghế người, tính trên state **sau** lượt AI.

Deck đi qua `validateDeck` (`packages/shared/src/deck/validate-deck.ts`: 40–60 lá, ≤3 bản/lá, lá phải có trong card data). Sai → `400 { code: "INVALID_DECK", errors: [{ seat, code: "TOO_FEW" | "TOO_MANY" | "TOO_MANY_COPIES" | "UNKNOWN_CARD", ... }] }`. **Hình dạng** của `action` được kiểm bằng `ActionInputSchema` (`packages/shared/src/duel/action-schema.ts`, task 2.4): payload méo (thiếu field, sai kiểu, key lạ, `zoneIndex` ngoài 0–4, `toPosition: "DefenseDown"`...) → `400 VALIDATION_FAILED` + `issues[]`, không còn `500`. Hình dạng đúng nhưng sai luật (sai lượt, sai phase, tribute sai số lượng...) → `409 ACTION_REJECTED` + `engineCode` do engine quyết. `StartDuel`/`Draw` chỉ cần qua vỏ (`payload.playerIndex`) để nhận `403 FORBIDDEN_ACTION`. Schema và type `PlayerAction` nằm ở shared; `apps/api` có assertion compile-time (`duels.dto.ts`) rằng `PlayerAction` gán được vào `Action` của engine, engine đổi shape mà schema không theo → `tsc` đỏ.

Type body phản hồi (`ViewResponse`, `CreateSoloResponse`, `GetViewResponse`, `ApiErrorBody`...) ở `packages/shared/src/duel/http-types.ts` để web import. **`legalActions` (task 2.5)** nằm cạnh `view` ở cấp response, **không** trong `StateView`: `{ view, legalActions }` (GET), `{ view, events, legalActions }` (POST/`solo`). Đó là danh sách `PlayerAction` mà ghế `view.viewerIndex` gửi được **ngay bây giờ**: engine (`getLegalActions`) sinh ứng viên theo cấu trúc rồi giữ những cái `applyAction` chấp nhận (dry-run), nên luật không bị sao chép. Quy ước:

- Chỉ chứa `instanceId`/ô/tư thế, **không bao giờ** `definitionId`; mục tiêu là lá úp của đối thủ chỉ theo `instanceId` (đã có trong view dạng ẩn). Bài trên tay đối thủ không bao giờ xuất hiện.
- Duel đã kết thúc → `[]`. Ghế không đến lượt (và không phải người phải trả lời prompt) → chỉ `Surrender` (nếu `allowSurrender`). Có `pendingPrompt` → người phải trả lời có các `ResolvePendingPrompt` hợp lệ (+ `Surrender`), ghế kia chỉ `Surrender`. `Surrender` luôn hợp lệ theo engine (ADR 1.9), nên có mặt trong mọi trường hợp trên.
- Không bao giờ chứa `Draw`/`StartDuel`. Danh sách phản ánh trạng thái **sau** action vừa gửi (POST) hoặc hiện tại (GET); luôn của đúng ghế trong response, không trả ghế kia.
- Client dùng để làm mờ/tắt nút và (Phaser sau này) highlight ô hợp lệ; **server vẫn validate mọi action** — danh sách chỉ là gợi ý, không phải quyền.
- Spell/Trap (task 3.2b): `SetSpellTrap {playerIndex, cardInstanceId, zoneIndex 0–4}` và `ActivateEffect {playerIndex, cardInstanceId, effectId, costInstanceIds?}` nằm trong `PlayerActionSchema` và `legalActions` (một phần tử cho mỗi ô trống / mỗi effect × lựa chọn cost). Target KHÔNG nằm trong payload: nhiều ứng viên → engine mở prompt `SelectEffectTarget`. Trap trên tay chỉ có `SetSpellTrap` (C11); Trap đã Set chưa kích hoạt được tới task 3.4.

Ví dụ:

```jsonc
// POST /duels/:id/actions  { "playerIndex": 0, "action": { "type": "EndPhase", "payload": { "playerIndex": 0 } } }
// 200
{ "view": { "viewerIndex": 0, "phase": "Standby", "version": 2 /* ... */ },
  "events": [ { "type": "PhaseChanged" /* ... */ } ],
  "legalActions": [ { "type": "EndPhase", "payload": { "playerIndex": 0 } }, { "type": "Surrender", "payload": { "playerIndex": 0 } } ] }

// Sai lượt: 409, state không đổi
{ "statusCode": 409, "code": "ACTION_REJECTED", "message": "...", "engineCode": "NOT_TURN_PLAYER" }
```

| HTTP | `code`                                                                                                              | Nguồn                                                                                |
| ---- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 400  | `VALIDATION_FAILED` (+`issues[]`), `INVALID_DECK` (+`errors[]`), `INVALID_VIEWER`, `INVALID_CONFIG`, `UNKNOWN_CARD` | body/query sai schema; deck sai                                                      |
| 401  | (không có `code`)                                                                                                   | thiếu/sai/hết hạn token                                                              |
| 403  | `NOT_OWNER`, `PLAYER_MISMATCH`, `FORBIDDEN_ACTION`                                                                  | không phải chủ duel; `playerIndex` envelope ≠ payload; client gửi `StartDuel`/`Draw` |
| 404  | `DUEL_NOT_FOUND`                                                                                                    | id lạ                                                                                |
| 409  | `ACTION_REJECTED` + `engineCode`                                                                                    | engine từ chối (luật)                                                                |
| 413  |                                                                                                                     | body > 100kb                                                                         |
| 500  | `INTERNAL_ERROR`                                                                                                    | lỗi lạ; message chung, không stack, state không đổi                                  |
| 500  | `AI_LOOP_LIMIT`                                                                                                     | `solo-vs-ai`: AI vượt 200 action/request; state đã lưu vẫn hợp lệ                    |

Mã lỗi `DuelServiceError` → HTTP nằm ở `duel-http.ts` (hàm thuần `toDuelHttpError`); filter `DuelServiceErrorFilter` gắn vào `DuelsController`.

Tất cả response lỗi theo format của `AllExceptionsFilter`:
`{ statusCode, message, ...(validation errors nếu có) }`.

## Socket.io events (M7, duel PvP)

Namespace: `/realtime` (đã có gateway skeleton từ M0).

**Client → Server**

| Event         | Payload                       | Mô tả                                        |
| ------------- | ----------------------------- | -------------------------------------------- |
| `duel:join`   | `{ matchId, token }`          | Join room của 1 duel đang diễn ra            |
| `duel:action` | `{ matchId, action: Action }` | Gửi 1 Action — server validate + chạy engine |
| `duel:resync` | `{ matchId, clientVersion }`  | Yêu cầu full `StateView` khi nghi ngờ desync |

**Server → Client**

| Event                        | Payload                                     | Mô tả                                                       |
| ---------------------------- | ------------------------------------------- | ----------------------------------------------------------- |
| `duel:events`                | `{ matchId, events: GameEvent[], version }` | Kết quả sau khi 1 Action được áp dụng                       |
| `duel:state`                 | `{ matchId, state: StateView, version }`    | Full state (lúc join hoặc sau resync)                       |
| `duel:error`                 | `{ matchId, code, message }`                | Action bị reject (invalid, không đúng lượt...)              |
| `duel:opponent-disconnected` | `{ matchId }`                               | Đối thủ mất kết nối (chờ reconnect trong X giây — TBD ở M7) |

## Reconnect / desync

1. Client mất kết nối → server giữ duel session (timeout TBD, ghi ADR khi implement M7).
2. Client reconnect → emit `duel:join` lại → server trả `duel:state` full (không replay
   từng event) để tránh phụ thuộc animation queue đã mất.
3. Nếu client nhận `duel:events` với `version` không khớp `localVersion + 1` → tự động emit
   `duel:resync` thay vì cố áp partial update — tránh state rách.

## Versioning API

Chưa cần versioned URL (`/v1/...`) ở quy mô hiện tại (private, single deploy). Khi cần, thêm
prefix `/v1` và ghi ADR — không đổi ngầm mà không version khi đã có client thật dùng.
