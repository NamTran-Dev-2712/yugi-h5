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
- Test dùng Vitest (không phải Jest mặc định của Nest CLI).
