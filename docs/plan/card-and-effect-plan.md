# Card & Effect Plan

Nguyên tắc (CLAUDE.md #3, #5): card = data ở `packages/shared`; engine không hardcode effect; lá quá phức tạp dùng `scriptId`.
Card mặc định là **placeholder tự đặt tên**, không tên/art Konami.

## Schema CardDefinition mở rộng (đề xuất, chốt ở task 3.1)

Hiện có: `id, name, effectText, scriptId, kind, category, attribute, race, level, atk, def, subType`.

| Trường thêm                                          | Mục đích                                                                                                 | Phase |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----- |
| `name`, `effectText` → `{ vi, en }` (hoặc `i18nKey`) | i18n text card ở data                                                                                    | P2/P3 |
| `effects: EffectDefinition[]`                        | Effect DSL (xem `docs/design/effect-dsl.md`)                                                             | P3    |
| `artId?`                                             | Tách art khỏi id (mặc định = `id`)                                                                       | P5    |
| `tags?: string[]`                                    | Lọc/batch/test (vd `batch1`, `vanilla`)                                                                  | P4    |
| `fusionMaterials?`                                   | Fusion — **có từ task 4.5** (`string[]` id nguyên liệu đích danh, ≥ 2; chỉ trên quái `category: Fusion`) | P4    |
| `ritualRequirement?`                                 | Ritual                                                                                                   | P4    |
| `tier: 'A'\|'B'\|'C'`                                | Dẫn xuất được từ effects/scriptId, validate                                                              | P3    |

Thay đổi contract → cập nhật `docs/design/effect-dsl.md` và ADR.

## Phân tầng effect

| Tier | Định nghĩa                                                            | Cách làm                     | Test                          |
| ---- | --------------------------------------------------------------------- | ---------------------------- | ----------------------------- |
| A    | Vanilla (chỉ ATK/DEF) hoặc Normal Spell/Trap chỉ 1 operation phổ biến | Data thuần (viết TS)         | Test tự động chung (smoke)    |
| B    | Effect mô tả được bằng DSL                                            | `EffectDefinition` data      | Test riêng từng lá (bắt buộc) |
| C    | Không map vào DSL                                                     | `scriptId` + handler đăng ký | Test riêng + ghi lý do        |

Mục tiêu: phủ ~80% card bằng A+B.

## Primitive DSL cần có (để phủ ~80%)

| Loại      | Primitive                                                                                                                                                                                               | Batch |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Trigger   | `OnSummon`, `OnFlip`, `OnDestroyed(by)`, `OnSentToGY`, `OnPhaseStart`, `OnDamage`, `OnAttackDeclared`, `Continuous`, `Ignition`, `Quick`, `OnActivate`                                                  | 1–3   |
| Condition | `PhaseIs`, `IsMyTurn`, `ZoneCount(min/max)`, `LPCompare`, `HasCardIn(zone, filter)`, `ChainLength`, `PositionIs`                                                                                        | 1–3   |
| Cost      | `Discard`, `Tribute`, `PayLP`, `Banish`, `SendToGY`, `Reveal`                                                                                                                                           | 1–3   |
| Target    | `Card(zone, filter, count)`, `Player(self/opp)`, `AllMatching(filter)`                                                                                                                                  | 1–3   |
| Operation | `Damage`, `Heal`, `Draw`, `Destroy`, `SendToGY`, `Banish`, `Return(hand/deck)`, `SpecialSummon`, `ModifyStat(atk/def, duration)`, `ChangePosition`, `Negate`, `Shuffle`, `Search`, `Equip`, `SkipPhase` | 1–4   |
| Filter    | `kind`, `level(min/max)`, `attribute`, `race`, `atk(min/max)`, `position`, `nameContains`, `tag`                                                                                                        | 1–3   |
| Duration  | `ThisTurn`, `UntilEndPhase`, `WhileOnField`, `Permanent`                                                                                                                                                | 3     |

Thêm primitive mới = `/new-effect-type` (1 handler nhỏ + test), không sửa core.

## Thứ tự batch

| Batch | Nội dung                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Phase |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 0     | 5 card mẫu hiện có + ~10 vanilla để chạy vertical slice                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | P2    |
| 3.8   | **Xong (nháp, task 3.8)**: 10 lá effect đầu tiên `SMP-019…023`, `SMP-102…104`, `SMP-202…203` (Tier B, chỉ DSL) + `EFFECT_DEMO_DECK`; test mỗi lá ở `packages/game-engine/src/cards/sample/<id>.test.ts` (engine chạy được data thật; shared không chạy engine)                                                                                                                                                                                                                                                                                                                                                                                 | P3    |
| 1     | **Xong (nháp, task 4.1)**: 20 vanilla `SMP-024…043` (Level 1–8, 6 thuộc tính, 17 race; test Tier A chung `cards/sample/vanilla.test.ts`) + 10 Spell/Trap `SMP-105…110`, `SMP-204…207` (Damage/Heal/Draw/Destroy + cost/condition/filter có sẵn; test mỗi lá) + `BATCH1_DEMO_DECK`. **Negate summon dời** sang task có primitive `Negate` (4.4). Data vẫn viết tay TS, CSV để sau (ADR 2026-09-30)                                                                                                                                                                                                                                              | P4    |
| 4.4   | **Xong (nháp, task 4.4; lên wire ở 4.4b)**: operation `NegateActivation{cardKinds?}` / `NegateAttack` / `NegateSummon` (thay mục `Negate` của bảng trên) + 3 lá Tier B: `SMP-201` (Bẫy thường, vô hiệu đòn tấn công — hết placeholder), `SMP-209` (Bẫy Phản công, trả 1000 LP: vô hiệu kích hoạt Phép/Bẫy), `SMP-210` (Bẫy Phản công: vô hiệu Normal/Flip Summon); test mỗi lá ở `cards/sample/smp-201\|209\|210.test.ts`. Deck demo `NEGATE_DEMO_DECK` + 3 scenario Sandbox (`negate-attack-real`, `counter-summon-real`, `counter-spell-real`): task 4.4b (nháp). ADR 065, 066                                                               | P4    |
| 2     | **Xong (nháp, task 4.7)**: 26 lá `SMP-048…061`, `SMP-117…124`, `SMP-211…214` — **chỉ DSL đã có, engine 0 dòng**: 12 quái hiệu ứng (`OnSummon` × 3, `OnFlip` × 3, `OnDestroyed` × 3, `Continuous` × 3 theo `race` / `attribute`; 2 trigger tốn `PayLP`), 2 quái Dung hợp (nguyên liệu là quái của lô), 8 Phép (Normal × 2, Quick-Play × 2, Equip × 2 — một lá trang bị lên quái **đối thủ** —, Continuous, Field), 4 Bẫy (Normal × 2, Continuous, Counter chỉ vô hiệu Phép). `BATCH2_DEMO_DECK` + `BATCH2_FUSION_EXTRA_DECK`; test mỗi lá ở `cards/sample/smp-*.test.ts`. Không làm được bằng dữ liệu: xem mục "Còn thiếu gì" bên dưới. ADR 070 | P4    |
| 3     | Field, Counter Trap, Special Summon, Fusion/Ritual mẫu                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | P4    |
| 4+    | Bộ card lớn hơn theo nhu cầu deck AI/PvE (mỗi lô 20–30 lá)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | P8–P9 |

## Còn thiếu gì (sau Batch 2, task 4.7) — đầu vào cho task 4.8

Bảng này ghi **thứ engine / DSL chưa có → lá đã không làm được vì thế → độ ưu tiên đề xuất**. Mọi mục đều cần sửa engine
(`/new-effect-type` hoặc task riêng), nên không làm trong 4.7.

| Còn thiếu                                                                                                                              | Lá / kiểu lá đã không làm được                                                                                                                                  | Ưu tiên                                  |
| -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| **Sửa lỗi P7** (`docs/ai/OPEN-ISSUES.md`): trigger có mục tiêu Phép/Bẫy liệt kê lá Trang bị sắp rời sân ⇒ prompt không ai trả lời được | Bản đầu của SMP-056 ("bị phá: trả 500 LP, phá 1 Phép/Bẫy đối thủ") — đã đổi thành "rút 1 lá". Mọi lá "bị phá / được gọi ra giữa chuỗi: phá 1 Phép/Bẫy" đều dính | **Cao nhất** (lỗi, không phải tính năng) |
| **Quái trên sân kích hoạt hiệu ứng** (`Ignition` / `Quick` trên quái): `ActivateEffect` từ chối mọi quái (`NOT_A_SPELL_TRAP`)          | 2 quái brief yêu cầu: "trả LP để gây sát thương / phá bài", "bỏ 1 lá để rút / tăng ATK". Cả lớp "quái có hiệu ứng bấm" của bài cổ điển                          | **Cao**                                  |
| `OncePerTurn` (condition hoặc cờ trên effect)                                                                                          | Đi kèm mục trên: không có nó thì quái "trả 500 LP: gây 500" bấm vô hạn trong một lượt                                                                           | **Cao** (làm cùng mục trên)              |
| **Cost có chọn lá cho trigger** (`Discard` / `Tribute` trên `OnSummon` / `OnFlip` / `OnDestroyed`): chưa có bước hỏi "bỏ lá nào"       | "Khi triệu hồi: bỏ 1 lá để phá 1 quái", "LẬT: hiến tế 1 quái để…" — ở 4.7 phải dùng `PayLP` (SMP-049, SMP-056)                                                  | Trung bình                               |
| `ChangePosition` (operation) + filter `position`                                                                                       | "Chuyển 1 quái đối thủ sang Thủ", "LẬT: lật úp 1 quái", quái "không thể bị phá khi ở Thủ"                                                                       | Trung bình                               |
| `SendToGY` / `Return(hand/deck)` (operation)                                                                                           | "Trả 1 quái về tay chủ" (bounce), "gửi 1 lá từ Deck vào mộ" — hai kiểu lá rất phổ biến ở bài cổ điển                                                            | Trung bình                               |
| Duration (`ModifyStat` tới hết lượt)                                                                                                   | Phép Tức thời "quái của bạn +700 ATK tới hết lượt" — ở 4.7 mọi buff phải là Continuous / Equip                                                                  | Trung bình                               |
| Trigger `OnAttackDeclared` / `OnDamage` / `OnPhaseStart`                                                                               | "Khi quái này tấn công…", "khi gây sát thương chiến đấu: rút 1", "mỗi Standby Phase: hồi 300"                                                                   | Thấp – trung bình                        |
| Condition `LPCompare`, `HasCardIn`; filter `atk` / `def`                                                                               | "Chỉ khi LP của bạn thấp hơn đối thủ", "phá 1 quái có ATK ≥ 1500" — ở 4.7 chỉ lọc được theo Cấp                                                                 | Thấp                                     |
| `Search` + `Shuffle`; `Banish`; "vô hiệu **hiệu ứng**" (khác vô hiệu việc kích hoạt)                                                   | "Lấy 1 quái Thú từ Deck lên tay"; lá loại khỏi cuộc chơi; SMP-212 chỉ chặn được việc kích hoạt                                                                  | Thấp (batch 3+)                          |

**Đề xuất phạm vi task 4.8 (primitive set 1)**, theo thứ tự: (1) sửa lỗi P7 + bất biến fuzz "prompt đang mở luôn có câu trả
lời hợp lệ"; (2) quái trên sân kích hoạt `Ignition` + `OncePerTurn` (cần `legalActions`, wire, UI chạm vào quái — có thể
tách 4.8 engine / 4.8b wire như 4.4 / 4.4b); (3) cost có chọn lá cho trigger; (4) `ChangePosition`. Mỗi mục kèm 2–3 lá thật
dùng nó. Các mục còn lại để batch 3.

## Import hàng loạt (không viết tay từng lá)

> **Chưa làm — `[DECISION]` ADR 058 (2026-09-30):** card data hiện viết tay bằng TS ở
> `packages/shared/src/cards/sample-cards.ts`, validate bằng `CardDefinitionSchema` trong test; pipeline CSV dưới đây
> là kế hoạch để sau (chỉ làm khi số lá đủ lớn và chủ dự án yêu cầu). Các lệnh `pnpm cards:*` chưa tồn tại.

- Nguồn: `data/cards/*.csv` (cột cố định) hoặc `*.json` cho effect phức tạp. Script `pnpm cards:build` sinh
  `packages/shared/src/cards/generated/*.ts` (hoặc JSON) và **fail nếu Zod validate lỗi**.
- Script `pnpm cards:validate`: id trùng, level ngoài 1–12, tham chiếu effect/scriptId không tồn tại, thiếu i18n.
- Vanilla: hoàn toàn từ CSV. Effect: cột `effects_json` hoặc file JSON riêng.
- Bạn có thể sửa CSV (tên, ATK/DEF, text) không cần code; tôi review lỗi validate cho bạn.

## Quy ước test mỗi card (bắt buộc)

| Tier  | Test                                                                                                                |
| ----- | ------------------------------------------------------------------------------------------------------------------- |
| A     | Auto: schema hợp lệ; summon được; ATK/DEF đúng                                                                      |
| B     | File test riêng `cards/<id>.test.ts`: kích hoạt hợp lệ, kích hoạt sai điều kiện bị chặn, kết quả đúng, chain nếu có |
| C     | Như B + comment lý do dùng `scriptId`                                                                               |
| Chung | Test snapshot `events` để bắt regression                                                                            |

## Quy trình thêm card mới (`/new-card`)

1. Chọn tier; nếu B/C, ghi effect dạng văn bản VI/EN.
2. Thêm lá vào `sample-cards.ts` (cuối dãy id; `/new-card` hướng dẫn). CSV/JSON: để sau (ADR 058).
3. Nếu thiếu primitive → `/new-effect-type` trước.
4. Viết test theo quy ước (shared: schema; engine: `cards/sample/<id>.test.ts`); test xanh.
5. Cập nhật Card Gallery (tự động) + `parity-board.md` (card đã có).
6. Nếu cần art → tạo mục trong `docs/assets/ASSET_REQUESTS.md`.
