# Review Packet — Task 3.4b: Nối wire chain + lá Set + cửa sổ phản ứng + prompt trigger (Shared + API + FE tối thiểu)

**Đã làm gì:** Mọi thứ về chuỗi mà engine đã có (3.3–3.6) giờ đi qua HTTP: server gửi **chuỗi công khai** (`chain`),
**cửa sổ đang mở** (`chainWindow`, kể cả "phản ứng sau Tấn công/Triệu hồi") và **ATK/DEF hiệu lực** của quái ngửa; hành động
**Bỏ qua** (`PassPriority`) và **Từ chối trigger** (`decline`) gửi được; 3 event chuỗi tới cả hai người chơi. **AI không còn kẹt**:
khi nó giữ quyền đáp trả thì kích hoạt Bẫy gây hại cho bạn hoặc bỏ qua; nó trả lời prompt trigger của lá mình. Chốt **C13**:
không có hộp thoại "Kích hoạt?" — chạm lá úp là kích hoạt, "Bỏ qua" là nút riêng (UI Phaser ở 3.7).

**Engine:** đúng **1 dòng** (bạn đã duyệt): `export { effectiveStats }` ở `packages/game-engine/src/index.ts`. Không đổi logic.

**Cách xem:**

- Trang debug (`apps/web/debug.html`, mục A `docs/design/debug-ui.md`): khi có cửa sổ mở, dòng trạng thái hiện
  `CHUỖI: [1] P0 … (tốc 1) · chờ P1 phản ứng (sau Tấn công)`; ghế giữ quyền có nút **Bỏ qua (PassPriority)**; prompt trigger có
  **Kích hoạt hiệu ứng trigger** / **Từ chối trigger**. ⚠ Card pool thật chưa có lá nào mở cửa sổ (SMP-201 chưa có hiệu ứng,
  không có quái trigger/Quick-Play), nên với deck thường bạn **sẽ không thấy** các nút này — đó là chủ đích (Phaser chưa có nút
  Bỏ qua cho tới 3.7).
- Test: `pnpm --filter @yugi/api exec vitest run duel-manager.chain` (AI đáp Bẫy trong cửa sổ, AI bỏ qua, AI tấn công → cửa sổ
  của bạn → bạn Bỏ qua / kích hoạt Bẫy, trigger optional/mandatory, bạn Từ chối trigger; replay log = state cuối).
- Test đỏ trước: `task-3.4b-red.txt`; mutation: `node tools/mutants-3.4b.mjs` → `task-3.4b-mutants.txt`.
- **Không có screenshot mới**: Phaser DuelScene không đổi hình (chỉ thêm 3 caption chữ cho event chuỗi, mà card pool thật không
  phát ra); trang debug đổi nhưng không mở được cửa sổ với deck thật và Docker/API không chạy trong phiên này.

**5 điều cần kiểm tra:**

1. **C13** ghi đúng ý bạn (ADR 2026-09-28 "C13", `fidelity-spec.md` G5, `rules-observed.md` C13): không dialog; "Bỏ qua" là
   nút riêng; prompt trigger của lá mình vẫn hỏi Có/Không.
2. **Chuỗi công khai cho cả hai bên**: lá đã kích hoạt (từ tay, lá úp lật lên, quái trigger/lá ở mộ) — đối thủ thấy tên lá,
   tốc độ, mục tiêu; **không** thấy lá dùng làm cost (đã công khai qua event) hay LP trả.
3. **ATK/DEF hiệu lực** chỉ có trên quái **ngửa**; quái úp không có (kể cả với chủ). Chỉ số in vẫn ở dữ liệu lá — 3.7 hiển thị cả hai.
4. **AI** (`[ASSUMED]`, đổi ở `ai/choose-action.ts`): trong cửa sổ chỉ kích hoạt lá **phá quái/đốt LP đối thủ**, còn lại Bỏ qua; trả
   lời trigger luôn "Có" (nhắm quái mạnh nhất của đối thủ) trừ khi chỉ còn "Không"; vẫn **không tự úp/kích hoạt** Phép/Bẫy ngoài
   cửa sổ (giữ như 3.2b).
5. Khi AI tấn công mà bạn có Bẫy đáp trả được: response **dừng** với cửa sổ mở cho bạn (`chainWindow.priorityPlayer = 0`), bạn
   Bỏ qua thì đòn tiếp tục và AI đi nốt lượt.

**So với reference:**

- `[REF]` video #3/#4: cửa sổ phản ứng sau tấn công/triệu hồi, chạm lá Bẫy úp (C13 giờ khớp). Chuỗi 2+ link/LIFO vẫn `[RULE]`
  (chưa có tư liệu Yugi H5).
- `[GUESS]`: thời lượng caption chuỗi (400/400/250 ms). `[ASSUMED]`: nhóm log (event chuỗi → Sân, AI Bỏ qua → Lượt), chính sách AI.
- Giới hạn còn lại: Phaser chưa có nút Bỏ qua (3.7); cửa sổ còn mở cho người kia biết "đối thủ có lá đáp trả" (trade-off ADR 3.3,
  chỉ quan trọng ở PvP); câu log AI cho câu trả lời prompt có id vẫn là "bỏ bài"; UI/AI chưa dùng ATK/DEF hiệu lực.
- Sửa kèm (lỗi có sẵn từ 3.1): trang debug in tên lá thành `[object Object]` → giờ in tên tiếng Việt.

**Kiểm chứng:** lint + typecheck 4 package xanh; test shared 129, engine 606 (golden không đổi, `git diff packages/game-engine` = 1
dòng), api 312, web 470. Fuzz leak dài 200 seed × 400 bước: 73.672 bước, 264 ván, 6.328 lần thử sai bị từ chối, 553 prompt
trigger (267 decline), 913 cửa sổ phản ứng, 661 link ≥ 2, 1.732 lần kích hoạt lá Set — **0 vi phạm**. AI vs AI với deck chuỗi:
200/200 ván kết thúc (4 × 50 song song; bản 1 lượt 200 ván cũng xong hết nhưng vượt timeout 600 s của vitest), AI giữ ưu tiên
~9.9k lần (≈2k kích hoạt, ≈7.1k bỏ qua), 0 action bị từ chối, 0 đầu hàng. Mutation 23/23 (lần đầu 20/23 → thêm 2 test, sửa 1 mẫu).
Smoke HTTP thật (`tools/smoke-http.ts`, `play-vs-ai.ts`) **chưa chạy** (Docker/API không bật trong phiên này).

**Cần bạn cung cấp:** không bắt buộc. Vẫn chờ: **C14** (Bẫy chọn chế độ lúc Set), tư liệu chuỗi 2+ link (`human-tasks.md`).

**Task tiếp theo:** **3.7** UI chuỗi trong Phaser — chạm lá Set có `ActivateEffect` hợp lệ (C13), banner "đang chờ phản ứng",
nút "Bỏ qua", overlay Có/Không cho `TriggerActivation`, hiện ATK/DEF hiệu lực; sau đó mới thêm lá thật có trigger/Speed 2 vào pool.
