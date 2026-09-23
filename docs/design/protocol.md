# Protocol Spec (client ↔ server)

## Nguyên tắc

- Server là nguồn sự thật. Client gửi **Action intent**, nhận về **GameEvent[] + StateView**.
- `StateView` = `GameState` đã lọc: ẩn `hand`/`deck` order của đối thủ, ẩn face-down card
  identity trừ khi đã lật. Việc lọc xảy ra ở `apps/api` (service layer), không phải trong
  `packages/game-engine`.
  Contract cụ thể: type `StateView`/`CardView` ở `packages/shared/src/duel/state-view.ts`; hàm `toStateView` ở `apps/api/src/modules/duels/state-view.ts`. Lá ẩn = `{hidden:true, instanceId, ownerIndex}` (không `definitionId`/`position`); tay đối thủ = toàn lá ẩn + `handCount`; deck/extra deck chỉ có count; `rng`/`chainStack` không gửi; Spell/Trap/Field của đối thủ ẩn trừ khi có position ngửa (fail-closed). Event lọc riêng bằng `toEventView` (xem dưới).
- Versioning: mọi `StateView` mang `version` (từ `GameState.version`). Client so sánh với
  version cục bộ; lệch → yêu cầu full re-sync thay vì áp partial update.

## Event gửi cho client (`EventView`)

Client chỉ nhận `EventView` (`packages/shared/src/duel/event-view.ts`), không bao giờ `GameEvent` thô. Gửi `eventsByViewer[i]` cho người chơi `i` (không gửi chéo). Event PUBLIC giữ nguyên shape engine; `CardDrawn` có dạng `{type, playerIndex, card: CardView}` — đối thủ nhận lá ẩn `{hidden:true, instanceId, ownerIndex}`. Bảng phân loại, bất biến engine và cách thêm event mới: [`event-visibility.md`](./event-visibility.md). Loại event chưa phân loại bị bỏ (deny by default).

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

**Chế độ `solo-debug`** (chưa có AI): guest tạo duel sở hữu **cả hai ghế** (playerIndex 0 và 1), tự gửi action cho từng ghế và chọn `viewer` khi xem. Người khác → `403 NOT_OWNER`. Ánh xạ guest → ghế nằm ở `apps/api/src/modules/duels/duel-access.ts` (thêm `solo-vs-ai`/`pvp` = thêm nhánh ở đó). Engine `playerIds` = `["<guestId>:0", "<guestId>:1"]`.

| Endpoint                             | Body / query                                                                                                                                            | Trả về                                                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /auth/guest` → `201`           | (không)                                                                                                                                                 | `{ guestId, accessToken }` (JWT `sub=guestId`, `kind:"guest"`, TTL env `GUEST_TOKEN_TTL`, mặc định 12h)                                           |
| `POST /duels/solo` → `201`           | `{ deck?: string[], decks?: [string[], string[]], viewer?: 0 \| 1 }` (không có `deck`/`decks` = starter deck; không được gửi cả hai; key lạ bị từ chối) | `{ duelId, mode: "solo-debug", viewer, view, events }` — `events` gồm `DuelStarted` + 10 `CardDrawn` (5 của đối thủ là lá ẩn) đã lọc cho `viewer` |
| `GET /duels/:id?viewer=0\|1` → `200` | `viewer` mặc định 0                                                                                                                                     | `{ view }`                                                                                                                                        |
| `POST /duels/:id/actions` → `200`    | `{ playerIndex: 0 \| 1, action: { type, payload: { playerIndex, ... } } }`                                                                              | `{ view, events }` — view và events của ghế `playerIndex` (không bao giờ của ghế kia)                                                             |

Deck đi qua `validateDeck` (`packages/shared/src/deck/validate-deck.ts`: 40–60 lá, ≤3 bản/lá, lá phải có trong card data). Sai → `400 { code: "INVALID_DECK", errors: [{ seat, code: "TOO_FEW" | "TOO_MANY" | "TOO_MANY_COPIES" | "UNKNOWN_CARD", ... }] }`. Chỉ phần vỏ của `action` được kiểm ở HTTP (type thuộc danh sách action, `payload.playerIndex`); nội dung payload do engine kiểm.

Ví dụ:

```jsonc
// POST /duels/:id/actions  { "playerIndex": 0, "action": { "type": "EndPhase", "payload": { "playerIndex": 0 } } }
// 200
{ "view": { "viewerIndex": 0, "phase": "Standby", "version": 2 /* ... */ },
  "events": [ { "type": "PhaseChanged" /* ... */ } ] }

// Sai lượt: 409, state không đổi
{ "statusCode": 409, "code": "ACTION_REJECTED", "message": "...", "engineCode": "NOT_TURN_PLAYER" }
```

| HTTP | `code`                                                                                            | Nguồn                                                                                |
| ---- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 400  | `VALIDATION_FAILED` (+`issues[]`), `INVALID_DECK` (+`errors[]`), `INVALID_CONFIG`, `UNKNOWN_CARD` | body/query sai schema; deck sai                                                      |
| 401  | (không có `code`)                                                                                 | thiếu/sai/hết hạn token                                                              |
| 403  | `NOT_OWNER`, `PLAYER_MISMATCH`, `FORBIDDEN_ACTION`                                                | không phải chủ duel; `playerIndex` envelope ≠ payload; client gửi `StartDuel`/`Draw` |
| 404  | `DUEL_NOT_FOUND`                                                                                  | id lạ                                                                                |
| 409  | `ACTION_REJECTED` + `engineCode`                                                                  | engine từ chối (luật)                                                                |
| 413  |                                                                                                   | body > 100kb                                                                         |
| 500  | `INTERNAL_ERROR`                                                                                  | lỗi lạ; message chung, không stack, state không đổi                                  |

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
