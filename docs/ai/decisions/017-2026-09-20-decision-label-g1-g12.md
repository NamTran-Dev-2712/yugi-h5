> **ADR 017** · 2026-09-20 · Task: Plan · Lớp: Luật, Plan
> **Trạng thái:** Hiệu lực — một phần đã thay. Mục lục: `docs/ai/DECISIONS.md`.
>
> Ghi chú đọc kèm (thêm khi tách file 2026-10-01; KHÔNG thuộc ADR gốc, phần dưới giữ nguyên văn):
>
> - G5 (hỏi "Kích hoạt?") → thay bởi ADR 054 (`054-2026-09-28-c13-no-activation-dialog.md`) (C13).
> - G12 "chưa gacha/pack" → thay bởi ADR 043 (`043-2026-09-25-scope-expansion-p10-p15.md`).
> - "Surrender (task 1.8)": do đổi số task, Surrender là task 1.9 — ADR 028 (`028-2026-09-23-task-1.9-surrender.md`).
> - G1/G4 được làm rõ thêm ở ADR 019 (`019-2026-09-21-c1-c4-c9-c10-c12.md`).

## 2026-09-20 — Nhãn [DECISION] và chốt G1–G12

Thêm nhãn `[DECISION]`: chủ dự án đã chốt thiết kế, chưa có `[REF]`; khác `[GUESS]` ở chỗ không hỏi lại, đổi bằng config khi có tư liệu.
Chốt: G1 `[RULE]` lượt 1 không draw/attack (`firstTurnDraw/Attack`); G2 tribute qua highlight + Xác nhận/Hủy; G3 chạm quái mở menu, chỉ action
hợp lệ theo server; G4 attack bằng kéo hoặc menu rồi chạm target; G5 hỏi "Kích hoạt?" + auto-pass (`chainPrompt`); G6 không Damage Step chi tiết,
Quick chỉ trước khi tính damage, state chừa chỗ mở rộng; G7 solo không timer, PvP 60s/lượt, hết giờ tự EndPhase, AFK nhiều lần thì thua;
G8 Fusion ở P4, **bỏ Ritual khỏi v1**, chừa `extraDeck`; G11 có surrender + log trận; G12 deck 40–60/≤3, chưa gacha/pack. G9/G10 vẫn `[GUESS]`;
LP 8000 giữ `[RULE]/[GUESS]`. Chi tiết: `docs/reference/notes/rules.md`. **Hệ quả**: thêm `chainPrompt`, `turnTimerSec`, `afkLossThreshold`,
`allowSurrender` vào `RulesetConfig`; thêm `Surrender` vào engine (task 1.8); bỏ task 4.6 Ritual; bảng duyệt luật `RULES-REVIEW-SHEET.md`.
