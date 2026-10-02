# Progress — trạng thái hiện tại

File này được tự nạp mỗi session nên **chỉ giữ trạng thái hiện tại** (trần ~8.000 ký tự). Cuối mỗi task:
(1) thêm mục chi tiết (đã làm gì, số test, mutant, smoke, ảnh) vào CUỐI `docs/ai/progress/p<phase>.md`;
(2) ở đây chỉ sửa "Đang ở đâu", dòng checklist của phase và các danh sách bên dưới. Không chép chi tiết task vào đây.

## Đang ở đâu (cập nhật 2026-10-02, sau task 4.4)

- **Phase đang làm: P4** (card batches + luật mở rộng), xong bản nháp tới **4.4** (Counter Trap + Negate, **engine-only**).
- **Task tiếp theo (đề xuất): 4.4b** — nối wire + UI cho 4.4 (3 event Negate vào `EventView`, fuzz chống rò với lá Negate,
  log/animation "vô hiệu", deck demo + scenario Sandbox, AI dùng lá Negate). Chi tiết: mục "Bàn giao sau 4.4" ở
  `docs/ai/progress/p4.md`.
- P0 xong. P1, P2, P3 và 4.1–4.4 là **bản nháp chờ chủ dự án duyệt** (AI chỉ tới 🟨; chỉ người dùng chuyển ✅ ở
  `docs/plan/parity-board.md`). P2 còn **2.4 ⏳ chờ người dùng test** theo `docs/design/debug-ui.md`.

## Chờ chủ dự án

- Test tay task 2.4 (mục A/C/D/E của `docs/design/debug-ui.md`); duyệt các bản nháp (review packet từng task:
  `docs/ai/review-packets/task-<số>.md`).
- Scope P10–P15: chốt `[DECISION]`/`[CẦN HỎI]` E1–E9 (`docs/plan/economy-plan.md`) + mục P13–P15
  (`docs/plan/modes-and-liveops-plan.md`); đề xuất **mở rộng** danh sách bảng DB ở `CLAUDE.md` #5 cho P10+ và câu hỏi
  quy mô deploy trước P14 (ADR 043).
- Tư liệu còn thiếu (`docs/plan/human-tasks.md`): chain 2+ link, Set / đổi thế / Lật, màn thắng-thua, ảnh tab Dung
  Hợp. Mâu thuẫn còn mở: **C14** (Bẫy chọn chế độ lúc Set) — `docs/reference/notes/rules-observed.md`.
- Bảng `docs/ai/OPEN-ISSUES.md` (5 mục): gỡ dependency `nestjs-zod`; AI Flip Summon quái úp (ADR 062); id SMP-208 (ADR
  063); **G22** — quái vừa triệu hồi chưa tấn công được trong lượt đó (`[GUESS]`, "giữ tạm" tới khi có video).
- Câu hỏi mở từ 4.3b (ADR 064): hiệu ứng liên tục của lá Field/Continuous có hiệu lực **ngay khi lá nằm ngửa**, kể cả khi
  mắt xích kích hoạt còn chờ đáp trả (luật chuẩn: sau khi xử lý xong) — giữ hay đổi (task engine)?
- Từ 4.4 (ADR 065): duyệt **G23** (cost không hoàn khi bị vô hiệu; lá / quái bị vô hiệu "gửi vào mộ"; …) và câu hỏi mở:
  quái có hiệu ứng "khi triệu hồi" đã lên chuỗi thì **không** bị vô hiệu triệu hồi (cửa sổ Summon mở sau trigger; luật
  chuẩn: trước) — giữ hay đổi thứ tự (task engine, đổi hành vi 3.5)?
- Kết quả dọn nợ duyệt 2026-10-01 (không hỏi lại): `docs/ai/review-packets/task-4.3b-triage.md`. `RULES-REVIEW-SHEET.md`:
  59 ☑ cũ + 12 "AI duyệt thay" + 11 "chủ dự án chọn qua hộp thoại"; còn trống 4 dòng (G22 + 3 dòng G23 của 4.4).

## Giới hạn / quan sát chưa sửa

- Caption animation (dải giữa bàn) vẫn đè lên dòng lượt/phase trong lúc đang phát animation (thanh chọn thì đã dời, 4.3b).
- `ScenarioSchema` chưa có ô Field: scenario cần lá ở ô Môi trường phải bắt đầu từ tay + `script`.
- **4.4 chưa lên wire**: `ChainLinkNegated` / `AttackNegated` / `SummonNegated` bị api bỏ (containment) ⇒ client chỉ thấy
  kết quả qua `StateView`, chưa có log/animation "vô hiệu". SMP-201 đã Set trong scenario cũ (vd `chain-basic`) nay kích
  hoạt được thật khi bị tấn công. SMP-209/210 chưa có trong deck demo / scenario nào.
- Chưa có trong engine: Equip Spell đã Set; người chơi chọn ô cho Continuous Spell từ tay (G20); "vô hiệu **hiệu ứng**"
  (mới có vô hiệu việc kích hoạt); Fusion (4.5); Duration; Special Summon từ mộ đối thủ; người chơi tự xếp thứ tự trigger
  (G15); replay khi mất mục tiêu tấn công (G14).
- AI server không tự Set/kích hoạt Phép/Bẫy ngoài cửa sổ ưu tiên và không dùng lá Negate; `STARTER_DECK` chỉ quái vanilla
  (deck có effect: `EFFECT_DEMO_DECK` / `BATCH1_DEMO_DECK` / `MECH_DEMO_DECK` / `FIELD_DEMO_DECK` gửi qua body `deck`).
- Cửa sổ chuỗi còn mở cho đối thủ biết "bên kia có lá đáp trả" (chỉ quan trọng ở PvP, P9).
- `InMemoryDuelStore`: mất phiên khi restart, mutex chỉ đúng 1 process; guest token 12h không refresh, guest chưa lưu DB.
- Chuỗi Tribute Summon dài hơn bản gốc (ADR 041); cảm ứng thật chưa thử; bản dịch `en` do AI viết, chưa duyệt; trang
  debug/sandbox chỉ tiếng Việt.

## Backlog (đã dọn 2026-10-01, task 4.3b; số trong ngoặc = số mục của PROGRESS cũ)

- Còn mở: (2≡7) TTL/dọn duel bỏ dở + store bền (DB/Redis); (3≡8) Extra Deck của chủ sở hữu cho task Fusion (hiện
  `StateView` chỉ có `extraDeckCount`); (4) lịch sử event/resync (event chưa lưu vào session; client mất event = phải GET
  view); (10) guest chưa lưu DB (upgrade lên account = P7).
- Đã xong: (1) `validateDeck`, (5) event mở đầu, (6) cổng chống rò Spell/Trap, (9) `PlayerActionSchema` đầy đủ.

## Nhật ký chi tiết (đọc khi cần, không tự nạp)

| Nội dung                                             | File                           |
| ---------------------------------------------------- | ------------------------------ |
| P0 / M0 + ghi chú môi trường                         | `docs/ai/progress/p0.md`       |
| P1: task 1.1–1.12, ánh xạ số task P1                 | `docs/ai/progress/p1.md`       |
| P2: task 2.1–2.12                                    | `docs/ai/progress/p2.md`       |
| P3: task 3.1–3.8                                     | `docs/ai/progress/p3.md`       |
| P4: task 4.1–4.4 + bàn giao                          | `docs/ai/progress/p4.md`       |
| Ingest video, mở rộng scope, giá trị ruleset đã chốt | `docs/ai/progress/planning.md` |

## Checklist phase (P0–P9) — chi tiết task: `docs/plan/MASTER-PLAN.md`

- [x] P0 — Setup monorepo + tooling (= M0)
- [x] P1 — Engine core vanilla + RulesetConfig + golden replay/fuzz (bản nháp, chờ duyệt; task 1.1–1.12)
- [ ] P2 — Vertical slice: solo vs AI dummy (API + FE Duel + Sandbox) — 2.1, 2.2, event-filter, 2.3 xong (nháp), 2.4 (trang debug) chờ người dùng test, 2.5 (legalActions) + 2.6 (AI, solo-vs-ai) xong (nháp); 2.7 (Phaser Duel Scene tĩnh) + 2.8 (kéo thả) + 2.9 (animation) + 2.10 (log panel) + 2.11 (Sandbox) + 2.12 (i18n) xong (nháp); chỉ còn 2.4 chờ người dùng test
- [ ] P3 — Effect system + Chain + 10 card mẫu — 3.1, 3.2, 3.2b, 3.3 (chain), 3.4 (Spell Speed + lá Set), 3.4c (cửa sổ phản ứng), 3.5 (trigger), 3.6 (Continuous + `scriptId`), 3.4b (nối wire, C13), 3.7 (UI chuỗi), 3.8 (10 lá effect thật + deck demo + scenario) xong (nháp)
- [ ] P4 — Card batches + Special/Equip/Field/Counter/Fusion — 4.1 (batch 1: 20 vanilla + 10 Phép/Bẫy + `BATCH1_DEMO_DECK`), 4.2a (Special Summon operation), 4.2b (Flip Summon + OnFlip), 4.2c (Equip Spell), 4.2d (nối wire 4.2a/b/c + 3 lá + UI), 4.3 (Field Spell + kích hoạt lá Continuous Spell/Trap + Phép đã Set, engine-only; 4 lá SMP-113/114/115/208), 4.3b (dọn nợ duyệt + nối wire 4.3: ô Môi trường trên wire/UI, `FIELD_DEMO_DECK`, 4 scenario), 4.4 (Counter Trap + operation Negate, engine-only; SMP-201/209/210) xong (nháp)
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
