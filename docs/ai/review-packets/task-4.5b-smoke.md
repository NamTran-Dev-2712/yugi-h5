# Task 2.4 — Smoke test HTTP thật

Sinh bởi `tools/smoke-http.ts` lúc 2026-10-04T06:20:08.966Z (API: http://localhost:3000). Token được rút gọn; view dài bị cắt khi in (kiểm tra rò rỉ chạy trên bản đầy đủ).

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
  "guestId": "61d1d934-02ea-4c33-b1d3-06c984712347",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2MWQxZDkzNC0wMmVhLTRjMzMtYjFkMy0wNmM5ODQ3MTIzNDciLCJraW5kIjoiZ3Vlc3QiLCJpYXQiOjE3OTEwOTQ4MDksImV4cCI6MTc5MTEzODAwOX0.cxStIUEvBXeicXz2wHnTgj2T9tVdZhiWiH_0YxgHnPM"
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
  "duelId": "eb3ed7d3-8c42-4586-a860-794bfaf0dd30",
  "mode": "solo-debug",
  "viewer": 0,
  "view": {
    "matchId": "eb3ed7d3-8c42-4586-a860-794bfaf0dd30",
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
        "playerId": "61d1d934-02ea-4c33-b1d3-06c984712347:0",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": false,
            "instanceId": "p0-29",
            "definitionId": "SMP-010",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-7",
            "definitionId": "SMP-003",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-18",
            "definitionId": "SMP-007",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-15",
            "definitionId": "SMP-006",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-33",
            "definitionId": "SMP-012",
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
        "playerId": "61d1d934-02ea-4c33-b1d3-06c984712347:1",
        "lifePoints": 8000,
        "hand": [
          {

… (cắt 3406 ký tự)
```

- ✅ POST /duels/solo → 201
- ✅ tay P0 thấy đủ 5 lá, tay P1 ẩn hết

## 3a. Xem duel là viewer 0

```http
GET /duels/eb3ed7d3-8c42-4586-a860-794bfaf0dd30?viewer=0   (Authorization: Bearer <token>)
```

Response **200**:

```json
{
  "view": {
    "matchId": "eb3ed7d3-8c42-4586-a860-794bfaf0dd30",
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
        "playerId": "61d1d934-02ea-4c33-b1d3-06c984712347:0",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": false,
            "instanceId": "p0-29",
            "definitionId": "SMP-010",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-7",
            "definitionId": "SMP-003",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-18",
            "definitionId": "SMP-007",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-15",
            "definitionId": "SMP-006",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-33",
            "definitionId": "SMP-012",
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
        "playerId": "61d1d934-02ea-4c33-b1d3-06c984712347:1",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": true,
            "instanceId": "p1-37",
            "ownerIndex": 1

… (cắt 1193 ký tự)
```

## 3b. Xem duel là viewer 1

```http
GET /duels/eb3ed7d3-8c42-4586-a860-794bfaf0dd30?viewer=1   (Authorization: Bearer <token>)
```

Response **200**:

```json
{
  "view": {
    "matchId": "eb3ed7d3-8c42-4586-a860-794bfaf0dd30",
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
        "playerId": "61d1d934-02ea-4c33-b1d3-06c984712347:0",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": true,
            "instanceId": "p0-29",
            "ownerIndex": 0
          },
          {
            "hidden": true,
            "instanceId": "p0-7",
            "ownerIndex": 0
          },
          {
            "hidden": true,
            "instanceId": "p0-18",
            "ownerIndex": 0
          },
          {
            "hidden": true,
            "instanceId": "p0-15",
            "ownerIndex": 0
          },
          {
            "hidden": true,
            "instanceId": "p0-33",
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
        "playerId": "61d1d934-02ea-4c33-b1d3-06c984712347:1",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": false,
            "instanceId": "p1-37",
            "definitionId": "SMP-013",
            "position": null,
            "ownerIndex": 1
          },
          {
            "hidden": false,
            "instanceId": "p1-20",
            "definitionId": "SMP-007",
            "position": null,
            "ownerIndex": 1
          },
          {
            "hidden": false,
            "instanceId": "p1-25",
            "definitionId": "SMP-009",

… (cắt 1102 ký tự)
```

- ✅ response viewer 0 không lộ definitionId của tay P1
- ✅ response viewer 1 không lộ definitionId của tay P0
- ✅ response tạo duel (viewer 0) không lộ tay P1
- ✅ grep thô: definitionId chỉ có trong tay P1 không xuất hiện trong response viewer 0 — đã kiểm 4 id; trùng: không
- ✅ response không chứa rng / actionLog
- ✅ GET viewer 0 có legalActions [EndPhase, Surrender]; viewer 1 (không đến lượt) chỉ [Surrender] — EndPhase,Surrender | Surrender
- ✅ legalActions không chứa definitionId
- ✅ POST /duels/solo trả legalActions của viewer 0

## 4a. Action hợp lệ: P0 EndPhase (Draw → Standby)

```http
POST /duels/eb3ed7d3-8c42-4586-a860-794bfaf0dd30/actions   (Authorization: Bearer <token>)
```

Request body:

```json
{ "playerIndex": 0, "action": { "type": "EndPhase", "payload": { "playerIndex": 0 } } }
```

Response **200**:

```json
{
  "view": {
    "matchId": "eb3ed7d3-8c42-4586-a860-794bfaf0dd30",
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
        "playerId": "61d1d934-02ea-4c33-b1d3-06c984712347:0",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": false,
            "instanceId": "p0-29",
            "definitionId": "SMP-010",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-7",
            "definitionId": "SMP-003",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-18",
            "definitionId": "SMP-007",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-15",
            "definitionId": "SMP-006",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-33",
            "definitionId": "SMP-012",
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
        "playerId": "61d1d934-02ea-4c33-b1d3-06c984712347:1",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": true,
            "instanceId": "p1-37",
            "ownerIndex": 1

… (cắt 1348 ký tự)
```

- ✅ EndPhase hợp lệ → 200, phase Standby, version tăng
- ✅ POST action trả legalActions của người gửi (sau EndPhase vẫn [EndPhase, Surrender]) — EndPhase,Surrender
- ✅ lượt 1: P0 không rút bài khi rời Draw (deck không giảm)

## 4b. Action sai luật: P1 EndPhase trong lượt P0

```http
POST /duels/eb3ed7d3-8c42-4586-a860-794bfaf0dd30/actions   (Authorization: Bearer <token>)
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
POST /duels/eb3ed7d3-8c42-4586-a860-794bfaf0dd30/actions   (Authorization: Bearer <token>)
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
GET /duels/eb3ed7d3-8c42-4586-a860-794bfaf0dd30?viewer=0   (Authorization: Bearer <token>)
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
GET /duels/eb3ed7d3-8c42-4586-a860-794bfaf0dd30?viewer=0
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
  "duelId": "b7a81c90-2d69-43fd-9315-36c5ca7c29d7",
  "mode": "solo-debug",
  "viewer": 0,
  "view": {
    "matchId": "b7a81c90-2d69-43fd-9315-36c5ca7c29d7",
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
        "playerId": "61d1d934-02ea-4c33-b1d3-06c984712347:0",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": false,
            "instanceId": "p0-18",
            "definitionId": "SMP-006",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-39",
            "definitionId": "SMP-017",
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
            "instanceId": "p0-33",
            "definitionId": "SMP-008",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-28",
            "definitionId": "SMP-202",
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
- ✅ Fusion: server liệt kê ActivateEffect cho lá Phép dung hợp (SMP-116) trong legalActions — lượt 5

## 7a. Kích hoạt lá Phép dung hợp

```http
POST /duels/b7a81c90-2d69-43fd-9315-36c5ca7c29d7/actions   (Authorization: Bearer <token>)
```

Request body:

```json
{
  "type": "ActivateEffect",
  "payload": { "playerIndex": 0, "cardInstanceId": "p0-2", "effectId": "merging-crucible" }
}
```

Response **200**:

```json
{
  "view": {
    "matchId": "b7a81c90-2d69-43fd-9315-36c5ca7c29d7",
    "version": 29,
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
    "turnCount": 5,
    "turnPlayerIndex": 0,
    "phase": "Main1",
    "winnerIndex": null,
    "pendingPrompt": {
      "promptId": "fusion-5-28",
      "playerIndex": 0,
      "kind": "SelectFusionMonster",
      "payload": {
        "candidateInstanceIds": [
          "p0-x3",
          "p0-x4"
        ],
        "count": 1
      }
    },
    "chain": [
      {
        "linkId": "link-5-28",
        "playerIndex": 0,
        "card": {
          "hidden": false,
          "instanceId": "p0-2",
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
        "playerId": "61d1d934-02ea-4c33-b1d3-06c984712347:0",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": false,
            "instanceId": "p0-18",
            "definitionId": "SMP-006",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-39",
            "definitionId": "SMP-017",
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
            "instanceId": "p0-33",
            "definitionId": "SMP-008",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-28",
            "definitionId": "SMP-202",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-23
… (cắt 4094 ký tự)
```

- ✅ Fusion: sau khi kích hoạt → prompt SelectFusionMonster cho P0, payload chỉ có candidateInstanceIds + count — {"candidateInstanceIds":["p0-x3","p0-x4"],"count":1}
- ✅ Fusion: đối thủ (viewer 1) thấy có prompt nhưng payload = null, không thấy id Extra Deck của P0

## 7b. Trả lời "Chọn mục tiêu dung hợp"

```http
POST /duels/b7a81c90-2d69-43fd-9315-36c5ca7c29d7/actions   (Authorization: Bearer <token>)
```

Request body:

```json
{
  "type": "ResolvePendingPrompt",
  "payload": { "playerIndex": 0, "promptId": "fusion-5-28", "cardInstanceIds": ["p0-x3"] }
}
```

Response **200**:

```json
{
  "view": {
    "matchId": "b7a81c90-2d69-43fd-9315-36c5ca7c29d7",
    "version": 30,
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
    "turnCount": 5,
    "turnPlayerIndex": 0,
    "phase": "Main1",
    "winnerIndex": null,
    "pendingPrompt": {
      "promptId": "fusion-5-29",
      "playerIndex": 0,
      "kind": "SelectFusionMaterials",
      "payload": {
        "fusionInstanceId": "p0-x3",
        "candidateInstanceIds": [
          "p0-18",
          "p0-23"
        ],
        "count": 2
      }
    },
    "chain": [
      {
        "linkId": "link-5-28",
        "playerIndex": 0,
        "card": {
          "hidden": false,
          "instanceId": "p0-2",
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
        "playerId": "61d1d934-02ea-4c33-b1d3-06c984712347:0",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": false,
            "instanceId": "p0-18",
            "definitionId": "SMP-006",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-39",
            "definitionId": "SMP-017",
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
            "instanceId": "p0-33",
            "definitionId": "SMP-008",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-28",
            "definitionId": "SMP-202",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden":
… (cắt 3513 ký tự)
```

- ✅ Fusion: → prompt SelectFusionMaterials (fusionInstanceId = quái đã chọn, count = số nguyên liệu của lá) — {"fusionInstanceId":"p0-x3","candidateInstanceIds":["p0-18","p0-23"],"count":2}

## 7c. Trả lời "Chọn N nguyên liệu dung hợp"

```http
POST /duels/b7a81c90-2d69-43fd-9315-36c5ca7c29d7/actions   (Authorization: Bearer <token>)
```

Request body:

```json
{
  "type": "ResolvePendingPrompt",
  "payload": { "playerIndex": 0, "promptId": "fusion-5-29", "cardInstanceIds": ["p0-18", "p0-23"] }
}
```

Response **200**:

```json
{
  "view": {
    "matchId": "b7a81c90-2d69-43fd-9315-36c5ca7c29d7",
    "version": 31,
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
    "turnCount": 5,
    "turnPlayerIndex": 0,
    "phase": "Main1",
    "winnerIndex": null,
    "pendingPrompt": null,
    "chain": [],
    "chainWindow": null,
    "players": [
      {
        "playerId": "61d1d934-02ea-4c33-b1d3-06c984712347:0",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": false,
            "instanceId": "p0-39",
            "definitionId": "SMP-017",
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
            "instanceId": "p0-33",
            "definitionId": "SMP-008",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-28",
            "definitionId": "SMP-202",
            "position": null,
            "ownerIndex": 0
          }
        ],
        "handCount": 4,
        "deckCount": 33,
        "extraDeckCount": 4,
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
            "ins
… (cắt 9155 ký tự)
```

- ✅ Fusion: → 200, đủ FusionMaterialSent rồi MonsterFusionSummoned (đúng quái đã chọn) — FusionMaterialSent,FusionMaterialSent,MonsterFusionSummoned,EffectResolved,CardSentToGraveyard,ChainResolved,EffectActivated,ChainLinkAdded,DamageDealt,EffectResolved,ChainResolved
- ✅ Fusion: quái Dung hợp nằm ngửa Tư thế Công trên sân; Extra Deck còn ít hơn 1; nguyên liệu trong mộ
- ✅ Fusion: không còn prompt nào treo
- ✅ Fusion: đối thủ thấy quái Dung hợp ngửa trên sân, vẫn không thấy danh sách Extra Deck của P0
- ✅ Fusion: response viewer 1 không lộ tay P0 và không nhắc lá nào còn trong Extra Deck của P0

## Tổng kết

**Tất cả 38 kiểm tra đạt.**
