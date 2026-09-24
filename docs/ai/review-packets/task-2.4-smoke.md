# Task 2.4 — Smoke test HTTP thật

Sinh bởi `tools/smoke-http.ts` lúc 2026-09-24T04:14:26.435Z (API: http://localhost:3000). Token được rút gọn; view dài bị cắt khi in (kiểm tra rò rỉ chạy trên bản đầy đủ).

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
  "guestId": "da8c1d3b-e6ed-441e-8043-fdac55cd7f1a",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkYThjMWQzYi1lNmVkLTQ0MWUtODA0My1mZGFjNTVjZDdmMWEiLCJraW5kIjoiZ3Vlc3QiLCJpYXQiOjE3OTAyMjMyNjYsImV4cCI6MTc5MDI2NjQ2Nn0.jZkMtThleKi2O1OIFreuSAtl3Y3xa1eelioGccw0W1I"
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
  "duelId": "99cb200d-10ff-41c3-90fb-bffc7909cfd1",
  "mode": "solo-debug",
  "viewer": 0,
  "view": {
    "matchId": "99cb200d-10ff-41c3-90fb-bffc7909cfd1",
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
        "playerId": "da8c1d3b-e6ed-441e-8043-fdac55cd7f1a:0",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": false,
            "instanceId": "p0-2",
            "definitionId": "SMP-001",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-24",
            "definitionId": "SMP-009",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-10",
            "definitionId": "SMP-004",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-6",
            "definitionId": "SMP-003",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-7",
            "definitionId": "SMP-003",
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
        "playerId": "da8c1d3b-e6ed-441e-8043-fdac55cd7f1a:1",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": true,
            "instanceId": "p1-17",
            "ow
… (cắt 3126 ký tự)
```

- ✅ POST /duels/solo → 201
- ✅ tay P0 thấy đủ 5 lá, tay P1 ẩn hết

## 3a. Xem duel là viewer 0

```http
GET /duels/99cb200d-10ff-41c3-90fb-bffc7909cfd1?viewer=0   (Authorization: Bearer <token>)
```

Response **200**:

```json
{
  "view": {
    "matchId": "99cb200d-10ff-41c3-90fb-bffc7909cfd1",
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
        "playerId": "da8c1d3b-e6ed-441e-8043-fdac55cd7f1a:0",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": false,
            "instanceId": "p0-2",
            "definitionId": "SMP-001",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-24",
            "definitionId": "SMP-009",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-10",
            "definitionId": "SMP-004",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-6",
            "definitionId": "SMP-003",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-7",
            "definitionId": "SMP-003",
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
        "playerId": "da8c1d3b-e6ed-441e-8043-fdac55cd7f1a:1",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": true,
            "instanceId": "p1-17",
            "ownerIndex": 1
          },
          {
            "hidden": true,
            "instanceId":
… (cắt 916 ký tự)
```

## 3b. Xem duel là viewer 1

```http
GET /duels/99cb200d-10ff-41c3-90fb-bffc7909cfd1?viewer=1   (Authorization: Bearer <token>)
```

Response **200**:

```json
{
  "view": {
    "matchId": "99cb200d-10ff-41c3-90fb-bffc7909cfd1",
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
        "playerId": "da8c1d3b-e6ed-441e-8043-fdac55cd7f1a:0",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": true,
            "instanceId": "p0-2",
            "ownerIndex": 0
          },
          {
            "hidden": true,
            "instanceId": "p0-24",
            "ownerIndex": 0
          },
          {
            "hidden": true,
            "instanceId": "p0-10",
            "ownerIndex": 0
          },
          {
            "hidden": true,
            "instanceId": "p0-6",
            "ownerIndex": 0
          },
          {
            "hidden": true,
            "instanceId": "p0-7",
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
        "playerId": "da8c1d3b-e6ed-441e-8043-fdac55cd7f1a:1",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": false,
            "instanceId": "p1-17",
            "definitionId": "SMP-006",
            "position": null,
            "ownerIndex": 1
          },
          {
            "hidden": false,
            "instanceId": "p1-0",
            "definitionId": "SMP-001",
            "position": null,
            "ownerIndex": 1
          },
          {
            "hidden": false,
            "instanceId": "p1-30",
            "definitionId": "SMP-011",
            "position": null,
            "ow
… (cắt 916 ký tự)
```

- ✅ response viewer 0 không lộ definitionId của tay P1
- ✅ response viewer 1 không lộ definitionId của tay P0
- ✅ response tạo duel (viewer 0) không lộ tay P1
- ✅ grep thô: definitionId chỉ có trong tay P1 không xuất hiện trong response viewer 0 — đã kiểm 3 id; trùng: không
- ✅ response không chứa rng / actionLog

## 4a. Action hợp lệ: P0 EndPhase (Draw → Standby)

```http
POST /duels/99cb200d-10ff-41c3-90fb-bffc7909cfd1/actions   (Authorization: Bearer <token>)
```

Request body:

```json
{ "playerIndex": 0, "action": { "type": "EndPhase", "payload": { "playerIndex": 0 } } }
```

Response **200**:

```json
{
  "view": {
    "matchId": "99cb200d-10ff-41c3-90fb-bffc7909cfd1",
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
        "playerId": "da8c1d3b-e6ed-441e-8043-fdac55cd7f1a:0",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": false,
            "instanceId": "p0-2",
            "definitionId": "SMP-001",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-24",
            "definitionId": "SMP-009",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-10",
            "definitionId": "SMP-004",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-6",
            "definitionId": "SMP-003",
            "position": null,
            "ownerIndex": 0
          },
          {
            "hidden": false,
            "instanceId": "p0-7",
            "definitionId": "SMP-003",
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
        "playerId": "da8c1d3b-e6ed-441e-8043-fdac55cd7f1a:1",
        "lifePoints": 8000,
        "hand": [
          {
            "hidden": true,
            "instanceId": "p1-17",
            "ownerIndex": 1
          },
          {
            "hidden": true,
            "instanceI
… (cắt 1052 ký tự)
```

- ✅ EndPhase hợp lệ → 200, phase Standby, version tăng
- ✅ lượt 1: P0 không rút bài khi rời Draw (deck không giảm)

## 4b. Action sai luật: P1 EndPhase trong lượt P0

```http
POST /duels/99cb200d-10ff-41c3-90fb-bffc7909cfd1/actions   (Authorization: Bearer <token>)
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

- ✅ sai lượt → 409 ACTION_REJECTED + engineCode NOT_TURN_PLAYER
- ✅ state không đổi sau lỗi 409 (version giữ nguyên)

## 4c. Payload méo: zoneIndex = 9

```http
POST /duels/99cb200d-10ff-41c3-90fb-bffc7909cfd1/actions   (Authorization: Bearer <token>)
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
GET /duels/99cb200d-10ff-41c3-90fb-bffc7909cfd1?viewer=0   (Authorization: Bearer <token>)
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
GET /duels/99cb200d-10ff-41c3-90fb-bffc7909cfd1?viewer=0
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

**Tất cả 18 kiểm tra đạt.**
