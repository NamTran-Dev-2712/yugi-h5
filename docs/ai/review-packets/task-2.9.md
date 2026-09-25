# Review Packet — Task 2.9: animation theo EventView[] + phát lại aiActions

Lớp: Frontend (`apps/web`). Engine/API/shared: 0 dòng đổi. Trạng thái: 🟨 nháp, chờ duyệt.

## Đã làm

- `duel/animation-queue.ts` (mới, thuần): `stepsFor`, `segmentsFor`, `DURATION_MS`.
- `duel/animation-player.ts` (mới, thuần): player tuần tự, scheduler tiêm được, skip/speed, `AnimatorHost`, `animationSpeedFromSearch`.
- `duel/duel-controller.ts` (sửa tối thiểu): `animator?`, `animating`, `skipAnimation()`; view mới chỉ áp sau khi phát xong.
- `duel/services.ts`, `duel/strings.ts`: gắn `animatorHost`, chuỗi gợi ý skip.
- `scenes/duel-scene.ts`: container `fx`, `playStep`, Space/Enter = skip.
- `interaction.ts`: KHÔNG sửa (khoá input tái dùng `busy`; có test xác nhận).

## Verify

| Bước                                      | Baseline | Sau   |
| ----------------------------------------- | -------- | ----- |
| web lint / typecheck                      | xanh     | xanh  |
| web test                                  | 218      | 269   |
| `tools/smoke-http.ts`                     | 23/23    | 23/23 |
| `tools/play-vs-ai.ts`                     | 45/45    | 60/60 |
| `tools/play-duel-ui.ts` (e2e, không anim) | —        | 4/4   |
| `pnpm --filter @yugi/web build`           | —        | xanh  |

Test đỏ trước: `task-2.9-red.txt`. Mutant thủ công: 18/18 bị bắt (`task-2.9-mutants.txt`).

## Cần duyệt

1. ✅ **ĐÃ CHỐT (2026-09-25): chỉnh gần bản gốc** — bảng mới và nguồn ở ADR "Hiệu chỉnh `DURATION_MS`" (`DECISIONS.md`); bảng dưới đây là bản cũ để đối chiếu. **Thời lượng (bản cũ)** (`DURATION_MS`, ms): draw 250 · summon 400 · set 300 · tribute 350 · flip 400 · đổi thế 300 · attack 500 · destroy 450 · damage 600 · discard 300 · phase 250 · turn 400 · duelEnd 500 · aiLabel 250. Ngắn hơn số đo gốc (`notes/animation-durations.md`: Summon ~2.6 s, Tribute ~2.2 s, attack ~0.7 s, banner lượt ~1.7 s, LP chạy ~0.65 s) 2–5×. Muốn giống gốc hơn: nhân bảng hoặc chỉnh từng dòng.
2. Hiệu ứng chỉ là nháp bằng code (flash ô, mũi tên, số damage nổi, caption). Chưa có: LP chạy dần, lá lớn preview, vệt lửa, banner đổi lượt kiểu gốc.
3. Screenshot: `task-2.9-screens/` (42 ảnh chụp lại sau khi chỉnh thời lượng, `SHOTS=40 INTERVAL=500`; board ổn định từ `17-anim` ≈ 8.5 s; 26 ảnh cũ đã thay, API thật, `node --experimental-strip-types tools/ui-anim-shots.ts`): `00-start` → `01…24-anim` (mỗi ~400 ms sau khi bấm "Kết thúc lượt": board giữ bản cũ, caption + gợi ý skip, nút khoá) → `99-settled` (đã snap, lá AI hiện, nút mở lại). Nên vẫn chơi thử tay với `?fast=1` và bản thường.
4. View đầu ván (10 lá rút) không animate (chưa có board cũ).
