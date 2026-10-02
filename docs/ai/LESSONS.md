# Lessons — bẫy đã gặp và quy ước xuyên package

Được tự nạp. Mỗi dòng là **con trỏ**: lý do đầy đủ nằm ở ADR ghi cuối dòng (`docs/ai/decisions/NNN-*.md`). Luật riêng
từng package nằm ở `CLAUDE.md` của package, không chép lại ở đây. Thêm dòng mới khi một bài học áp dụng cho mọi task.

## Môi trường / công cụ

- Postgres **5433**, Redis **6380** (không phải 5432/6379); chuẩn là `apps/api/.env.example` (ADR 009). API cần Postgres
  lúc boot ⇒ Docker Desktop phải chạy; `pnpm test` không cần DB.
- API `:3000`, web `:5173`; khi project khác chiếm cổng đã chạy bằng `:3100`/`:5174` (task 3.8, 4.1).
- `apps/api` build bằng `tsc` trực tiếp; `nest build` thoát 0 nhưng không sinh `dist/` (ADR 008).
- **Không đặt tên thư mục `scripts` hay `lib`**: `.gitignore` gốc bỏ qua chúng nên file không vào git (đã dùng
  `effect-scripts/`, và `!tools/lib/`). Tạo thư mục mới thì chạy `git check-ignore -v <path>` (ADR 053, 058).
- Screenshot: Edge headless + CDP qua `tools/ui-*-shots.ts`; Playwright không cài, không thêm dependency (ADR 039, 040).
- `apps/web` dùng `zustand/vanilla`, không có React (ADR 010). Validation dùng Zod, không `class-validator` (ADR 003).

## Test

- Mỗi task: test **đỏ trước** (lưu `docs/ai/review-packets/task-<số>-red.txt`), mutation thủ công
  (`tools/mutants-<số>.mjs` → `task-<số>-mutants.txt`), smoke thật qua `tools/` khi đụng API/web.
- Test đồng bộ dài (fuzz, mô phỏng AI) phải `await` nhường event loop giữa seed/ván + timeout tường minh; nếu không vitest
  báo `Timeout calling "onTaskUpdate"` và thoát mã 1 dù mọi test pass — đọc dòng `Tests`, đừng chỉ nhìn mã thoát (ADR 058, 062).
- Không assert thời gian tuyệt đối (trôi ~10× khi `pnpm test` chạy song song) ⇒ đếm công việc tất định (ADR 062).
- Test engine dùng lá thật đọc `SAMPLE_CARDS` từ `dist` của shared ⇒ sửa/mutation ở shared phải build lại shared (ADR 057).
- Thêm lá vào pool fuzz làm loãng độ phủ (chain ≥ 2 link, Equip theo quái) ⇒ thêm test độ phủ với bộ seed riêng;
  **không** sửa engine/deck/checker để "cho qua" (ADR 059, 060, 061).
- Test kiểm `EngineError.code`, không kiểm câu chữ message (ADR 022). Golden đỏ = hành vi đổi; chỉ `UPDATE_GOLDEN=1` sau
  khi đọc diff (ADR 031).
- `UPDATE_GOLDEN=1` ghi lại **mọi** file golden ở dạng `JSON.stringify` thô ⇒ chạy xong phải
  `pnpm exec prettier --write "packages/game-engine/src/__golden__/*.json"` rồi mới đọc `git diff` (ADR 063).
- Thêm lá vào pool fuzz có thể làm test "checker bắt engine hỏng" bắt lỗi bằng **bất biến khác** (thông báo khác): thu hẹp
  phép phá cho đúng bất biến cần chứng minh, không nới regex (ADR 063).
- Nhánh fuzz quá hiếm với nước đi ngẫu nhiên (vd phá lá Field **úp**): thêm variant riêng (deck + dòng rng riêng + `steer`
  ưu tiên nước đi, chỉ ở test); không đổi deck/seed cũ, không nới oracle (ADR 064).
- Cho một lá placeholder effect thật (vd SMP-201) hoặc thêm lá vào `SAMPLE_CARDS` làm đổi hành vi test ở package KHÁC: lá
  đó đang được dùng như "lá không làm gì", và có deck fuzz tự gom mọi lá có effect ⇒ chạy test api + web **ngay** sau khi đổi
  dữ liệu lá; harness tự tính "ai phải hành động" phải dùng `pendingPrompt → chainWindow.priorityPlayer → turn player`; lá
  "không có effect" trong test engine dùng fixture `TRAP_PLAIN`, không dùng lá thật (ADR 065).
- Hook sau mỗi Edit chạy `eslint --fix`: biến `let` chưa có chỗ gán lại bị đổi thành `const` ⇒ thêm khai báo và chỗ gán
  trong **cùng một lần sửa** (ADR 065).
- `ScenarioSchema` không có ô Field ⇒ scenario cần lá ở ô Môi trường phải bắt đầu từ tay + `script` (ADR 064).
- Đổi shape một field (vd `name` → `{vi,en}`): template literal nhận object không làm `tsc` đỏ (`[object Object]`) ⇒ grep
  mọi nơi dùng (ADR 046, 055).

## Mẫu thiết kế đã lặp lại (làm theo, đừng phát minh lại)

- **Containment**: tính năng engine chưa lên wire ⇒ `toEventView` trả `null` cho event mới, action vào
  `ENGINE_ONLY_ACTIONS`, web chỉ thêm câu i18n `error.engine.*`; nối wire là task riêng (ADR 047, 049, 060 → 048, 055, 062).
- **Không sao chép luật**: `legalActions`, auto-pass, AI, UI đều dựa vào dry-run engine / danh sách server gửi; client
  không optimistic (ADR 037, 040, 049).
- **Chống rò thông tin**: oracle `findLeaks` không phụ thuộc shape; thêm field/zone ẩn = mở rộng fuzz, **không nới oracle**;
  mặc định là che (deny by default) (ADR 034, 048, 062).
- Switch vét cạn + `never` ở mọi nơi tiêu thụ event/action: loại mới phải làm `tsc` đỏ cho tới khi được phân loại (ADR 034).
- Tránh thêm field top-level vào `GameState` (vỡ `scenario-to-state` ở api + golden cũ): đặt trên `CardInstance`,
  `ChainWindow` hoặc payload prompt (ADR 051, 052, 061).
- Operation cần đổi **luồng** resolve (vô hiệu link khác, chặn đòn tấn công) thì chỉ phát event; `effects/chain.ts` đọc
  event đó (như trigger đọc event), không thêm kênh trả về riêng. Operation cần biết "đang đáp cái gì" đọc
  `OperationContext.respondsTo` / `window`. Luật kích hoạt đọc từ subType / operation của lá, không từ id lá (ADR 065).
- Thêm dữ liệu cho cửa sổ phản ứng: đặt field optional cạnh `reactionTo` trên `ChainWindow`, **không** vào `ReactionTo`
  hay payload prompt (hai thứ đó api gửi nguyên ra wire) (ADR 065).
- Web: không thêm kind vào máy trạng thái tương tác; tái dùng `selecting-tribute` + `purpose` (ADR 048, 056, 062).
- Dấu/nhãn hiển thị ở client phải đi theo điều server gửi (vd dấu "đang hiệu lực" ↔ `effectiveStats`), không tự suy
  thời điểm theo luật; chỉ ảnh chạy thật mới lộ chỗ lệch ⇒ luôn mở ảnh đã chụp ra xem (ADR 064).
- Client cần biết "loại gì" của một việc server làm (vd AI trả lời prompt nào) ⇒ server gửi kèm field công khai
  (`AiActionView.promptKind`), client không đoán từ id/chuỗi (ADR 064).

## Quyết định của chủ dự án dễ bị làm ngược

- `STARTER_DECK` **không đổi**; lá mới thêm vào CUỐI dãy; lá effect đi qua deck demo riêng (ADR 057, 058).
- `NegateSummon` chỉ Normal/Tribute/Flip Summon; Special Summon bằng effect chặn qua `NegateActivation`; Set không phải
  triệu hồi. Bẫy Phản công không tự mở chuỗi. Lá/quái bị vô hiệu "được gửi vào mộ" (không "bị phá"), cost không hoàn (ADR 065).
- Card data viết bằng TS, **không** pipeline CSV (ADR 058). Không Duration, không action `SpecialSummon` (ADR 059, 061).
- C11: Trap phải Set mới kích hoạt (ADR 018). C13: phản ứng = chạm lá, **không** dialog "Kích hoạt?" (ADR 054).
- AI server không tự Set/kích hoạt Phép/Bẫy ngoài cửa sổ ưu tiên (ADR 048, 055).
- Brief mâu thuẫn tài liệu đã duyệt (☑ trong `RULES-REVIEW-SHEET.md`) ⇒ theo tài liệu đã duyệt và ghi rõ chỗ lệch trong
  ADR (ADR 025); brief lệch luật chuẩn ⇒ hỏi chủ dự án trong phiên plan (ADR 049, 050, 052).
- Cột duyệt `RULES-REVIEW-SHEET.md` có 3 ký hiệu: `☑` trần chỉ của chủ dự án; AI chỉ ghi "☑ (AI duyệt thay, …)" cho dòng
  thuần `[RULE]` đủ 4 điều kiện, dòng `[ASSUMED]`/`[DECISION]`/`[GUESS]` phải hỏi ("☑ (chủ dự án chọn qua hộp thoại, …)");
  `parity-board.md` vẫn tối đa 🟨 (ADR 064).
- Số task thực tế lệch `MASTER-PLAN.md` gốc (P1, P2 đã đổi số nhiều lần) ⇒ tin `docs/ai/PROGRESS.md` + `docs/ai/progress/`.
