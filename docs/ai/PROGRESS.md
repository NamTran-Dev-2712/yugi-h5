# Progress

Cập nhật file này ở cuối MỌI task (xem quy trình trong `CLAUDE.md` root).

## Milestone hiện tại: M0 — Setup nền móng (DONE), chuẩn bị M1

### Đã xong (M0)

- Monorepo pnpm + turbo, tsconfig/eslint dùng chung (`packages/config`), husky + lint-staged.
- `packages/shared`: `CardDefinition` (Zod schema) + 5 sample card placeholder.
- `packages/game-engine`: skeleton `GameState`/`PlayerState`/`Zone`/`CardInstance`, seeded RNG
  (mulberry32), `applyAction` với `StartDuel` (shuffle + opening hand) và `Draw`. 6 test xanh.
- `apps/api` (NestJS 11): config Zod validate (fail-fast), Prisma (Postgres, migration `init`
  đã chạy), Pino logger, Swagger (`/docs`), global exception filter, throttler, health check
  thật (`/health` check DB). Module skeleton: auth/users/decks/collections/duels/matchmaking/
  realtime (rỗng, có comment mô tả milestone sẽ implement). `cards` module trả
  `SAMPLE_CARDS` từ shared.
- `apps/web` (Phaser 3 + Vite 7): Boot → Menu (hiển thị trạng thái kết nối API) → Duel scene
  (vẽ board 5+5 zone x2 player bằng placeholder rectangle). Zustand vanilla store cho view state.
- `docker-compose.yml`: Postgres (port **5433**, không phải 5432 — tránh đụng container khác
  trên máy dev) + Redis (port **6380**, chưa wire vào code).
- Verify thật: `pnpm install/lint/typecheck/test/build/dev` xanh toàn workspace;
  `/health` trả `{"status":"ok","database":"ok"}` với DB thật; Vite dev server load được,
  gọi `/health` thành công qua CORS.

### Đang làm / Bị chặn

- Không có gì đang làm dở. Không bị chặn.

### Bàn giao cho task tiếp theo

- **Task đề xuất đầu tiên của M1**: implement `NormalSummon` + `SetMonster` trong
  `packages/game-engine` (validate tribute theo level 1-4/5-6/7+, cập nhật zone, phát event),
  kèm test cho case hợp lệ + invalid. Xem `docs/design/engine.md` phần Action list.
- Port Postgres/Redis đã đổi so với mặc định — nhớ dùng `apps/api/.env.example` làm chuẩn,
  không hardcode 5432/6379 ở chỗ khác.
- `apps/api` build dùng `tsc` trực tiếp (không dùng `nest build`/`nest start --watch` — xem
  `docs/ai/DECISIONS.md` mục Nest CLI build).

## Checklist milestone (M0-M8)

- [x] M0 — Setup monorepo + tooling, lint/typecheck/test/build/dev xanh
- [ ] M1 — Engine core (state, phases, draw, summon/tribute, battle, win condition) + test
- [ ] M2 — Effect system + chain + 10 card mẫu placeholder
- [ ] M3 — API + DB + auth guest/account + duel session REST/WS solo với AI dummy
- [ ] M4 — FE Duel scene: kéo thả summon/attack, event animation queue
- [ ] M5 — AI rule-based
- [ ] M6 — Deck Builder + collection
- [ ] M7 — PvP real-time private
- [ ] M8 — Polish hiệu ứng/âm thanh/UX

Tiêu chí done chi tiết từng milestone: xem `docs/ai/ROADMAP.md`.
