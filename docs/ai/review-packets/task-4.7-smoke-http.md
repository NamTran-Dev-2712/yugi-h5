# Task 2.4 — Smoke test HTTP thật

Sinh bởi `tools/smoke-http.ts` lúc 2026-10-08T08:48:40.630Z (API: http://localhost:3000). Token được rút gọn; view dài bị cắt khi in (kiểm tra rò rỉ chạy trên bản đầy đủ).

## 0. Health

```http
GET /health
```

Response **200**:

```json
{
  "status": "ok",
  "database": "ok"
}
```

- ✅ health ok + database ok

## 1. Tạo guest

```http
POST /auth/guest
```

Response **201**:

```json
{
  "guestId": "f46734c4-0ec4-40de-8675-47a004d656c3",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmNDY3MzRjNC0wZWM0LTQwZGUtODY3NS00N2EwMDRkNjU2YzMiLCJraW5kIjoiZ3Vlc3QiLCJpYXQiOjE3OTE0NDkzMjAsImV4cCI6MTc5MTQ5MjUyMH0.Ug-5d-1g0EF2_I0dJYZubYa0AMWk2AARBP197OgHHNo"
}
```

- ✅ POST /auth/guest → 201 có accessToken
- ✅ CORS preflight từ http://localhost:5173 được phép

## 2. Tạo duel solo (starter deck, viewer 0)

```http
POST /duels/solo   (Authorization: Bearer <token>)
```

Request body:

```json
{}
```

Response **201**:

```json
{
  "duelId": "50721bae-b4cc-4fac-a622-3204e5663281",
  "mode": "solo-debug",
  "viewer": 0,
  "view": {
    "matchId": "50721bae-b4cc-4fac-a622-3204e5663281",
    "version": 1,
    "viewerIndex": 0,
    "ruleset": {
      "startingLP": 8000,
      "openingHandSize": 5,
      "handLimit": 6,
      "firstTurnDraw": false,
      "firstTurnAttack": false,
      "deckMin": 40,
      "deckMax": 60,
      "copyLimit": 3,
      "extraDeckSize": 20,
      "extraMonsterZones": 0,
      "fieldSpellReplace": true,
      "chainPrompt": "ask",
      "turnTimerSec": null,
      "afkLossThreshold": 3,
      "allowSurrender": true,
      "allowTrapActivationFromHand": false,
      "trapSetTurnDelay": true
    },
    "turnCount": 1,
    "turnPlayerIndex": 0,
    "phase": "Draw",
    "winnerIndex": null,
    "pendingPrompt": null,
    "chain": [],
    "chainWindow": null,
    "players": [
      {
        "playerId": "f46734c4-0ec4-40de-8675-47a004d656c3:0",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": false,
            "instanceId": "p0-36",
            "definitionId": "SMP-013",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-40",
            "definitionId": "SMP-014",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-27",
            "definitionId": "SMP-010",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-41",
            "definitionId": "SMP-014",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-11",
            "definitionId": "SMP-004",
            "position": null,
            "ownerIndex": 0
          }
        ],
        "handCount": 5,
        "deckCount": 37,
        "extraDeckCount": 0,
        "extraDeck": [],
        "graveyard": [],
        "banished": [],
        "board": {
          "monsterZones": [
            null,
            null,
            null,
            null,
            null
          ],
          "spellTrapZones": [
            null,
            null,
            null,
            null,
            null
          ],
          "fieldZone": null
        },
        "hasNormalSummonedThisTurn": false
      },
      {
        "playerId": "f46734c4-0ec4-40de-8675-47a004d656c3:1",
        "lifePoints": 8000,
        "hand": [
          {

… (cắt 3406 ký tự)
```

- ✅ POST /duels/solo → 201
- ✅ tay P0 thấy đủ 5 lá, tay P1 ẩn hết

## 3a. Xem duel là viewer 0

```http
GET /duels/50721bae-b4cc-4fac-a622-3204e5663281?viewer=0   (Authorization: Bearer <token>)
```

Response **200**:

```json
{
  "view": {
    "matchId": "50721bae-b4cc-4fac-a622-3204e5663281",
    "version": 1,
    "viewerIndex": 0,
    "ruleset": {
      "startingLP": 8000,
      "openingHandSize": 5,
      "handLimit": 6,
      "firstTurnDraw": false,
      "firstTurnAttack": false,
      "deckMin": 40,
      "deckMax": 60,
      "copyLimit": 3,
      "extraDeckSize": 20,
      "extraMonsterZones": 0,
      "fieldSpellReplace": true,
      "chainPrompt": "ask",
      "turnTimerSec": null,
      "afkLossThreshold": 3,
      "allowSurrender": true,
      "allowTrapActivationFromHand": false,
      "trapSetTurnDelay": true
    },
    "turnCount": 1,
    "turnPlayerIndex": 0,
    "phase": "Draw",
    "winnerIndex": null,
    "pendingPrompt": null,
    "chain": [],
    "chainWindow": null,
    "players": [
      {
        "playerId": "f46734c4-0ec4-40de-8675-47a004d656c3:0",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": false,
            "instanceId": "p0-36",
            "definitionId": "SMP-013",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-40",
            "definitionId": "SMP-014",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-27",
            "definitionId": "SMP-010",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-41",
            "definitionId": "SMP-014",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-11",
            "definitionId": "SMP-004",
            "position": null,
            "ownerIndex": 0
          }
        ],
        "handCount": 5,
        "deckCount": 37,
        "extraDeckCount": 0,
        "extraDeck": [],
        "graveyard": [],
        "banished": [],
        "board": {
          "monsterZones": [
            null,
            null,
            null,
            null,
            null
          ],
          "spellTrapZones": [
            null,
            null,
            null,
            null,
            null
          ],
          "fieldZone": null
        },
        "hasNormalSummonedThisTurn": false
      },
      {
        "playerId": "f46734c4-0ec4-40de-8675-47a004d656c3:1",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": true,
            "instanceId": "p1-11",
            "ownerIndex": 1

… (cắt 1193 ký tự)
```

## 3b. Xem duel là viewer 1

```http
GET /duels/50721bae-b4cc-4fac-a622-3204e5663281?viewer=1   (Authorization: Bearer <token>)
```

Response **200**:

```json
{
  "view": {
    "matchId": "50721bae-b4cc-4fac-a622-3204e5663281",
    "version": 1,
    "viewerIndex": 1,
    "ruleset": {
      "startingLP": 8000,
      "openingHandSize": 5,
      "handLimit": 6,
      "firstTurnDraw": false,
      "firstTurnAttack": false,
      "deckMin": 40,
      "deckMax": 60,
      "copyLimit": 3,
      "extraDeckSize": 20,
      "extraMonsterZones": 0,
      "fieldSpellReplace": true,
      "chainPrompt": "ask",
      "turnTimerSec": null,
      "afkLossThreshold": 3,
      "allowSurrender": true,
      "allowTrapActivationFromHand": false,
      "trapSetTurnDelay": true
    },
    "turnCount": 1,
    "turnPlayerIndex": 0,
    "phase": "Draw",
    "winnerIndex": null,
    "pendingPrompt": null,
    "chain": [],
    "chainWindow": null,
    "players": [
      {
        "playerId": "f46734c4-0ec4-40de-8675-47a004d656c3:0",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": true,
            "instanceId": "p0-36",
            "ownerIndex": 0
          },
          {
            "hidden": true,
            "instanceId": "p0-40",
            "ownerIndex": 0
          },
          {
            "hidden": true,
            "instanceId": "p0-27",
            "ownerIndex": 0
          },
          {
            "hidden": true,
            "instanceId": "p0-41",
            "ownerIndex": 0
          },
          {
            "hidden": true,
            "instanceId": "p0-11",
            "ownerIndex": 0
          }
        ],
        "handCount": 5,
        "deckCount": 37,
        "extraDeckCount": 0,
        "graveyard": [],
        "banished": [],
        "board": {
          "monsterZones": [
            null,
            null,
            null,
            null,
            null
          ],
          "spellTrapZones": [
            null,
            null,
            null,
            null,
            null
          ],
          "fieldZone": null
        },
        "hasNormalSummonedThisTurn": false
      },
      {
        "playerId": "f46734c4-0ec4-40de-8675-47a004d656c3:1",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": false,
            "instanceId": "p1-11",
            "definitionId": "SMP-004",
            "position": null,
            "ownerIndex": 1
          },
          {
            "hidden": false,
            "instanceId": "p1-34",
            "definitionId": "SMP-012",
            "position": null,
            "ownerIndex": 1
          },
          {
            "hidden": false,
            "instanceId": "p1-6",
            "definitionId": "SMP-003",

… (cắt 1102 ký tự)
```

- ✅ response viewer 0 không lộ definitionId của tay P1
- ✅ response viewer 1 không lộ definitionId của tay P0
- ✅ response tạo duel (viewer 0) không lộ tay P1
- ✅ grep thô: definitionId chỉ có trong tay P1 không xuất hiện trong response viewer 0 — đã kiểm 2 id; trùng: không
- ✅ response không chứa rng / actionLog
- ✅ GET viewer 0 có legalActions [EndPhase, Surrender]; viewer 1 (không đến lượt) chỉ [Surrender] — EndPhase,Surrender | Surrender
- ✅ legalActions không chứa definitionId
- ✅ POST /duels/solo trả legalActions của viewer 0

## 4a. Action hợp lệ: P0 EndPhase (Draw → Standby)

```http
POST /duels/50721bae-b4cc-4fac-a622-3204e5663281/actions   (Authorization: Bearer <token>)
```

Request body:

```json
{ "playerIndex": 0, "action": { "type": "EndPhase", "payload": { "playerIndex": 0 } } }
```

Response **200**:

```json
{
  "view": {
    "matchId": "50721bae-b4cc-4fac-a622-3204e5663281",
    "version": 2,
    "viewerIndex": 0,
    "ruleset": {
      "startingLP": 8000,
      "openingHandSize": 5,
      "handLimit": 6,
      "firstTurnDraw": false,
      "firstTurnAttack": false,
      "deckMin": 40,
      "deckMax": 60,
      "copyLimit": 3,
      "extraDeckSize": 20,
      "extraMonsterZones": 0,
      "fieldSpellReplace": true,
      "chainPrompt": "ask",
      "turnTimerSec": null,
      "afkLossThreshold": 3,
      "allowSurrender": true,
      "allowTrapActivationFromHand": false,
      "trapSetTurnDelay": true
    },
    "turnCount": 1,
    "turnPlayerIndex": 0,
    "phase": "Standby",
    "winnerIndex": null,
    "pendingPrompt": null,
    "chain": [],
    "chainWindow": null,
    "players": [
      {
        "playerId": "f46734c4-0ec4-40de-8675-47a004d656c3:0",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": false,
            "instanceId": "p0-36",
            "definitionId": "SMP-013",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-40",
            "definitionId": "SMP-014",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-27",
            "definitionId": "SMP-010",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-41",
            "definitionId": "SMP-014",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-11",
            "definitionId": "SMP-004",
            "position": null,
            "ownerIndex": 0
          }
        ],
        "handCount": 5,
        "deckCount": 37,
        "extraDeckCount": 0,
        "extraDeck": [],
        "graveyard": [],
        "banished": [],
        "board": {
          "monsterZones": [
            null,
            null,
            null,
            null,
            null
          ],
          "spellTrapZones": [
            null,
            null,
            null,
            null,
            null
          ],
          "fieldZone": null
        },
        "hasNormalSummonedThisTurn": false
      },
      {
        "playerId": "f46734c4-0ec4-40de-8675-47a004d656c3:1",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": true,
            "instanceId": "p1-11",
            "ownerIndex": 1

… (cắt 1348 ký tự)
```

- ✅ EndPhase hợp lệ → 200, phase Standby, version tăng
- ✅ POST action trả legalActions của người gửi (sau EndPhase vẫn [EndPhase, Surrender]) — EndPhase,Surrender
- ✅ lượt 1: P0 không rút bài khi rời Draw (deck không giảm)

## 4b. Action sai luật: P1 EndPhase trong lượt P0

```http
POST /duels/50721bae-b4cc-4fac-a622-3204e5663281/actions   (Authorization: Bearer <token>)
```

Request body:

```json
{ "playerIndex": 1, "action": { "type": "EndPhase", "payload": { "playerIndex": 1 } } }
```

Response **409**:

```json
{
  "statusCode": 409,
  "code": "ACTION_REJECTED",
  "message": "EndPhase rejected: only the turn player may end the phase.",
  "engineCode": "NOT_TURN_PLAYER"
}
```

- ✅ action sai luật (P1 EndPhase) KHÔNG nằm trong legalActions của P1 — Surrender
- ✅ sai lượt → 409 ACTION_REJECTED + engineCode NOT_TURN_PLAYER
- ✅ state không đổi sau lỗi 409 (version giữ nguyên)

## 4c. Payload méo: zoneIndex = 9

```http
POST /duels/50721bae-b4cc-4fac-a622-3204e5663281/actions   (Authorization: Bearer <token>)
```

Request body:

```json
{
  "playerIndex": 0,
  "action": {
    "type": "NormalSummon",
    "payload": { "playerIndex": 0, "cardInstanceId": "p0-1", "zoneIndex": 9 }
  }
}
```

Response **400**:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_FAILED",
  "message": "Request validation failed.",
  "issues": [
    {
      "path": "action.payload.zoneIndex",
      "message": "Number must be less than or equal to 4"
    }
  ]
}
```

- ✅ payload méo → 400 VALIDATION_FAILED có issues (không phải 500)
- ✅ client gửi Draw → 403 FORBIDDEN_ACTION

## 5a. Guest khác xem duel của người ta

```http
GET /duels/50721bae-b4cc-4fac-a622-3204e5663281?viewer=0   (Authorization: Bearer <token>)
```

Response **403**:

```json
{
  "statusCode": 403,
  "code": "NOT_OWNER",
  "message": "You cannot view this seat of the duel."
}
```

- ✅ guest khác → 403 NOT_OWNER

## 5b. Không token

```http
GET /duels/50721bae-b4cc-4fac-a622-3204e5663281?viewer=0
```

Response **401**:

```json
{
  "statusCode": 401,
  "message": "Missing bearer token.",
  "error": "Unauthorized"
}
```

- ✅ không token → 401

## 6. Fusion — tạo duel có Extra Deck

```http
POST /duels/solo   (Authorization: Bearer <token>)
```

Request body:

```json
{
  "deck": [
    "SMP-116",
    "SMP-116",
    "SMP-116",
    "SMP-001",
    "SMP-001",
    "SMP-001",
    "SMP-007",
    "SMP-007",
    "SMP-007",
    "SMP-004",
    "SMP-004",
    "SMP-004",
    "SMP-010",
    "SMP-010",
    "SMP-010",
    "SMP-013",
    "SMP-013",
    "SMP-013",
    "SMP-006",
    "SMP-006",
    "SMP-006",
    "SMP-009",
    "SMP-009",
    "SMP-009",
    "SMP-019",
    "SMP-019",
    "SMP-209",
    "SMP-209",
    "SMP-202",
    "SMP-202",
    "SMP-101",
    "SMP-101",
    "SMP-008",
    "SMP-008",
    "SMP-008",
    "SMP-012",
    "SMP-012",
    "SMP-012",
    "SMP-017",
    "SMP-017"
  ],
  "extraDeck": ["SMP-045", "SMP-045", "SMP-046", "SMP-047", "SMP-047"]
}
```

Response **201**:

```json
{
  "duelId": "4fddbf89-9d3d-46b7-bf42-0b4e733cd9e0",
  "mode": "solo-debug",
  "viewer": 0,
  "view": {
    "matchId": "4fddbf89-9d3d-46b7-bf42-0b4e733cd9e0",
    "version": 1,
    "viewerIndex": 0,
    "ruleset": {
      "startingLP": 8000,
      "openingHandSize": 5,
      "handLimit": 6,
      "firstTurnDraw": false,
      "firstTurnAttack": false,
      "deckMin": 40,
      "deckMax": 60,
      "copyLimit": 3,
      "extraDeckSize": 20,
      "extraMonsterZones": 0,
      "fieldSpellReplace": true,
      "chainPrompt": "ask",
      "turnTimerSec": null,
      "afkLossThreshold": 3,
      "allowSurrender": true,
      "allowTrapActivationFromHand": false,
      "trapSetTurnDelay": true
    },
    "turnCount": 1,
    "turnPlayerIndex": 0,
    "phase": "Draw",
    "winnerIndex": null,
    "pendingPrompt": null,
    "chain": [],
    "chainWindow": null,
    "players": [
      {
        "playerId": "f46734c4-0ec4-40de-8675-47a004d656c3:0",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": false,
            "instanceId": "p0-17",
            "definitionId": "SMP-013",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-11",
            "definitionId": "SMP-004",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-34",
            "definitionId": "SMP-008",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-9",
            "definitionId": "SMP-004",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-10",
            "definitionId": "SMP-004",
            "position": null,
            "ownerIndex": 0
          }
        ],
        "handCount": 5,
        "deckCount": 35,
        "extraDeckCount": 5,
        "extraDeck": [
          {
            "hidden": false,
            "instanceId": "p0-x0",
            "definitionId": "SMP-045",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-x1",
            "definitionId": "SMP-045",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-x2",
            "definitionId": "SMP-046",
            "position": null,
            "ownerIndex": 0
          },

… (cắt 4346 ký tự)
```

- ✅ Fusion: POST /duels/solo có extraDeck → 201 — 201
- ✅ Fusion: người tạo thấy Extra Deck của mình (đủ lá, có definitionId); ghế kia chỉ có số lượng
- ✅ Fusion: response viewer 0 không nhắc tới lá Extra Deck nào của P1
- ✅ Fusion: viewer 1 thấy Extra Deck của chính mình, không thấy của P0

## 6b. Extra Deck chứa lá không phải quái Dung hợp

```http
POST /duels/solo   (Authorization: Bearer <token>)
```

Request body:

```json
{ "extraDeck": ["SMP-001"] }
```

Response **400**:

```json
{
  "statusCode": 400,
  "code": "INVALID_DECK",
  "message": "The deck is not valid.",
  "errors": [
    {
      "seat": 0,
      "code": "EXTRA_NOT_FUSION",
      "definitionId": "SMP-001"
    },
    {
      "seat": 1,
      "code": "EXTRA_NOT_FUSION",
      "definitionId": "SMP-001"
    }
  ]
}
```

- ✅ Fusion: Extra Deck sai → 400 INVALID_DECK (EXTRA_NOT_FUSION) — 400
- ✅ Fusion: solo-vs-ai — ghế AI không có Extra Deck (extraDeckCount 0), ghế người có đủ — 201
- ✅ Fusion: server liệt kê ActivateEffect cho lá Phép dung hợp (SMP-116) trong legalActions — lượt 47

## 7a. Kích hoạt lá Phép dung hợp

```http
POST /duels/4fddbf89-9d3d-46b7-bf42-0b4e733cd9e0/actions   (Authorization: Bearer <token>)
```

Request body:

```json
{
  "type": "ActivateEffect",
  "payload": { "playerIndex": 0, "cardInstanceId": "p0-0", "effectId": "merging-crucible" }
}
```

Response **200**:

```json
{
  "view": {
    "matchId": "4fddbf89-9d3d-46b7-bf42-0b4e733cd9e0",
    "version": 323,
    "viewerIndex": 0,
    "ruleset": {
      "startingLP": 8000,
      "openingHandSize": 5,
      "handLimit": 6,
      "firstTurnDraw": false,
      "firstTurnAttack": false,
      "deckMin": 40,
      "deckMax": 60,
      "copyLimit": 3,
      "extraDeckSize": 20,
      "extraMonsterZones": 0,
      "fieldSpellReplace": true,
      "chainPrompt": "ask",
      "turnTimerSec": null,
      "afkLossThreshold": 3,
      "allowSurrender": true,
      "allowTrapActivationFromHand": false,
      "trapSetTurnDelay": true
    },
    "turnCount": 47,
    "turnPlayerIndex": 0,
    "phase": "Main1",
    "winnerIndex": null,
    "pendingPrompt": {
      "promptId": "fusion-47-322",
      "playerIndex": 0,
      "kind": "SelectFusionMonster",
      "payload": {
        "candidateInstanceIds": [
          "p0-x0",
          "p0-x1",
          "p0-x3",
          "p0-x4"
        ],
        "count": 1
      }
    },
    "chain": [
      {
        "linkId": "link-47-322",
        "playerIndex": 0,
        "card": {
          "hidden": false,
          "instanceId": "p0-0",
          "definitionId": "SMP-116",
          "position": null,
          "ownerIndex": 0
        },
        "source": {
          "zone": "Hand"
        },
        "effectId": "merging-crucible",
        "spellSpeed": 1,
        "targetInstanceIds": []
      }
    ],
    "chainWindow": {
      "priorityPlayer": 0,
      "passCount": 0
    },
    "players": [
      {
        "playerId": "f46734c4-0ec4-40de-8675-47a004d656c3:0",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": false,
            "instanceId": "p0-20",
            "definitionId": "SMP-006",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-5",
            "definitionId": "SMP-001",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-21",
            "definitionId": "SMP-009",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-3",
            "definitionId": "SMP-001",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-22",
            "definitionId": "SMP-009",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden
… (cắt 12347 ký tự)
```

- ✅ Fusion: sau khi kích hoạt → prompt SelectFusionMonster cho P0, payload chỉ có candidateInstanceIds + count — {"candidateInstanceIds":["p0-x0","p0-x1","p0-x3","p0-x4"],"count":1}
- ✅ Fusion: đối thủ (viewer 1) thấy có prompt nhưng payload = null, không thấy id Extra Deck của P0

## 7b. Trả lời "Chọn mục tiêu dung hợp"

```http
POST /duels/4fddbf89-9d3d-46b7-bf42-0b4e733cd9e0/actions   (Authorization: Bearer <token>)
```

Request body:

```json
{
  "type": "ResolvePendingPrompt",
  "payload": { "playerIndex": 0, "promptId": "fusion-47-322", "cardInstanceIds": ["p0-x0"] }
}
```

Response **200**:

```json
{
  "view": {
    "matchId": "4fddbf89-9d3d-46b7-bf42-0b4e733cd9e0",
    "version": 324,
    "viewerIndex": 0,
    "ruleset": {
      "startingLP": 8000,
      "openingHandSize": 5,
      "handLimit": 6,
      "firstTurnDraw": false,
      "firstTurnAttack": false,
      "deckMin": 40,
      "deckMax": 60,
      "copyLimit": 3,
      "extraDeckSize": 20,
      "extraMonsterZones": 0,
      "fieldSpellReplace": true,
      "chainPrompt": "ask",
      "turnTimerSec": null,
      "afkLossThreshold": 3,
      "allowSurrender": true,
      "allowTrapActivationFromHand": false,
      "trapSetTurnDelay": true
    },
    "turnCount": 47,
    "turnPlayerIndex": 0,
    "phase": "Main1",
    "winnerIndex": null,
    "pendingPrompt": {
      "promptId": "fusion-47-323",
      "playerIndex": 0,
      "kind": "SelectFusionMaterials",
      "payload": {
        "fusionInstanceId": "p0-x0",
        "candidateInstanceIds": [
          "p0-5",
          "p0-3",
          "p0-8"
        ],
        "count": 2
      }
    },
    "chain": [
      {
        "linkId": "link-47-322",
        "playerIndex": 0,
        "card": {
          "hidden": false,
          "instanceId": "p0-0",
          "definitionId": "SMP-116",
          "position": null,
          "ownerIndex": 0
        },
        "source": {
          "zone": "Hand"
        },
        "effectId": "merging-crucible",
        "spellSpeed": 1,
        "targetInstanceIds": []
      }
    ],
    "chainWindow": {
      "priorityPlayer": 0,
      "passCount": 0
    },
    "players": [
      {
        "playerId": "f46734c4-0ec4-40de-8675-47a004d656c3:0",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": false,
            "instanceId": "p0-20",
            "definitionId": "SMP-006",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-5",
            "definitionId": "SMP-001",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-21",
            "definitionId": "SMP-009",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-3",
            "definitionId": "SMP-001",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-22",
            "definitionId": "SMP-009",
            "position": null,
            "ownerIndex": 0
          },
          {

… (cắt 11557 ký tự)
```

- ✅ Fusion: → prompt SelectFusionMaterials (fusionInstanceId = quái đã chọn, count = số nguyên liệu của lá) — {"fusionInstanceId":"p0-x0","candidateInstanceIds":["p0-5","p0-3","p0-8"],"count":2}

## 7c. Trả lời "Chọn N nguyên liệu dung hợp"

```http
POST /duels/4fddbf89-9d3d-46b7-bf42-0b4e733cd9e0/actions   (Authorization: Bearer <token>)
```

Request body:

```json
{
  "type": "ResolvePendingPrompt",
  "payload": { "playerIndex": 0, "promptId": "fusion-47-323", "cardInstanceIds": ["p0-5", "p0-8"] }
}
```

Response **200**:

```json
{
  "view": {
    "matchId": "4fddbf89-9d3d-46b7-bf42-0b4e733cd9e0",
    "version": 325,
    "viewerIndex": 0,
    "ruleset": {
      "startingLP": 8000,
      "openingHandSize": 5,
      "handLimit": 6,
      "firstTurnDraw": false,
      "firstTurnAttack": false,
      "deckMin": 40,
      "deckMax": 60,
      "copyLimit": 3,
      "extraDeckSize": 20,
      "extraMonsterZones": 0,
      "fieldSpellReplace": true,
      "chainPrompt": "ask",
      "turnTimerSec": null,
      "afkLossThreshold": 3,
      "allowSurrender": true,
      "allowTrapActivationFromHand": false,
      "trapSetTurnDelay": true
    },
    "turnCount": 47,
    "turnPlayerIndex": 0,
    "phase": "Main1",
    "winnerIndex": null,
    "pendingPrompt": null,
    "chain": [],
    "chainWindow": null,
    "players": [
      {
        "playerId": "f46734c4-0ec4-40de-8675-47a004d656c3:0",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": false,
            "instanceId": "p0-20",
            "definitionId": "SMP-006",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-21",
            "definitionId": "SMP-009",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-3",
            "definitionId": "SMP-001",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-22",
            "definitionId": "SMP-009",
            "position": null,
            "ownerIndex": 0
          }
        ],
        "handCount": 4,
        "deckCount": 12,
        "extraDeckCount": 4,
        "extraDeck": [
          {
            "hidden": false,
            "instanceId": "p0-x1",
            "definitionId": "SMP-045",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-x2",
            "definitionId": "SMP-046",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-x3",
            "definitionId": "SMP-047",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-x4",
            "definitionId": "SMP-047",
            "position": null,
            "ownerIndex": 0
          }
        ],
        "graveyard": [
          {
            "hidden": false,
            "in
… (cắt 16609 ký tự)
```

- ✅ Fusion: → 200, đủ FusionMaterialSent rồi MonsterFusionSummoned (đúng quái đã chọn) — FusionMaterialSent,FusionMaterialSent,MonsterFusionSummoned,EffectResolved,CardSentToGraveyard,ChainResolved
- ✅ Fusion: quái Dung hợp nằm ngửa Tư thế Công trên sân; Extra Deck còn ít hơn 1; nguyên liệu trong mộ
- ✅ Fusion: không còn prompt nào treo
- ✅ Fusion: đối thủ thấy quái Dung hợp ngửa trên sân, vẫn không thấy danh sách Extra Deck của P0
- ✅ Fusion: response viewer 1 không lộ tay P0 và không nhắc lá nào còn trong Extra Deck của P0

## Tổng kết

**Tất cả 38 kiểm tra đạt.**
