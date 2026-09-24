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
- `src/debug/` + `debug.html` (task 2.4) là công cụ tạm kiểm luật, KHÔNG Phaser, dễ xoá (xoá thư mục + `debug.html` + khoá `debug` ở `vite.config.ts`). Logic thuần (`describe-event`, `build-actions`, `debug-state`) có test; `debug-page.ts` chỉ là DOM. Nút chỉ liệt kê những gì đang có trên màn hình, KHÔNG sao chép luật (Level→tribute, phase, lượt); từ task 2.5 `applyLegality` đối chiếu với `legalActions` của server để làm mờ/tắt nút và thu hẹp ô chọn (công tắc "Cho phép thử hành động sai luật" tắt việc này để thấy 409 + `engineCode`); UI giữ nguyên state khi bị từ chối. Phaser sau này dùng `legalActions` để highlight ô hợp lệ, không tự suy luận. Thêm loại action mới = thêm nhánh ở `build-actions.ts` + thêm loại `EventView` = `describe-event.ts` (compile-time vét cạn).
- Trang debug có mode "Đấu với AI" (task 2.6): viewer khoá ở ghế người (server trả 403 nếu xem ghế AI), không dựng nút cho ghế AI, không tự chuyển viewer; `aiActions` trong response (cắt lát `events`) được ghi thành dòng "🤖 AI …" trước các event của nó (`describe-ai-action.ts`, vét cạn `never`; `logLinesFor` ở `debug-state.ts`). Web KHÔNG biết AI chọn thế nào — chỉ hiển thị điều server đã làm.
- Duel Scene Phaser (task 2.7) — `src/duel/` là lớp THUẦN (không import `phaser`, có test): `layout.ts` (hình học), `presenter.ts` (`StateView`+`legalActions` → `RenderModel`), `duel-controller.ts` (nối `DuelApi`), `theme.ts` (mọi màu/font/kích thước — đổi phong cách ở đây), `asset-manifest.ts` (key texture ổn định), `strings.ts` (chuỗi UI, chờ i18n 2.12). `src/scenes/` chỉ vẽ `RenderModel` (không quyết luật, không dựng payload action: nút/lá gửi đúng action server liệt kê trong `legalActions`). Presenter không được đưa `definitionId`/tên lá ẩn vào model (có test quét JSON + mutant). Placeholder texture sinh bằng code ở Boot theo manifest, không dùng art Konami. Fixture xem không cần server: `index.html?fixture=midgame|handfull|gameover` — chỉ DEV (`import.meta.env.DEV`, dữ liệu ở `fixtures.ts` import động; tên ở `fixture-names.ts`). Thêm loại action UI mới = thêm nhánh ở presenter/controller + test; đổi khung/kích thước = `theme.ts`.
- Dùng `textContent`, không `innerHTML` với dữ liệu từ server.
