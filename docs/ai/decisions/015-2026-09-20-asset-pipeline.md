> **ADR 015** · 2026-09-20 · Task: Plan · Lớp: Assets
> **Trạng thái:** Hiệu lực. Mục lục: `docs/ai/DECISIONS.md`.

## 2026-09-20 — Asset pipeline: art vuông 512×512, khung vẽ bằng code, asset pack ngoài git

Card frame/chữ/sao/ATK-DEF vẽ bằng code; art là 1 ảnh vuông `<cardId>.webp` thả vào `assets/card-art-src/`, thiếu art → placeholder.
`assets/card-art*` và `docs/reference` (media) ignore khỏi git (tránh ảnh bản quyền lên repo public). **Hệ quả**: thêm `sharp` (dev-only) khi làm
task 5.3 — **cần hỏi người dùng trước**; Spine không dùng mặc định (dependency lớn).
