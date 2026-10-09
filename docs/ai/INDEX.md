# AI docs index — đọc gì cho task nào

File này chỉ là **bản đồ** (được tự nạp). Kiến thức nằm ở file đích; đọc file đích TRƯỚC khi sửa code thuộc chủ đề đó.
ADR = `docs/ai/decisions/NNN-*.md` (Glob theo số); mục lục + trạng thái "đã thay một phần": `docs/ai/DECISIONS.md`.
Khối "Ghi chú đọc kèm" đầu mỗi ADR cho biết phần nào đã bị ADR sau thay — đọc cả ADR được trỏ tới.

## Luôn đọc theo package đụng tới

`packages/game-engine/CLAUDE.md` · `packages/shared/CLAUDE.md` · `apps/api/CLAUDE.md` · `apps/web/CLAUDE.md` (luật +
"thêm X thì sửa những đâu" của từng package; tự nạp khi mở file trong package).

## Theo chủ đề

| Task đụng tới                                                           | Contract / kế hoạch                                                                | ADR                                              |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------ |
| Engine: phase, draw, summon, tribute, đổi thế, combat, thắng/thua       | `docs/design/engine.md`, `docs/plan/rules-coverage.md`, `RULES-REVIEW-SHEET.md`    | 020–030                                          |
| Engine: mã lỗi, `ActionContext`, prompt (`PendingPrompt`)               | `docs/design/engine.md`                                                            | 022, 030, 068, 071                               |
| Effect DSL: schema, operation, cost, target, condition                  | `docs/design/effect-dsl.md`, `docs/plan/card-and-effect-plan.md`                   | 046, 047, 053, 059, 061, 063, 065, 070, 071      |
| Chain, Spell Speed, lá Set, cửa sổ phản ứng                             | `docs/design/engine.md` (Chain stack)                                              | 018, 049, 050, 051, 054, 063, 065–067            |
| Trigger (OnSummon/OnDestroyed/OnFlip), Continuous, `scriptId`, Equip    | `docs/design/effect-dsl.md`, `engine.md` (Trigger effect)                          | 052, 053, 060, 061, 067, 071                     |
| Field Spell, lá Continuous Spell/Trap ở lại sân, Field Zone             | `docs/design/engine.md` (Field Spell + lá ở lại sân)                               | 053, 061, 063, 064                               |
| Counter Trap, Negate (kích hoạt / tấn công / triệu hồi)                 | `docs/design/engine.md` (Counter Trap + Negate), `effect-dsl.md`                   | 050, 051, 052, 065, 066, 067                     |
| Fusion, Extra Deck, prompt lúc resolve (chain tạm dừng), `validateDeck` | `docs/design/engine.md` (Fusion), `effect-dsl.md` (`FusionSummon`)                 | 059, 068, 069                                    |
| `legalActions`                                                          | `docs/design/protocol.md`                                                          | 037, 071                                         |
| Golden replay, fuzz, mutation test, test chập chờn                      | `docs/plan/testing-strategy.md`                                                    | 031, 058, 062, 064–071                           |
| Wire: StateView, EventView, rò thông tin, lọc theo ghế                  | `docs/design/event-visibility.md`, `docs/design/protocol.md`                       | 032, 034, 048, 055, 062, 064, 065, 066, 068, 069 |
| API: DuelService, HTTP, guest/JWT, quyền ghế, deck validate             | `docs/design/protocol.md`, `docs/plan/backend-plan.md`                             | 003, 033, 035, 036                               |
| AI đối thủ (`solo-vs-ai`)                                               | `docs/design/protocol.md` (solo-vs-ai)                                             | 038, 048, 055, 057, 062, 064, 066, 069, 071      |
| Phaser Duel Scene, kéo thả, UI chuỗi, menu/picker                       | `docs/plan/ui-plan.md`, `docs/reference/notes/layout-analysis.md`                  | 039, 040, 054, 056, 062, 064, 066, 069           |
| Animation, thời lượng, log panel                                        | `docs/plan/animation-plan.md`, `docs/reference/notes/animation-durations.md`       | 041, 042, 066, 069                               |
| i18n, text lá song ngữ                                                  | —                                                                                  | 016, 045, 046                                    |
| Card data, deck mẫu/demo, scenario                                      | `docs/plan/card-and-effect-plan.md`, `.claude/commands/new-card.md`                | 046, 057, 058, 062, 064–066, 068–070             |
| Trang debug, Duel Sandbox, dev tool                                     | `docs/design/debug-ui.md`, `docs/plan/dev-tools-and-review.md`                     | 014, 036, 044, 069, 071                          |
| Luật Yugi H5 gốc, nhãn `[REF]/[RULE]/[DECISION]/[GUESS]`, mục G#/C#     | `docs/plan/fidelity-spec.md`, `docs/reference/notes/rules.md`, `rules-observed.md` | 012, 013, 017, 018, 019, 054                     |
| Asset, card art                                                         | `docs/plan/card-art-pipeline.md`, `docs/assets/ASSET_REQUESTS.md`                  | 015                                              |
| Stack, tooling, môi trường, build                                       | `README.md`, `docs/ai/LESSONS.md`                                                  | 001–010                                          |
| Phase/scope, thứ tự task, P10–P15                                       | `docs/plan/MASTER-PLAN.md`, `docs/ai/ROADMAP.md`, `economy-plan.md`                | 011, 012, 043                                    |
| Việc/tư liệu cần người dùng, bảng duyệt                                 | `docs/plan/human-tasks.md`, `docs/plan/parity-board.md`, `RULES-REVIEW-SHEET.md`   | 064 (ủy quyền + ký hiệu duyệt), 069              |

`RULES-REVIEW-SHEET.md`, `rules.md`, `rules-observed.md` ở `docs/reference/notes/`; `economy-plan.md` ở `docs/plan/`.

## Lịch sử một task cụ thể

Đã làm gì / số liệu: `docs/ai/progress/p<phase>.md`. Checklist duyệt + cách xem: `docs/ai/review-packets/task-<số>.md`.
Vì sao làm vậy: ADR có cột Task = số task trong `docs/ai/DECISIONS.md`.

## Khi nào BẮT BUỘC tra ADR

- Sắp đổi một hành vi có nhãn `[DECISION]`/`[ASSUMED]`, hoặc làm ngược một dòng trong `docs/ai/LESSONS.md`.
- Brief/task mới mâu thuẫn với code hoặc tài liệu đã duyệt → tra ADR của chủ đề trước, rồi hỏi chủ dự án; không tự chọn.
- Gặp tham chiếu "ADR <số task>" / "ADR <ngày>" trong code hay docs.

Thuật ngữ: `docs/ai/GLOSSARY.md`. Mâu thuẫn docs ↔ code đang chờ duyệt: `docs/ai/OPEN-ISSUES.md`.
