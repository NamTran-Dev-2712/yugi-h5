# Progress

Cập nhật file này ở cuối MỌI task (xem quy trình trong `CLAUDE.md` root).

## Phase hiện tại: P0 (= M0) DONE — Planning xong, chờ duyệt, chuẩn bị P1

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

- **Planning (2026-09-20)**: bộ kế hoạch tổng thể xong trong `docs/plan/*` (11 file + `parity-board.md`), chờ người dùng duyệt.
  Chưa bắt đầu P1. Không bị chặn.

### Bàn giao cho task tiếp theo

- **Task đầu tiên (P1, task 1.1)**: `RulesetConfig` (Zod trong `packages/shared`) + `state.ruleset`, truyền qua `StartDuel`, kèm test. Chạy `/next-task` để chọn theo MASTER-PLAN.
- G1–G8/G11/G12 đã chốt (xem `docs/reference/notes/rules.md`); G9/G10 vẫn `[GUESS]` chờ tư liệu.
- Port Postgres/Redis đã đổi (5433/6380) — dùng `apps/api/.env.example` làm chuẩn.
- `apps/api` build bằng `tsc` trực tiếp (xem `docs/ai/DECISIONS.md`).
- Mỗi task kết thúc bằng Review Packet (`/review-packet`) và cập nhật `docs/plan/parity-board.md`.

## Checklist phase (P0–P9) — chi tiết task: `docs/plan/MASTER-PLAN.md`

- [x] P0 — Setup monorepo + tooling (= M0)
- [ ] P1 — Engine core vanilla + RulesetConfig + golden replay/fuzz
- [ ] P2 — Vertical slice: solo vs AI dummy (API + FE Duel + Sandbox)
- [ ] P3 — Effect system + Chain + 10 card mẫu
- [ ] P4 — Card batches + Special/Equip/Field/Counter/Fusion
- [ ] P5 — Asset pipeline + Card Gallery
- [ ] P6 — Animation + Audio tier 1 + Animation Preview + Replay Viewer
- [ ] P7 — Auth + Deck Builder + Collection
- [ ] P8 — AI rule-based
- [ ] P9 — PvP private + PvE nhẹ + Polish

Tiêu chí done từng phase: `docs/ai/ROADMAP.md`.
