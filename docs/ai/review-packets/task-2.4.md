### Review Packet — Task 2.4: trang debug solo + Action schema ở shared (Frontend + Shared + API nhỏ; không đụng game-engine)

**Đã làm gì:** trang debug thô `http://localhost:5173/debug.html` (HTML/TS + Vite, không Phaser) để bạn chơi thử một ván solo-debug và soi JSON thô. `PlayerActionSchema`/`ActionInputSchema` + type response HTTP ở `packages/shared`; API dùng schema đó nên payload méo → `400` thay vì `500`. Đổi số task: 2.4 = trang debug, AI dummy → **2.5**, các task sau +1 (MASTER-PLAN, PROGRESS, dev-tools-and-review, human-tasks đã sửa).

**File chính**

- Shared: `duel/action-schema.ts` (+test, 32 ca), `duel/http-types.ts`, `index.ts`.
- API: `modules/duels/duels.dto.ts` (dùng schema + assertion compile-time `PlayerAction` ⊂ engine `Action`), `duels.e2e.spec.ts` (+7 ca payload méo).
- Web: `src/api/duel-api.ts` (+test 11), `src/debug/{describe-event,build-actions,debug-state}.ts` (+test 45), `debug-page.ts` (DOM), `main.ts`, `debug.html`, `vite.config.ts` (entry thứ hai).
- Docs: `docs/design/debug-ui.md` (**các bước chạy + kịch bản + checklist "điều cần để ý"**), `protocol.md`, ADR 2026-09-24, `PROGRESS.md`, `MASTER-PLAN.md`, `parity-board.md`, `apps/{web,api}/CLAUDE.md`, `README.md`, `apps/api/.env.example`.

**Cách xem:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build` (đã xanh: shared 58, engine 362, web 58, api 135 test); `git diff packages/game-engine` rỗng. Chơi tay: làm theo `docs/design/debug-ui.md`.

**CẬP NHẬT: Bước 0 đã chạy sau khi bật Docker** (Postgres healthy, migrate "already in sync", `pnpm dev` lên cả API + web, smoke 18/18 trong `task-2.4-smoke.md`, tự chơi 129/129 và 123/123 với `HEAVY=1`, 0 lộ bài; không cần sửa code để boot). Đoạn dưới là ghi chú cũ trước khi bật Docker. **Bước 0 (cũ, đã lỗi thời):** Docker Desktop không chạy trên máy lúc làm (`docker compose up -d` → không tìm thấy `dockerDesktopLinuxEngine`), mà API cần Postgres để boot (`PrismaService.$connect`). Đã làm được: `pnpm --filter @yugi/api build` xanh; chạy `node dist/main.js` boot qua validate env + DI + module init rồi chết đúng ở `P1001 Can't reach database server at localhost:5433`. Chưa làm: `docker compose up`, `prisma:migrate`, `pnpm dev`, curl chuỗi `POST /auth/guest → /duels/solo → /actions → GET`, và **chụp screenshot Playwright** (MCP Playwright không kết nối được + không có duel thật để chụp). Chuỗi curl đã được viết sẵn trong README. **Bạn bật Docker Desktop rồi chạy các lệnh trong `debug-ui.md`; nếu boot lỗi, báo lại — tôi sửa.** Không có sửa "boot" nào cần thiết được phát hiện.

**Hành vi đã test**

- Schema: 10 hình dạng hợp lệ; 19 payload méo (thiếu/sai kiểu/key lạ/zone 5, -1, 1.5, "0"/`DefenseDown`/mảng không phải mảng…) → lỗi; `StartDuel`/`Draw` qua vỏ nhưng `PlayerActionSchema` từ chối chúng.
- E2E: 7 payload méo → `400`, view không đổi.
- Client API (mock fetch): tạo guest lần đầu + lưu token; dùng lại token (cả instance mới); storage hỏng/vắng; header bearer + JSON; URL `?viewer=`; envelope `{playerIndex, action}`; 409 → `DuelApiError{status,code,engineCode}`; 400 giữ `issues`; 401 xoá token; lỗi mạng → status 0; body lỗi không phải JSON.
- `describeEvent`: đủ 15 loại event (kiểu `Record` ép thêm event = `tsc` đỏ), lá ẩn của đối thủ không lộ tên, hòa/thắng/direct attack.
- `buildActionButtons`/`toAction`: hết trận không nút; EndPhase/EndTurn/Surrender; Summon/Set chỉ cho quái ngửa trên tay; tribute liệt kê mọi quái của mình; đổi thế đúng chiều; Attack chỉ khi ở Attack + mục tiêu gồm quái úp + "trực tiếp" (`""` → `null`); prompt bỏ bài chỉ cho ghế bị hỏi; payload sinh ra qua `PlayerActionSchema.parse`; `pickViewer`; `shouldContinueEndTurn`.
- `applyActionError`: giữ nguyên tham chiếu `view` và `raw`, hiện `status code / engineCode`, ghi log; `applyActionSuccess` thay view + xoá lỗi.

**Mutation test thủ công (11, tất cả bị bắt):** payload EndPhase bỏ `.strict()`; `zoneIndex` max 5; hiện tên lá ẩn trong `CardDrawn`; lỗi làm `view = null`; `pickViewer` bỏ ghế prompt; direct attack gửi `""` thay `null`; 401 không xoá token; `EndTurn` bỏ điều kiện prompt; gửi `tributeInstanceIds: []`; schema cho phép `DefenseDown` (**api `tsc` đỏ** — guard compile-time hoạt động); API quay lại vỏ lỏng (e2e đỏ). Lần đầu M1 không áp được vì formatter đổi dòng, đã chạy lại đúng dòng: bị bắt.

**Cần bạn duyệt (`[ASSUMED]`)**

1. **Không có `legalActions`** — nút chỉ liệt kê cái đang hiện trên màn hình, luôn hiện cả khi sai luật (server từ chối 409 + `engineCode`). Chủ đích để bạn thử luật; nếu muốn UI chỉ hiện nút hợp lệ thì cần task `legalActions` ở API.
2. **Không có nút "Draw"** (engine cấm client gửi `Draw`, 403); rút xảy ra khi `EndPhase` rời Draw phase.
3. `End Turn` = lặp `EndPhase` phía client (tối đa 12), dừng khi đổi lượt / có prompt / hết trận / lỗi.
4. Tự chuyển viewer theo (ghế đang có prompt) → (người đến lượt); bật/tắt được. Mặc định bật.
5. Nhật ký chỉ có event **góc nhìn ghế vừa gửi action** (server không trả event của ghế kia).
6. Raw JSON = phản hồi thành công gần nhất **đã parse rồi in lại** (`JSON.stringify(…, null, 2)`), không phải bytes nguyên văn; nội dung như nhau.
7. Schema Action: mảng tối đa 20, id ≤64 ký tự (chặn trên hào phóng); `Draw`/`StartDuel` chỉ kiểm `payload.playerIndex`.
8. `debug.html` được build ra `dist/` cùng game. Không mở thêm API nhưng khi deploy production nên loại khỏi build.
9. Type response ở shared **chưa được controller dùng làm kiểu trả về** (chỉ web dùng).
10. Guest token lưu `localStorage` (khoá `yugi.guestToken`); token hết hạn (12h) → 401 → xoá, bấm "Tạo duel mới" (duel cũ mất quyền vì guest mới).
11. Thêm tên lá/Level/ATK/DEF hiển thị lấy từ `SAMPLE_CARDS` ở shared (không phải luật).

**Vi phạm quy trình cần báo:** vài lệnh Bash của tôi dùng heredoc có dấu nháy (script mutant, ghi ADR) trái ràng buộc "tạo file bằng Write". Nội dung file đúng; đã dừng dùng.

**Việc để dành:** chạy lại Bước 0 khi có Docker + chụp screenshot; `legalActions` (nếu muốn); loại `debug.html` khỏi build production; controller dùng `http-types`; fuzz lộ thông tin qua HTTP (**cổng bắt buộc trước P3**, không đổi).

**Task tiếp theo:** 2.5 AI dummy (`solo-vs-ai`).
