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
- Web: không thêm kind vào máy trạng thái tương tác; tái dùng `selecting-tribute` + `purpose` (ADR 048, 056, 062).

## Quyết định của chủ dự án dễ bị làm ngược

- `STARTER_DECK` **không đổi**; lá mới thêm vào CUỐI dãy; lá effect đi qua deck demo riêng (ADR 057, 058).
- Card data viết bằng TS, **không** pipeline CSV (ADR 058). Không Duration, không action `SpecialSummon` (ADR 059, 061).
- C11: Trap phải Set mới kích hoạt (ADR 018). C13: phản ứng = chạm lá, **không** dialog "Kích hoạt?" (ADR 054).
- AI server không tự Set/kích hoạt Phép/Bẫy ngoài cửa sổ ưu tiên (ADR 048, 055).
- Brief mâu thuẫn tài liệu đã duyệt (☑ trong `RULES-REVIEW-SHEET.md`) ⇒ theo tài liệu đã duyệt và ghi rõ chỗ lệch trong
  ADR (ADR 025); brief lệch luật chuẩn ⇒ hỏi chủ dự án trong phiên plan (ADR 049, 050, 052).
- Số task thực tế lệch `MASTER-PLAN.md` gốc (P1, P2 đã đổi số nhiều lần) ⇒ tin `docs/ai/PROGRESS.md` + `docs/ai/progress/`.
