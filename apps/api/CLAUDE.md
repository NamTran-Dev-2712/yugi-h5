# apps/api

NestJS 11, server-authoritative. Mọi action ảnh hưởng game state (kể cả solo vs AI)
phải validate + chạy qua `@yugi/game-engine` ở server — client không tự đổi state.

Luật riêng:

- Validation dùng Zod (`nestjs-zod`), KHÔNG dùng `class-validator`. DTO/schema nên tái dùng
  Zod schema từ `@yugi/shared` khi contract đã định nghĩa ở đó.
- Import được: `@yugi/shared`, `@yugi/game-engine`. KHÔNG import từ `apps/web`.
- Card content (tên, stat, effect) không lưu DB — DB chỉ lưu User/Collection/Deck/MatchHistory.
  Xem `prisma/schema.prisma`.
- Mọi module mới thêm vào `app.module.ts`. Env var mới phải thêm vào `config/env.schema.ts`
  (Zod) trước, để app fail-fast khi thiếu config thay vì lỗi runtime giữa chừng.
- View gửi cho client phải ẩn thông tin đối thủ (bài trên tay, bài úp) — xử lý ở tầng
  API/service trước khi trả response/emit event, không phải ở engine.
- Mọi response/emit chứa game state phải đi qua `toStateView` (`modules/duels/state-view.ts`), không bao giờ gửi `GameState` thô. Mọi event gửi client phải là `EventView` (`toEventView`, `modules/duels/event-view.ts`): dùng `eventsByViewer[i]` cho người chơi `i`, không bao giờ `GameEvent` thô.
- Mọi thay đổi state duel đi qua `DuelService` (`modules/duels`), không gọi `applyAction` trực tiếp từ controller/gateway. `getDuel` trả `GameState` thô, không bao giờ trả cho client (dùng `getView`). Thêm `GameEvent` mới trong engine ⇒ `tsc` đỏ ở `event-view.ts`: phải phân loại (xem `docs/design/event-visibility.md`). Controller map `DuelServiceError.code` sang HTTP.
- Test dùng Vitest (không phải Jest mặc định của Nest CLI).
- HTTP duel (task 2.3): controller chỉ parse (Zod qua `ZodPipe`), kiểm quyền qua `duel-access.ts` (`assertMayControl`/`assertMayView` — nơi DUY NHẤT ánh xạ guest → ghế), gọi `DuelService`, trả `{view, events}` của đúng ghế. Không tự tính ghế trong controller; không trả `eventsByViewer` nguyên mảng; không trả `getDuel`. Session thiếu `mode`/`ownerId` = không ai truy cập được (fail closed). Thêm mã `DuelErrorCode` ⇒ cập nhật `STATUS` ở `duel-http.ts` (kiểu `Record` buộc phải đủ). App phải tạo bằng `{ bodyParser: false }` + `configureApp` (body limit, CORS); e2e dùng chung `configureApp`.
- Hình dạng `action` ở HTTP kiểm bằng `ActionInputSchema` của `@yugi/shared` (`duels.dto.ts`): méo → `400 VALIDATION_FAILED`, sai luật → `409` (engine). Assertion `PlayerActionMatchesEngine` ở `duels.dto.ts` giữ schema và `Action` của engine khớp nhau: thêm/đổi action ở engine ⇒ cập nhật `packages/shared/src/duel/action-schema.ts` (+ test) hoặc `tsc` đỏ. `StartDuel`/`Draw` vẫn lọt vỏ để trả 403.
- `legalActions` (task 2.5): mọi response state của duel (`POST solo`, `GET :id`, `POST actions`) kèm `legalActions` của **đúng ghế** trong response, lấy từ `DuelManager` (`legalActionsOf`/`getLegalActions`, gọi `getLegalActions` của engine với `cardDefinitions`), không tự tính ở controller và không trả ghế kia. Chỉ chứa id/ô/tư thế — không `definitionId`, không tay đối thủ (e2e quét rò rỉ). Là gợi ý cho client; server vẫn validate mọi action.
- AI `solo-vs-ai` (task 2.6): `modules/duels/ai/` — `chooseAction` là hàm THUẦN chỉ nhận `StateView` của ghế AI + `legalActions` + `cardDefinitions` + rng có seed; KHÔNG bao giờ truyền `GameState`/`getDuel` vào đó (test metamorphic "không nhìn trộm" phải xanh), không `Surrender`, không `Math.random`. Driver (`DuelManager.driveAi`) chạy TRONG khoá duel của request người, đi qua `applyAndSave` (đường duy nhất đổi state: engine → log → save), trần `MAX_AI_ACTIONS_PER_REQUEST` (→ `AI_LOOP_LIMIT`). Quyền ở `duel-access.ts`: ghế AI không điều khiển/không xem được. Response chỉ của ghế người: `events` = người rồi AI (đã lọc), `aiActions` cắt lát `events` theo từng action AI. Đổi luật AI = sửa `choose-action.ts`/`ai-config.ts` + test; đổi engine không cần sửa AI (nó chỉ chọn trong `legalActions`). Mô phỏng nặng (`ai/simulate.spec.ts`, mỗi ván vài giây) mặc định 3 ván/loại (chạy đồng bộ, >~60s làm vitest báo timeout RPC); bản dài chạy `AI_SIM_GAMES`/`AI_SIM_OFFSET`.
- Duel Sandbox (task 2.11, DEV): `modules/dev-sandbox/` chỉ được import qua `devOnlyModules(NODE_ENV)` ở `app.module.ts` (production ⇒ không route ⇒ 404; có e2e) — KHÔNG thêm dev tool khác vào `imports` trực tiếp, thêm vào `devOnlyModules`. `scenarioToState` (thuần) dựng `GameState` mà không sửa engine; test drift so với `StartDuel` phải xanh (engine thêm trường `GameState` ⇒ sửa hàm này). Session scenario có `initialState` (không `startAction`); replay dùng `initialStateOf`. Mọi action sau khi nạp đi qua `DuelService`/`applyAndSave` như duel thường.
- Vitest/esbuild không phát `emitDecoratorMetadata`: provider Nest chạy được dưới Vitest phải khai `@Inject(Token)` tường minh cho tham số constructor (đã làm với guard/controller/filter).
- Secret JWT: `JWT_ACCESS_SECRET` bắt buộc (min 16); ở `NODE_ENV=production` giá trị `change-me…` của `.env.example` bị từ chối lúc boot.
