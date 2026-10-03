# Review Packet — Task 4.4c: vô hiệu triệu hồi đứng trước hiệu ứng "khi triệu hồi / lật" + Lá Trang bị đã úp

**Đã làm gì:** (A) Đổi thứ tự trong engine: sau khi triệu hồi (thường / hiến tế / lật), đối thủ được đáp lần triệu hồi
**trước**; hiệu ứng "khi được triệu hồi / lật" của quái chỉ lên chuỗi sau khi họ cho qua. Nhờ vậy quái có hiệu ứng "khi
triệu hồi" nay **vô hiệu triệu hồi được**, và khi bị vô hiệu thì hiệu ứng đó không xảy ra. (B) Lá Trang bị đã úp kích
hoạt được (trước đây bị từ chối). Engine-only: api / web **không đổi code chạy thật**, chỉ sửa / thêm test. Không có UI
mới nên không có ảnh.

**Cách xem (không cần đọc code):**

1. `pnpm --filter @yugi/game-engine test` (1022 test) — hoặc chỉ hai file luật mới:
   `pnpm --filter @yugi/game-engine exec vitest run src/rules/summon-window-order.test.ts src/rules/equip-set-activation.test.ts`.
2. Chơi thử: Docker → `docker compose up -d` → `pnpm dev` → `http://localhost:5173/dev/sandbox.html`, màn
   `trigger-optional-real`: máy nay dùng Bẫy **ngay khi bạn triệu hồi** (bạn mất 800 LP trước), rồi bạn mới được hỏi "Kích
   hoạt?". Màn `counter-summon-real` vẫn như cũ.

## 1. Trước / sau — thứ tự sự kiện của một ván mẫu

Tình huống: bạn Triệu hồi Thường quái có hiệu ứng bắt buộc "khi được triệu hồi: gây 300 sát thương"; đối thủ có **Cổng
Khước Từ** (vô hiệu triệu hồi) đã úp.

| Bước                           | Trước 4.4c                                                                                                                                                      | Từ 4.4c                                                                                                                                                       |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bạn triệu hồi                  | `NormalSummoned` → `EffectActivated` → `ChainLinkAdded` → `DamageDealt` 300 → `EffectResolved` → `ChainResolved`. Đối thủ **không được hỏi**, lá vô hiệu nằm im | `NormalSummoned`. Dừng lại: đối thủ được hỏi (cửa sổ triệu hồi)                                                                                               |
| Đối thủ chạm Cổng Khước Từ     | (không có bước này)                                                                                                                                             | `EffectActivated` → `ChainLinkAdded` → `SummonNegated` → `EffectResolved` → `CardSentToGraveyard` → `ChainResolved`. Quái vào mộ, **không có 300 sát thương** |
| …hoặc đối thủ bấm Bỏ qua       | (không có bước này)                                                                                                                                             | `EffectActivated` → `ChainLinkAdded` → `DamageDealt` 300 → `EffectResolved` → `ChainResolved` (kết quả như trước)                                             |
| Đối thủ **không có** lá úp nào | như dòng đầu                                                                                                                                                    | **y hệt trước** (không thêm bước, không thêm câu hỏi)                                                                                                         |

Nếu đối thủ có một Bẫy thường (không phải lá vô hiệu): họ được hỏi **hai lần liên tiếp** — lần 1 đáp lần triệu hồi, lần 2
đáp mắt xích hiệu ứng. Đúng luật, có test cho cả hai cách cho qua.

## 2. Golden đổi và vì sao

- **Golden cũ đổi: 0 / 22.** Không ca cũ nào có đồng thời "quái có hiệu ứng khi triệu hồi" và "đối thủ có lá đáp trả
  được", nên cả 22 file giữ nguyên từng byte (`git diff 5499ffb -- packages/game-engine/src/__golden__` chỉ có 3 file thêm).
- **Golden mới: 3** — `summon-negated-before-trigger`, `summon-window-then-trigger`, `equip-set-then-activate`.

## 3. Cách đọc 3 golden mới

Mở `packages/game-engine/src/__golden__/<tên>.json`, tìm `"steps"`; mỗi bước có `action` (ai làm gì) và `events` (chuyện
gì xảy ra) hoặc `errorCode` (bị từ chối).

- **`summon-negated-before-trigger`**: bước `NormalSummon` `p0-32` chỉ có `NormalSummoned`; bước kế (`ActivateEffect`
  `p1-16`) có `SummonNegated` và **không** có `DamageDealt`. Sau đó `FlipSummon` `p0-17` → hai lần `PassPriority` của
  người 1 → `DamageDealt` 400 (hiệu ứng Lật xảy ra vì họ cho qua). LP cuối: 8000 / 7600.
- **`summon-window-then-trigger`**: sau `NormalSummon`, `EndPhase` của người 0 bị từ chối `CHAIN_WINDOW_OPEN` (đang chờ đối
  thủ); `PassPriority` → `EffectActivated` + `ChainLinkAdded` (lúc này hiệu ứng mới lên chuỗi); đối thủ đáp bằng Bẫy 300 →
  hai `DamageDealt` 300 (bẫy trước, hiệu ứng sau). Rồi `FlipSummon` bị vô hiệu: không có sát thương Lật. LP cuối: 7700 / 7700.
- **`equip-set-then-activate`**: `SetSpellTrap` `p0-21` vào ô 3 → `ActivateEffect` bị từ chối `NO_VALID_TARGET` (chưa có
  quái) → triệu hồi → `ActivateEffect` có `CardEquipped` (cùng lượt vừa úp) → kích hoạt lần nữa bị `NOT_ACTIVATABLE`. Cuối
  ván quái bị phá, lá Trang bị theo vào mộ (`CardSentToGraveyard`; mộ người 0: `p0-31`, `p0-21`). Việc lá giữ nguyên ô 3
  được kiểm ở test `Set, then activated on the same turn…`, golden không ghi state giữa chừng.

## 4. `[GUESS]` / `[ASSUMED]` mới cần bạn duyệt — G25 (`docs/plan/fidelity-spec.md`)

| #   | Nội dung                                                                                                                                             | Trạng thái                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| (a) | Lần hỏi đầu nhận **mọi** lá đáp trả, nên Bẫy thường phá quái ngay lúc đó làm quái **mất** hiệu ứng "khi triệu hồi" (luật chuẩn: hiệu ứng vẫn xảy ra) | Bạn đã chọn qua hộp thoại 2026-10-03 ("theo brief") |
| (b) | Chuỗi dựng trong lần hỏi đầu xử lý xong rồi hiệu ứng "khi triệu hồi" mới lên chuỗi, đứng trước hiệu ứng do chính chuỗi đó sinh ra                    | **Chờ bạn** (dòng trống ở `RULES-REVIEW-SHEET.md`)  |
| (c) | Hiệu ứng tuỳ chọn bị từ chối sau lần hỏi đầu ⇒ không hỏi đối thủ lần nữa                                                                             | **Chờ bạn** (cùng dòng)                             |
| (d) | Lá Trang bị đã úp kích hoạt được ngay lượt vừa úp, lật tại ô đang úp                                                                                 | Trùng luật chuẩn; chưa có tư liệu bản gốc           |

`RULES-REVIEW-SHEET.md`: thêm 5 dòng (2 dòng thuần `[RULE]` AI duyệt thay; 2 dòng "chủ dự án chọn qua hộp thoại"; 1 dòng
trống — G25 b/c), sửa 2 dòng cũ (tên test + câu "giới hạn" đã gỡ).

**Số kiểm chứng thật:**

- Đỏ trước: `task-4.4c-red.txt` — 34 test engine đỏ trước khi sửa engine, 1 e2e api đỏ trước phần B.
- Test: shared **200** (=), engine **1022** (975 → +47), api **471** (466 → +5), web **675** (674 → +1). `pnpm lint` 4/4,
  `pnpm typecheck` 6/6, `pnpm build` 4/4. `pnpm test` thoát mã 1 vì lỗi RPC `onTaskUpdate` quen thuộc của api (mọi test xanh).
- Mutation: **20/20** bị bắt (`task-4.4c-mutants.txt`, `tools/mutants-4.4c.mjs`).
- Fuzz engine dài: 200 seed × 3 bộ bài (đầy đủ / thiên về vô hiệu / quái OnSummon-OnFlip + lá vô hiệu) × 400 bước,
  **620/620 test, 0 vi phạm** (`task-4.4c-fuzz-long.txt`). Độ phủ bộ bài mới (60 seed): 57 cửa sổ triệu hồi trước trigger,
  13 lần quái có trigger bị vô hiệu triệu hồi, 44 lần trigger lên sau cửa sổ.
- Fuzz chống rò api dài: 200 seed × 400 bước (+100 solo-vs-ai, +100 deck Field, +50 deck quái lật mới, +100 deck Negate, +50 deck Negate solo-vs-ai) — **603/603**, 207.018 bước, 1.174 duel, 0 vi phạm; `battleFlipTriggers` 244, `SummonNegated` 372 (vitest thoát mã 1 do lỗi RPC `onTaskUpdate` quen thuộc, mọi test xanh) (`task-4.4c-fuzz-leak.txt`).
- Mô phỏng AI 100 ván: `NEGATE_DEMO_DECK` **100/100** ván kết thúc ở cả ba kiểu; `EFFECT_DEMO_DECK` **100/100** ở cả hai kiểu, chạy thành 4 lô × 25 ván (lần chạy 100 ván một lượt bị timeout 600 s của test vì chạy song song với fuzz dài; chạy lại theo lô thì xanh hết) (`task-4.4c-ai-sim.txt`).
- Chạy thật (Docker + API thật ở `:3000`): smoke-http **23/23**, smoke-sandbox **71/71**, `play-vs-ai` mặc định **77/77**,
  `DECK=negate` **54/54** (1 lần `SummonNegated`), `DECK=effect` **95/95** (`task-4.4c-smoke-*.md`,
  `task-4.4c-play-vs-ai*.txt`). API chạy bằng `pnpm --filter @yugi/api start` (bản build), không bật web.

**Test cũ đã sửa và lý do:**

- Engine: 4 assert `toEqual` cửa sổ triệu hồi nay có thêm `summonEvent`; 3 test `trigger-effects` thêm bước "đối thủ cho
  qua"; test "known limit" của `negate-summon` đảo kết luận; 2 test "Equip đã Set: NOT_ACTIVATABLE (backlog)" nay kiểm hành
  vi mới.
- Api (không sửa code api): `duel-manager.ai-redact.spec.ts` ×2 — máy triệu hồi quái có hiệu ứng, người có Bẫy úp ⇒ người
  được hỏi trước, cho qua rồi máy mới trả lời; `duel-manager.scenario-real.spec.ts` (`trigger-optional-real`) — máy dùng Bẫy
  ở lần hỏi triệu hồi. Thêm e2e HTTP cho Equip đã úp. Thêm **variant fuzz thứ tư** (bộ bài quái lật, seed riêng): sau phần B,
  8 seed mặc định không còn chạm nhánh "quái bị lật do tấn công" vì danh sách nước đi đổi; không đổi seed / bộ bài cũ, không
  nới bộ kiểm rò.
- Web: thêm 1 test — chạm Lá Trang bị úp đi đúng đường "chạm để kích hoạt" chung. Không cần code web mới.

**Chưa làm / lệch kế hoạch (nói thẳng):**

- Các bất biến fuzz mới và 2 test "checker bắt engine hỏng" được viết **sau** khi phần A đã xanh (không có lượt đỏ riêng);
  3 test lá thật SMP-210 × SMP-019 / SMP-044 và test `owedSummonEvents` cũng thêm sau.
- `packages/game-engine/CLAUDE.md`: đã grep lại — **không có** câu "engine-only" nào về Negate (câu đó nằm ở
  `apps/api/CLAUDE.md`, nói về action / event engine-only, vẫn đúng). Đã sửa các câu thật sự lệch (thứ tự trigger ↔ cửa sổ,
  `runTriggers`, Equip đã Set) và gỡ dòng nhắc việc này khỏi `PROGRESS.md`.
- Ảnh / script `tools/ui-chain-real-shots.ts` của màn `trigger-optional-real` còn mô tả luồng cũ — chưa chụp lại.
- Commit (4) gồm cả phần test bổ sung + `export owedSummonEvents` (một dòng engine), không chỉ tài liệu.
- Docker Desktop được AI tự bật để chạy thật; hai container Postgres / Redis vẫn đang chạy.

## 5. Câu hỏi mở

1. G25 (b)(c) ở bảng trên: giữ hay đổi?
2. Sau này có muốn tách "cửa sổ chỉ dành cho lá vô hiệu triệu hồi" khỏi cửa sổ đáp trả thường (sát luật chuẩn, sửa G25 a)
   không? Hiện ghi ở mục "Chưa có trong engine".
3. Có cần chụp lại ảnh màn `trigger-optional-real` (luồng mới) không?

**Task tiếp theo (đề xuất): 4.5 Fusion**, chia hai:

- **4.5 (engine)**: Extra Deck trong state, lá Phép dung hợp, Fusion Summon, golden / fuzz.
- **4.5b (wire + UI)**: Extra Deck của **chủ sở hữu** trên `StateView` (hiện chỉ có `extraDeckCount`), chọn nguyên liệu,
  deck demo + scenario, log / animation.

Cần bạn chốt **trước khi viết 4.5**:

1. Nguyên liệu: chỉ quái được ghi đích danh trên lá Fusion, hay cho phép nguyên liệu "chung" (vd "1 Warrior + 1 quái LỬA")?
2. Fusion Summon có tính là Special Summon (bắn hiệu ứng "khi được triệu hồi", không tốn Normal Summon) không?
3. Nguyên liệu lấy từ đâu (chỉ tay + sân, hay cả chỗ khác) và đi đâu (mộ)?
4. Có vô hiệu Fusion Summon bằng lá "vô hiệu triệu hồi" (Cổng Khước Từ) được không, hay chỉ chặn bằng cách vô hiệu lá Phép
   dung hợp (như Special Summon bằng hiệu ứng hiện nay)?
5. Lá dung hợp kiểu Polymerization là **Phép Thường** (Speed 1, lượt mình, Main Phase), đúng không? Quái Fusion bị trả về /
   rời sân thì về Extra Deck hay vào mộ?
