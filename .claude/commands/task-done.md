---
description: Chạy kiểm tra, cập nhật PROGRESS/DECISIONS, báo cáo hoàn thành task
---

Trước khi báo task đã xong:

1. Chạy lint + typecheck + test cho (các) package/app đã sửa:
   `pnpm --filter <pkg> lint && pnpm --filter <pkg> typecheck && pnpm --filter <pkg> test`
   (hoặc `pnpm lint && pnpm typecheck && pnpm test` ở root nếu đụng nhiều package).
2. Nếu sửa `apps/api` hoặc `apps/web`: xác nhận `pnpm build` cho package đó vẫn xanh.
3. Cập nhật tiến độ (bắt buộc), hai nơi:
   - `docs/ai/progress/p<phase>.md`: thêm vào CUỐI một mục chi tiết cho task (đã làm gì, file/lớp,
     số test, mutant, smoke, ảnh, việc chưa làm, bàn giao cho task tiếp theo).
   - `docs/ai/PROGRESS.md` (tự nạp, giữ dưới ~8.000 ký tự): chỉ sửa "Đang ở đâu", dòng checklist
     của phase, "Chờ chủ dự án", "Giới hạn / quan sát chưa sửa", backlog. Không chép chi tiết vào đây.
4. Nếu có quyết định thiết kế mới (đổi thư viện, đổi cấu trúc, chọn cách tiếp cận không hiển
   nhiên) → tạo file `docs/ai/decisions/NNN-YYYY-MM-DD-<slug>.md` (ngày, quyết định, lý do, hệ
   quả; quy tắc ở đầu `docs/ai/DECISIONS.md`), thêm 1 dòng vào bảng mục lục `docs/ai/DECISIONS.md`,
   và thêm vào `docs/ai/INDEX.md` nếu là chủ đề mới. ADR mới thay một phần ADR cũ: không sửa thân
   ADR cũ, chỉ thêm 1 dòng vào khối "Ghi chú đọc kèm" của nó. Bài học dùng cho mọi task → thêm 1
   dòng vào `docs/ai/LESSONS.md`.
5. Nếu đổi contract (Action/Event/EffectDefinition/API endpoint) → cập nhật
   `docs/design/*.md` tương ứng.
6. Nếu task thuộc Engine: cập nhật `docs/reference/notes/RULES-REVIEW-SHEET.md` (thêm dòng luật, đổi tên test thật) và
   `docs/plan/parity-board.md`; kết thúc bằng `/review-packet`.
7. Nếu phát sinh luật mới cho 1 package cụ thể → cập nhật `CLAUDE.md` của package đó (hoặc
   root `CLAUDE.md` nếu là luật chung).
8. Báo cáo cuối: đã làm gì, file nào đổi, cách verify (lệnh đã chạy + kết quả), việc tiếp
   theo đề xuất (nếu có).
