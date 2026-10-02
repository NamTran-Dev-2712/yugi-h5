# Task 4.3b — Phase 0: kết quả dọn nợ duyệt (2026-10-01)

**AI tự xử lý: 25 · Chủ dự án chọn (qua hộp thoại, 8 câu): 13 · Còn chờ: 5.** Chỉ sửa tài liệu; 0 dòng code/test game.
Ký hiệu trong `RULES-REVIEW-SHEET.md`: `☑` trần = chủ dự án tự tick (59 dòng, không đụng; chỉ khoảng trắng căn cột đổi do
prettier); `☑ (AI duyệt thay, …)`; `☑ (chủ dự án chọn qua hộp thoại, …)`.

## A. OPEN-ISSUES (đã xoá khỏi file những mục xong)

| Mục | Quyết định                                                                                                        | Ai                                     | Bằng chứng ngắn                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------ |
| A1  | GLOSSARY "Spell Speed" viết lại: Counter Trap 3, Trap khác + Quick-Play 2, còn lại 1; Ignition = Speed 1          | AI                                     | `effects/spell-speed.ts`, ADR 050/052                                                |
| A2  | GLOSSARY: ví dụ event `CardSummoned` → `NormalSummoned`; ô Field "dùng từ 4.3"                                    | AI                                     | `events/types.ts`                                                                    |
| A3  | `apps/api/CLAUDE.md`: validation = pipe tự viết `ZodPipe`                                                         | AI                                     | `common/pipes/zod-pipe.ts`; gỡ dependency → còn chờ (P1)                             |
| A4  | Root `CLAUDE.md` #5 (+ câu ở `apps/api/CLAUDE.md`) ghi đúng 6 bảng trong `schema.prisma`                          | **Chủ dự án** ("Sửa cho khớp thực tế") | `apps/api/prisma/schema.prisma`                                                      |
| A5  | `event-visibility.md`: tiêu đề bảng ghi đúng số (28/30; lên 30 ở phần code 4.3b)                                  | AI                                     | đếm dòng bảng = union `GameEvent`                                                    |
| A6  | Agent `engine-reviewer`: trỏ `engine.md` / sheet / ADR; reject bằng `EngineError` có mã                           | AI                                     | ADR 022                                                                              |
| A7  | `/new-action`: thêm bước legalActions, fuzz/golden, wire (schema, `toEventView`, i18n), M→P                       | AI                                     | `CLAUDE.md` các package                                                              |
| A8  | `/new-card`, `/new-effect-type`: effect engine đã có, test lá ở `cards/sample/<id>.test.ts`, `state.rng`, data TS | AI                                     | ADR 057, 058                                                                         |
| A9  | ROADMAP P4 + `card-and-effect-plan.md`: "data TS, CSV để sau"                                                     | AI                                     | ADR 058                                                                              |
| A10 | `fidelity-spec.md` dòng G5 + dòng Chain của ma trận: chạm lá, không dialog                                        | AI                                     | C13, ADR 054                                                                         |
| A11 | `chain-basic.json` không cần `script` nữa (ghi ở Ghi chú đọc kèm ADR 044; không sửa JSON)                         | AI                                     | đã có `chain-reaction-real.json`                                                     |
| B-1 | Đối chiếu ngưỡng Tribute với tư liệu: **khớp** (Lv 5–6: 1, Lv 7+: 2), không hỏi                                   | AI                                     | `docs/reference/02-yugi-h5-mechanics.md` dòng 12–13; ghi ở `progress/p1.md`, ADR 023 |
| B-2 | Ghi chú số task lệch ở ADR 016/017/023/035/036/049: đã có đủ, không sửa thêm                                      | AI                                     | khối Ghi chú đọc kèm từng file                                                       |
| B-3 | Backlog PROGRESS: gạch (1) `validateDeck`, (9) schema Action; gộp (2)≡(7), (3)≡(8)                                | AI                                     | `validate-deck.ts`, `action-schema.ts`                                               |
| C-1 | Quan hệ ADR 037 → 062 (test chi phí legalActions): **đúng**, giữ                                                  | AI                                     | ADR 062 mục Chore (a)                                                                |
| C-2 | Ghi chú ADR 044 (`chain-basic`): sửa thành sự thật đã kiểm (không có script, không cần)                           | AI                                     | file JSON                                                                            |

## B. RULES-REVIEW-SHEET — 21 dòng chưa duyệt

**AI duyệt thay (10 dòng, chỉ nhãn `[RULE]`)** — đủ 4 điều kiện: tên test có thật và xanh (895/895 test engine, 32 tên test
đối chiếu từng cái), đã đọc thân test khớp cột "Kết quả mong đợi", không mâu thuẫn `[REF]`/dòng đã ☑/ADR:
OnSummon bắt buộc · OnSummon tuỳ chọn · Úp quái không phải triệu hồi · OnDestroyed · Trigger không thoả điều kiện ·
Liên tục tăng/giảm ATK/DEF · Liên tục mất khi lá rời sân · Special Summon bằng effect · Flip Summon · Lá Môi trường bị phá.
Không dòng nào phải sửa mô tả/tên test.

| Dòng (chủ dự án chọn qua hộp thoại)                                           | Câu hỏi → trả lời                                                                     |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Nhiều trigger cùng lúc (G15)                                                  | Game tự xếp theo thứ tự xảy ra → **Chấp nhận**                                        |
| Hiệu ứng Lật (G15 + ADR 060)                                                  | Như trên + "Flip Summon có tính là được triệu hồi?" → **Có tính**                     |
| Quái được Special Summon (G17)                                                | Tự vào ô trống đầu tiên, Tư thế Công → **Chấp nhận**                                  |
| Lá Trang bị · Lá Trang bị rời sân theo quái (G18)                             | Ô trống đầu tiên; "gửi vào mộ" không tính "bị phá" → **Chấp nhận**                    |
| Field úp rồi kích hoạt · Field mới thay lá cũ · Kích hoạt Phép Liên tục (G20) | Lá cũ "gửi vào mộ"; Phép Liên tục tự vào ô trống → **Chấp nhận**                      |
| Hiệu ứng liên tục không kích hoạt · Bẫy Liên tục · Phép thường đã úp          | 3 điều đã chốt trước → **Duyệt cả nhóm** (dòng đầu: sửa câu "để sang P4" đã lỗi thời) |

**Dòng mới, ô duyệt để trống:** "Quái vừa được triệu hồi: tấn công" — câu hỏi bắt buộc → **"Giữ: chưa được (tạm)"** ⇒ nhãn
`[GUESS]`, thêm **G22** ở `fidelity-spec.md`; engine không đổi, không tạo task đổi luật.

## C. Còn chờ chủ dự án (bảng ở `docs/ai/OPEN-ISSUES.md`)

1. Gỡ dependency `nestjs-zod` (không dùng). 2. Mở rộng `CLAUDE.md` #5 cho P10+ (ADR 043). 3. Id SMP-208 cho Bẫy Liên tục.
2. AI tự Flip Summon (ADR 062). 5. G22 — xem lại khi có video bản gốc.
