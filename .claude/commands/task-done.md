---
description: Chạy kiểm tra, cập nhật PROGRESS/DECISIONS, báo cáo hoàn thành task
---

Trước khi báo task đã xong:

1. Chạy lint + typecheck + test cho (các) package/app đã sửa:
   `pnpm --filter <pkg> lint && pnpm --filter <pkg> typecheck && pnpm --filter <pkg> test`
   (hoặc `pnpm lint && pnpm typecheck && pnpm test` ở root nếu đụng nhiều package).
2. Nếu sửa `apps/api` hoặc `apps/web`: xác nhận `pnpm build` cho package đó vẫn xanh.
3. Cập nhật `docs/ai/PROGRESS.md` (bắt buộc): đánh dấu việc đã xong, cập nhật mục "Bàn giao
   cho task tiếp theo".
4. Nếu có quyết định thiết kế mới (đổi thư viện, đổi cấu trúc, chọn cách tiếp cận không hiển
   nhiên) → thêm 1 mục vào `docs/ai/DECISIONS.md` (ngày, quyết định, lý do, hệ quả).
5. Nếu đổi contract (Action/Event/EffectDefinition/API endpoint) → cập nhật
   `docs/design/*.md` tương ứng.
6. Nếu phát sinh luật mới cho 1 package cụ thể → cập nhật `CLAUDE.md` của package đó (hoặc
   root `CLAUDE.md` nếu là luật chung).
7. Báo cáo cuối: đã làm gì, file nào đổi, cách verify (lệnh đã chạy + kết quả), việc tiếp
   theo đề xuất (nếu có).
