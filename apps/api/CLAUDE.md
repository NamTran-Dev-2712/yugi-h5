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
- Mọi response/emit chứa game state phải đi qua `toStateView` (`modules/duels/state-view.ts`), không bao giờ gửi `GameState` thô. Event chưa có filter — không phát `GameEvent` thô cho đối thủ khi task lọc event chưa xong.
- Mọi thay đổi state duel đi qua `DuelService` (`modules/duels`), không gọi `applyAction` trực tiếp từ controller/gateway. `submitAction` trả `events` thô, chỉ nội bộ — không forward cho đối thủ trước khi có event filter. `getDuel` trả `GameState` thô, không bao giờ trả cho client (dùng `getView`). Controller map `DuelServiceError.code` sang HTTP.
- Test dùng Vitest (không phải Jest mặc định của Nest CLI).
