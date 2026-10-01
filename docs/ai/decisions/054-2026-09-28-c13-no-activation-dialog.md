> **ADR 054** · 2026-09-28 · Task: C13 · Lớp: Luật, Web
> **Trạng thái:** Hiệu lực. Mục lục: `docs/ai/DECISIONS.md`.
>
> Ghi chú đọc kèm (thêm khi tách file 2026-10-01; KHÔNG thuộc ADR gốc, phần dưới giữ nguyên văn):
>
> - Thay G5 ở ADR 017 (`017-2026-09-20-decision-label-g1-g12.md`) và C12 ở ADR 019 (`019-2026-09-21-c1-c4-c9-c10-c12.md`). UI làm ở ADR 056 (`056-2026-09-28-task-3.7-chain-ui.md`).

## 2026-09-28 — C13: phản ứng = chạm lá trực tiếp, KHÔNG có hộp thoại "Kích hoạt?"

- **Chủ dự án chốt** `[DECISION]` (đóng mâu thuẫn C13 giữa video #3/#4 và G5/C12): khi cửa sổ phản ứng/chain đang mở và người
  chơi có lá Set (Trap/Quick-Play) đáp trả được, UI **không** hiện dialog xác nhận — chạm lá úp có `ActivateEffect` hợp lệ
  trong `legalActions` là kích hoạt luôn (như chạm quái ngửa mở menu hiện có, chỉ khác action). "Bỏ qua" là **nút riêng**
  gửi `PassPriority`, không phải nút trong dialog.
- `TriggerActivation` (hỏi **chủ** lá có trigger) **không thuộc** C13: vẫn dùng overlay Có/Không như các prompt khác
  (`SelectEffectTarget`, tribute), vì đó là lá của chính mình.
- **Hệ quả:** G5 cập nhật trong `fidelity-spec.md`; `RulesetConfig.chainPrompt` (C12) không dùng cho phản ứng (engine chưa bao
  giờ đọc nó); việc làm UI (chạm lá Set, banner "đang chờ phản ứng", nút Bỏ qua, overlay trigger) là task 3.7.
