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

## legalActions (task 2.5)

- `getLegalActions(state, seat, ctx)` (`src/legal-actions.ts`, export từ `index.ts`) = ứng viên theo cấu trúc + lọc bằng dry-run `applyAction`. **KHÔNG sao chép luật vào đây** (không kiểm phase/lượt/Level/zone trống): luật nào cũng phải nằm ở handler; hàm này chỉ liệt kê "có thể thử gì". Thêm loại Action mới ⇒ thêm bộ sinh ứng viên trong `candidates()` + mở rộng `perturb`/`junk` ở `legal-actions.property.test.ts` (không có bộ sinh = action mới không bao giờ hiện trong list). Không sinh `Draw`/`StartDuel`. `Surrender` luôn có cho cả hai ghế khi engine chấp nhận.
- Effect (task 3.2): `effects/{filter,conditions,costs,targets}.ts` + `effects/operations/<kind>.ts` (1 file/operation, đăng ký ở `operations/index.ts`; thiếu kind ở `OperationKind` = `tsc` đỏ). `actions/handlers/activate-effect.ts` tách `prepare` (validate, KHÔNG đổi state) và `activate` (lá rời tay → trả cost → chốt target → đẩy `ChainLink` → settle, `version` +1 một lần); prompt `SelectEffectTarget` trả lời bằng `ResolvePendingPrompt` (kiểm lại toàn bộ trên state chưa đổi). Operation thuần, không tự bump `version`, chỉ chạy lúc chain resolve. Fixture test: `testing/effect-fixtures.ts`. Sửa/thêm kind ở `packages/shared` phải cập nhật `OPERATION_REGISTRY` (test đối chiếu `registry-sync.test.ts`).
- Chain (task 3.3): `effects/chain.ts` thuần (`pushLink`, `passPriority`, `settle`, `resolveChain`); `GameState.chainWindow` non-null ⇔ `chainStack` không rỗng. Link mới → ưu tiên sang đối thủ người kích hoạt; `settle` auto-pass người giữ ưu tiên không có activation hợp lệ (callback `hasLegalActivation` = dry-run `prepare` trên `effects/activation-candidates.ts`, KHÔNG chép luật); pass thứ hai liên tiếp resolve CẢ chain LIFO. Lá Phép nằm trong `ChainLink.card` tới khi vào mộ — mọi kiểm tra bảo toàn lá phải đếm cả `chainStack` (fuzz đã làm). Cửa sổ mở ⇒ `applyAction` chặn mọi action trừ `ActivateEffect`/`PassPriority`/`ResolvePendingPrompt`/`Surrender` (`CHAIN_WINDOW_OPEN`). Lá test Speed 2: `quickPlay()` ở `effect-fixtures.ts`, `QPH`/`QPK` ở `FUZZ_DEFS`, `G_QP_*` ở golden. Mutation: `tools/mutants-3.3.mjs`.
- Lá Set (task 3.4): `ActivateEffect` tìm lá ở tay rồi ô Phép/Bẫy của người gọi; lá Set kích hoạt **lật ngửa (`position: 'Attack'`) và ở lại ô**, `ChainLink.source = {zone:'SpellTrapZone', zoneIndex}`, `link.card` chỉ là bản sao — **đếm bảo toàn lá chỉ tính `link.card` khi `source.zone === 'Hand'`**. `resolveChain` gỡ lá khỏi ô sau link (bỏ qua nếu đã bị phá). Spell Speed: `effects/spell-speed.ts` (`effect.spellSpeed` tường minh thắng). Fixture: `trap()`, `mySpellTraps`/`oppSpellTraps` (phần tử thứ 3 = `setTurn`) ở `effect-fixtures.ts`; `TRB`/`TRK`/`TRC` ở `FUZZ_DEFS`; golden `set-trap-quickplay-counter-chain`. Lá Trap có effect ở sân đối thủ **giữ cửa sổ chain mở** — test cần chain resolve ngay thì dùng `TRAP_PLAIN`. Mutation: `tools/mutants-3.4.mjs`.
- Hiệu năng: đầy sân + tay 7 ≈ 15 ms (≈1100 dry-run). Nếu sau này ứng viên tăng nhiều (P3), cân nhắc thu hẹp bằng cấu trúc (không bằng luật) trước khi tối ưu.

## Golden replay + fuzz (task 1.12)

- **Golden**: `src/testing/golden/cases.ts` (chỉ chứa INPUT: start + danh sách action) → `src/__golden__/<case>.json` (baseline commit vào git: events từng bước, mã lỗi khi bị reject, final state). Test đỏ = hành vi engine đổi. Nếu đổi là chủ đích: xem diff JSON rồi ghi lại bằng `UPDATE_GOLDEN=1 pnpm --filter @yugi/game-engine test golden`. Thêm case = thêm 1 phần tử vào `GOLDEN_CASES` + chạy lệnh trên.
- **Fuzz**: `src/testing/fuzz/fuzz.ts` (`runFuzz({seed, steps})`). Mặc định 10 seed × 300 action trong suite thường; chạy dài: `FUZZ_SEEDS=1000 FUZZ_STEPS=1000 pnpm --filter @yugi/game-engine test fuzz`. Fail sẽ in seed + step + action log để reproduce. Lá bài mới ở P3+ nên bổ sung vào `FUZZ_DEFS`/generator.
- Bug do fuzz tìm ra ở rule cũ: KHÔNG sửa trong task đang làm; báo riêng.
