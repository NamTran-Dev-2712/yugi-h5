### Review Packet — Task 2.11: Duel Sandbox (dev-only) — Shared + API + Frontend

**Đã làm gì (1-3 dòng):**

- Bạn dán/chọn một Scenario JSON (board, tay, mộ, LP, phase, lượt) → server dựng ván đó → chơi bằng chính Duel scene (kéo thả, animation, log panel) với đối thủ là AI. Engine 0 dòng đổi: `GameState` được dựng ở `apps/api` (`scenarioToState`, thuần), mọi action sau đó vẫn qua `applyAction`.
- Endpoint `POST /dev/sandbox/duels` chỉ tồn tại khi `NODE_ENV != production` (production → 404, có e2e); trang `/dev/sandbox.html` không nằm trong build production.
- 3 scenario mẫu: `tribute-summon`, `attack-defense`, `chain-basic`. **`chain-basic` chỉ dựng state đầu** (Trap úp + Spell trên tay/sân cả hai bên) vì Spell/Trap/Chain chưa có ở engine (P3): chưa có gì để kích hoạt, cũng không có `script` cho nó.

**Cách xem:** (cần Docker Postgres đang chạy)

1. `pnpm dev` → mở <http://localhost:5173/dev/sandbox.html> (thêm `?fast=1` để animation nhanh ×3).
2. Chọn mẫu ở ô chọn → sửa id lá trong textarea (chỉ id `SMP-001…SMP-018`, Spell `SMP-101`, Trap `SMP-201`) → **Nạp**.
3. Chơi như ván thường; nút "Menu" trong ván = đóng ván, quay lại form. "Đóng ván" ở thanh trên cũng vậy.
4. Thử lỗi: xoá dấu `}` (báo lỗi JSON), đổi một id thành `NOPE-1` (server báo `INVALID_SCENARIO … unknown card "NOPE-1"`).

**5 điều cần kiểm tra:**

1. `tribute-summon`: kéo SMP-003 (Lv8) hoặc SMP-018 (Lv7) ra sân → phải hỏi 2 lá hiến tế; SMP-015 (Lv5) cần 1; SMP-001 (Lv3) không cần. Luật khớp `[RULE]` chứ chưa có `[REF]`.
2. `attack-defense`: quái mình đánh được quái DefenseUp lẫn DefenseDown (lật rồi tính damage, xem log); bảng damage theo `RULES-REVIEW-SHEET.md`.
3. Bạn có thể tự dựng tình huống mình cần bằng file JSON không, hay format còn chỗ khó dùng? (`turn` = `{count, player}`; `summonedTurn` bỏ trống = quái đã ở sân lâu, được tấn công ngay; Spell/Trap `position` mặc định `DefenseDown` = úp.)
4. Tay/bài úp đối thủ không lộ (scenario chain-basic: tay AI có SMP-007 nhưng response chỉ có lá ẩn — đã có e2e + smoke kiểm tra).
5. Trang chỉ có ở dev: `pnpm --filter @yugi/web build` → `dist` chỉ có `index.html` + `debug.html`, không có `dev/sandbox.html`.

**So với reference:** công cụ dev, không thuộc bản gốc → không có `[REF]`. Luật thể hiện trong các mẫu là `[RULE]` như các task engine trước; không thêm `[GUESS]` mới. Số liệu LP/lượt trong mẫu (8000, lượt 3) là `[DECISION]` mặc định, đổi tự do trong JSON.

**Cần bạn cung cấp / trả lời:**

- Sau khi P3 xong: muốn `chain-basic` kích hoạt gì (Spell nào, Trap nào) để thêm vào file JSON? (chưa chặn gì hôm nay).
- Đối thủ hiện luôn là AI (ghế 1). Cần chế độ tự điều khiển cả hai bên (API đã có `?mode=solo-debug`, chưa có UI vì Duel scene chỉ điều khiển ghế 0)? Ghi ở đây để quyết sau.

**Kiểm chứng đã chạy:**

- Test đỏ trước: `task-2.11-red.txt` (3 nhóm: shared schema, api scenario/manager/e2e, web client/controller/load).
- Xanh: shared 77, api 233, web 345 test; `lint`/`typecheck` cả 3 package; `pnpm --filter @yugi/web build`.
- Mutant thủ công (`tools/mutants-2.11.mjs`): xem `task-2.11-mutants.txt`.
- Smoke HTTP thật (API + Postgres): `tools/smoke-sandbox.ts` 22/22 → `task-2.11-smoke.md` (3 mẫu × {nạp, phase/lượt, legalActions, tay ẩn, chơi 4 action, 409 sai luật} + 401 / 400 id lạ / 400 méo / 409 script).
- Screenshot thật (Edge headless, API + dev server thật): `docs/ai/review-packets/task-2.11-screens/` (`01-empty-page` … `06-server-refusal`), chụp bằng `tools/ui-sandbox-shots.ts`.
- **Chưa** kiểm: production build chạy thật của API với `NODE_ENV=production` (chỉ có e2e dựng module với `production` → 404 và test hàm `devOnlyModules`); nạp bằng file-input (trang chỉ có textarea + chọn mẫu, không có ô chọn file).

**Ghi chú thiết kế / lệch brief:**

- Brief nói pattern NODE_ENV cho endpoint dev "đã có ở `app.module.ts`" — thực tế chỗ đó chỉ dùng cho logger; dùng cùng biểu thức (`=== 'production'`) qua `devOnlyModules(process.env.NODE_ENV)` (danh sách module tĩnh, đọc `process.env` thay vì `ConfigService`; giá trị đã được `env.schema.ts` validate).
- Vết còn lại ở bundle production: một phương thức `createSandbox` trong client HTTP dùng chung (gọi endpoint 404 ở production, vô hại). Trang, scenario, scene Sandbox không vào bundle.
- `DuelSession.startAction` thành optional (thêm `initialState`); 4 chỗ test cũ đổi sang `initialStateOf(session)`. Session scenario **replay được** (có test).
- Scenario mẫu đặt ở `packages/shared/scenarios/` (dữ liệu, web + api cùng đọc được; không import vào bundle production).

**Task tiếp theo:** 2.12 (i18n VI+EN) theo `MASTER-PLAN.md`. Cổng bắt buộc trước P3: fuzz/golden kiểm bất biến "không lộ thông tin" qua HTTP khi có Spell/Trap (Sandbox có thể dùng làm nguồn dựng ca).
