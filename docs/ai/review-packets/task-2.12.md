# Review Packet — Task 2.12: i18n bootstrap VI/EN — Frontend

## Đã làm

- Hạ tầng `src/i18n/`: `t()`/`lookup()` thuần + nội suy `{param}`, `locales/vi.json` + `en.json` (phẳng, ~150 key), chọn ngôn ngữ `?lang=` > localStorage `yugi.lang` > `vi`. Không thêm dependency; không nút đổi ngôn ngữ (thuộc 9.6).
- Chuyển sang `t()`: `duel/strings.ts` (facade getter, API cũ giữ nguyên), `debug/describe-event.ts`, `debug/describe-ai-action.ts` (log panel dùng), `duel/labels.ts`, `duel/detail-text.ts`, `duel/error-messages.ts` (`ErrorLike`/`messageFor` giữ nguyên). Thêm 3 nhãn "API: …" ở `menu-scene.ts` (ngoài danh sách brief — người chơi thấy, đang hardcode tiếng Anh). `main.ts` gọi `initI18n()`.
- Không đổi: engine/API/shared, trang debug (`debug-page/state/build-actions`), `src/dev/*`, nhãn fixture DEV, card data.

## File

- Mới: `apps/web/src/i18n/{i18n.ts,locales/vi.json,locales/en.json,i18n.test.ts,locales.test.ts,translated.test.ts}`, `tools/ui-i18n-shots.ts`, `tools/mutants-2.12.mjs`.
- Sửa: 6 file trên + `scenes/menu-scene.ts`, `main.ts`. **Không test cũ nào phải sửa.**

## Verify

- Đỏ trước: `task-2.12-red.txt`. `pnpm --filter @yugi/web lint / typecheck / test / build`: xanh; 390 test (330 → +60).
- Test ép: vi/en cùng key-set và cùng `{param}`, en không dấu tiếng Việt, mọi mã lỗi engine có câu ở cả hai ngôn ngữ, 6 module không còn chữ Việt hardcode, mọi `EventView`/`PlayerAction` có câu en.
- Mutant 16 (`task-2.12-mutants.txt`): 15 bắt + 1 tương đương (fallback về vi không quan sát được vì key-set bị ép bằng nhau).
- Screenshot thật (Edge headless, API thật): `task-2.12-screens/{vi,en}-{1-menu,2-duel-log,3-toast,4-surrender-confirm,5-gameover}.png`. Toast dùng fixture DEV `drag-illegal` (không phải lỗi server thật). Lần chụp đầu, ván vi gặp `NETWORK_ERROR` khi API còn khởi động → đã chụp lại, ảnh hiện tại sạch.
- Chưa chạy: e2e `tools/play-duel-ui.ts` (không đổi luồng gửi action).

## Cần bạn duyệt

1. **Bản dịch tiếng Anh** (`locales/en.json`) do AI tự dịch — đọc lại nhất là câu lỗi, tên nút, tên nhóm log ("Battle", "GY").
2. Thứ tự chọn ngôn ngữ và việc `?lang=` hợp lệ được nhớ vào localStorage (có muốn không nhớ?).
3. Còn tiếng Việt cố định: trang debug/sandbox, nhãn fixture, và dòng lỗi mạng thô trong log (`0 NETWORK_ERROR — Failed to fetch`, controller ghép mã + message) — có muốn dịch nốt không?
4. Card name/effect chưa song ngữ (data ở `packages/shared`): cần task riêng nếu muốn.

## Việc tiếp theo đề xuất

P2 hết task code → chờ duyệt P1/P2; sau đó P3 (effect system) với cổng "fuzz không lộ thông tin qua HTTP".
