# Backend Plan

Nguyên tắc: server là nguồn sự thật (CLAUDE.md #2); DB chỉ lưu User/Collection/Deck/MatchHistory/Progress (#5); auth guest+account JWT (#6).
Contract chi tiết: `docs/design/protocol.md`.

## Làm sớm vs sau

| Hạng mục                                           | Phase | Vì sao                                    |
| -------------------------------------------------- | ----- | ----------------------------------------- |
| `StateView` filter + DuelService + action log/seed | P2    | Cốt lõi vertical slice; anti-cheat từ đầu |
| Guest token tối thiểu                              | P2    | Cần định danh player; JWT đầy đủ ở P7     |
| Dev-endpoint (scenario/replay/anim)                | P2–P6 | Chỉ bật khi `NODE_ENV!=production`        |
| Auth đầy đủ, Deck/Collection                       | P7    | Cần sau khi có card + art + UI            |
| AI rule-based                                      | P8    | Cần effect (P3) xong                      |
| Rooms, Socket.io, reconnect                        | P9    | Phụ thuộc engine ổn định                  |
| Redis adapter, metrics nâng cao, backup tự động    | P9+   | Chỉ khi cần scale/deploy                  |

## Thành phần

| Mảng              | Kế hoạch                                                                                                                           | Phase |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Auth              | Guest → JWT access+refresh; register/login/upgrade giữ userId; refresh rotation; hash mật khẩu (argon2/bcrypt — hỏi trước khi cài) | P2/P7 |
| Decks/Collections | CRUD deck, validate dùng Zod chung (`packages/shared`); starter collection; không lưu card content trong DB                        | P7    |
| Duel session      | `DuelService`: create → load state → validate action (engine) → apply → persist log → trả `events + StateView`                     | P2    |
| Replay            | Lưu `seed, playerIds, deckLists, actionLog, rulesetConfig`; endpoint replay dev-only; xác minh deterministic                       | P2    |
| AI player         | `AIPlayer` interface (`chooseAction(view) → Action`); Dummy (P2) → Easy/Normal (P8) → dùng DSL-aware (P8.3)                        | P2/P8 |
| Matchmaking/Rooms | Room private bằng mã; không ranked/matchmaking công khai v1                                                                        | P9    |
| Realtime          | Socket.io namespace `/realtime`; `duel:join`, `duel:action`, `duel:state` (StateView + events + version)                           | P9    |
| Version/desync    | Mỗi StateView có `version`; client lệch → `duel:resync` full; server từ chối action sai `expectedVersion`                          | P9    |
| Reconnect         | Giữ session theo token; join lại nhận full StateView (không replay animation)                                                      | P9    |
| Timeout/AFK       | Turn timer `[GUESS]` (G7); hết giờ → auto `EndPhase`/thua theo config                                                              | P9    |
| Anti-cheat        | Validate toàn bộ ở server; `PendingPrompt` chỉ trả lời bởi đúng player; rate limit (throttler đã có); ẩn hand/deck/face-down       | P2+   |
| Observability     | Pino log có `matchId/userId/requestId`; metrics cơ bản (duels active, action latency) khi lên deploy                               | P7+   |
| Migration         | Prisma 6.x migrate; migration nhỏ theo task; seed script (starter deck/collection)                                                 | P7    |
| Seed card data    | Card ở `packages/shared` (không vào DB); DB chỉ tham chiếu `definitionId`                                                          | —     |
| CI/CD & deploy    | GitHub Actions: lint/typecheck/test/build; Dockerfile api + web (nginx); docker compose prod cho self-host                         | P9    |
| Backup            | `pg_dump` định kỳ (script + cron) khi có deploy thật                                                                               | P9+   |

## Thay đổi contract dự kiến (cập nhật `protocol.md` khi làm)

- `StateView` thêm `legalActions`/`legalTargets` (FE không suy luận luật).
- Action thêm `expectedVersion` (chống race/desync).
- `POST /duels/solo` nhận `rulesetConfig` (mặc định early Master Rule) và `deckId?`.

## Rủi ro

| Rủi ro                                    | Giảm                                                     |
| ----------------------------------------- | -------------------------------------------------------- |
| Lộ thông tin ẩn qua StateView/events      | Test filter riêng (P2.1) + event redaction cho đối thủ   |
| Action log không tái lập (nondeterminism) | Golden replay + fuzz từ P1; cấm `Math.random`/`Date.now` |
| State lớn/log dài                         | Lưu log (không snapshot); snapshot định kỳ nếu cần sau   |
