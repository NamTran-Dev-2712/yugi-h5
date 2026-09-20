# Card & Effect Plan

Nguyên tắc (CLAUDE.md #3, #5): card = data ở `packages/shared`; engine không hardcode effect; lá quá phức tạp dùng `scriptId`.
Card mặc định là **placeholder tự đặt tên**, không tên/art Konami.

## Schema CardDefinition mở rộng (đề xuất, chốt ở task 3.1)

Hiện có: `id, name, effectText, scriptId, kind, category, attribute, race, level, atk, def, subType`.

| Trường thêm                                          | Mục đích                                     | Phase |
| ---------------------------------------------------- | -------------------------------------------- | ----- |
| `name`, `effectText` → `{ vi, en }` (hoặc `i18nKey`) | i18n text card ở data                        | P2/P3 |
| `effects: EffectDefinition[]`                        | Effect DSL (xem `docs/design/effect-dsl.md`) | P3    |
| `artId?`                                             | Tách art khỏi id (mặc định = `id`)           | P5    |
| `tags?: string[]`                                    | Lọc/batch/test (vd `batch1`, `vanilla`)      | P4    |
| `fusionMaterials?`                                   | Fusion                                       | P4    |
| `ritualRequirement?`                                 | Ritual                                       | P4    |
| `tier: 'A'\|'B'\|'C'`                                | Dẫn xuất được từ effects/scriptId, validate  | P3    |

Thay đổi contract → cập nhật `docs/design/effect-dsl.md` và ADR.

## Phân tầng effect

| Tier | Định nghĩa                                                            | Cách làm                     | Test                          |
| ---- | --------------------------------------------------------------------- | ---------------------------- | ----------------------------- |
| A    | Vanilla (chỉ ATK/DEF) hoặc Normal Spell/Trap chỉ 1 operation phổ biến | Data thuần, sinh CSV         | Test tự động chung (smoke)    |
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

| Batch | Nội dung                                                                                                      | Phase |
| ----- | ------------------------------------------------------------------------------------------------------------- | ----- |
| 0     | 5 card mẫu hiện có + ~10 vanilla để chạy vertical slice                                                       | P2    |
| 1     | 20 vanilla (đủ level 1–8, đủ thuộc tính/race) + 10 Spell/Trap cơ bản (Damage/Heal/Draw/Destroy/Negate summon) | P4    |
| 2     | Trigger (OnSummon/OnFlip/OnDestroyed), Continuous, Quick-Play, Equip                                          | P4    |
| 3     | Field, Counter Trap, Special Summon, Fusion/Ritual mẫu                                                        | P4    |
| 4+    | Bộ card lớn hơn theo nhu cầu deck AI/PvE (mỗi lô 20–30 lá)                                                    | P8–P9 |

## Import hàng loạt (không viết tay từng lá)

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
2. Thêm dòng CSV/JSON (hoặc `/new-card` sinh).
3. Nếu thiếu primitive → `/new-effect-type` trước.
4. Viết test theo quy ước; `pnpm cards:validate` + test xanh.
5. Cập nhật Card Gallery (tự động) + `parity-board.md` (card đã có).
6. Nếu cần art → tạo mục trong `docs/assets/ASSET_REQUESTS.md`.
