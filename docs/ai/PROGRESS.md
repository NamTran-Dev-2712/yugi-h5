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

- **Task 1.1 ✅ xong và đã duyệt** (`RulesetConfig` + `state.ruleset`). Bộ plan `docs/plan/*` đã duyệt.
- **Task 1.2 chưa bắt đầu — đang chờ ingest tư liệu video** (xem mục bàn giao bên dưới).

### Bàn giao cho session mới

- **VIỆC ĐẦU TIÊN: chạy `/ingest-reference` cho video trong `docs/reference/video/`** (video ~26 phút: "Yugi H5 Cách chơi Hero Anh Hùng cơ bản",
  1080p). **Chưa làm Task 1.2 trước khi ingest xong.** Quy trình: `ffmpeg -version` (thiếu → báo người dùng, không tự cài) → cắt frame vào
  `docs/reference/frames/` + bảng timestamp → `notes/layout-analysis.md` → ước lượng thời lượng animation → chuyển G tương ứng `[GUESS]` → `[REF]`
  (nêu chỗ chắc/không chắc; không bịa; mâu thuẫn với `[DECISION]` thì nêu ra chờ người dùng quyết). Video dài: lấy mẫu thưa trước, sau đó dày hơn
  quanh đoạn có hành động; cần đối chiếu đặc biệt: số lá mở đầu (5 hay 6), LP khởi đầu, lượt 1 draw/attack, flow tribute/attack/chain, timer.
- **Task tiếp theo sau ingest: 1.2** — `EndPhase` + phase transition + đổi lượt + luật lượt 1 (`firstTurnDraw/Attack`, đọc từ `state.ruleset`).
- Đã chốt sau duyệt 1.1: `openingHandSize = 5` (**[GUESS]** tới khi có `[REF]` từ video), `afkLossThreshold = 3`, `extraDeckSize = 15`.
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
