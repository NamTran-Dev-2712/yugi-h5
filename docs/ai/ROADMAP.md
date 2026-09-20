# Roadmap

Trạng thái tick nhanh: `docs/ai/PROGRESS.md`. Kế hoạch chi tiết + task con: `docs/plan/MASTER-PLAN.md`.
File này chỉ định nghĩa tiêu chí "done" mức phase. (M0–M8 cũ đã được tái cấu trúc thành P0–P9 — xem ADR 2026-09-20.)

## P0 — Setup monorepo + tooling ✅ (= M0)

**Done khi**: `pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm build` xanh toàn workspace; `docker compose up -d`
chạy Postgres+Redis; `pnpm dev` chạy web+api; `/health` trả `{status:"ok", database:"ok"}`.

## P1 — Engine core (vanilla) (≈ M1)

**Done khi**: `RulesetConfig` (early Master Rule mặc định); Draw/Standby/Main1/Battle/Main2/End; `NormalSummon`/`SetMonster` + tribute; `ChangePosition`;
`DeclareAttack` + damage calc + flip; win/lose; hand limit. Test valid+invalid mỗi rule; golden replay + fuzz cơ bản xanh. Chưa effect.

## P2 — Vertical slice: solo vs AI dummy

**Done khi**: `POST /duels/solo` + `/actions`, StateView ẩn thông tin, AI dummy, guest token tối thiểu; FE Duel scene kéo thả Summon/Set/Attack/End,
LP + phase bar + log panel; Duel Sandbox (scenario JSON); i18n bootstrap. Chơi hết 1 ván qua `pnpm dev`; integration test xanh.

## P3 — Effect system + Chain (≈ M2)

**Done khi**: `EffectDefinition` (Zod) Trigger/Continuous/Ignition/Quick + `scriptId`; chain LIFO + Spell Speed; Set/Activate Spell/Trap;
10 card mẫu có test từng lá; FE Chain UI + prompt target. Xem `docs/design/effect-dsl.md`.

## P4 — Card batches + luật mở rộng

**Done khi**: Batch 1–3 (CSV → validate); Special Summon, Equip, Field, Counter Trap, Fusion (Ritual ngoài v1); test tự động mỗi lá.

## P5 — Asset pipeline + Card Gallery

**Done khi**: thả ảnh vào `assets/card-art-src/` → Gallery hiện đúng; `assets:validate/optimize/manifest` chạy; Duel/Hand dùng art thật, thiếu → placeholder.

## P6 — Animation + Audio (tier 1)

**Done khi**: `EventAnimationQueue` + animator cho mọi GameEvent chính; VFX lib; audio manager; Animation Preview + Replay Viewer; skip/speed; FPS đạt ngân sách.

## P7 — Auth + Deck Builder + Collection (≈ M6)

**Done khi**: guest → account giữ dữ liệu; Deck CRUD validate 40–60/≤3; Collection; Deck Builder UI; chọn deck trước duel; Match Result.

## P8 — AI rule-based (≈ M5)

**Done khi**: `AIPlayer` Easy/Normal hợp luật, dùng effect cơ bản; AI-vs-AI 100 ván seed cố định không crash/kẹt.

## P9 — PvP private + PvE nhẹ + Polish (≈ M7 + M8)

**Done khi**: room private, Socket.io, version sync + resync + reconnect, timeout/AFK; PvE chuỗi đối thủ AI; Settings + i18n hoàn thiện; polish tier 2 chọn lọc.
