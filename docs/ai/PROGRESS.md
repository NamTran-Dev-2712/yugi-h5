# Progress — trạng thái hiện tại

File này được tự nạp mỗi session nên **chỉ giữ trạng thái hiện tại** (trần ~8.000 ký tự). Cuối mỗi task:
(1) thêm mục chi tiết (đã làm gì, số test, mutant, smoke, ảnh) vào CUỐI `docs/ai/progress/p<phase>.md`;
(2) ở đây chỉ sửa "Đang ở đâu", dòng checklist của phase và các danh sách bên dưới. Không chép chi tiết task vào đây.

## Đang ở đâu (cập nhật 2026-10-02, sau task 4.4b)

- **Phase đang làm: P4** (card batches + luật mở rộng), xong bản nháp tới **4.4b** (Counter Trap / Negate đã lên wire +
  UI; engine 0 dòng).
- **Task tiếp theo (đề xuất):** (a) task engine nhỏ **"cửa sổ vô hiệu triệu hồi đứng trước trigger" + "Equip Spell đã
  Set"** — nên đi trước; rồi (b) **4.5 Fusion**. Lý do và chi tiết: mục "Bàn giao sau 4.4b" ở `docs/ai/progress/p4.md`.
- P0 xong. P1, P2, P3 và 4.1–4.4b là **bản nháp chờ chủ dự án duyệt** (AI chỉ tới 🟨; chỉ người dùng chuyển ✅ ở
  `docs/plan/parity-board.md`). P2 còn **2.4 ⏳ chờ người dùng test** theo `docs/design/debug-ui.md`.

## Chờ chủ dự án

- Test tay task 2.4 (mục A/C/D/E của `docs/design/debug-ui.md`); duyệt các bản nháp (review packet từng task:
  `docs/ai/review-packets/task-<số>.md`; mới nhất: `task-4.4b.md` + 14 ảnh ở `task-4.4b-screens/`).
- Scope P10–P15: chốt `[DECISION]`/`[CẦN HỎI]` E1–E9 (`docs/plan/economy-plan.md`) + mục P13–P15
  (`docs/plan/modes-and-liveops-plan.md`); mở rộng danh sách bảng DB ở `CLAUDE.md` #5 (để tới P10) và câu hỏi quy mô
  deploy trước P14 (ADR 043).
- Tư liệu còn thiếu (`docs/plan/human-tasks.md`): chain 2+ link, Set / đổi thế / Lật, màn thắng-thua, ảnh tab Dung
  Hợp, clip Bẫy Phản công / vô hiệu (G23, G24). Mâu thuẫn còn mở: **C14** (Bẫy chọn chế độ lúc Set) —
  `docs/reference/notes/rules-observed.md`.
- `docs/ai/OPEN-ISSUES.md` còn 2 mục: **G22** (quái vừa triệu hồi chưa tấn công được trong lượt đó, `[GUESS]`, "giữ tạm"
  tới khi có video) và bảng DB cho P10. `RULES-REVIEW-SHEET.md` còn trống 1 dòng (G22).

## Đã chốt 2026-10-02 (không hỏi lại; ADR 066)

- **G23 giữ**: cost không hoàn khi bị vô hiệu; lá / quái bị vô hiệu "được gửi vào mộ", không "bị phá".
- Buff của lá Liên tục / Môi trường có hiệu lực **ngay khi lá nằm ngửa** (kể cả khi đối thủ còn được đáp trả): giữ.
- Quái có hiệu ứng "khi được triệu hồi" đã lên chuỗi thì không vô hiệu triệu hồi được: **hoãn** — task engine nhỏ riêng
  trước 4.5; cho tới đó là giới hạn đã biết.
- Giữ id SMP-208; giữ AI Flip Summon quái úp; đã gỡ dependency `nestjs-zod`. AI không được dạy dùng lá Negate trước P8.

## Giới hạn / quan sát chưa sửa

- Panel Nhật ký tràn lên trên tiêu đề "Nhật ký" khi log dài (thấy ở ảnh 09, 10 của 4.4b). Trong lúc phát animation bàn vẫn
  là view cũ: LP / chỉ số chỉ đổi khi animation xong (thiết kế 2.9).
- `ScenarioSchema` chưa có ô Field: scenario cần lá ở ô Môi trường phải bắt đầu từ tay + `script`.
- Câu báo lỗi `NOTHING_TO_RESPOND_TO` / `NOTHING_TO_NEGATE` có test nhưng chưa có ảnh trang debug (client Phaser không bao
  giờ gửi action không được liệt kê nên không gặp lỗi này).
- `packages/game-engine/CLAUDE.md` còn câu "engine-only (nối wire: 4.4b)" — 4.4b giữ 0 file engine, sửa ở task engine kế.
- Chưa có trong engine: cửa sổ vô hiệu triệu hồi đứng trước trigger; Equip Spell đã Set; người chơi chọn ô cho Continuous
  Spell từ tay (G20); "vô hiệu **hiệu ứng**" (mới có vô hiệu việc kích hoạt); Fusion (4.5); Duration; Special Summon từ mộ
  đối thủ; người chơi tự xếp thứ tự trigger (G15); replay khi mất mục tiêu tấn công (G14).
- AI server không tự Set/kích hoạt Phép/Bẫy ngoài cửa sổ ưu tiên và không dùng lá Negate (P8); `STARTER_DECK` chỉ quái
  vanilla (deck có effect: `EFFECT_DEMO_DECK` / `BATCH1_DEMO_DECK` / `MECH_DEMO_DECK` / `FIELD_DEMO_DECK` /
  `NEGATE_DEMO_DECK` qua body `deck`).
- Cửa sổ chuỗi còn mở cho đối thủ biết "bên kia có lá đáp trả" (chỉ quan trọng ở PvP, P9).
- `InMemoryDuelStore`: mất phiên khi restart, mutex chỉ đúng 1 process; guest token 12h không refresh, guest chưa lưu DB.
- Chuỗi Tribute Summon dài hơn bản gốc (ADR 041); cảm ứng thật chưa thử; bản dịch `en` do AI viết, chưa duyệt; trang
  debug/sandbox chỉ tiếng Việt.

## Backlog còn mở

- TTL/dọn duel bỏ dở + store bền (DB/Redis); Extra Deck của chủ sở hữu cho task Fusion (hiện `StateView` chỉ có
  `extraDeckCount`); lịch sử event/resync (client mất event = phải GET view); guest chưa lưu DB (upgrade = P7).

## Nhật ký chi tiết (đọc khi cần, không tự nạp)

| Nội dung                                             | File                           |
| ---------------------------------------------------- | ------------------------------ |
| P0 / M0 + ghi chú môi trường                         | `docs/ai/progress/p0.md`       |
| P1: task 1.1–1.12, ánh xạ số task P1                 | `docs/ai/progress/p1.md`       |
| P2: task 2.1–2.12                                    | `docs/ai/progress/p2.md`       |
| P3: task 3.1–3.8                                     | `docs/ai/progress/p3.md`       |
| P4: task 4.1–4.4b + bàn giao                         | `docs/ai/progress/p4.md`       |
| Ingest video, mở rộng scope, giá trị ruleset đã chốt | `docs/ai/progress/planning.md` |

## Checklist phase (P0–P9) — chi tiết task: `docs/plan/MASTER-PLAN.md`

- [x] P0 — Setup monorepo + tooling (= M0)
- [x] P1 — Engine core vanilla + RulesetConfig + golden replay/fuzz (bản nháp, chờ duyệt; task 1.1–1.12)
- [ ] P2 — Vertical slice: solo vs AI dummy (API + FE Duel + Sandbox) — 2.1–2.3, event-filter, 2.5–2.12 xong (nháp);
      chỉ còn 2.4 (trang debug) chờ người dùng test
- [ ] P3 — Effect system + Chain + 10 card mẫu — 3.1, 3.2, 3.2b, 3.3, 3.4, 3.4b, 3.4c, 3.5, 3.6, 3.7, 3.8 xong (nháp)
- [ ] P4 — Card batches + Special/Equip/Field/Counter/Fusion — 4.1 (batch 1), 4.2a–d (Special Summon, Flip Summon,
      Equip + nối wire), 4.3 + 4.3b (Field / Continuous + nối wire), 4.4 + 4.4b (Counter Trap + Negate + nối wire) xong
      (nháp); còn 4.5 Fusion, 4.7 batch 2/3
- [ ] P5 — Asset pipeline + Card Gallery
- [ ] P6 — Animation + Audio tier 1 + Animation Preview + Replay Viewer
- [ ] P7 — Auth + Deck Builder + Collection
- [ ] P8 — AI rule-based
- [ ] P9 — PvP private + PvE nhẹ + Polish
- [ ] P10 — Economy & Inventory _(scope mở rộng 2026-09-25, chưa breakdown; sau P7)_
- [ ] P11 — Gacha / Pack opening _(sau P10; cần P4/P5)_
- [ ] P12 — Shop _(sau P11)_
- [ ] P13 — Adventure / Campaign _(mở rộng 9.5; sau P8 + P10)_
- [ ] P14 — Arena (PvP ladder) _(sau P9 + P10; khác Room private 9.1)_
- [ ] P15 — Live-ops _(cuối; đua top dùng Leaderboard P14)_

Tiêu chí done từng phase: `docs/ai/ROADMAP.md`.
