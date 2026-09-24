# Task 2.4 — Smoke test HTTP thật

Sinh bởi `tools/smoke-http.ts` lúc 2026-09-24T04:51:33.679Z (API: http://localhost:3000). Token được rút gọn; view dài bị cắt khi in (kiểm tra rò rỉ chạy trên bản đầy đủ).

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
  "guestId": "4bf265b1-a999-4021-857e-b3dcce1851a3",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0YmYyNjViMS1hOTk5LTQwMjEtODU3ZS1iM2RjY2UxODUxYTMiLCJraW5kIjoiZ3Vlc3QiLCJpYXQiOjE3OTAyMjU0OTMsImV4cCI6MTc5MDI2ODY5M30.ASsXB6ewBJsaIImR50nl5xU-4xcLGhyVNwpjZo_GwR8"
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
  "duelId": "45d23561-d733-4940-b9c1-feb6eb78e8dd",
  "mode": "solo-debug",
  "viewer": 0,
  "view": {
    "matchId": "45d23561-d733-4940-b9c1-feb6eb78e8dd",
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
    "players": [
      {
        "playerId": "4bf265b1-a999-4021-857e-b3dcce1851a3:0",
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
            "instanceId": "p0-4",
            "definitionId": "SMP-002",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-38",
            "definitionId": "SMP-013",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-12",
            "definitionId": "SMP-005",
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
        "playerId": "4bf265b1-a999-4021-857e-b3dcce1851a3:1",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": true,
            "instanceId": "p1-29",
            "
… (cắt 3339 ký tự)
```

- ✅ POST /duels/solo → 201
- ✅ tay P0 thấy đủ 5 lá, tay P1 ẩn hết

## 3a. Xem duel là viewer 0

```http
GET /duels/45d23561-d733-4940-b9c1-feb6eb78e8dd?viewer=0   (Authorization: Bearer <token>)
```

Response **200**:

```json
{
  "view": {
    "matchId": "45d23561-d733-4940-b9c1-feb6eb78e8dd",
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
    "players": [
      {
        "playerId": "4bf265b1-a999-4021-857e-b3dcce1851a3:0",
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
            "instanceId": "p0-4",
            "definitionId": "SMP-002",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-38",
            "definitionId": "SMP-013",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-12",
            "definitionId": "SMP-005",
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
        "playerId": "4bf265b1-a999-4021-857e-b3dcce1851a3:1",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": true,
            "instanceId": "p1-29",
            "ownerIndex": 1
          },
          {
            "hidden": true,
            "instanceId
… (cắt 1126 ký tự)
```

## 3b. Xem duel là viewer 1

```http
GET /duels/45d23561-d733-4940-b9c1-feb6eb78e8dd?viewer=1   (Authorization: Bearer <token>)
```

Response **200**:

```json
{
  "view": {
    "matchId": "45d23561-d733-4940-b9c1-feb6eb78e8dd",
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
    "players": [
      {
        "playerId": "4bf265b1-a999-4021-857e-b3dcce1851a3:0",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": true,
            "instanceId": "p0-36",
            "ownerIndex": 0
          },
          {
            "hidden": true,
            "instanceId": "p0-4",
            "ownerIndex": 0
          },
          {
            "hidden": true,
            "instanceId": "p0-38",
            "ownerIndex": 0
          },
          {
            "hidden": true,
            "instanceId": "p0-12",
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
        "playerId": "4bf265b1-a999-4021-857e-b3dcce1851a3:1",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": false,
            "instanceId": "p1-29",
            "definitionId": "SMP-010",
            "position": null,
            "ownerIndex": 1
          },
          {
            "hidden": false,
            "instanceId": "p1-6",
            "definitionId": "SMP-003",
            "position": null,
            "ownerIndex": 1
          },
          {
            "hidden": false,
            "instanceId": "p1-12",
            "definitionId": "SMP-005",
            "position": null,
            "
… (cắt 1035 ký tự)
```

- ✅ response viewer 0 không lộ definitionId của tay P1
- ✅ response viewer 1 không lộ definitionId của tay P0
- ✅ response tạo duel (viewer 0) không lộ tay P1
- ✅ grep thô: definitionId chỉ có trong tay P1 không xuất hiện trong response viewer 0 — đã kiểm 3 id; trùng: không
- ✅ response không chứa rng / actionLog
- ✅ GET viewer 0 có legalActions [EndPhase, Surrender]; viewer 1 (không đến lượt) chỉ [Surrender] — EndPhase,Surrender | Surrender
- ✅ legalActions không chứa definitionId
- ✅ POST /duels/solo trả legalActions của viewer 0

## 4a. Action hợp lệ: P0 EndPhase (Draw → Standby)

```http
POST /duels/45d23561-d733-4940-b9c1-feb6eb78e8dd/actions   (Authorization: Bearer <token>)
```

Request body:

```json
{ "playerIndex": 0, "action": { "type": "EndPhase", "payload": { "playerIndex": 0 } } }
```

Response **200**:

```json
{
  "view": {
    "matchId": "45d23561-d733-4940-b9c1-feb6eb78e8dd",
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
    "players": [
      {
        "playerId": "4bf265b1-a999-4021-857e-b3dcce1851a3:0",
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
            "instanceId": "p0-4",
            "definitionId": "SMP-002",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-38",
            "definitionId": "SMP-013",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-12",
            "definitionId": "SMP-005",
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
        "playerId": "4bf265b1-a999-4021-857e-b3dcce1851a3:1",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": true,
            "instanceId": "p1-29",
            "ownerIndex": 1
          },
          {
            "hidden": true,
            "instanc
… (cắt 1262 ký tự)
```

- ✅ EndPhase hợp lệ → 200, phase Standby, version tăng
- ✅ POST action trả legalActions của người gửi (sau EndPhase vẫn [EndPhase, Surrender]) — EndPhase,Surrender
- ✅ lượt 1: P0 không rút bài khi rời Draw (deck không giảm)

## 4b. Action sai luật: P1 EndPhase trong lượt P0

```http
POST /duels/45d23561-d733-4940-b9c1-feb6eb78e8dd/actions   (Authorization: Bearer <token>)
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
POST /duels/45d23561-d733-4940-b9c1-feb6eb78e8dd/actions   (Authorization: Bearer <token>)
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
GET /duels/45d23561-d733-4940-b9c1-feb6eb78e8dd?viewer=0   (Authorization: Bearer <token>)
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
GET /duels/45d23561-d733-4940-b9c1-feb6eb78e8dd?viewer=0
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

## Tổng kết

**Tất cả 23 kiểm tra đạt.**
