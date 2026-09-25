# MASTER PLAN — Yugi H5 Recreate

> Thay thế cách chia M0–M8 cũ bằng **Phase P0–P9** (tái cấu trúc: đưa vertical slice lên sớm, tách
> asset/animation/tool ra phase riêng). Ánh xạ M cũ → P mới ở cuối file. Ghi ADR trong `docs/ai/DECISIONS.md`.

Nhãn độ tin cậy dùng xuyên suốt: `[REF]` có tư liệu trong `docs/reference/` · `[RULE]` luật YGO chuẩn · `[DECISION]` chủ dự án đã chốt (chưa có [REF], đổi bằng config) ·
`[GUESS]` đoán cách Yugi H5 xử lý (phải xác nhận). Độ khó: **S** (nhỏ) / **M** / **L**. Lớp: Engine / API / Frontend /
Realtime / Shared / Tooling.

## Phạm vi đã chốt (xem ADR 2026-09-20)

- IN: Normal/Tribute/Set/Flip/Special Summon, Fusion; Normal/Quick-Play/Continuous/Equip/Field Spell;
  Normal/Continuous/Counter Trap; chain + Spell Speed; early Master Rule qua `ruleset config`.
- OUT (v1): Ritual, Synchro, Xyz, Pendulum, Link, ban-list. Ngoài scope hẳn (chờ xác nhận): thanh toán tiền thật, giao dịch bài giữa người chơi, admin panel.
- Landscape 1280×720 (FIT), touch + chuột. VI + EN. Solo vs AI → PvP private → PvE nhẹ.
- **Mở rộng scope 2026-09-25 (ADR "Mở rộng scope")**: Economy & Inventory, Gacha/pack, Shop, Adventure/Campaign, Arena (PvP ladder),
  Live-ops — **P10–P15**, xây SAU khi core duel + auth (P7) + AI (P8) + realtime (P9) ổn định, không chen ngang. Trước đây "story mode"/gacha
  bị loại (OUT); nay nằm trong scope. Chi tiết khái niệm: `economy-plan.md`, `modes-and-liveops-plan.md`. Phase mới **chưa breakdown task con**
  (chờ chủ dự án duyệt hướng lớn + chốt các `[DECISION]`/`[CẦN HỎI CHỦ DỰ ÁN]`).

## Sơ đồ phụ thuộc

```
P0 (xong) → P1 Engine core ─→ P2 VERTICAL SLICE ─┬→ P3 Effect+Chain ─→ P4 Card batches
                                                 ├→ P5 Asset pipeline + Gallery ─→ P6 Animation/Audio
                                                 └→ P7 Auth+Deck Builder ─→ P8 AI rule-based ─→ P9 PvP + PvE + Polish
P3 ──→ P8 (AI cần effect)         P5 ──→ P7 (deck builder cần art/thumbnail)
```

Mở rộng scope (P10–P15, xây sau P7/P8/P9):

```
P7 Auth+Collection ─→ P10 Economy & Inventory ─┬→ P11 Gacha/Pack ─→ P12 Shop ──────────────┐
                                               │   (cần P4 pool lá + P5 art)                │
P8 AI rule-based ──────────────────────────────┼→ P13 Adventure/Campaign ───────────────────┤
                                               │   (mở rộng 9.5 tối giản)                   ├→ P15 Live-ops
P9 Realtime (9.1 Room private ≠ Arena) ────────┴→ P14 Arena + Leaderboard/Season ───────────┘
                                                   (đua top của P15 dùng Leaderboard P14)
```

Thứ tự P10→P15 theo phụ thuộc thật, không theo thứ tự liệt kê ban đầu: Gacha đặt **trước** Shop (Shop bán pack nên cần định nghĩa pack có trước); Adventure trước
Arena (không cần realtime, là nguồn gold); Live-ops cuối (nhiệm vụ/đua top bám hành động của mọi hệ thống trước). P11/P13/P14 độc lập nhau sau P10 — đổi thứ tự được.

## Vertical slice (P2) — "chơi được sớm nhất"

1 ván solo vs AI dummy end-to-end: guest ẩn danh → `/duels/solo` → kéo Summon/Set/Attack/EndPhase → AI đánh lại
→ LP về 0 thì kết thúc. ~10 vanilla monster placeholder, chưa effect, chưa animation đẹp. Đây là mốc bạn **chơi thử lần đầu**.

---

## P1 — Engine core (vanilla) · thay M1

| Mục       | Nội dung                                                                                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mục tiêu  | Engine chơi trọn 1 ván vanilla, có `RulesetConfig`.                                                                                                                                                     |
| IN        | Phase Draw→End, NormalSummon/SetMonster + tribute, ChangePosition, DeclareAttack + damage calc, win/lose (LP, deck-out), first-turn no-draw/no-attack `[RULE]`.                                         |
| OUT       | Effect, chain, spell/trap, Special Summon.                                                                                                                                                              |
| Done      | Mỗi rule có test valid + invalid; golden replay đầu tiên (seed + log → state); fuzz test cơ bản (không crash, bất biến LP/zone count) xanh; `pnpm --filter @yugi/game-engine lint/typecheck/test` xanh. |
| Phụ thuộc | P0.                                                                                                                                                                                                     |
| Rủi ro    | Thiết kế `PendingPrompt` sai → sửa lớn ở P3. Giảm: chốt kiểu prompt trong task 1.1.                                                                                                                     |
| Bạn làm   | Không (G1–G8 đã chốt). Duyệt `RULES-REVIEW-SHEET.md` sau mỗi task engine.                                                                                                                               |

Test P1 đặt tên mô tả luật (xem `docs/reference/notes/RULES-REVIEW-SHEET.md`): 1.2 → phase/lượt 1; 1.3–1.4 → summon/tribute; 1.5 → position; 1.6–1.7 → attack/damage/flip; 1.8 → hand limit/win/surrender.

Task con:

| #   | Task                                                                                                                                                            | Lớp    | Độ khó |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------ |
| 1.1 | `RulesetConfig` (Zod, shared) + `state.ruleset`                                                                                                                 | Engine | S      |
| 1.2 | `EndPhase` + phase transition + turn change + first-turn rules                                                                                                  | Engine | M      |
| 1.3 | `NormalSummon`/`SetMonster` (level 1-4)                                                                                                                         | Engine | S      |
| 1.4 | Tribute Summon/Set (level 5-6, 7+) qua `tributeInstanceIds` (SelectTribute UI → task 2.8)                                                                       | Engine | M      |
| 1.5 | `ChangePosition` (1 lần/turn, không vừa summon)                                                                                                                 | Engine | S      |
| 1.6 | `DeclareAttack`: ATK vs ATK, ATK vs DEF, direct attack                                                                                                          | Engine | M      |
| 1.7 | Flip khi bị tấn công + damage step cơ bản _(làm ở task 1.8)_                                                                                                    | Engine | M      |
| 1.8 | Win/lose + `DuelEnded` + `Surrender` [DECISION]; hand-size 6 ở End Phase `[RULE]` _(tách thành 1.7 win LP≤0 + 1.9 Surrender + 1.10 deck-out + 1.11 hand-limit)_ | Engine | S      |
| 1.9 | Golden replay harness + fuzz harness _(làm ở task 1.12)_                                                                                                        | Engine | M      |

> Số task trong bảng là số gốc của kế hoạch; số thực tế đã làm ở `docs/ai/PROGRESS.md` (1.7 = win, 1.8 = flip, 1.9 = surrender, 1.10 = deck-out, 1.11 = hand-limit, 1.12 = golden/fuzz).

## P2 — VERTICAL SLICE (solo vs AI dummy, chưa effect)

| Mục       | Nội dung                                                                                                                                                                                                                                                                    |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mục tiêu  | Chơi được 1 ván end-to-end qua server; có tool để bạn review.                                                                                                                                                                                                               |
| IN        | `POST /duels/solo`, `/duels/:id/actions`, StateView ẩn thông tin, AI dummy (action hợp lệ ngẫu nhiên có seed), guest token tối thiểu, FE Duel scene: board, hand, kéo thả Summon/Set/Attack, LP, phase bar, event log panel, Duel Sandbox (scenario JSON qua dev-endpoint). |
| OUT       | Effect, art thật, animation đẹp, deck builder.                                                                                                                                                                                                                              |
| Done      | Test integration "tạo duel → draw → summon → attack → end"; `pnpm dev` → mở web → chơi hết 1 ván; Review Packet + checklist QA kéo thả.                                                                                                                                     |
| Phụ thuộc | P1.                                                                                                                                                                                                                                                                         |
| Rủi ro    | Kéo thả trên touch; đồng bộ optimistic vs server-authoritative (không optimistic — ADR).                                                                                                                                                                                    |
| Bạn làm   | Screenshot màn Duel gốc `[REF]` (**cần trước 2.7**); chơi thử + điền checklist QA.                                                                                                                                                                                          |

| #    | Task                                                                                                                             | Lớp           | Độ khó |
| ---- | -------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------ |
| 2.1  | `StateView` filter (ẩn hand/deck/face-down đối thủ) + test                                                                       | API           | M      |
| 2.2  | `DuelService` wrap `applyAction`, lưu seed + action log                                                                          | API           | M      |
| 2.3  | `POST /duels/solo` + `/actions` + guest token tối thiểu                                                                          | API           | M      |
| 2.4  | Trang debug thô (HTML/TS, không Phaser) chơi solo-debug qua HTTP + Action schema ở shared                                        | Frontend      | M      |
| 2.5  | `legalActions` (engine `getLegalActions` + API + trang debug); phục vụ AI, debug, Phaser                                         | Engine+API+FE | M      |
| 2.6  | AI rule-based (`chooseAction` thuần: chỉ thấy StateView + legalActions) + mode `solo-vs-ai` + driver                             | API+FE(debug) | M      |
| 2.7  | Phaser Duel Scene tĩnh + `solo-vs-ai` (board 1280×720, tay, LP, phase, log, banner kết thúc, fixture; chỉ nút bấm, chưa kéo thả) | Frontend      | M      |
| 2.8  | Kéo thả + highlight ô hợp lệ: Summon/Set (tribute qua prompt), Attack (kéo mũi tên), đổi thế, bỏ bài nhiều lá ✅ nháp 2026-09-25 | Frontend      | L      |
| 2.9  | Animation theo `GameEvent[]` + nhịp lượt AI (phát lại `aiActions` từng bước) ✅ nháp 2026-09-25                                  | Frontend      | M      |
| 2.10 | Log panel bật/tắt + lọc (log cơ bản và banner kết thúc trận đã có từ 2.7)                                                        | Frontend      | S      |
| 2.11 | Dev-endpoint nạp scenario JSON + Duel Sandbox page                                                                               | Tooling       | M      |
| 2.12 | i18n bootstrap (VI/EN locale files, `t()`) ✅ nháp 2026-09-25                                                                    | Frontend      | S      |

## P3 — Effect system + Chain

| Mục       | Nội dung                                                                                                                                                                            |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mục tiêu  | Spell/Trap + effect data-driven chạy đúng, chain LIFO.                                                                                                                              |
| IN        | Effect DSL (Zod, `packages/shared`), Set/Activate Spell/Trap, chain stack, Spell Speed, priority/pass, prompt target/chain response, primitives batch 1 (xem card-and-effect-plan). |
| OUT       | Fusion, Field/Equip/Counter (P4).                                                                                                                                                   |
| Done      | 10 card mẫu (Monster+Spell+Trap) chạy bằng DSL, mỗi lá có test; FE có Chain UI + prompt chọn target; AI dummy không kẹt prompt.                                                     |
| Phụ thuộc | P2.                                                                                                                                                                                 |
| Rủi ro    | Timing "when/if", auto-chain vs hỏi mỗi lần `[GUESS]` — sai flow so với gốc. Giảm: `RulesetConfig.chainPrompt` chỉnh được.                                                          |
| Bạn làm   | Video/mô tả flow chain của Yugi H5 `[REF]` (**trước 3.4**).                                                                                                                         |

| #   | Task                                                                       | Lớp      | Độ khó |
| --- | -------------------------------------------------------------------------- | -------- | ------ |
| 3.1 | Schema `EffectDefinition` (Zod) + registry operation/cond/cost             | Shared   | M      |
| 3.2 | `Set` + `ActivateEffect` Normal Spell + operation Damage/Heal/Draw/Destroy | Engine   | M      |
| 3.3 | Chain stack + resolve LIFO + `PassPriority`                                | Engine   | L      |
| 3.4 | Spell Speed enforcement + Quick-Play + Normal Trap                         | Engine   | M      |
| 3.5 | Trigger OnSummon/OnDestroyed (optional/mandatory)                          | Engine   | L      |
| 3.6 | Continuous effect + `scriptId` registry                                    | Engine   | M      |
| 3.7 | Chain UI + prompt target/activate?                                         | Frontend | L      |
| 3.8 | 10 card mẫu + test mỗi lá                                                  | Shared   | M      |

## P4 — Card batches + luật mở rộng

Mỗi batch là 1 phiên nhỏ, theo `card-and-effect-plan.md`.

| #   | Task                                                        | Lớp    | Độ khó |
| --- | ----------------------------------------------------------- | ------ | ------ |
| 4.1 | Batch 1: 20 vanilla + 10 spell/trap cơ bản (CSV → validate) | Shared | M      |
| 4.2 | Special Summon + Flip effect + Equip Spell                  | Engine | L      |
| 4.3 | Field Spell + Continuous Spell/Trap đầy đủ                  | Engine | M      |
| 4.4 | Counter Trap (Speed 3)                                      | Engine | M      |
| 4.5 | Fusion (Polymerization-like, Extra Deck)                    | Engine | L      |
| 4.7 | Batch 2/3: trigger, continuous, quirk nhiều lá              | Shared | M/lô   |

Done: mỗi batch có test tự động sinh cho từng lá; parity-board cập nhật.

## P5 — Asset pipeline + Card Gallery (chạy song song P3/P4)

| Mục      | Nội dung                                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Mục tiêu | Bạn thả ảnh vào thư mục → card có art, không sửa code.                                                                                |
| IN       | Card frame vẽ bằng code, `card-art.manifest.json`, `validate-assets`, thumbnail/atlas, lazy load, asset pack ngoài git, Card Gallery. |
| Done     | Thả 5 ảnh thật vào `assets/card-art/` → Gallery hiện đúng; validate báo thiếu/thừa/sai size; Duel + Hand dùng art thật.               |
| Bạn làm  | Nộp batch art đầu (10 lá) **trước 5.6**.                                                                                              |

| #   | Task                                                                                   | Lớp      | Độ khó |
| --- | -------------------------------------------------------------------------------------- | -------- | ------ |
| 5.1 | Card frame renderer theo loại card (code-drawn)                                        | Frontend | L      |
| 5.2 | Script `validate-assets` + manifest generator                                          | Tooling  | M      |
| 5.3 | Optimize/thumbnail/atlas script (đề xuất `sharp` dev-only — **hỏi bạn trước khi cài**) | Tooling  | M      |
| 5.4 | Asset loader: lazy theo deck, fallback placeholder                                     | Frontend | M      |
| 5.5 | Card Gallery dev page (lọc thiếu art, effect dạng text)                                | Tooling  | M      |
| 5.6 | Asset pack path config (ngoài git)                                                     | Tooling  | S      |

## P6 — Animation + Audio (tier 1)

| Mục      | Nội dung                                                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Mục tiêu | Mọi GameEvent chính có animation; skip/speed; Animation Preview.                                                                |
| IN       | `EventAnimationQueue`, catalog tier 1, VFX lib code (flash/shake/slash/glow/dissolve), audio manager, Animation Preview page.   |
| Done     | Replay Viewer bước từng action; fast-forward khi reconnect; FPS ≥ 55 trên máy bạn; bạn duyệt từng animation trong parity-board. |
| Bạn làm  | Video tham chiếu animation `[REF]` (**trước 6.3**); SFX/BGM theo spec (**trước 6.6**).                                          |

| #   | Task                                                       | Lớp      | Độ khó |
| --- | ---------------------------------------------------------- | -------- | ------ |
| 6.1 | `EventAnimationQueue` (tuần tự/song song/skip/speed)       | Frontend | L      |
| 6.2 | Animator: draw, summon, set, flip, position                | Frontend | M      |
| 6.3 | Animator: attack, damage, destroy, LP change               | Frontend | L      |
| 6.4 | Animator: activate spell/trap, chain link, phase, win/lose | Frontend | L      |
| 6.5 | VFX library (code) + Animation Preview page                | Tooling  | M      |
| 6.6 | Audio manager + SFX/BGM mapping                            | Frontend | M      |
| 6.7 | Replay Viewer (seed + log)                                 | Tooling  | M      |

## P7 — Auth + Deck Builder + Collection

| #   | Task                                                     | Lớp      | Độ khó |
| --- | -------------------------------------------------------- | -------- | ------ |
| 7.1 | Auth guest + register/login/refresh/upgrade (JWT)        | API      | L      |
| 7.2 | Deck CRUD + validate (40-60, ≤3 bản) qua Zod dùng chung  | API      | M      |
| 7.3 | Collection + starter pack cấp mặc định                   | API      | M      |
| 7.4 | Màn Login/Guest + Menu thật                              | Frontend | M      |
| 7.5 | Deck Builder UI (list, filter, add/remove, validate)     | Frontend | L      |
| 7.6 | Chọn deck trước duel; Match result screen + MatchHistory | Frontend | M      |

Done: guest → nâng cấp account giữ deck; deck hợp lệ dùng để duel. Bạn cần screenshot Deck Builder gốc `[REF]` **trước 7.5**.

## P8 — AI rule-based

| #   | Task                                                  | Lớp | Độ khó |
| --- | ----------------------------------------------------- | --- | ------ |
| 8.1 | AI Easy: summon/attack heuristic hợp luật             | API | M      |
| 8.2 | AI Normal: tribute, so ATK, set bài                   | API | L      |
| 8.3 | AI dùng effect/chain (DSL-aware heuristics)           | API | L      |
| 8.4 | Bộ test AI-vs-AI 100 ván seed cố định không crash/kẹt | API | M      |

## P9 — PvP private + PvE nhẹ + Polish

| #   | Task                                                                                                                         | Lớp      | Độ khó |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| 9.1 | Room private (mã phòng, chơi với bạn bè, **không rating** — giữ nguyên; KHÁC Arena ở P14), Socket.io gateway, join/reconnect | Realtime | L      |
| 9.2 | Version sync + desync recovery (full re-sync)                                                                                | Realtime | M      |
| 9.3 | Timeout/AFK + turn timer `[GUESS]`                                                                                           | Realtime | M      |
| 9.4 | Redis adapter (nếu >1 instance)                                                                                              | Realtime | S      |
| 9.5 | PvE nhẹ: chuỗi đối thủ AI + deck định sẵn — **chỉ là bản tối giản trước; bản đầy đủ (map ải, thưởng, tiến độ) dời sang P13** | API/FE   | M      |
| 9.6 | Settings, i18n hoàn thiện, polish hiệu ứng tier 2 chọn lọc                                                                   | Frontend | M      |

## Mở rộng scope (2026-09-25): P10–P15

Chỉ mô tả ở tầm phase; **không đánh số task con** — "Task con: [để breakdown sau khi chốt hướng]". Nguyên tắc chung mọi phase dưới đây: server là nguồn sự thật
và **không optimistic** với tiền/vật phẩm/thưởng/rating (client không gửi giá, số lượng, kết quả roll, kết quả trận); engine duel thuần, tách UI; TypeScript strict;
không dùng asset/tên bài Konami. Con số kinh tế = `[DECISION]` chờ chủ dự án; mơ hồ = `[CẦN HỎI CHỦ DỰ ÁN]`. Không có `[REF]` cho cả nhóm này.
Đổi DB (Wallet/Inventory/Transaction…) mâu thuẫn CLAUDE.md #5 — cần chủ dự án duyệt sửa trước P10 (xem ADR 2026-09-25).

## P10 — Economy & Inventory

| Mục       | Nội dung                                                                                                                                                                                                                                                                                        |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mục tiêu  | Nền tiền tệ + kho đồ server-authoritative để Gacha/Shop/Adventure/Arena/Live-ops cùng ghi/đọc.                                                                                                                                                                                                  |
| IN        | Ví theo currency (gold, gem, currency sự kiện), kho item (bài theo `definitionId` × số lượng, item khác) mở rộng `Collection`, **ledger append-only** (idempotency key), giao dịch trong DB transaction, chống double-spend, cấp thưởng sau trận từ server (có trần farm AI), khởi tạo starter. |
| OUT       | Thanh toán tiền thật, giao dịch bài giữa người chơi, UI shop/gacha (P11–P12).                                                                                                                                                                                                                   |
| Done      | Không có đường ghi số dư ngoài service; số dư không âm khi giao dịch đồng thời; lặp cùng idempotency key không trừ/cộng thêm; số dư khớp ledger; guest không giữ tiền lâu dài.                                                                                                                  |
| Phụ thuộc | **P7** (tài khoản thật + `Collection` 7.3 — guest không đủ để giữ tiền/item qua các lần chơi).                                                                                                                                                                                                  |
| Rủi ro    | Mâu thuẫn CLAUDE.md #5; gem "cứng hơn" chưa rõ nguồn (E4); kinh tế lệch vì chưa có số.                                                                                                                                                                                                          |
| Bạn làm   | Chốt tên/nhãn/nguồn/trần gold & gem, thưởng mỗi trận `[DECISION]`; xác nhận không IAP (E4); duyệt sửa CLAUDE.md #5.                                                                                                                                                                             |

Task con: [để breakdown sau khi chốt hướng]. Khái niệm: `economy-plan.md`.

## P11 — Gacha / Pack opening

| Mục       | Nội dung                                                                                                                                                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mục tiêu  | Mở gói bài ngẫu nhiên theo tỉ lệ, phân tầng độ hiếm, kết quả do server chốt và có log kiểm toán.                                                                                                                                                                                            |
| IN        | Định nghĩa pack (data ở `packages/shared`), bảng tỉ lệ theo tầng độ hiếm, pity nếu có, xử lý bài trùng, mở pack = 1 giao dịch (trừ tiền → roll RNG phía server có log → cộng kho → ledger), hiển thị tỉ lệ, animation mở pack (animation queue P6), trường `rarity` trong `CardDefinition`. |
| OUT       | Banner giới hạn thời gian/rotation (P15), bán/đổi bài.                                                                                                                                                                                                                                      |
| Done      | Roll không suy ra được từ dữ liệu client; mở pack idempotent; log roll đủ để audit; thống kê mô phỏng N lần khớp bảng tỉ lệ (sai số chấp nhận được).                                                                                                                                        |
| Phụ thuộc | **P10**; **P4** (đủ pool lá để pack có nghĩa); **P5** (art/thumbnail).                                                                                                                                                                                                                      |
| Rủi ro    | Tên/số tầng độ hiếm chưa chốt (E1); đổi contract shared (thêm `rarity`); pool lá mỏng; RNG gacha tách khỏi RNG engine duel (không dùng chung).                                                                                                                                              |
| Bạn làm   | **[CẦN HỎI CHỦ DỰ ÁN]** tên các tầng độ hiếm; chốt tỉ lệ/pity/số lá mỗi pack/xử lý trùng `[DECISION]`; art pack (placeholder trước).                                                                                                                                                        |

Task con: [để breakdown sau khi chốt hướng]. Khái niệm: `economy-plan.md`.

## P12 — Shop

| Mục       | Nội dung                                                                                                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mục tiêu  | Cửa hàng đầy đủ: mua bài/gói/vật phẩm bằng gold hoặc gem; đổi vật phẩm sự kiện bằng currency sự kiện.                                                                                             |
| IN        | Catalog (data shared) SKU gói (từ P11)/bài lẻ/vật phẩm, giá theo currency, giới hạn mua (ngày/mùa/tài khoản), tab đổi vật phẩm sự kiện, server tính giá + kiểm tồn/giới hạn, UI cửa hàng (VI/EN). |
| OUT       | Khuyến mãi/rotation tự động và nội dung sự kiện cụ thể (P15), thanh toán tiền thật.                                                                                                               |
| Done      | Mua = giao dịch idempotent qua Economy; client không thể ép giá/số lượng; vượt giới hạn bị từ chối ở server; catalog thêm SKU không sửa code.                                                     |
| Phụ thuộc | **P10**; **P11** (Shop bán pack ⇒ pack phải có định nghĩa trước).                                                                                                                                 |
| Rủi ro    | Kinh tế lệch (chưa có bảng giá); tiền sự kiện cần Live-ops cấp nội dung (P15) — P12 chỉ dựng khung đổi.                                                                                           |
| Bạn làm   | Chốt bảng giá + giới hạn mua `[DECISION]`; art icon tiền/vật phẩm; chốt quy tắc currency sự kiện (E7).                                                                                            |

Task con: [để breakdown sau khi chốt hướng]. Khái niệm: `economy-plan.md`.

## P13 — Adventure / Campaign (mở rộng P9.5)

| Mục       | Nội dung                                                                                                                                                                                                  |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mục tiêu  | Chế độ PvE đầy đủ: đánh qua các ải để nhận thưởng (gold, thẻ, pack), có tiến độ lưu theo người chơi.                                                                                                      |
| IN        | Map chương/ải (data shared), đối thủ AI + deck định sẵn theo ải, điều kiện thắng/sao, mở khóa tuần tự, tiến độ lưu DB, thưởng lần đầu vs lặp cấp qua Economy sau khi server xác nhận thắng, UI bản đồ ải. |
| OUT       | PvP (P14), sự kiện giới hạn thời gian (P15).                                                                                                                                                              |
| Done      | Qua ải → server ghi tiến độ + cấp thưởng đúng một lần (idempotent); ải bị khóa không vào được; thêm ải = thêm data; AI của ải chạy không kẹt (test AI-vs-AI ở P8.4 tái dùng).                             |
| Phụ thuộc | **P8** (AI rule-based đủ mạnh cho từng ải — cần effect P3/P4); **P10** (thưởng); **P7** (lưu tiến độ); dùng lại phần dựng duel deck định sẵn của **9.5**.                                                 |
| Rủi ro    | Khối lượng nội dung/art (ải, map, nhân vật); cần AI đa độ khó; stamina/năng lượng chưa rõ; farm thưởng lặp.                                                                                               |
| Bạn làm   | **[CẦN HỎI CHỦ DỰ ÁN]** cấu trúc chương/ải, stamina, deck cố định hay mượn deck; chốt thưởng `[DECISION]`; art map/nhân vật (placeholder trước).                                                          |

Task con: [để breakdown sau khi chốt hướng]. Liên kết: **9.5 chỉ là bản tối giản trước**, bản đầy đủ dời sang phase này. Khái niệm: `modes-and-liveops-plan.md`.

## P14 — Arena (PvP ladder/ranking)

| Mục       | Nội dung                                                                                                                                                                                                                                                                      |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mục tiêu  | PvP công khai có xếp hạng: matchmaking theo rating, ladder, mùa, bảng xếp hạng. **Khác** P9.1 Room private (phòng theo mã chơi với bạn bè, không rating, giữ nguyên) — không gộp.                                                                                             |
| IN        | Matchmaking theo rating, rating/rank, mùa + thưởng cuối mùa qua Economy, **Leaderboard/Season service** (dùng lại ở P15), kết quả trận do server chốt, surrender/AFK tính thua, UI Arena + bảng xếp hạng.                                                                     |
| OUT       | Room private (P9.1), sự kiện đua top cụ thể (P15), giải đấu/bracket.                                                                                                                                                                                                          |
| Done      | Hai người chơi tìm nhau qua Arena, đấu qua hạ tầng Realtime P9, rating cập nhật đúng một lần/trận; reconnect/AFK xử lý; bảng xếp hạng khớp lịch sử trận; test chống cập nhật rating trùng.                                                                                    |
| Phụ thuộc | **P9** (Realtime, reconnect, version sync, AFK 9.3, Redis 9.4 nếu cần); **P10** (thưởng); **P7** (tài khoản).                                                                                                                                                                 |
| Rủi ro    | Dự án ghi "dùng cá nhân, không phát hành" → rất ít người chơi, matchmaking công khai có thể không có đối thủ; Leaderboard có thể cần hạ tầng riêng (cache/sorted set/Redis, job đóng mùa — khác `users` thường) — ghi rõ, hỏi trước khi thêm dependency; cheat/tài khoản phụ. |
| Bạn làm   | **[CẦN HỎI CHỦ DỰ ÁN]** quy mô deploy/số người chơi, có bot fallback không; hệ rank/rating, độ dài mùa, thưởng `[DECISION]`.                                                                                                                                                  |

Task con: [để breakdown sau khi chốt hướng]. Khái niệm: `modes-and-liveops-plan.md`.

## P15 — Live-ops (điểm danh, nhiệm vụ ngày, sự kiện đua top)

| Mục       | Nội dung                                                                                                                                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mục tiêu  | Giữ chân người chơi: điểm danh hằng ngày, nhiệm vụ ngày, sự kiện đua top/bảng xếp hạng theo mùa, có tiền/vật phẩm sự kiện.                                                                                                                              |
| IN        | Điểm danh (streak, reset theo giờ server), nhiệm vụ ngày data-driven (tiến độ từ event server của mọi mode), sự kiện đua top (Leaderboard P14) + thưởng cuối sự kiện, currency sự kiện + tab đổi ở Shop (P12), lịch sự kiện bằng config có `start/end`. |
| OUT       | Admin panel/CMS, banner gacha tự động phức tạp (chỉ cấu hình data).                                                                                                                                                                                     |
| Done      | Nhận thưởng điểm danh/nhiệm vụ đúng một lần (idempotent); reset ngày đúng theo giờ server; tiến độ quest khớp event thật; hết sự kiện → chốt hạng + phát thưởng một lần.                                                                                |
| Phụ thuộc | **P10**, **P12** (đổi vật phẩm sự kiện), và các mode để quest bám: **P11**, **P13**, **P14**; đua top cần Leaderboard từ **P14**.                                                                                                                       |
| Rủi ro    | Múi giờ/giờ reset; không có admin nên sửa lịch = sửa data + deploy; hạ tầng bảng xếp hạng + job đóng mùa; quest coupling mọi mode. Điểm danh + quest ngày chỉ cần P10 — có thể tách làm sớm nếu chủ dự án muốn (chưa quyết).                            |
| Bạn làm   | Danh sách nhiệm vụ + thưởng, chu kỳ điểm danh, lịch sự kiện, metric đua top `[DECISION]`; **[CẦN HỎI CHỦ DỰ ÁN]** giờ reset/múi giờ, streak đứt, công cụ sửa lịch.                                                                                      |

Task con: [để breakdown sau khi chốt hướng]. Khái niệm: `modes-and-liveops-plan.md`.

## Ánh xạ M cũ → P mới

| M cũ             | P mới             | Ghi chú                                                                                  |
| ---------------- | ----------------- | ---------------------------------------------------------------------------------------- |
| M1               | P1                | giữ nguyên                                                                               |
| M3+M4 (một phần) | P2 vertical slice | đưa FE + API tối thiểu lên trước effect                                                  |
| M2               | P3, P4            | tách effect và batch card                                                                |
| —                | P5, P6            | asset/animation/tool là phase riêng                                                      |
| M6               | P7                | + auth đầy đủ                                                                            |
| M5               | P8                | sau effect                                                                               |
| M7+M8            | P9                | + PvE nhẹ                                                                                |
| —                | P10–P15           | Mở rộng scope 2026-09-25: Economy, Gacha, Shop, Adventure (mở rộng 9.5), Arena, Live-ops |

## Việc của bạn theo phase (tóm tắt — chi tiết `human-tasks.md`)

| Cần có trước    | Việc                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------ |
| P1 (1.4)        | Xác nhận flow phase/tribute `[GUESS]`                                                            |
| P2 (2.7)        | Screenshot Duel gốc                                                                              |
| P3 (3.4)        | Mô tả/video chain                                                                                |
| P5 (5.6)        | 10 ảnh art đầu                                                                                   |
| P6 (6.3/6.6)    | Video animation, SFX/BGM                                                                         |
| P7 (7.5)        | Screenshot Deck Builder                                                                          |
| P10 (Economy)   | Chốt tên/nhãn/nguồn/trần gold & gem, thưởng mỗi trận; xác nhận không IAP; duyệt sửa CLAUDE.md #5 |
| P11 (Gacha)     | Tên các tầng độ hiếm [CẦN HỎI], tỉ lệ rơi/pity/xử lý bài trùng, art pack                         |
| P12 (Shop)      | Bảng giá + giới hạn mua, icon tiền/vật phẩm, quy tắc tiền sự kiện                                |
| P13 (Adventure) | Cấu trúc chương/ải, thưởng, stamina?, art map/nhân vật                                           |
| P14 (Arena)     | Quy mô deploy/số người chơi [CẦN HỎI], hệ rank/rating, mùa, thưởng                               |
| P15 (Live-ops)  | Danh sách nhiệm vụ + thưởng, chu kỳ điểm danh, lịch sự kiện, metric đua top, giờ reset           |
