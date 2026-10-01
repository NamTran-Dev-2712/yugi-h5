# \_migration — tách docs AI (2026-10-01)

Thư mục tạm của lần tái cấu trúc docs. **Không phải nguồn sự thật — đừng đọc để lấy kiến thức, đừng sửa.**

- `original/` — bản đóng băng của `CLAUDE.md`, `docs/ai/PROGRESS.md`, `docs/ai/DECISIONS.md` tại commit `566d9f5`
  (cũng lấy lại được bằng `git show 566d9f5:<path>`). `.ignore` khiến ripgrep/Grep bỏ qua thư mục này.
- `split.mjs` — script đã tách (chỉ đọc `original/`; chạy lại sẽ **ghi đè** `docs/ai/DECISIONS.md`, `decisions/`,
  `progress/` về trạng thái lúc tách — không chạy lại sau khi đã có ADR/nhật ký mới).
- `verify.mjs` — kiểm chứng chỉ-đọc: `node docs/ai/_migration/verify.mjs`.
- `AUDIT.md` — báo cáo trước/sau.

Xoá cả thư mục sau khi chủ dự án duyệt kết quả (kiểm tra 1, 2, 3 của `verify.mjs` cần `original/`; kiểm tra 4–6 nên
chuyển sang `tools/` nếu muốn giữ làm cổng kích thước context).
