# Roadmap

Trạng thái tick nhanh: xem `docs/ai/PROGRESS.md`. File này chỉ định nghĩa tiêu chí "done".

## M0 — Setup monorepo + tooling ✅

**Done khi**: `pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm build` xanh
toàn workspace; `docker compose up -d` chạy Postgres+Redis; `pnpm dev` chạy đồng thời web+api;
`/health` trả `{status:"ok", database:"ok"}` với DB thật; `.claude/` + `docs/ai/` +
`docs/design/` tồn tại đầy đủ.

## M1 — Engine core

**Done khi**: `packages/game-engine` implement đủ: Draw, Standby, Main1/2, Battle, End phase
transition; `NormalSummon`/`SetMonster` với tribute rule đúng theo level; `ChangePosition`;
`DeclareAttack` + damage calculation (ATK vs ATK, ATK vs DEF, face-down flip); win condition
(LP <= 0, deck-out). Mỗi rule có test Vitest cho case hợp lệ + case invalid. Không có effect
system (chỉ vanilla monster, không kích hoạt effect).

## M2 — Effect system + chain

**Done khi**: `EffectDefinition` DSL (trigger/condition/cost/target/operation) implement
được cả 4 loại (Trigger/Continuous/Ignition/Quick) + `scriptId` fallback; Chain stack hoạt
động đúng (LIFO resolve, Spell Speed 1/2/3 rule); 10 card placeholder (Monster + Spell + Trap)
dùng DSL, có test cho từng lá. Xem `docs/design/effect-dsl.md`.

## M3 — API + DB + Auth + Duel session (solo vs AI dummy)

**Done khi**: Guest login + Account register/login/refresh hoạt động qua REST; `DuelService`
wrap `applyAction` chạy solo vs 1 "AI" trả action ngẫu nhiên hợp lệ (chưa cần AI thật);
`DuelMatch` (seed + action log) lưu DB đúng; StateView ẩn thông tin đối thủ đúng. Có test
integration (Vitest + DB test) cho ít nhất luồng "tạo duel → draw → normal summon → end phase".

## M4 — FE Duel scene

**Done khi**: Board 5x2 render CardSprite thật (không còn placeholder rectangle); kéo bài từ
Hand vào Monster/Spell-Trap Zone gửi Action lên server; kéo monster sang bên đối thủ để tấn
công; toàn bộ animation chạy từ `GameEvent` nhận về (không có logic "optimistic update" tự
suy luận trước khi server xác nhận, trừ khi có ADR ghi rõ lý do).

## M5 — AI rule-based

**Done khi**: `AIPlayer` interface tách riêng khỏi `DuelService`; implementation rule-based
đưa ra quyết định hợp lý cho summon/tribute/attack/basic effect activation (không cần tối ưu,
chỉ cần hợp luật + không tự sát vô lý). Test: chơi được 1 ván đầy đủ solo vs AI không crash.

## M6 — Deck Builder + Collection

**Done khi**: CRUD Deck/DeckCard qua API, validate đúng luật (40-60 lá, tối đa 3 bản/lá);
CardCollection cho biết user sở hữu bao nhiêu bản mỗi definitionId; FE có màn hình deck
builder cơ bản (list card, thêm/bớt, validate ngay trên UI trước khi save).

## M7 — PvP real-time (private, bạn bè)

**Done khi**: `RealtimeModule` (Socket.io) xử lý duel room thật (không còn skeleton); 2
client kết nối, action của người này tạo event cho người kia qua socket, đồng bộ đúng version
number, xử lý reconnect cơ bản. Redis wire vào làm Socket.io adapter nếu chạy nhiều instance
(không bắt buộc cho 1 instance).

## M8 — Polish

**Done khi**: hiệu ứng/âm thanh cho các action chính (summon, attack, damage, chain) có ít
nhất 1 phiên bản; UX tổng thể chơi được mượt mà không cần đọc code để hiểu đang chờ gì
(loading state, turn indicator, prompt UI rõ ràng cho PendingPrompt).
