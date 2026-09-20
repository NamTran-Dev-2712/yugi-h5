---
description: Sinh yêu cầu asset/tư liệu chuẩn cho người dùng (không tự bịa asset)
---

Khi task cần asset hoặc tư liệu mà repo chưa có:

1. Xác định loại: card art / background / icon / VFX / SFX / BGM / reference (screenshot, video, ghi chú).
2. Đọc spec trong `docs/plan/card-art-pipeline.md` (asset) hoặc `docs/reference/README.md` (tư liệu).
3. Thêm 1 dòng vào `docs/assets/ASSET_REQUESTS.md` (asset) và/hoặc `docs/plan/human-tasks.md` (việc của người dùng): id/tên, loại, spec, "cần trước task nào", đường dẫn nộp, ghi chú.
4. Thêm nhãn `[GUESS]` vào mục liên quan trong `docs/plan/fidelity-spec.md` nếu thiếu tư liệu.
5. Trong code: dùng placeholder (card thiếu art → placeholder tên; SFX thiếu → no-op), KHÔNG tự tạo/tải asset thay bạn.
6. Báo người dùng: cần gì, spec, nộp ở đâu, cần trước khi nào.
