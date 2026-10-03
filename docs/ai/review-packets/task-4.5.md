# Review Packet — Task 4.5: Dung hợp (Fusion) — engine + shared

**Đã làm gì:** Thêm Dung hợp vào engine. Một lá Phép Thường ("Lò Hợp Thể", SMP-116) kích hoạt được khi Extra Deck của bạn có
một quái Dung hợp mà bạn đủ nguyên liệu (ghi đích danh) trên tay / trên sân. Khi lá resolve, bạn được hỏi **hai bước**: chọn
quái Dung hợp, rồi chọn nguyên liệu. Nguyên liệu vào mộ, quái Dung hợp lên sân như một lần Triệu hồi Đặc biệt. Kèm theo: Extra
Deck được nạp lúc bắt đầu ván, kiểm tra bộ bài có Extra Deck, 2 quái Dung hợp mẫu (SMP-045, SMP-046).

**Chưa chơi được trên màn hình.** Task này chỉ làm engine + dữ liệu lá; api / web chỉ sửa đúng phần "che" (2 event mới bị loại,
2 câu báo lỗi) và test. Không ván nào tạo qua HTTP có Extra Deck, nên chưa có gì mới để bấm thử và **không có ảnh**. Nối lên
màn hình là task **4.5b**.

**Cách xem (không cần đọc code):**

1. `pnpm --filter @yugi/game-engine exec vitest run src/rules/fusion.test.ts` — 54 tình huống, tên test là câu mô tả luật.
2. Mở một golden (mục 3) để xem từng bước của một ván có Dung hợp.
3. `docs/reference/notes/RULES-REVIEW-SHEET.md`: 8 dòng cuối là luật Dung hợp viết bằng lời, **ô duyệt còn trống — chờ bạn**.

## 1. Trước / sau

| Việc                                                    | Trước 4.5     | Từ 4.5                                                                                                                                              |
| ------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extra Deck lúc bắt đầu ván                              | luôn rỗng     | nạp từ `extraDeckLists` (không xáo); không truyền thì vẫn rỗng và ván diễn ra **y hệt trước**                                                       |
| Lá Phép dung hợp                                        | không có      | SMP-116: kích hoạt được khi có quái Dung hợp đủ nguyên liệu + còn ô quái; không thì bị từ chối                                                      |
| Lúc lá resolve                                          | —             | hỏi "chọn quái Dung hợp" → hỏi "chọn nguyên liệu"; trong lúc hỏi không làm việc khác được                                                           |
| Nguyên liệu                                             | —             | từ tay / sân của mình (quái úp cũng được) → **mộ** (không tính "bị phá")                                                                            |
| Quái Dung hợp                                           | —             | vào ô quái trống thấp nhất, ngửa Tư thế Công; **không** tốn Normal Summon; không tấn công / đổi thế lượt đó; hiệu ứng "khi triệu hồi" lên chuỗi mới |
| Đối thủ chặn                                            | —             | chỉ bằng lá vô hiệu **việc kích hoạt** lá Phép ⇒ không nguyên liệu nào bị dùng. Lá "vô hiệu triệu hồi" không dùng được vào Dung hợp                 |
| Normal Summon / Set / "Triệu hồi Đặc biệt từ tay / mộ"  | nhận mọi quái | từ chối quái Dung hợp                                                                                                                               |
| Kiểm tra bộ bài (`validateDeck`)                        | chỉ Main Deck | thêm Extra Deck (≤ 20, chỉ quái Dung hợp, ≤ 3 bản); Main Deck không được có quái Dung hợp                                                           |
| Ván không có Extra Deck (mọi ván hiện chơi được qua UI) | —             | **không đổi gì**: 25 golden cũ giữ nguyên từng byte, smoke HTTP thật vẫn đạt                                                                        |

## 2. Số liệu thật

| Hạng mục                                | Kết quả                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Test đỏ trước khi viết code engine      | **51 đỏ** / 58 (`task-4.5-red.txt`); 7 test còn lại xanh sẵn vì chỉ kiểm hành vi chưa đổi                                                                                                                                                                                                                                                                                            |
| Test sau khi xong                       | shared **217** (+17) · engine **1097** (+75) · api **476** (+5) · web **675** (=)                                                                                                                                                                                                                                                                                                    |
| Lint / typecheck / build toàn workspace | `pnpm lint` 4/4, `pnpm typecheck` 6/6, `pnpm build` 4/4 đạt; `pnpm test`: mọi test đạt, nhưng gói api thoát mã 1 vì thông báo `Timeout calling "onTaskUpdate"` của vitest (lỗi đã biết khi chạy song song, 476/476 test api vẫn đạt)                                                                                                                                                 |
| Golden                                  | cũ đổi **0 / 25**; thêm **5**                                                                                                                                                                                                                                                                                                                                                        |
| Mutation (`tools/mutants-4.5.mjs`)      | **42 / 42** bị bắt, tất cả bởi test luật / golden, 0 chỉ nhờ `tsc` (`task-4.5-mutants.txt`)                                                                                                                                                                                                                                                                                          |
| Fuzz engine (bộ mặc định trong suite)   | 60 seed Fusion × 400 bước: 70 lần Dung hợp, 22 nguyên liệu từ sân, 71 từ Deck, 2 lần lá Phép bị vô hiệu, 17 hiệu ứng "khi triệu hồi" của quái Dung hợp, 1 lần chuỗi tạm dừng có hiệu ứng "nợ"; 0 vi phạm                                                                                                                                                                             |
| Fuzz engine dài                         | 400 seed pool cũ + 100 pool vô hiệu + 100 pool trigger + **200 seed Fusion**, mỗi seed 400 bước: **826 / 826** test đạt, 0 vi phạm (`task-4.5-fuzz-long.txt`)                                                                                                                                                                                                                        |
| Seed cũ có đổi đường đi không           | **Không**: dấu vân tay nhật ký hành động của 50 seed cũ (30 mặc định, 10 vô hiệu, 10 trigger; 400 bước) giống hệt trước / sau khi thêm Fusion vào fuzz                                                                                                                                                                                                                               |
| Fuzz chống rò api dài                   | 120 seed × 300 bước (+60 solo-vs-ai, +60 deck Field, +30 deck quái lật, +60 deck Negate, +30 Negate solo-vs-ai): **363 / 363** test đạt, 0 vi phạm (`task-4.5-leak-fuzz-long.txt`; lần chạy này cũng in thông báo `onTaskUpdate` và thoát mã 1 dù mọi test đạt). Đây là các deck **không có** Extra Deck — chứng minh không hồi quy; phần Fusion kiểm ở `fusion-containment.spec.ts` |
| Smoke HTTP thật (API + Postgres chạy)   | `smoke-http` **23 / 23** (`task-4.5-smoke.md`); `smoke-sandbox` tất cả đạt (`task-4.5-smoke-sandbox.md`); `play-vs-ai` deck mặc định 47 / 47, deck effect 63 / 63, deck negate 108 / 108 (`task-4.5-play-vs-ai.txt`)                                                                                                                                                                 |

## 3. Cách đọc 5 golden mới

Mở `packages/game-engine/src/__golden__/<tên>.json`, tìm `"steps"`; mỗi bước có `action` (ai làm gì) và `events` (chuyện gì xảy
ra) hoặc `errorCode` (bị từ chối). Cả 5 dùng chung một ván chia bài: người 0 có trên tay `p0-32` / `p0-20` (Phép dung hợp),
`p0-25` (quái 1000), `p0-2` (quái 1800), `p0-31` (quái có hiệu ứng "khi bị phá: 400 sát thương"); Extra Deck: `p0-x0` (quái
Dung hợp 2400) và `p0-x1` (quái Dung hợp có hiệu ứng "khi triệu hồi: 300 sát thương").

- **`fusion-hand-and-field`**: triệu hồi quái 1000 → kích hoạt Phép (`EffectActivated`, `ChainLinkAdded`, rồi dừng lại hỏi) →
  `EndPhase` bị từ chối `CHAIN_WINDOW_OPEN` → chọn một quái không có trong Extra Deck bị từ chối → chọn `p0-x0` (không event) →
  chọn nguyên liệu sai bị từ chối → chọn `p0-25` (trên sân) + `p0-2` (trên tay): 2 × `FusionMaterialSent`,
  `MonsterFusionSummoned`, `EffectResolved`, `CardSentToGraveyard`, `ChainResolved`. Normal Summon thêm bị từ chối
  `NORMAL_SUMMON_USED`, đổi thế quái Dung hợp bị từ chối `SUMMONED_THIS_TURN`. Lượt 3 nó tấn công trực tiếp: LP cuối 8000 / 5600.
- **`fusion-then-onsummon-trigger`**: cùng bước cuối nhưng sau `ChainResolved` có thêm `EffectActivated`, `ChainLinkAdded`,
  `DamageDealt` 300, `EffectResolved`, `ChainResolved` (hiệu ứng của quái Dung hợp trên chuỗi mới). Lá Phép thứ hai bị từ chối
  `NOT_ACTIVATABLE` (hết nguyên liệu). LP cuối 8000 / 7700.
- **`fusion-negated-keeps-materials`**: đối thủ úp Bẫy Phản công; bạn kích hoạt Phép → họ đáp → `ChainLinkNegated`, lá Phép vào
  mộ, **không** có `FusionMaterialSent`. Lá Phép thứ hai dung hợp được ngay với đúng hai nguyên liệu đó. LP cuối 8000 / 7000
  (đối thủ trả 1000 LP cho Bẫy).
- **`fusion-material-destroyed-in-response`**: quái 1000 trên sân là bản duy nhất của nguyên liệu; đối thủ đáp bằng Bẫy phá nó ⇒
  bước đó có `MonsterDestroyed` rồi `EffectResolved` của lá Phép mà **không** hỏi, không dung hợp. Quái 1800 vẫn trên tay, Extra
  Deck còn nguyên.
- **`fusion-owed-trigger-after-pause`**: đối thủ phá quái có hiệu ứng "khi bị phá" để đáp lá Phép; bước đó dừng ở câu hỏi chọn
  quái (chưa có 400 sát thương). Sau khi dung hợp xong mới có `DamageDealt` 400. LP cuối 8000 / 7600.

## 4. `[ASSUMED]` mới cần bạn duyệt — G26 (`docs/plan/fidelity-spec.md`)

Độ tin cậy **thấp**: tư liệu chỉ có 1 lần Dung hợp (video #2, 25:36–25:41), nhãn nguồn thấy là "Bài trên Tay".

| #   | Nội dung                                                                                                   | Nguồn                                              |
| --- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| (a) | Nguyên liệu lấy từ **tay + sân của mình** (lá demo); vào mộ, không tính "bị phá"                           | brief của bạn (3); luật chuẩn                      |
| (b) | Chọn quái + nguyên liệu **lúc resolve**; luôn hỏi cả hai bước kể cả khi chỉ có một lựa chọn                | brief (3); video thấy đúng 2 bước với 1 lựa chọn   |
| (c) | Không có lần hỏi "đáp lại triệu hồi" cho Dung hợp; chỉ vô hiệu kích hoạt lá Phép mới chặn được             | brief (4)                                          |
| (d) | Nguyên liệu bị phá để đáp trả, không còn cách dung hợp ⇒ lá resolve không hiệu ứng, không dùng lá nào khác | AI tự chọn (mặc định hợp lý, giống "mất mục tiêu") |
| (e) | Quái Dung hợp vào ô trống thấp nhất, Tư thế Công; không tấn công / đổi thế lượt đó                         | brief (2); G17, G22                                |
| (f) | Lá có nguồn "Deck" (chưa có lá thật nào dùng): nguyên liệu vào mộ, Deck được xáo lại                       | AI tự chọn; brief yêu cầu nguồn là tham số         |

## 5. Lệch kế hoạch / nói thẳng

- **Có sửa code api, đúng 1 chỗ:** 2 dòng `case` trả `null` ở `apps/api/src/modules/duels/event-view.ts` (brief yêu cầu: event
  mới phải bị loại; thiếu thì `tsc` đỏ). Web: 2 câu báo lỗi vi / en (test web buộc mọi mã lỗi engine có câu). Ngoài ra api /
  web chỉ đổi test.
- **Fuzz chống rò api với Extra Deck không làm được như một "variant"** như plan đã ghi: tầng tạo ván của api chưa có đường nạp
  Extra Deck (phải sửa code api), và bộ kiểm rò hiện coi mọi con trỏ vào Extra Deck là rò — kể cả với chính chủ lá, mà câu hỏi
  "chọn quái Dung hợp" buộc phải trỏ vào Extra Deck của họ. Thay vào đó có `fusion-containment.spec.ts` (5 test): chạy engine
  với lá thật, kiểm ghế **đối thủ** ở mọi bước của một lần Dung hợp — 0 vi phạm, chỉ thấy số lá Extra Deck, không biết quái nào
  đang được chọn — và ghi lại chỗ hở phía chủ lá để 4.5b xử lý (câu hỏi (a) bên dưới).
- **Một nhánh không tới được bằng fuzz ngẫu nhiên:** "nguyên liệu bị phá để đáp trả ⇒ lá không hiệu ứng" — 0 lần trong 60 seed ×
  400 bước (thử cả một pool chỉ dùng sân). Nhánh này được phủ bằng test luật + golden; bộ đếm trong fuzz chỉ in ra, không ép.
- **Lá dung hợp chỉ có thể là Phép Thường** (đúng quyết định 5), và engine dựa vào điều đó: chuỗi chỉ tạm dừng được ở mắt xích
  cuối cùng. Lá dung hợp Phép Tức thời / Bẫy sau này cần làm thêm.
- **Test viết sau khi đã có code** (không phải đỏ trước): 3 test dữ liệu méo / dùng một lá cho hai nguyên liệu (thêm khi soạn
  mutant), 4 test "bộ kiểm fuzz bắt được engine hỏng", biến thể Fusion của property test `legalActions`, 5 test containment ở
  api, test 5 golden. Một test trong file đỏ có chỉ số event sai (lỗi của test, không phải của engine), đã sửa ở commit 2.
- ADR 068 lọt vào commit (3/4) thay vì (4/4) (`git add -A`); nội dung không đổi.
- Tôi đã **tự bật Docker Desktop** (đang tắt) và chạy API ở cổng 3000 để chạy smoke thật; API đã tắt sau đó, Docker còn chạy.

## 6. Câu hỏi mở (cần bạn trả lời trước task 4.5b)

- **(a)** Ở 4.5b, chủ lá phải thấy Extra Deck của mình trên màn hình. Bạn đồng ý cho bộ kiểm rò **cho phép trỏ vào Extra Deck
  của chính chủ lá** (đối thủ vẫn chỉ thấy số lượng; Deck chính vẫn kín với cả hai) chứ?
- **(b)** Bản gốc có cho lấy nguyên liệu từ "Bộ bài" không? Hiện lá demo chỉ dùng tay + sân. Đổi chỉ là sửa một dòng dữ liệu
  lá; cần tư liệu (đã thêm vào `human-tasks.md`).
- **(c)** Khi chỉ có **một** quái Dung hợp làm được, vẫn hỏi bước "chọn mục tiêu dung hợp" (đang: có, theo video) hay bỏ qua?
- **(d)** Người chơi có được tự chọn ô và tư thế cho quái Dung hợp không (đang: ô thấp nhất, Tư thế Công)?

## 7. File đổi (tóm tắt)

- **Shared:** `cards/card-definition.ts` (`fusionMaterials`), `effects/{operation,effect-definition,registry}.ts`
  (`FusionSummon`), `cards/sample-cards.ts` (+3 lá), `deck/validate-deck.ts`; test `cards/fusion.test.ts` (mới) + 3 file test.
- **Engine:** `effects/operations/fusion-summon.ts` (mới), `actions/handlers/fusion-prompt.ts` (mới), `effects/chain.ts`,
  `effects/{targets,triggers}.ts`, `actions/handlers/{start-duel,summon,activate-effect,resolve-pending-prompt}.ts`,
  `actions/types.ts`, `events/types.ts`, `errors.ts`, `legal-actions.ts`; test `rules/fusion.test.ts`,
  `start-duel.extra-deck.test.ts`, fuzz, golden (+5 file), property test.
- **Api:** `event-view.ts` (2 `case`), spec: `event-view.spec.ts`, `event-visibility.fuzz.spec.ts` (bộ lọc `FUSION_CARDS`),
  `fusion-containment.spec.ts` (mới). **Web:** 2 khoá i18n × 2 ngôn ngữ.
- **Docs:** ADR 068, `engine.md`, `effect-dsl.md`, `event-visibility.md`, `protocol.md`, `fidelity-spec.md` (G8, G26),
  `rules-coverage.md`, `RULES-REVIEW-SHEET.md` (+8 dòng), `parity-board.md` (🟨), `MASTER-PLAN.md` (+4.5b), `human-tasks.md`,
  `card-and-effect-plan.md`, `PROGRESS.md`, `progress/p4.md`, `INDEX.md`, `LESSONS.md`, `CLAUDE.md` của engine và api.
- **Tools:** `tools/mutants-4.5.mjs`.
