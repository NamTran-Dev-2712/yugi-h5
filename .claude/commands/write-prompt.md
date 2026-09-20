---
description: Soạn 1 prompt hoàn chỉnh cho task lớn tiếp theo (để chạy trong session mới/agent khác)
argument-hint: [mô tả ngắn task muốn giao]
---

Soạn prompt hoàn chỉnh cho task sau, theo mẫu 4 phần bên dưới — mục tiêu là 1 agent/session
mới (không có context hiện tại) đọc vào là làm được ngay, không cần hỏi lại:

Task cần soạn prompt: $ARGUMENTS

## Mẫu

**1. Context** — vì sao task này cần làm, nó nằm ở milestone nào (tham chiếu
`docs/ai/ROADMAP.md`), đã có gì tồn tại liên quan (file/module cụ thể), quyết định thiết kế
liên quan đã chốt ở đâu (`docs/ai/DECISIONS.md` nếu có).

**2. Mục tiêu** — kết quả cụ thể, đo được (không phải "làm cho tốt hơn"). Nếu có tiêu chí
done rõ ràng trong `docs/ai/ROADMAP.md`, trích dẫn lại.

**3. Ràng buộc** — luật bất biến liên quan (trích từ `CLAUDE.md` + `CLAUDE.md` package cụ
thể), dependency rule phải tuân theo, những gì KHÔNG được làm trong phạm vi task này.

**4. Cấu trúc file** — file nào sẽ tạo/sửa (đường dẫn cụ thể), pattern nên theo (trỏ tới file
ví dụ đã có trong repo), và bước cuối bắt buộc: chạy lint/typecheck/test + cập nhật
`docs/ai/PROGRESS.md`.

Sau khi soạn xong, in prompt ra dạng code block để user copy trực tiếp — không tự động chạy
task đó trong session hiện tại trừ khi user yêu cầu thêm.
