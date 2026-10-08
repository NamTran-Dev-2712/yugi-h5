# Asset Requests

AI thêm yêu cầu asset vào đây (không tự bịa asset). Dùng `/asset-request` để sinh mục chuẩn. Bạn thả file theo cột "Nộp".
Spec chi tiết: `docs/plan/card-art-pipeline.md`.

## Trạng thái

☐ chưa nộp · 🟨 đã nộp, chờ duyệt · ✅ đã duyệt

## Yêu cầu

| ☐   | ID / tên                                                        | Loại     | Spec                                                                                                  | Cần trước                                                                    | Nộp                    | Ghi chú                                                                                                                                                                                 |
| --- | --------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ☐   | Art 26 lá batch 2 (`SMP-048…061`, `SMP-117…124`, `SMP-211…214`) | Card art | 512×512 WebP, safe area 80%, không chữ; 1 file / lá, tên file = id lá viết thường (vd `smp-048.webp`) | Task 5.x (asset pipeline, P5) — chưa chặn việc gì: hiện vẽ khung placeholder | `assets/card-art-src/` | Tên + mô tả từng lá: bảng ở `docs/ai/review-packets/task-4.7.md`. Không dùng art / tên Konami. Art cũ hơn (SMP-001…047, 101…116, 201…210) cũng chưa có: gộp chung một lần nộp cũng được |

## Mẫu một yêu cầu

| ☐ | `wandering-squire` | Card art | 512×512 WebP, safe area 80%, không chữ | Task 5.6 | `assets/card-art-src/wandering-squire.webp` | Hiệp sĩ lang thang, thuộc tính EARTH |
