# Task 2.4 — Smoke test HTTP thật

Sinh bởi `tools/smoke-http.ts` lúc 2026-09-30T04:26:47.761Z (API: http://localhost:3100). Token được rút gọn; view dài bị cắt khi in (kiểm tra rò rỉ chạy trên bản đầy đủ).

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
  "guestId": "5a90575a-6662-4404-b91e-9b5c636494ab",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1YTkwNTc1YS02NjYyLTQ0MDQtYjkxZS05YjVjNjM2NDk0YWIiLCJraW5kIjoiZ3Vlc3QiLCJpYXQiOjE3OTA3NDI0MDcsImV4cCI6MTc5MDc4NTYwN30.AVzwqJ8WsC9B8UgzuruYooxRasqEBogBh2In5Xn-ep0"
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
  "duelId": "604171d0-f89d-45fa-a5c5-86498a4aec8f",
  "mode": "solo-debug",
  "viewer": 0,
  "view": {
    "matchId": "604171d0-f89d-45fa-a5c5-86498a4aec8f",
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
        "playerId": "5a90575a-6662-4404-b91e-9b5c636494ab:0",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": false,
            "instanceId": "p0-1",
            "definitionId": "SMP-001",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-36",
            "definitionId": "SMP-013",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-17",
            "definitionId": "SMP-006",
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
            "instanceId": "p0-3",
            "definitionId": "SMP-002",
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
        "playerId": "5a90575a-6662-4404-b91e-9b5c636494ab:1",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": true,

… (cắt 3377 ký tự)
```

- ✅ POST /duels/solo → 201
- ✅ tay P0 thấy đủ 5 lá, tay P1 ẩn hết

## 3a. Xem duel là viewer 0

```http
GET /duels/604171d0-f89d-45fa-a5c5-86498a4aec8f?viewer=0   (Authorization: Bearer <token>)
```

Response **200**:

```json
{
  "view": {
    "matchId": "604171d0-f89d-45fa-a5c5-86498a4aec8f",
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
        "playerId": "5a90575a-6662-4404-b91e-9b5c636494ab:0",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": false,
            "instanceId": "p0-1",
            "definitionId": "SMP-001",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-36",
            "definitionId": "SMP-013",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-17",
            "definitionId": "SMP-006",
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
            "instanceId": "p0-3",
            "definitionId": "SMP-002",
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
        "playerId": "5a90575a-6662-4404-b91e-9b5c636494ab:1",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": true,
            "instanceId": "p1-39",
            "ownerIndex": 1
          },
          {

… (cắt 1166 ký tự)
```

## 3b. Xem duel là viewer 1

```http
GET /duels/604171d0-f89d-45fa-a5c5-86498a4aec8f?viewer=1   (Authorization: Bearer <token>)
```

Response **200**:

```json
{
  "view": {
    "matchId": "604171d0-f89d-45fa-a5c5-86498a4aec8f",
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
        "playerId": "5a90575a-6662-4404-b91e-9b5c636494ab:0",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": true,
            "instanceId": "p0-1",
            "ownerIndex": 0
          },
          {
            "hidden": true,
            "instanceId": "p0-36",
            "ownerIndex": 0
          },
          {
            "hidden": true,
            "instanceId": "p0-17",
            "ownerIndex": 0
          },
          {
            "hidden": true,
            "instanceId": "p0-18",
            "ownerIndex": 0
          },
          {
            "hidden": true,
            "instanceId": "p0-3",
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
        "playerId": "5a90575a-6662-4404-b91e-9b5c636494ab:1",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": false,
            "instanceId": "p1-39",
            "definitionId": "SMP-014",
            "position": null,
            "ownerIndex": 1
          },
          {
            "hidden": false,
            "instanceId": "p1-3",
            "definitionId": "SMP-002",
            "position": null,
            "ownerIndex": 1
          },
          {
            "hidden": false,
            "instanceId": "p1-10",
            "definitionId": "SMP-004",

… (cắt 1075 ký tự)
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
POST /duels/604171d0-f89d-45fa-a5c5-86498a4aec8f/actions   (Authorization: Bearer <token>)
```

Request body:

```json
{ "playerIndex": 0, "action": { "type": "EndPhase", "payload": { "playerIndex": 0 } } }
```

Response **200**:

```json
{
  "view": {
    "matchId": "604171d0-f89d-45fa-a5c5-86498a4aec8f",
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
        "playerId": "5a90575a-6662-4404-b91e-9b5c636494ab:0",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": false,
            "instanceId": "p0-1",
            "definitionId": "SMP-001",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-36",
            "definitionId": "SMP-013",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-17",
            "definitionId": "SMP-006",
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
            "instanceId": "p0-3",
            "definitionId": "SMP-002",
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
        "playerId": "5a90575a-6662-4404-b91e-9b5c636494ab:1",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": true,
            "instanceId": "p1-39",
            "ownerIndex": 1
          },
          {

… (cắt 1321 ký tự)
```

- ✅ EndPhase hợp lệ → 200, phase Standby, version tăng
- ✅ POST action trả legalActions của người gửi (sau EndPhase vẫn [EndPhase, Surrender]) — EndPhase,Surrender
- ✅ lượt 1: P0 không rút bài khi rời Draw (deck không giảm)

## 4b. Action sai luật: P1 EndPhase trong lượt P0

```http
POST /duels/604171d0-f89d-45fa-a5c5-86498a4aec8f/actions   (Authorization: Bearer <token>)
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
POST /duels/604171d0-f89d-45fa-a5c5-86498a4aec8f/actions   (Authorization: Bearer <token>)
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
GET /duels/604171d0-f89d-45fa-a5c5-86498a4aec8f?viewer=0   (Authorization: Bearer <token>)
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
GET /duels/604171d0-f89d-45fa-a5c5-86498a4aec8f?viewer=0
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
