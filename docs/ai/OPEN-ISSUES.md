# Open issues — mâu thuẫn tài liệu ↔ code chờ chủ dự án duyệt

Mỗi mục nêu bằng chứng và đề xuất; chủ dự án chọn rồi AI sửa trong một task riêng. Xong mục nào thì xoá mục đó khỏi
file này. Lần dọn gần nhất: **task 4.4b Phase 0 (2026-10-02)** — chủ dự án chốt: P1 gỡ dependency `nestjs-zod` (đã gỡ,
commit riêng của 4.4b), P3 giữ id SMP-208, P4 giữ AI Flip Summon quái úp (ba mục đã xoá khỏi bảng); P5/G22 "giữ tạm",
P2 để tới P10. Lần trước: task 4.3b Phase 0 (2026-10-01), kết quả ở `docs/ai/review-packets/task-4.3b-triage.md`.

## Chờ chủ dự án

| #   | Vấn đề                                                                                                                                                                            | Bằng chứng                                                                                     | Đề xuất                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| P2  | ADR 043 **đề xuất** mở rộng danh sách bảng DB ở root `CLAUDE.md` #5 cho P10–P15 (Economy…). Câu #5 nay đã khớp `schema.prisma` hiện tại (chủ dự án chọn 2026-10-01), chưa mở rộng | `docs/ai/decisions/043-2026-09-25-scope-expansion-p10-p15.md`; `apps/api/prisma/schema.prisma` | Chủ dự án chốt 2026-10-02: **để tới P10** (quyết khi bắt đầu P10)       |
| P5  | Quái vừa triệu hồi chưa tấn công được trong lượt đó — đang là `[GUESS]` **G22** ("giữ tạm", chủ dự án chọn 2026-10-01, nhắc lại 2026-10-02)                                       | `docs/plan/fidelity-spec.md` G22; dòng G22 ở `RULES-REVIEW-SHEET.md` (ô duyệt trống)           | **Giữ tạm**; xem lại khi có video bản gốc; đổi luật = task engine riêng |
