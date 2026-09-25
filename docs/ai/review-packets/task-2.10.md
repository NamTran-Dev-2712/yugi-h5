# Review Packet — Task 2.10: Log panel (ẩn/lọc) — Frontend

## Đã làm

- Nút "Ẩn" / tab "Log" (góc phải trên cột log) + phím **L**; 4 chip lọc **Sân / Đánh / Lượt / Lỗi** + chip "Tất cả". Mặc định hiện hết. Trạng thái nhớ ở localStorage.
- Kiến trúc hướng (b): `entries` song song `log` (xem ADR 2026-09-25 "Log panel"). Không đổi engine/API/shared, `debug-state.ts`, `debug-page.ts`, animation, luật, `legalActions`.

## File

- Mới: `apps/web/src/duel/log-entries.ts`, `log-panel.ts` (+ 3 file test: `log-entries.test.ts`, `log-panel.test.ts`, `duel-controller.log.test.ts`), `tools/ui-log-shots.ts`.
- Sửa: `duel-controller.ts` (thêm `entries`, `addLog` nhận entry), `scenes/duel-scene.ts`, `strings.ts`. **Không test cũ nào phải sửa.**

## Verify

- Đỏ trước: `task-2.10-red.txt` (3 file × 6 test đỏ vì chưa có module).
- `pnpm --filter @yugi/web lint / typecheck / test / build`: xanh; 330 test (toàn bộ, gồm `src/debug/*`).
- Mutant thủ công 13/13 bị bắt (`task-2.10-mutants.txt`); 1 sống lần đầu (con trỏ lát AI chồng lấn) → thêm test.
- Screenshot thật (Edge headless, API thật): `task-2.10-screens/` 01-all, 02-combat-off, 03-combat-only, 04-hidden, 05-shown-again.
- Chưa chạy: e2e `tools/play-duel-ui.ts` (không đổi luồng gửi action; `.log` vẫn có nên e2e cũ không bị ảnh hưởng — chưa kiểm bằng chạy).

## Cần bạn duyệt

1. **Cách chia nhóm** (bảng ở ADR): DeckOut ở "Lượt", "sẽ gửi" (DEV) ở "Sân", bỏ bài của AI ở "Sân" có hợp lý không? Draw nằm "Lượt" (không phải "Sân").
2. **Vị trí nút**: nằm trong cột log bên phải, board (x < 1024) không bị che; khi ẩn chỉ còn tab "Log" 44×24 ở góc trên phải. Xem 04-hidden.png. Khi ẩn, khoảng trống bên phải không được dùng lại cho board (chọn "ẩn", không "thu nhỏ").
3. **Persist** localStorage: giữ hay bỏ?
4. Chip "Tất cả" sáng khi đang lọc (bấm để reset) và mờ khi đang hiện tất cả — có dễ hiểu không?
5. 03-combat-only.png trống vì ván mẫu chưa có đánh nhau (AI lượt đầu chỉ Summon) — nhóm Đánh đã được test bằng dữ liệu, chưa có ảnh có dòng.

## Việc tiếp theo đề xuất

2.11 (Dev-endpoint scenario + Duel Sandbox) theo MASTER-PLAN.
