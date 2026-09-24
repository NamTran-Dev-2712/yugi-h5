### Review Packet — Task 2.5: legalActions (Engine + Shared + API + Frontend/debug)

**Đã làm gì:** engine có hàm thuần `getLegalActions(state, seat, ctx)` trả các action mà ghế đó gửi được ngay bây giờ. Nó **không chép luật**: sinh ứng viên theo cấu trúc (mỗi lá tay × Summon/Set × 5 ô × tập tribute 0–2 quái; đổi thế; từng cặp tấn công/trực tiếp; EndPhase; Surrender; mọi tổ hợp bỏ bài) rồi giữ những cái `applyAction` thật sự chấp nhận (dry-run). API trả `legalActions` của đúng ghế trong `POST /duels/solo`, `GET /duels/:id?viewer=`, `POST /duels/:id/actions`. Trang debug làm mờ/tắt nút không hợp lệ và có công tắc "Cho phép thử hành động sai luật". `legalActions` phục vụ ba nơi: **AI (2.6), trang debug, Phaser (highlight ô hợp lệ)**. Đổi số task: 2.5 = legalActions; AI dummy + `solo-vs-ai` → **2.6**; Duel scene 2.7 … i18n 2.12 (MASTER-PLAN, PROGRESS đã sửa).

**File chính**

- Engine (chỉ THÊM): `src/legal-actions.ts`, `src/index.ts` (+1 dòng export), `src/legal-actions.test.ts` (18 ca), `src/legal-actions.property.test.ts`, `src/testing/fuzz/fuzz.ts` (thêm callback tuỳ chọn `onState`).
- Shared: `duel/http-types.ts` (`legalActions` trong `ViewResponse`/`GetViewResponse`).
- API: `duel-manager.ts` (`getLegalActions`, `legalActions` trong kết quả `createDuel`/`submitAction`), `duels.controller.ts`; test `duel-manager.spec.ts` (+5), `duels.e2e.spec.ts` (+2 và quét rò rỉ), `event-visibility.spec.ts` (sửa 1 assertion tập key).
- Web: `src/debug/build-actions.ts` (`applyLegality`), `debug-state.ts`, `debug-page.ts`, `debug.html` (+ test).
- Tools: `tools/smoke-http.ts` (+5 kiểm tra), `tools/play-duel.ts` (đối chiếu mọi action gửi với legalActions).
- Docs: ADR 2026-09-24 "legalActions", `protocol.md`, `debug-ui.md`, `MASTER-PLAN.md`, `PROGRESS.md`, `parity-board.md`, `CLAUDE.md` của engine/api/web.

**Cách xem:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build` (đã xanh: shared 58, engine 381 + 7 todo [362 cũ + 19 mới], api 142, web 64). `git diff packages/game-engine` chỉ có 1 dòng export + callback `onState` của harness fuzz (không đổi handler/test cũ).

**Xem thử trên trang debug (dưới 5 phút):** bật `pnpm dev` (Docker Postgres đang chạy), mở `http://localhost:5173/debug.html`, làm theo mục "Xem thử legalActions" trong `docs/design/debug-ui.md`: (1) tạo duel → chỉ EndPhase/End Turn/Surrender sáng, "Xem là P1" chỉ còn Surrender; (2) EndPhase 2 lần tới Main1 → Triệu hồi/Úp Lv≤4 sáng, Lv≥5 mờ; (3) Triệu hồi 1 lá → mọi Triệu hồi/Úp còn lại mờ; (4) lượt 1 Battle → Tấn công mờ; (5) bật công tắc "Cho phép thử hành động sai luật" và bấm nút mờ → `409 NORMAL_SUMMON_USED`, `version` không tăng.

**Hành vi đã test**

- Kịch bản engine: Summon/Set đủ 5 ô; Spell không Summon; đã Normal Summon → hết Summon/Set; Lv5 cần 1 tribute, Lv7 cần 2; lượt 1 không tấn công; đối thủ trống → direct, có quái → chỉ đánh có mục tiêu (kể cả úp); đã đổi thế không đổi lại; tay > 6 ở Main2 → chỉ câu trả lời bỏ bài (C(7,1)=7) + Surrender, ghế kia chỉ Surrender; ghế không đến lượt chỉ Surrender; `allowSurrender=false` bỏ Surrender; duel kết thúc → `[]`; không có `Draw`/`StartDuel`; không trùng; mọi action trong list được `applyAction` chấp nhận; lỗi không phải `EngineError` được ném lại; input đóng băng không bị mutate.
- **Property test** (fuzz có seed, seed in ra khi fail; mặc định 8 seed × 200 bước, chạy dài bằng `LEGAL_SEEDS`/`LEGAL_STEPS`): lần chạy 25 seed × 250 bước: 3534 state, 40 454 action liệt kê, 192 619 action âm (biến thể sai của action hợp lệ + rác) đều bị từ chối; (a) list ⊂ được chấp nhận, (b) ngoài list (không tính Draw/StartDuel) bị từ chối, (c) không trùng, (d) duel đang chạy luôn có EndPhase/Surrender/câu trả lời prompt. **0 vi phạm.**
- Hiệu năng: đầy sân (5 vs 5) + tay 7 (Lv7/5/4) = 107 action hợp lệ, **~14–17 ms/lần** (~1100 dry-run). Ngưỡng test 300 ms (để không flake khi workspace chạy song song).
- API: mọi response mang `legalActions` của đúng ghế (GET viewer 0/1, POST solo viewer 0/1, POST action = ghế người gửi, sau action); ghế không đến lượt chỉ `[Surrender]`; sau Surrender `[]`; mọi phần tử qua `PlayerActionSchema`; **quét rò rỉ** trong ván e2e Summon/Set/Flip-attack/Surrender: `legalActions` không chứa chuỗi `definitionId`, không nêu `instanceId` của tay đối thủ.
- Web: `applyLegality` khớp theo type + trường cố định (lá/ô/thế), thu hẹp ô quái/mục tiêu/tribute/bỏ bài, không thu hẹp khi công tắc bật, trực tiếp chỉ khi hợp lệ, `null` (chưa có phản hồi) = tất cả hợp lệ, danh sách rỗng = không nút nào sáng; `debug-state` lưu `legalActions` cùng `view`.
- Thật qua HTTP: `tools/smoke-http.ts` **23/23**; `tools/play-duel.ts` **109/109** (79 action đối chiếu: được liệt kê ⇔ server 200), `HEAVY=1` **124/124** (93 action), 0 lộ bài.

**Mutation test thủ công (18 mutant, 16 bị bắt, 2 tương đương)**

- Engine: bỏ dry-run (bị bắt); `MAX_TRIBUTES`=1 (bắt); quên câu trả lời prompt (bắt); bỏ ứng viên Surrender (bắt); bỏ SetMonster (bắt); chỉ đổi sang Attack (bắt); nuốt lỗi không phải EngineError (**sống lần đầu** → thêm test "rethrows unexpected", rồi bị bắt); bỏ early-return duel kết thúc (**sống, tương đương**: mọi handler đã ném `DUEL_ENDED`); bỏ khử trùng (**sống, tương đương**: ứng viên vốn không trùng; giữ làm phòng thủ).
- API: POST trả list của ghế kia (bắt); `getLegalActions` ghế kia (bắt); GET luôn ghế 0 (bắt); POST trả `[]` (bắt); `POST solo` trả list ghế kia (**sống lần đầu** → thêm e2e, rồi bị bắt).
- Web: `applyLegality` bỏ khớp trường cố định (bắt); thu hẹp thành no-op (bắt); state giữ `legalActions` cũ (bắt); coi mọi nút là hợp lệ (bắt).

**Cần bạn duyệt (`[ASSUMED]`)**

1. **Lệch yêu cầu #3 (đã duyệt ở bước plan, xin xác nhận lại):** `Surrender` có trong list của **cả hai ghế**, kể cả khi có prompt hoặc không đến lượt, vì engine chấp nhận (ADR 1.9). Nên "ghế kia trả mảng rỗng" thành `[Surrender]`; `[]` chỉ khi duel kết thúc hoặc `allowSurrender=false`. Muốn `[]` cứng thì phải sửa engine (ngoài phạm vi).
2. `getLegalActions` nhận thêm `ctx` (chữ ký khác `(state, playerIndex)` trong yêu cầu) vì dry-run cần `cardDefinitions`.
3. Trần tribute = 2 và tổ hợp bỏ bài ≤ 200 là hằng số trong bộ sinh ứng viên (không phải luật); luật cần >2 tribute phải nâng `MAX_TRIBUTES`.
4. `legalActions` nằm ở cấp response, **không** trong `StateView`; luôn của ghế `view.viewerIndex`, tính trên state sau action (POST).
5. Property test loại `Draw`/`StartDuel` khỏi tập âm (engine chấp nhận `Draw`, nhưng server cấm và không bao giờ liệt kê).
6. Property test chỉ kiểm mẫu ngẫu nhiên có giới hạn (tối đa 8 action hợp lệ được biến thể hoá mỗi state/ghế) chứ không vét cạn mọi tập âm; chạy dài bằng biến môi trường.
7. Người xem ghế không có quyền vẫn nhận `legalActions` của ghế mình xem (chủ solo-debug xem được cả hai ghế); PvP sau này chỉ trả ghế của chính người chơi (nhánh `duel-access`).

**Vi phạm quy trình cần báo:** (a) hai lần tôi gõ heredoc có nháy trong Bash và bị hook chặn (đã chuyển sang Write/Edit; không ảnh hưởng kết quả). (b) Sửa 1 assertion cũ (`event-visibility.spec.ts`, tập key kết quả `submitAction`) và 2 fixture `debug-state.test.ts` vì shape response đổi có chủ đích — không có test engine cũ nào bị sửa. (c) `tools/smoke-http.ts` ghi đè `docs/ai/review-packets/task-2.4-smoke.md` (hành vi có sẵn của script; nội dung nay là bản 23 kiểm tra).

**Việc để dành:** bộ sinh ứng viên cho Activate/Chain/target ở P3 + mở rộng property test; fuzz/golden "không lộ thông tin" khi có Spell/Trap (cổng bắt buộc trước P3, vẫn mở); PvP chỉ trả `legalActions` của chính người chơi; nếu ứng viên tăng nhiều thì thu hẹp bằng cấu trúc trước khi tối ưu.

**Task tiếp theo:** 2.6 AI dummy (`AIPlayer` random-legal-with-seed, mode `solo-vs-ai`) — chọn action từ `getLegalActions`.
