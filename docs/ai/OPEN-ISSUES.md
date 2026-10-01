# Open issues — mâu thuẫn tài liệu ↔ code chờ chủ dự án duyệt

Tìm thấy khi tách docs (2026-10-01). **Chưa sửa** (trừ mục ghi "đã sửa"): mỗi mục nêu bằng chứng và đề xuất; chủ dự án
chọn rồi AI sửa trong một task riêng. Xong mục nào thì xoá mục đó khỏi file này.

## A. Tài liệu lệch code (code là bằng chứng)

| #   | Tài liệu nói                                                                                                                            | Thực tế (bằng chứng)                                                                                                                                                                               | Đề xuất                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| A1  | `docs/ai/GLOSSARY.md` "Spell Speed": Trap thường = 1; "most Trigger/Ignition effect" = 2; "Ignition … lên chain như Spell Speed 2"      | `packages/game-engine/src/effects/spell-speed.ts`: Counter Trap 3, Trap khác 2, Quick-Play 2, **còn lại 1** (kể cả Ignition/Trigger của quái) — khớp ADR 050, 052                                  | Sửa GLOSSARY theo code                                               |
| A2  | `docs/ai/GLOSSARY.md` "GameEvent": ví dụ `CardSummoned`                                                                                 | Không có event đó; engine dùng `NormalSummoned` (`packages/game-engine/src/events/types.ts`)                                                                                                       | Sửa ví dụ                                                            |
| A3  | `apps/api/CLAUDE.md`: "Validation dùng Zod (`nestjs-zod`)"                                                                              | `nestjs-zod` có trong `package.json` nhưng `src` không import; pipe thật là `apps/api/src/common/pipes/zod-pipe.ts` (lý do: ADR 035)                                                               | Sửa câu; cân nhắc gỡ dependency `nestjs-zod` (hỏi trước)             |
| A4  | Root `CLAUDE.md` #5: DB lưu "User/Collection/Deck/MatchHistory/**Progress**"; `apps/api/CLAUDE.md`: "User/Collection/Deck/MatchHistory" | `apps/api/prisma/schema.prisma`: `User`, `RefreshToken`, `CardCollection`, `Deck`, `DeckCard`, `DuelMatch` — chưa có Progress. Ngoài ra ADR 043 đang **đề xuất** mở rộng danh sách này (chờ duyệt) | Chủ dự án quyết câu chữ #5 (gộp với đề xuất ADR 043)                 |
| A5  | `docs/design/event-visibility.md`: tiêu đề "Table (25 engine events)"                                                                   | Bảng có đủ 28 dòng = 28 thành viên union `GameEvent`; chỉ con số trong tiêu đề cũ                                                                                                                  | Sửa số (hoặc bỏ số)                                                  |
| A6  | `.claude/agents/engine-reviewer.md`: đối chiếu "`CLAUDE.md` root phần LUẬT GAME"; "không throw cho case hợp lệ nhưng không làm gì"      | Root `CLAUDE.md` không có phần đó (luật ở `docs/design/engine.md`, `RULES-REVIEW-SHEET.md`); engine reject bằng `EngineError` (ADR 022)                                                            | Cập nhật agent trỏ đúng tài liệu                                     |
| A7  | `.claude/commands/new-action.md`: chỉ có bước type/handler/event/test; nhãn "M1/M2"                                                     | Thêm action nay còn cần: bộ sinh ứng viên `legalActions`, `PlayerActionSchema` hoặc `ENGINE_ONLY_ACTIONS`, generator fuzz, câu i18n mã lỗi (đều ghi ở `CLAUDE.md` các package)                     | Bổ sung các bước; đổi M→P                                            |
| A8  | `.claude/commands/new-card.md` + `new-effect-type.md`: "chỉ khi effect engine đã có ở M2", test ở `card-definition.test.ts`, `ctx.rng`  | Effect engine đã có từ P3; lá thật có test riêng ở `packages/game-engine/src/cards/sample/<id>.test.ts` (ADR 057); RNG nằm ở `state.rng`                                                           | Cập nhật theo quy trình 3.8/4.1 (đường dẫn `effect-scripts/` đã sửa) |
| A9  | `docs/ai/ROADMAP.md` P4 và `docs/plan/card-and-effect-plan.md`: "CSV → validate"                                                        | ADR 058 `[DECISION]`: không làm pipeline CSV, data viết TS (`MASTER-PLAN.md` đã ghi "CSV để sau")                                                                                                  | Sửa ROADMAP + ghi chú trong card-and-effect-plan                     |
| A10 | `docs/plan/fidelity-spec.md` bảng G (dòng G5) và ma trận (dòng Chain): "Hỏi Kích hoạt? … auto-pass"                                     | C13 đã quyết 2026-09-28 (ADR 054) và chính file đó ghi nhận ở đoạn dưới bảng; hai dòng bảng chưa đổi                                                                                               | Sửa 2 dòng bảng                                                      |
| A11 | `packages/shared/scenarios/chain-basic.json`: ADR 044 hẹn "khi P3 xong thêm `script`"                                                   | File vẫn chưa có `script` (P3 đã xong nháp; đã có scenario lá thật khác)                                                                                                                           | Thêm script hoặc ghi rõ là không cần nữa                             |

## B. Câu đã lỗi thời nằm trong văn bản nguyên văn (không sửa thân, đã chú thích)

- ADR 023 và nhật ký `docs/ai/progress/p1.md` ("Củng cố trước 1.4"): "`docs/reference/02-yugi-h5-mechanics.md` chưa có
  trong repo" — file **đã có** (commit `6709070`). Việc "đối chiếu ngưỡng tribute khi file được thêm" (ADR 023) chưa thấy
  ghi là đã làm → cần một lượt đối chiếu.
- Số task trong ADR cũ lệch do đổi số: ADR 016 (i18n "task 2.10" → thực tế 2.12), ADR 017 (Surrender "task 1.8" → 1.9),
  ADR 023 (SelectTribute "gần 2.6" → 2.8), ADR 035/036 ("2.4/2.5 (AI)" → 2.6), ADR 049 ("3.3b" → 3.4b). Đã chú thích ở
  khối "Ghi chú đọc kèm" của từng file.
- Backlog trong `docs/ai/PROGRESS.md`: mục (1) và (9) có vẻ đã xong (2.3, 2.4); (2)≡(7), (3)≡(8). Giữ nguyên văn, chờ
  xác nhận rồi gạch.

## C. Quan hệ "thay một phần" do AI suy ra (cần duyệt)

Mọi dòng "Ghi chú đọc kèm" ở đầu các file ADR là do AI thêm khi tách file, dựa trên chính lời ADR sau. Hai dòng **không**
có câu xác nhận tường minh trong ADR sau: ADR 037 → ADR 062 (ngưỡng 300 ms của test chi phí `legalActions`), ADR 044
(`chain-basic`). Nếu một ghi chú sai: sửa dòng ghi chú đó và cột Trạng thái trong `docs/ai/DECISIONS.md`.

## D. Đã sửa trong lần tách này (có bằng chứng rõ)

- `.claude/commands/new-card.md`: `effects/scripts/` → `effects/effect-scripts/` (thư mục thật; ADR 053).
- Tiêu đề PROGRESS "Phase hiện tại: P3" → P4 (4.1–4.2d đã làm; checklist cùng file).
- Root `CLAUDE.md`: 2 chỗ bị formatter làm vỡ câu ("kéo thả + flow lượt" thành gạch đầu dòng; mục 6b và 7 dính một dòng).
