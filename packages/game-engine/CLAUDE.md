# packages/game-engine

Pure TypeScript rule engine. Public API is `applyAction(state, action, ctx) -> { state, events }`
exported from `src/index.ts` only — nothing else in this package is a stable contract.

Luật bất biến (không được vi phạm):

- KHÔNG import `phaser`, `@nestjs/*`, `socket.io`, hay bất kỳ Node/browser API nào (fs, fetch, DOM...).
- KHÔNG dùng `Math.random()` hay `Date.now()` — mọi randomness đi qua `rng/seeded-rng.ts`,
  mọi RNG state phải nằm trong `GameState` để replay được từ (seed + action log).
- State phải serialize được (JSON) — không class instance, không Map/Set trong GameState.
- Update state bằng cách tạo object mới (spread), không mutate trực tiếp.
- Thêm Action mới: xem `.claude/commands/new-action.md` ở root.
- Thêm effect: xem `docs/design/effect-dsl.md` và `.claude/commands/new-effect-type.md`.
- ESLint ở package này chặn cứng `Math.random()` và global `Date` — đừng disable rule để "cho nhanh".
