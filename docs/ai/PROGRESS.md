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
  3. **1.4** ✅ xong (2026-09-21, chờ duyệt) — Tribute Summon/Set qua `tributeInstanceIds` (`[RULE]` lv5–6:1, lv7+:2), event `MonsterTributed`, ô giải phóng dùng lại được (ADR 2026-09-21). `PendingPrompt SelectTribute` (overlay/Hủy, C9/G2) tách sang task UI, không còn trong 1.4.
  4. **1.5** ✅ xong (2026-09-21, chờ duyệt) — `ChangePosition` (`toPosition` tường minh), event `PositionChanged`, dấu lượt theo quái `summonedTurn`/`positionChangedTurn`/`attackedTurn` trên `CardInstance` (ADR 2026-09-21). `attackedTurn` chỉ được đọc: `DeclareAttack` (1.6) phải ghi. Toàn bộ `[RULE]`, chưa có `[REF]`.
  5. **1.6** ✅ xong (2026-09-22, chờ duyệt) — `DeclareAttack`: direct attack, ATK-vs-ATK, ATK-vs-DEF theo `RULES-REVIEW-SHEET.md` (đã sửa lại brief ban đầu cho khớp dòng 29/33-34 đã duyệt), event `AttackDeclared`/`MonsterDestroyed`/`DamageDealt`, ghi `attackedTurn` (ADR 2026-09-22). Chưa xử lý win condition (LP=0) lúc đó. Lỗ hổng chủ đích: sân đối thủ chỉ có quái úp → không có action tấn công hợp lệ (chờ Flip ở task sau).
  6. **1.7** ✅ xong (2026-09-22, chờ duyệt) — Win condition LP ≤ 0: `checkLifePointsWinCondition` (`state/win-condition.ts`, tái dùng được), gọi từ `declare-attack.ts` sau khi build state cuối; `GameState.winnerIndex` mở rộng `0|1|'draw'|null` để biểu diễn hòa mà không đụng nghĩa "đang đấu" của `null`; event `DuelEnded {winnerIndex, reason: 'LP_ZERO'}` (ADR 2026-09-22). **Đổi số thứ tự task**: brief gọi win condition là "1.7" nên làm trước Flip-on-attack — Flip-on-attack đẩy xuống task kế tiếp (chưa đặt số).
  7. **1.8** ✅ xong (2026-09-23, chờ duyệt) — Flip-on-Attack: target face-down giờ hợp lệ, lật `DefenseDown → DefenseUp` trước damage calc (tái dùng nguyên logic ATK-vs-DEF task 1.6), event `MonsterFlipped` phát trước `MonsterDestroyed`/`DamageDealt`; xoá mã lỗi `TARGET_FACE_DOWN` (ADR 2026-09-23). Direct-attack condition xác nhận đã đúng từ 1.6/1.7, không cần sửa. Đóng lỗ hổng "sân đối thủ chỉ có quái úp → không tấn công được" từ 1.6. Chưa làm Flip Effect thật (chờ effect system P3).
  8. **1.9** ✅ xong (2026-09-23, chờ duyệt) — `Surrender`: bất kỳ bên nào, mọi phase (kể cả khi có prompt treo), chặn `DUEL_ENDED`/`SURRENDER_DISABLED`; đối thủ thắng; event `DuelEnded` thêm `reason: 'SURRENDER'` (không đổi shape). `allowSurrender=false` → `SURRENDER_DISABLED` (ADR 2026-09-23).
     8b. **Deck-out phát `DuelEnded` (1.10) + hand limit 6** — `[RULE]`. Nên tái dùng `checkLifePointsWinCondition`/pattern tương tự cho deck-out.
  9. **1.10 (số mới; trước là 1.9)** Golden replay + fuzz harness — không có luật riêng.

- Tư liệu còn thiếu (Set / đổi thế / Lật, màn thắng-thua, ảnh tab Dung Hợp) **không chặn** 1.4 — xem `parity-board.md`, `human-tasks.md`.
- **Củng cố trước 1.4 ✅ (2026-09-21, chờ duyệt)** — mutation test `summon.ts` (17 đột biến, 0 sống), 4 commit 1.2/1.3 đều xanh độc lập, `EngineError` + `expectEngineError`, `cardDefinitions` bắt buộc (ADR 2026-09-21). Lưu ý: `docs/reference/02-yugi-h5-mechanics.md` chưa có trong repo.
- **Task tiếp theo: Hand limit 6 + deck-out phát `DuelEnded`** (tái dùng `checkLifePointsWinCondition`-style helper cho deck-out).
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
