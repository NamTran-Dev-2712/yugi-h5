# Open issues — mâu thuẫn tài liệu ↔ code chờ chủ dự án duyệt

Mỗi mục nêu bằng chứng và đề xuất; chủ dự án chọn rồi AI sửa trong một task riêng. Xong mục nào thì xoá mục đó khỏi
file này. **Task 4.8 (2026-10-09) đã sửa và xoá mục P7** (prompt không ai trả lời được khi lá Trang bị rời sân cùng quái —
ADR 071; có bất biến fuzz "prompt đang mở luôn có câu trả lời" để nó không quay lại). Lần dọn trước đó: **task 4.5b Phase 0 (2026-10-04)** — chủ dự án **chốt giữ** luật G22 (quái vừa triệu hồi chưa
tấn công được trong lượt đó; mục P5 đã xoá khỏi bảng), chấp nhận G25 (b)(c) và G26 (d); G26 (f) "giữ tạm" (mục P6 mới).
Kết quả ở `docs/ai/review-packets/task-4.5b-triage.md`. Lần trước: task 4.4b Phase 0 (2026-10-02), task 4.3b Phase 0
(2026-10-01, `docs/ai/review-packets/task-4.3b-triage.md`).

## Chờ chủ dự án

| #   | Vấn đề                                                                                                                                                                                                                     | Bằng chứng                                                                                                          | Đề xuất                                                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| P2  | ADR 043 **đề xuất** mở rộng danh sách bảng DB ở root `CLAUDE.md` #5 cho P10–P15 (Economy…). Câu #5 nay đã khớp `schema.prisma` hiện tại (chủ dự án chọn 2026-10-01), chưa mở rộng                                          | `docs/ai/decisions/043-2026-09-25-scope-expansion-p10-p15.md`; `apps/api/prisma/schema.prisma`                      | Chủ dự án chốt 2026-10-02: **để tới P10** (quyết khi bắt đầu P10)                                                     |
| P6  | Lá dung hợp lấy nguyên liệu từ **Bộ bài** (G26 f): engine đã hỗ trợ (nguyên liệu vào mộ, Bộ bài được xáo lại) nhưng chưa có tư liệu bản gốc và chưa lá thật nào dùng; chủ dự án chọn **"giữ tạm, chờ tư liệu"** 2026-10-04 | `docs/plan/fidelity-spec.md` G26; dòng "Nguyên liệu lấy từ Deck" ở `RULES-REVIEW-SHEET.md` (ô duyệt trống); ADR 068 | **Giữ tạm**; nguồn `Deck` không lên wire / UI (task 4.5b); xem lại khi có video "Bộ bài" (`docs/plan/human-tasks.md`) |
