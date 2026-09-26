# Review Packet — Task 3.2b: Nối wire Spell/Trap (API + Frontend) + cổng fuzz "không lộ definitionId"

### Review Packet — Task 3.2b

**Đã làm gì:**
Bài Phép/Bẫy giờ chơi được thật qua server và màn Duel: kéo lá vào ô Phép/Bẫy → menu **Kích hoạt / Úp** (Bẫy chỉ Úp), lá úp hiện mặt sau với đối thủ, SMP-101 kích hoạt rút 1 lá, có animation + dòng log + tiếng Việt/Anh. Kèm **cổng kiểm tra bắt buộc**: fuzz tự chơi hàng chục nghìn bước, soát mọi phản hồi server gửi cho từng người chơi — **0 lần lộ lá ẩn**. Game engine không sửa dòng nào.

**Cách xem:**

1. `docker compose up -d` rồi `pnpm dev` (API :3000 + web :5173).
2. Mở `http://localhost:5173/dev/sandbox.html`, chọn mẫu **chain-basic** → **Nạp** (hoặc dán JSON có `SMP-101`/`SMP-201` trên tay).
3. Kéo lá **Rào Chắn Hộ Vệ** (Bẫy) xuống hàng ô dưới cùng của bạn → úp ngay. Kéo **Tiếp Viện Bất Ngờ** (Phép) xuống ô Phép/Bẫy → bấm **Kích hoạt** → xem lá lớn, rút 1 lá, lá Phép vào Mộ, log panel (nhóm **Sân**).
4. Xem màn chọn mục tiêu (chưa có lá thật nào cần): `http://localhost:5173/?fixture=effect-target` → bấm lá úp của đối thủ → **Xác nhận**.
5. Ảnh chụp thật: `docs/ai/review-packets/task-3.2b-screens/` (01–10; 10 là tiếng Anh). Tự chụp lại: `node --experimental-strip-types tools/ui-spell-shots.ts`.

**5 điều cần kiểm tra** (checklist QA #1, #5, #9, #10, #8):

1. Kéo lá Phép/Bẫy: ô sáng đúng chỗ thả được? thả vào ô đã có lá → lá quay về + thông báo? (ảnh 02, 03)
2. Menu **Kích hoạt / Úp** có dễ hiểu? Bẫy trên tay không có "Kích hoạt" (đúng C11)? (ảnh 04)
3. Animation kích hoạt (~1.3 s) có vừa không? Space/Enter bỏ qua được? — **biết trước:** khung lá Phép hiện giữa sân hơi nhỏ (ảnh 05), cần bạn chấp nhận hoặc bảo làm to hơn.
4. Log panel: có đủ 5 dòng "úp… / kích hoạt… / rút… / đã xử lý xong / vào mộ" và lọc được bằng chip **Sân**? (ảnh 06)
5. Đổi `?lang=en`: nút **Activate / Set** và dòng log tiếng Anh không tràn chữ? (ảnh 10)

**So với reference:**

- Bẫy/Phép úp hiện dạng lá úp trên hàng ô phải — khớp video #2/#3 `[REF]`.
- Thời lượng lá Phép lớn khi kích hoạt 1.3 s `[REF]` (video #2, 1 lần đo); Úp 0.5 s, hồi/trả LP 0.5 s `[GUESS]`.
- Menu "Kích hoạt / Úp" khi thả lá là **thiết kế của AI** `[DECISION chờ duyệt]` — video #3/#4 chưa cho thấy rõ thao tác kích hoạt Phép từ tay của người chơi.
- Phá Phép/Bẫy úp bằng hiệu ứng → lộ lá vì vào Mộ `[ASSUMED]` (giống quái úp bị phá).
- AI **chưa** dùng Phép/Bẫy (theo brief; làm ở task AI sau).
- Người không phải trả lời prompt chọn mục tiêu **không** thấy chi tiết prompt (chỉ biết "đối thủ đang chọn") — quyết định bảo mật của AI, ghi ở ADR.

**Cần bạn cung cấp:**

- Quyết định **C13** (từ ingest video #3/#4): phản ứng Bẫy = hộp thoại "Kích hoạt?" như G5 hay "chạm lá Bẫy úp trong lúc chờ" như video — `docs/reference/notes/rules-observed.md` mục "Mâu thuẫn / căng thẳng…".
- Video chain 2 lá liên tiếp + màn cài đặt auto-pass — `docs/plan/human-tasks.md` mục **Theo phase → P3** ("Video/GIF chain, activate spell/trap", "Trả lời G5–G6").

**Task tiếp theo:** 3.3 — Chain stack + PassPriority (chờ bạn quyết C13 và/hoặc gửi video chain 2 link; AI không tự đoán flow chain).

---

## Chi tiết kỹ thuật (cho người duyệt code)

| Lớp    | Thay đổi                                                                                                                                                                                                                                                                                                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engine | 0 dòng (`git diff packages/game-engine` rỗng)                                                                                                                                                                                                                                                                                                                                               |
| Shared | `action-schema.ts` (+`SetSpellTrap`, `ActivateEffect`, strict), `event-view.ts` (+7 type), `state-view.ts` (type payload prompt)                                                                                                                                                                                                                                                            |
| API    | `event-view.ts` (7 event PUBLIC), `state-view.ts` (`promptView`: che payload với người không được hỏi, deny by default), `duel-manager.ts` (gỡ `ENGINE_ONLY_ACTIONS`), `duel-manager.spell-trap.spec.ts` (thay `engine-only.spec`), AI chỉ thêm test                                                                                                                                        |
| Gate   | `testing/leak-check.ts` (+spec âm), `event-visibility.fuzz.spec.ts`, nhóm "Spell/Trap over HTTP" ở `duels.e2e.spec.ts` (golden + 3×100 bước HTTP thật)                                                                                                                                                                                                                                      |
| Web    | `legal-index.ts` (`spellSetOptions`, `activations`), `layout.ts` (`spellZoneIndexAt`), `interaction.ts` (`dropSpell`, `purpose: cost/target`), `interaction-driver.ts` (settle view có sẵn), `presenter.ts` (không xoay lá Phép/Bẫy, câu prompt target), `animation-queue.ts` (+7 step), `log-entries.ts`, `describe-*.ts`, locales vi/en, `duel-scene.ts`, fixture `spell`/`effect-target` |

**Kiểm chứng:**

- `pnpm lint`, `pnpm typecheck`, `pnpm test` toàn workspace xanh: shared 113, engine 436 (+3 todo), api 273, web 450.
- Test đỏ trước: `task-3.2b-red.txt`. Mutant: `task-3.2b-mutants.txt` — **20/20 bị bắt** (5 mutant rò rỉ bị bắt chỉ bằng fuzz gate).
- Fuzz dài `FUZZ_SEEDS=200 FUZZ_STEPS=400`: 201/201 test đạt — 75.553 bước, 250 ván, 4.447 lần thử Phép/Bẫy sai bị từ chối (state không đổi), 576 prompt target, 7 event đều xuất hiện, **0 vi phạm**. Vitest báo thêm 1 lỗi hạ tầng `Timeout calling "onTaskUpdate"` (lượt chạy đồng bộ ~10 phút, cùng hiện tượng đã ghi cho `simulate.spec.ts`), không phải assertion nào hỏng — nhưng lệnh thoát mã 1.
- Chạy thật (Docker + Postgres 5433 + `pnpm dev`): `tools/smoke-http.ts` 23/23 (`task-3.2b-smoke-http.md`), `tools/play-vs-ai.ts` 132/132, `tools/smoke-sandbox.ts` đạt (`task-3.2b-smoke-sandbox.md`).
- Lỗi tìm ra khi chụp ảnh và đã sửa (test đỏ trước): view có sẵn prompt lúc khởi tạo (fixture / tải lại trang giữa prompt) không mở overlay chọn.
