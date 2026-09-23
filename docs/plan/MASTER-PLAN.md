# MASTER PLAN — Yugi H5 Recreate

> Thay thế cách chia M0–M8 cũ bằng **Phase P0–P9** (tái cấu trúc: đưa vertical slice lên sớm, tách
> asset/animation/tool ra phase riêng). Ánh xạ M cũ → P mới ở cuối file. Ghi ADR trong `docs/ai/DECISIONS.md`.

Nhãn độ tin cậy dùng xuyên suốt: `[REF]` có tư liệu trong `docs/reference/` · `[RULE]` luật YGO chuẩn · `[DECISION]` chủ dự án đã chốt (chưa có [REF], đổi bằng config) ·
`[GUESS]` đoán cách Yugi H5 xử lý (phải xác nhận). Độ khó: **S** (nhỏ) / **M** / **L**. Lớp: Engine / API / Frontend /
Realtime / Shared / Tooling.

## Phạm vi đã chốt (xem ADR 2026-09-20)

- IN: Normal/Tribute/Set/Flip/Special Summon, Fusion; Normal/Quick-Play/Continuous/Equip/Field Spell;
  Normal/Continuous/Counter Trap; chain + Spell Speed; early Master Rule qua `ruleset config`.
- OUT (v1): Ritual, Synchro, Xyz, Pendulum, Link, ban-list, story mode.
- Landscape 1280×720 (FIT), touch + chuột. VI + EN. Solo vs AI → PvP private → PvE nhẹ.

## Sơ đồ phụ thuộc

```
P0 (xong) → P1 Engine core ─→ P2 VERTICAL SLICE ─┬→ P3 Effect+Chain ─→ P4 Card batches
                                                 ├→ P5 Asset pipeline + Gallery ─→ P6 Animation/Audio
                                                 └→ P7 Auth+Deck Builder ─→ P8 AI rule-based ─→ P9 PvP + PvE + Polish
P3 ──→ P8 (AI cần effect)         P5 ──→ P7 (deck builder cần art/thumbnail)
```

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
| 1.4 | Tribute Summon/Set (level 5-6, 7+) qua `tributeInstanceIds` (SelectTribute UI → task 2.6)                                                                       | Engine | M      |
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
| Bạn làm   | Screenshot màn Duel gốc `[REF]` (**cần trước 2.5**); chơi thử + điền checklist QA.                                                                                                                                                                                          |

| #    | Task                                                                   | Lớp      | Độ khó |
| ---- | ---------------------------------------------------------------------- | -------- | ------ |
| 2.1  | `StateView` filter (ẩn hand/deck/face-down đối thủ) + test             | API      | M      |
| 2.2  | `DuelService` wrap `applyAction`, lưu seed + action log                | API      | M      |
| 2.3  | `POST /duels/solo` + `/actions` + guest token tối thiểu                | API      | M      |
| 2.4  | AI dummy (`AIPlayer` interface + random-legal-with-seed)               | API      | S      |
| 2.5  | Duel scene: layout board 1280×720 từ reference, CardSprite placeholder | Frontend | M      |
| 2.6  | Hand + kéo thả Summon/Set (chọn tribute qua prompt)                    | Frontend | L      |
| 2.7  | Kéo attack + prompt vị trí + LP bar + phase bar                        | Frontend | M      |
| 2.8  | Action/Event log panel (bật/tắt) + kết thúc trận                       | Frontend | S      |
| 2.9  | Dev-endpoint nạp scenario JSON + Duel Sandbox page                     | Tooling  | M      |
| 2.10 | i18n bootstrap (VI/EN locale files, `t()`)                             | Frontend | S      |

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

| #   | Task                                                       | Lớp      | Độ khó |
| --- | ---------------------------------------------------------- | -------- | ------ |
| 9.1 | Room private (mã phòng), Socket.io gateway, join/reconnect | Realtime | L      |
| 9.2 | Version sync + desync recovery (full re-sync)              | Realtime | M      |
| 9.3 | Timeout/AFK + turn timer `[GUESS]`                         | Realtime | M      |
| 9.4 | Redis adapter (nếu >1 instance)                            | Realtime | S      |
| 9.5 | PvE nhẹ: chuỗi đối thủ AI + deck định sẵn                  | API/FE   | M      |
| 9.6 | Settings, i18n hoàn thiện, polish hiệu ứng tier 2 chọn lọc | Frontend | M      |

## Ánh xạ M cũ → P mới

| M cũ             | P mới             | Ghi chú                                 |
| ---------------- | ----------------- | --------------------------------------- |
| M1               | P1                | giữ nguyên                              |
| M3+M4 (một phần) | P2 vertical slice | đưa FE + API tối thiểu lên trước effect |
| M2               | P3, P4            | tách effect và batch card               |
| —                | P5, P6            | asset/animation/tool là phase riêng     |
| M6               | P7                | + auth đầy đủ                           |
| M5               | P8                | sau effect                              |
| M7+M8            | P9                | + PvE nhẹ                               |

## Việc của bạn theo phase (tóm tắt — chi tiết `human-tasks.md`)

| Cần có trước | Việc                                  |
| ------------ | ------------------------------------- |
| P1 (1.4)     | Xác nhận flow phase/tribute `[GUESS]` |
| P2 (2.5)     | Screenshot Duel gốc                   |
| P3 (3.4)     | Mô tả/video chain                     |
| P5 (5.6)     | 10 ảnh art đầu                        |
| P6 (6.3/6.6) | Video animation, SFX/BGM              |
| P7 (7.5)     | Screenshot Deck Builder               |
