# apps/web

Phaser 3 + Vite 7. Client chỉ vẽ những gì server nói qua GameEvent — không tự suy luận
luật chơi, không tự đổi game state.

Luật riêng:

- Import được: `@yugi/shared` (types/constants/card definitions). KHÔNG import
  `@yugi/game-engine` trực tiếp trừ khi export rõ ràng là type/utility thuần (không phải
  `applyAction`/rule logic) — engine chạy ở server, client không được tự chạy rule.
- `state/` (Zustand) chỉ là view state phản chiếu server, không phải nguồn sự thật.
- Animation/hiệu ứng bind vào `GameEvent` nhận từ server (xem `docs/design/protocol.md`),
  không viết logic "nếu tôi kéo lá bài thì..." ở client trước khi server xác nhận.
- Input (drag-drop) chỉ tạo "Action intent" gửi lên server; UI cập nhật khi có event trả về.
- `src/api/` (client HTTP `createDuelApi`, tiêm `fetch`/`storage`, lỗi = `DuelApiError` có `status`/`code`/`engineCode`) là lớp mạng dùng chung cho Phaser và trang debug; type response lấy từ `@yugi/shared` (`http-types`). Action gửi đi là `PlayerAction` của shared, build xong qua `PlayerActionSchema.parse`.
- `src/debug/` + `debug.html` (task 2.4) là công cụ tạm kiểm luật, KHÔNG Phaser, dễ xoá (xoá thư mục + `debug.html` + khoá `debug` ở `vite.config.ts`). Logic thuần (`describe-event`, `build-actions`, `debug-state`) có test; `debug-page.ts` chỉ là DOM. Không có `legalActions`: nút chỉ liệt kê những gì đang có trên màn hình, KHÔNG sao chép luật (Level→tribute, phase, lượt); sai luật thì server trả 409 + `engineCode` và UI giữ nguyên state. Thêm loại action mới = thêm nhánh ở `build-actions.ts` + thêm loại `EventView` = `describe-event.ts` (compile-time vét cạn).
- Dùng `textContent`, không `innerHTML` với dữ liệu từ server.
