> **ADR 006** · 2026-09-19 · Task: P0 · Lớp: Tooling
> **Trạng thái:** Hiệu lực. Mục lục: `docs/ai/DECISIONS.md`.

## 2026-09-19 — Bỏ commitlint

Dự án cá nhân, 1 dev, thêm friction không cần thiết. Husky + lint-staged (eslint --fix +
prettier trên staged files) là đủ cho M0. **Hệ quả**: không có convention bắt buộc cho commit
message; có thể bật lại commitlint dễ dàng nếu sau này cần changelog tự động.
