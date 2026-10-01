# Nhật ký planning, tư liệu và giá trị đã chốt (không thuộc một phase code)

> Nhật ký task, **nguyên văn** từ `docs/ai/PROGRESS.md` tại thời điểm tách (2026-10-01, commit 566d9f5).
> Số liệu/trạng thái ở đây là lúc task xong; trạng thái hiện tại: `docs/ai/PROGRESS.md`. Task mới: thêm vào CUỐI file.

- **Ingest video #1/#2 xong (2026-09-20)** — mâu thuẫn ở `docs/reference/notes/rules.md` + `rules-observed.md`.
- **C11 đã chốt (2026-09-20)**: `[DECISION]` Trap phải Set mới kích hoạt, không từ tay; `[RULE]` Trap vừa Set chưa kích hoạt trong lượt đó; `[RULE]` Spell thường kích hoạt từ tay ở Main Phase. Đã thêm `allowTrapActivationFromHand` (false) + `trapSetTurnDelay` (true) vào `RulesetConfig` (shared, có test); hành vi engine ở task 3.4 (test `it.todo` ở `packages/game-engine/src/rules/trap-activation.test.ts`). Quan sát 15:17 → backlog `rules-observed.md`.
- Tư liệu còn thiếu (Set / đổi thế / Lật, màn thắng-thua, ảnh tab Dung Hợp) **không chặn** 1.4 — xem `parity-board.md`, `human-tasks.md`.
- **Planning: mở rộng scope P10–P15 (2026-09-25, chỉ tài liệu, chờ chủ dự án duyệt hướng)** — Economy, Gacha, Shop, Adventure, Arena, Live-ops đã vào `MASTER-PLAN.md` (phase-level, **chưa** breakdown task con), `economy-plan.md`, `modes-and-liveops-plan.md`, `project-vision-patch.md` (bản vá cho `01-project-vision.md` ngoài repo), ADR 2026-09-25 "Mở rộng scope". Cần chủ dự án chốt: các `[DECISION]`/`[CẦN HỎI]` (E1–E9 + mục P13–P15) và duyệt **đề xuất sửa CLAUDE.md #5**. Không đổi code/thứ tự task hiện tại.
- **Ingest video #3/#4 (2026-09-26, chỉ tư liệu, không code)** — trọng tâm chain cho 3.3. `[REF]`: Bẫy úp phản ứng sau tuyên bố tấn công, trước damage (3 lần của mình, 1 của AI) và phản ứng triệu hồi (1 lần); khoảng chờ ~1.6–2.2 s. **Không thấy**: hộp thoại "Kích hoạt?", chain 2 link/LIFO/priority, Quick-Play ngoài lượt, kích hoạt Bẫy cùng lượt Set. C11 không mâu thuẫn. **Mâu thuẫn chờ chủ dự án: C13** (phản ứng = chạm lá Bẫy úp, không dialog vs G5/C12), **C14** (Bẫy chọn chế độ lúc Set). Xem `docs/reference/notes/rules-observed.md` mục "Video #3/#4", `timestamps-video3.md`, `timestamps-video4.md`. 3.3 vẫn cần tư liệu chain 2 link.
- Đã chốt sau duyệt 1.1: `openingHandSize = 5` (**[REF]**, video #2 4/4 ván), `afkLossThreshold = 3`, `extraDeckSize = 20` (**[REF thấp, 1 nguồn]**, C3), `startingLP = 8000` (**[DECISION]**, C2/C10), `extraMonsterZones = 0` (C1).
- G1–G8/G11/G12 đã chốt (xem `docs/reference/notes/rules.md`); G9/G10 vẫn `[GUESS]` chờ tư liệu.
- Mỗi task kết thúc bằng Review Packet (`/review-packet`) và cập nhật `docs/plan/parity-board.md`.
