# Open issues — mâu thuẫn tài liệu ↔ code chờ chủ dự án duyệt

Mỗi mục nêu bằng chứng và đề xuất; chủ dự án chọn rồi AI sửa trong một task riêng. Xong mục nào thì xoá mục đó khỏi
file này. Lần dọn gần nhất: **task 4.3b Phase 0 (2026-10-01)** — nhóm A (A1–A11), B, C của lần tách docs đã xử lý xong,
kết quả từng mục ở `docs/ai/review-packets/task-4.3b-triage.md`.

## Chờ chủ dự án

| #   | Vấn đề                                                                                                                                                                            | Bằng chứng                                                                                     | Đề xuất                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| P1  | Dependency `nestjs-zod` có trong `apps/api/package.json` nhưng `src` không import (pipe thật là `ZodPipe` tự viết). Câu trong `apps/api/CLAUDE.md` đã sửa; dependency chưa gỡ     | `apps/api/src/common/pipes/zod-pipe.ts`; ADR 035                                               | Gỡ dependency (đổi `package.json` + lockfile) — cần chủ dự án đồng ý |
| P2  | ADR 043 **đề xuất** mở rộng danh sách bảng DB ở root `CLAUDE.md` #5 cho P10–P15 (Economy…). Câu #5 nay đã khớp `schema.prisma` hiện tại (chủ dự án chọn 2026-10-01), chưa mở rộng | `docs/ai/decisions/043-2026-09-25-scope-expansion-p10-p15.md`; `apps/api/prisma/schema.prisma` | Quyết khi bắt đầu P10                                                |
| P3  | Lá Bẫy Liên tục mang id **SMP-208** (brief 4.3 dự kiến SMP-116; dãy 2xx là Bẫy)                                                                                                   | ADR 063                                                                                        | Xác nhận giữ SMP-208                                                 |
| P4  | AI tự Flip Summon quái úp khi ATK > quái Tấn công mạnh nhất của đối thủ (ngoại lệ có số đo so với brief 4.2d "AI không cần dùng cơ chế mới")                                      | ADR 062; `apps/api/src/modules/duels/ai/choose-action.ts`                                      | Xác nhận giữ                                                         |
| P5  | Quái vừa triệu hồi chưa tấn công được trong lượt đó — đang là `[GUESS]` **G22** ("giữ tạm", chủ dự án chọn 2026-10-01)                                                            | `docs/plan/fidelity-spec.md` G22; dòng cuối `RULES-REVIEW-SHEET.md` (ô duyệt trống)            | Xem lại khi có video bản gốc; đổi luật = task engine riêng           |
