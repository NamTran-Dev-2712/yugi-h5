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
- **Task 1.1b ✅ xong (2026-09-21, chờ duyệt)** — áp dụng C1/C2/C3: `extraMonsterZones` (0, chỉ lưu), `extraDeckSize` 20, `StartDuel.payload.startingLP` ghi đè LP từng bên. C1–C4, C9, C10, C12 đã đóng (ADR 2026-09-21 trong `DECISIONS.md`). C2/C10 dựa trên giả thuyết.
- **Ingest video #1/#2 xong (2026-09-20)** — mâu thuẫn ở `docs/reference/notes/rules.md` + `rules-observed.md`.

### Bàn giao cho session mới

- **C11 đã chốt (2026-09-20)**: `[DECISION]` Trap phải Set mới kích hoạt, không từ tay; `[RULE]` Trap vừa Set chưa kích hoạt trong lượt đó; `[RULE]` Spell thường kích hoạt từ tay ở Main Phase. Đã thêm `allowTrapActivationFromHand` (false) + `trapSetTurnDelay` (true) vào `RulesetConfig` (shared, có test); hành vi engine ở task 3.4 (test `it.todo` ở `packages/game-engine/src/rules/trap-activation.test.ts`). Quan sát 15:17 → backlog `rules-observed.md`.
- **Task P1 còn lại** (nguồn: `docs/plan/MASTER-PLAN.md`; đọc `RULES-REVIEW-SHEET.md` + `rules-coverage.md` theo nhãn):
  1. **1.2** ✅ xong (2026-09-21, chờ duyệt) — `EndPhase`, `PhaseChanged`/`TurnChanged`; draw khi rời Draw phase (ADR 2026-09-21). `firstTurnAttack` chưa được dùng: `DeclareAttack` (1.6) phải đọc nó.
  2. **1.3** ✅ xong (2026-09-21, chờ duyệt) — `NormalSummon`/`SetMonster` lv 1–4, `resetTurnFlags`, `ActionContext.cardDefinitions` (ADR 2026-09-21).
  3. **1.4** Tribute + `PendingPrompt` SelectTribute — `[RULE]` lv5–6:1, lv7+:2; G2 `[DECISION]` Xác nhận/Hủy; C9 (overlay) còn mở.
  4. **1.5** `ChangePosition` — `[RULE]` không đổi khi vừa summon/set hoặc đã tấn công.
  5. **1.6** `DeclareAttack` — `[RULE]` ATK/DEF, direct, 1 lần/lượt, lượt 1 không attack.
  6. **1.7** Flip khi bị tấn công + damage step cơ bản — `[RULE]`; G6 `[DECISION]`.
  7. **1.8** Win/lose + `Surrender` + hand limit 6 — `[RULE]`; G11 `[DECISION]`.
  8. **1.9** Golden replay + fuzz harness — không có luật riêng.

- Tư liệu còn thiếu (Set / đổi thế / Lật, màn thắng-thua, ảnh tab Dung Hợp) **không chặn** 1.4 — xem `parity-board.md`, `human-tasks.md`.
- **Củng cố trước 1.4 ✅ (2026-09-21, chờ duyệt)** — mutation test `summon.ts` (17 đột biến, 0 sống), 4 commit 1.2/1.3 đều xanh độc lập, `EngineError` + `expectEngineError`, `cardDefinitions` bắt buộc (ADR 2026-09-21). Lưu ý: `docs/reference/02-yugi-h5-mechanics.md` chưa có trong repo.
- **Task tiếp theo: 1.4** — Tribute + `PendingPrompt` SelectTribute (mở rộng NormalSummon/SetMonster cho level ≥ 5; hiện đang bị từ chối với thông báo "Tribute").
- Đã chốt sau duyệt 1.1: `openingHandSize = 5` (**[REF]**, video #2 4/4 ván), `afkLossThreshold = 3`, `extraDeckSize = 20` (**[REF thấp, 1 nguồn]**, C3), `startingLP = 8000` (**[DECISION]**, C2/C10), `extraMonsterZones = 0` (C1).
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
