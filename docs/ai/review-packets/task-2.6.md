### Review Packet — Task 2.6: AI rule-based + `solo-vs-ai` (API + Shared + Frontend/debug)

**Đã làm gì:** AI đối thủ là hàm thuần `chooseAction` (`apps/api/src/modules/duels/ai/`), chỉ nhận `StateView` của ghế AI + `legalActions` + card definitions + rng có seed; không thấy tay/deck/lá úp của người. `DuelManager` chạy vòng lặp AI trong khoá duel qua đúng `applyAndSave` (validate, log, replay). Mode `solo-vs-ai`: người ghế 0, AI ghế 1; xem/điều khiển ghế AI → 403. Không sửa `packages/game-engine`. Trang debug có chế độ "Đấu với AI".

**Kiểm chứng:** lint/typecheck/build xanh; shared 58, web 69, api 190 test. Qua HTTP thật: `tools/play-vs-ai.ts` **83/83** (ván trọn tới thắng, 74 action người / 57 action AI), `tools/smoke-http.ts` 23/23 (solo-debug không đổi).

- **Không nhìn trộm:** test metamorphic (2 state chỉ khác thông tin ẩn → cùng view, cùng action; có khẳng định 2 raw state khác nhau) + test spy ở manager + e2e quét instanceId↔definitionId bài AI còn trên tay.
- **Mô phỏng 200 ván AI vs AI (seed có sẵn):** 200/200 kết thúc, 0 action bị engine từ chối, 0 Surrender; ~35 lượt, ~265 action/ván; thắng ghế 0 / ghế 1 = 101 / 99.
- **Sức mạnh, 200 ván AI vs random-legal (đổi ghế):** AI thắng **183/200 = 91.5%** (ngưỡng đề ra 70%).
- **Mutation thủ công 21 mutant: 21 bị bắt, 0 sống** (AI Surrender, bỏ trần vòng lặp, driver bỏ log, event sai ghế, người điều khiển ghế AI, xem ghế AI, ...).

**Xem thử 5 phút:** `pnpm dev` → `http://localhost:5173/debug.html` → mục "Chơi thử với AI" trong `docs/design/debug-ui.md`.

**Cần bạn duyệt (`[ASSUMED]`):**

1. Không làm Bước 0 (tách commit): working tree đã sạch, 2.5 đã commit.
2. Người luôn ghế 0, AI ghế 1 (ghế 0 luôn đi trước); nhánh AI đi trước chỉ test ở tầng manager.
3. `aiActions: {action, eventsFrom, eventsTo}[]` ở response để tách event theo hành động AI.
4. Ngưỡng chính sách (quái úp ≥1800 ATK, margin tribute 300) — G13 `[GUESS]` trong fidelity-spec.
5. `AI_LOOP_LIMIT` = HTTP 500; deck AI = deck/starter deck như người.
6. Mô phỏng nặng (mỗi ván 4–6 s vì tính legalActions): suite mặc định 3 ván/loại; bản dài `AI_SIM_GAMES=50 AI_SIM_OFFSET=0|50|100|150`.
