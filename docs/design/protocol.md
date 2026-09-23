# Protocol Spec (client ↔ server)

## Nguyên tắc

- Server là nguồn sự thật. Client gửi **Action intent**, nhận về **GameEvent[] + StateView**.
- `StateView` = `GameState` đã lọc: ẩn `hand`/`deck` order của đối thủ, ẩn face-down card
  identity trừ khi đã lật. Việc lọc xảy ra ở `apps/api` (service layer), không phải trong
  `packages/game-engine`.
  Contract cụ thể: type `StateView`/`CardView` ở `packages/shared/src/duel/state-view.ts`; hàm `toStateView` ở `apps/api/src/modules/duels/state-view.ts`. Lá ẩn = `{hidden:true, instanceId, ownerIndex}` (không `definitionId`/`position`); tay đối thủ = toàn lá ẩn + `handCount`; deck/extra deck chỉ có count; `rng`/`chainStack` không gửi; Spell/Trap/Field của đối thủ ẩn trừ khi có position ngửa (fail-closed). **Event chưa lọc** (task sau).
- Versioning: mọi `StateView` mang `version` (từ `GameState.version`). Client so sánh với
  version cục bộ; lệch → yêu cầu full re-sync thay vì áp partial update.

## Lỗi tầng service (`DuelService`, task 2.2)

`DuelServiceError.code`: `DUEL_NOT_FOUND`, `INVALID_CONFIG`, `UNKNOWN_CARD`, `PLAYER_MISMATCH` (payload.playerIndex ≠ người gọi), `FORBIDDEN_ACTION` (client gửi `StartDuel`/`Draw`), `ACTION_REJECTED` (kèm `engineCode` = `EngineErrorCode`, state không đổi), `INTERNAL_ERROR`. Controller/gateway (2.3+) map các mã này sang HTTP/`duel:error`. Action của 1 duel xử lý tuần tự; log lưu action được chấp nhận + `version`. `submitAction` trả `{view (của người gửi), events (thô, nội bộ)}` — event filter là task sau.

## Mã lỗi Action & `legalActions` cho Trap (C11)

- Action bị reject trả `code` riêng để UI hiện đúng thông báo: `TRAP_NOT_SET` (Trap chưa Set trên sân), `TRAP_SET_THIS_TURN` (Trap vừa Set lượt này). Đi qua `duel:error` và response lỗi REST.
- `legalActions` trong `StateView` **không bao giờ** liệt kê "Kích hoạt" cho Trap trên tay (khi `allowTrapActivationFromHand=false`); Trap trên tay chỉ có "Set". Trap úp trên sân chỉ có "Kích hoạt" khi đã qua lượt Set (nếu `trapSetTurnDelay`).
- Spell thường trên tay vẫn có "Kích hoạt" ở Main Phase của mình.

## REST endpoints (M3+)

| Method                  | Path                      | Mô tả                                                            |
| ----------------------- | ------------------------- | ---------------------------------------------------------------- |
| `GET`                   | `/health`                 | Liveness + DB check (đã có từ M0)                                |
| `GET`                   | `/cards`                  | List CardDefinition (đã có từ M0, dùng sample data tới M2)       |
| `POST`                  | `/auth/guest`             | Tạo guest User + JWT                                             |
| `POST`                  | `/auth/register`          | Đăng ký account (email/password)                                 |
| `POST`                  | `/auth/login`             | Login, trả access + refresh token                                |
| `POST`                  | `/auth/refresh`           | Đổi refresh token lấy access token mới                           |
| `POST`                  | `/auth/upgrade`           | Guest → Account (giữ nguyên userId/collection)                   |
| `GET`                   | `/users/me`               | Profile hiện tại                                                 |
| `GET/POST/PATCH/DELETE` | `/decks`                  | CRUD deck (M6)                                                   |
| `GET`                   | `/collections/me`         | Card collection của user (M6)                                    |
| `POST`                  | `/duels/solo`             | Tạo duel session solo vs AI, trả `matchId` + `StateView` ban đầu |
| `POST`                  | `/duels/:matchId/actions` | Gửi 1 Action (fallback không dùng socket, dùng cho solo)         |

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
