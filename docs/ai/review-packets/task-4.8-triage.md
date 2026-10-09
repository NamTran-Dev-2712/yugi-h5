# Task 4.8 — Phase 0: kết quả (2026-10-09)

**Hỏi chủ dự án: 4 câu (1 hộp thoại) · Mặc định tự dùng: 0 · Ô duyệt trống của sheet: vẫn 1 (G26 f) · Code game sửa ở
Phase 0: 0 dòng.**

## 0a. Đường cơ sở (commit `d84020f`, trước khi sửa gì)

| Lệnh             | Kết quả                                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| `pnpm lint`      | xanh (4 / 4 package)                                                                                      |
| `pnpm typecheck` | xanh (6 / 6 tác vụ)                                                                                       |
| `pnpm test`      | shared **267** / 267 · engine **1230** / 1230 (98 file) · api **551** / 551 (40 file) · web **734** / 734 |
| Golden           | **30** file ở `packages/game-engine/src/__golden__/`                                                      |

`pnpm test` thoát mã 1 dù mọi test xanh: vitest của api báo `Timeout calling "onTaskUpdate"` khi cả workspace chạy song
song (bài học ADR 058 / 062 — đọc dòng `Tests`, không chỉ nhìn mã thoát). Không phải lỗi mới.

**Dấu vân tay fuzz trước khi sửa** (test tạm, không commit): hash của `log` + `stats` cho 370 lần chạy — `fuzz-1…60` × 400
bước, `fuzz-1…30` × 300, `negate-1…80`, `sumwin-1…60`, `fusion-1…60`, `batch2-1…60` (× 400) và 5 seed `*-long-*` của mỗi
variant (× 300). So lại sau bản sửa P7 và sau phần Ignition; kết quả ghi ở review packet.

## 0b. Hộp thoại — câu đã hỏi và đáp án

Mọi câu đều có người trả lời (không dùng mặc định thay người).

| #   | Câu hỏi (rút gọn)                                                  | Đáp án                              | Hệ quả                                                                                                              |
| --- | ------------------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Q1  | Phạm vi task 4.8?                                                  | **Tách 3 task** (khuyến nghị)       | 4.8 = engine sau cờ tắt · 4.8b = wire + UI + 3 lá thật · 4.9 = cost chọn lá cho trigger + ChangePosition + SendToGY |
| Q2  | Quái vừa triệu hồi / lật có bấm hiệu ứng Ignition ngay được không? | **Được — luật chuẩn** (khuyến nghị) | Không chặn theo lượt triệu hồi; G22 chỉ áp cho tấn công. Ghi thành **G28 `[DECISION]`**                             |
| Q3  | "Mỗi lượt 1 lần" tính theo gì?                                     | **Theo từng bản lá** (khuyến nghị)  | Dấu lượt nằm trên `CardInstance`; bản rời sân rồi vào lại là bản mới. Ghi vào **G28**                               |
| Q4  | Brief để trống "[ĐIỀN]" về việc duyệt 4.7 — ghi nhận thế nào?      | **Đã duyệt cả 26 lá**               | Ghi vào docs; `parity-board.md` vẫn 🟨 (chỉ chủ dự án chuyển ✅)                                                    |

## 0c. Điều tìm ra khi đọc mã — lệch brief, nói trước khi làm

1. **Cờ ruleset là `.optional()`, không `.default(false)`** (brief: "mặc định false, mẫu `allowTrapActivationFromHand`").
   Cả 30 golden lưu nguyên `state.ruleset`; thêm một khoá có giá trị mặc định làm **đổi byte cả 30 file** — trái ràng buộc
   cứng của chính brief. Khoá vắng = tắt cho cùng hành vi mà golden, `StateView.ruleset` trên wire và mọi state đã lưu giữ
   nguyên (cùng bài học ADR 069).
2. **Mã lỗi hiện tại của quái trên sân là `CARD_NOT_IN_HAND`**, không phải `NOT_A_SPELL_TRAP` như brief ghi: `locate` không
   tìm ở ô quái. `NOT_A_SPELL_TRAP` chỉ dành cho quái **trên tay**; quái có effect `Continuous` thì
   `CONTINUOUS_NOT_ACTIVATABLE`. "Cờ tắt = y như cũ" nghĩa là giữ đúng ba mã này (có test ghim, xanh trước và sau).
3. **Trang Sandbox bật được cờ**: `ScenarioSchema.ruleset` là bản `partial()` của `RulesetConfigSchema`, nên khoá mới tự có
   mặt ở scenario. Containment ở api phải gỡ khoá ở **cả hai** lối tạo duel (`createDuel` và `scenarioToState`).
4. **Cost `Tribute`**: `planCosts` không loại lá nguồn, nên một quái có thể hiến tế **chính nó** để trả cost của hiệu ứng
   của nó. Ngữ nghĩa đó ("hiến tế lá này") chưa ai chốt ⇒ 4.8 **từ chối** (`INVALID_COST`) và ghi "chưa hỗ trợ"; hiến tế
   **quái khác** chạy qua đường cũ.

## 0d. Triage `RULES-REVIEW-SHEET.md`

- Trước task: 1 ô duyệt trống (G26 f — nguyên liệu Dung hợp từ Bộ bài, "giữ tạm, chờ tư liệu"). **Giữ nguyên, không hỏi lại.**
- Dòng mới do task 4.8 thêm: xem mục E ở cuối file này (điền ở cuối task, quy trình A / B / C của ADR 064).

## C. Còn chờ chủ dự án (không đổi so với trước task)

1. G26 (f) — nguyên liệu từ Bộ bài: cần video bản gốc có nhãn "Bộ bài" (`docs/plan/human-tasks.md`).
2. Mở rộng `CLAUDE.md` #5 cho P10+ (ADR 043) — để tới P10.

## E. Dòng mới do task 4.8 thêm vào sheet (điền cuối task, 2026-10-10)

**11 dòng** (sheet: 106 → 117 dòng luật). Theo quy trình A / B / C của ADR 064:

| Loại                                               | Số dòng | Dòng nào                                                                                                                     |
| -------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| A — thuần `[RULE]`, AI duyệt thay (đủ 4 điều kiện) | 5       | lá Trang bị không là mục tiêu; mọi prompt trả lời được; điều kiện bấm Ignition; "mỗi lượt 1 lần" tính lúc nào; cost của quái |
| B — `[DECISION]` đã có câu trả lời từ trước        | 4       | công tắc tắt (Q1), dùng ngay lượt triệu hồi (Q2), theo từng bản lá (Q3), bị vô hiệu thì quái ở yên / cost không hoàn (G23)   |
| C — phải hỏi ở cuối task                           | 2       | G28 (c) quái tự hiến tế chính nó; G28 (d) quái rời sân trước khi hiệu ứng resolve                                            |

**Hộp thoại cuối task (2 câu, chủ dự án trả lời cả 2, đều chọn "giữ"):** (c) vẫn **từ chối**, làm ở 4.9; (d) hiệu ứng **vẫn
thực hiện**. Hai dòng đó ghi "☑ (chủ dự án chọn qua hộp thoại, 2026-10-10)" và nhãn đổi thành `[DECISION]`.

Sau task: **còn đúng 1 ô trống** (G26 f — không đổi).
