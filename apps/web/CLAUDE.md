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
