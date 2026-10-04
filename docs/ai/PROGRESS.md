# Progress — trạng thái hiện tại

File này được tự nạp mỗi session nên **chỉ giữ trạng thái hiện tại** (trần ~8.000 ký tự). Cuối mỗi task:
(1) thêm mục chi tiết (đã làm gì, số test, mutant, smoke, ảnh) vào CUỐI `docs/ai/progress/p<phase>.md`;
(2) ở đây chỉ sửa "Đang ở đâu", dòng checklist của phase và các danh sách bên dưới. Không chép chi tiết task vào đây.

## Đang ở đâu (cập nhật 2026-10-04, sau task 4.5b)

- **Phase đang làm: P4** (card batches + luật mở rộng), xong bản nháp tới **4.5b**: Fusion **chơi được qua HTTP + màn hình
  Phaser** (Extra Deck qua body `extraDeck`, chủ ghế thấy Extra Deck của mình, hai màn chọn quái / nguyên liệu, log +
  animation, deck demo, 3 scenario Sandbox; engine 0 dòng). Kèm Phase 0: `RULES-REVIEW-SHEET.md` còn **1** ô duyệt trống.
- **Task tiếp theo (đề xuất):** **4.7** — card batch 2 / 3 (trigger, continuous, nhiều lá hơn). Không có task engine nào
  phát sinh từ Phase 0 (không đáp án nào đòi đổi luật).
- P0 xong. P1, P2, P3 và 4.1–4.5b là **bản nháp chờ chủ dự án duyệt** (AI chỉ tới 🟨; chỉ người dùng chuyển ✅ ở
  `docs/plan/parity-board.md`). P2 còn **2.4 ⏳ chờ người dùng test** theo `docs/design/debug-ui.md`.

## Chờ chủ dự án

- Test tay task 2.4 (mục A/C/D/E của `docs/design/debug-ui.md`); duyệt các bản nháp (review packet từng task:
  `docs/ai/review-packets/task-<số>.md`; mới nhất: `task-4.5b.md` — 18 ảnh thật, có "cách tự test tay").
- Scope P10–P15: chốt `[DECISION]`/`[CẦN HỎI]` E1–E9 (`docs/plan/economy-plan.md`) + mục P13–P15
  (`docs/plan/modes-and-liveops-plan.md`); mở rộng danh sách bảng DB ở `CLAUDE.md` #5 (để tới P10) và câu hỏi quy mô
  deploy trước P14 (ADR 043).
- Tư liệu còn thiếu (`docs/plan/human-tasks.md`): chain 2+ link, Set / đổi thế / Lật, màn thắng-thua, ảnh tab Dung
  Hợp, clip Bẫy Phản công / vô hiệu (G23, G24), clip Dung hợp rõ hiệu ứng + màn chọn, dùng quái trên sân / từ **Bộ bài** /
  bị vô hiệu (G26, G27), art 3 quái Dung hợp. Mâu thuẫn còn mở: **C14** (Bẫy chọn chế độ lúc Set) — `rules-observed.md`.
- `docs/ai/OPEN-ISSUES.md` còn 2 mục: bảng DB cho P10, và **G26 (f)** — nguyên liệu Dung hợp từ Bộ bài ("giữ tạm, chờ tư
  liệu"; ô duyệt duy nhất còn trống của `RULES-REVIEW-SHEET.md`).

## Đã chốt (không hỏi lại)

- 2026-10-02 (ADR 066): **G23 giữ** — cost không hoàn khi bị vô hiệu; lá / quái bị vô hiệu "được gửi vào mộ". Buff của lá
  Liên tục / Môi trường có hiệu lực **ngay khi lá nằm ngửa**. AI không được dạy dùng lá Negate trước P8.
- 2026-10-03 (ADR 067): cửa sổ phản ứng triệu hồi đứng trước trigger nhận **mọi** lá đáp trả — G25.
- 2026-10-03 (ADR 068): Fusion — nguyên liệu **đích danh**; là Special Summon, **không** cửa sổ triệu hồi; nguồn nguyên liệu
  là tham số của lá (demo: tay + sân), chọn lúc resolve, vào mộ; quái Fusion rời sân vào mộ — G26.
- 2026-10-04 (ADR 069, brief 4.5b + hộp thoại): **Extra Deck theo ghế** (chủ thấy / được trỏ tới của mình, đối thủ chỉ
  thấy số lượng; Deck chính kín với cả hai); **ghế AI không có Extra Deck** ở ván thật; nguồn nguyên liệu `Deck` **không
  lên wire**; luôn hỏi bước chọn quái; không chọn ô / tư thế. **G22 thành `[DECISION]`**: quái vừa triệu hồi / Set không
  tấn công trong lượt đó. G25 (b)(c), G26 (d) và chi tiết thao tác màn chọn Dung hợp (G27: không Hủy, chỉ chọn trong dải
  lá, chạm lá khác = đổi) được chấp nhận.

## Giới hạn / quan sát chưa sửa

- Panel Nhật ký tràn lên trên tiêu đề "Nhật ký" khi log dài. Trong lúc phát animation bàn vẫn là view cũ (thiết kế 2.9):
  nguyên liệu biến mất / quái Dung hợp hiện ra khi animation xong.
- Fusion: trang game chưa có cách chọn deck có Extra Deck (P7) ⇒ chỉ chơi qua Duel Sandbox hoặc body API. Dải chọn Dung
  hợp che một phần hàng quái đối thủ, chữ trên lá trong dải nhỏ; chưa có trình xem Extra Deck. Trang Sandbox chỉ tiếng
  Việt (ảnh tiếng Anh của 4.5b chụp bằng fixture). Sandbox cho phép scenario khai Extra Deck cho ghế AI (ván thật thì
  không); AI không tự Dung hợp, chỉ trả lời prompt khi `script` đã kích hoạt hộ.
- `tools/play-vs-ai.ts` `DECK=negate`: hai kiểm tra độ phủ phụ thuộc ván chia (3 / 4 lần chạy thiếu) — chưa sửa.
- `ScenarioSchema` chưa có ô Field: scenario cần lá ở ô Môi trường phải bắt đầu từ tay + `script`.
- Câu báo lỗi `NOTHING_TO_RESPOND_TO` / `NOTHING_TO_NEGATE` chưa có ảnh trang debug. Scenario `trigger-optional-real` nay
  diễn ra khác: ảnh 3.8 và `tools/ui-chain-real-shots.ts` còn mô tả luồng cũ, chưa chụp lại.
- Chưa có trong engine: người chơi chọn ô cho Continuous Spell từ tay (G20); "vô hiệu **hiệu ứng**"; Fusion với nguyên
  liệu "chung", lá dung hợp Quick-Play / Bẫy, cửa sổ triệu hồi cho Fusion, chọn ô / tư thế cho quái Fusion, trả quái Fusion
  về Extra Deck; Duration; Special Summon từ mộ đối thủ; người chơi tự xếp thứ tự trigger (G15); replay khi mất mục tiêu
  tấn công (G14); cửa sổ "chỉ lá vô hiệu triệu hồi" (G25).
- AI server không tự Set/kích hoạt Phép/Bẫy ngoài cửa sổ ưu tiên, không dùng lá Negate, không Dung hợp (P8);
  `STARTER_DECK` chỉ quái vanilla (deck có effect: `EFFECT_DEMO_DECK` / `BATCH1_DEMO_DECK` / `MECH_DEMO_DECK` /
  `FIELD_DEMO_DECK` / `NEGATE_DEMO_DECK` / `FUSION_DEMO_DECK` + `FUSION_DEMO_EXTRA_DECK` qua body).
- Cửa sổ chuỗi còn mở cho đối thủ biết "bên kia có lá đáp trả" (chỉ quan trọng ở PvP, P9).
- `InMemoryDuelStore`: mất phiên khi restart, mutex chỉ đúng 1 process; guest token 12h không refresh, guest chưa lưu DB.
- Chuỗi Tribute Summon dài hơn bản gốc (ADR 041); cảm ứng thật chưa thử; bản dịch `en` do AI viết, chưa duyệt; trang
  debug/sandbox chỉ tiếng Việt.

## Backlog còn mở

- TTL/dọn duel bỏ dở + store bền (DB/Redis); lịch sử event/resync (client mất event = phải GET view); guest chưa lưu DB
  (upgrade = P7); lưu Extra Deck vào DB + tab "Dung Hợp" của Deck Builder (P7).

## Nhật ký chi tiết (đọc khi cần, không tự nạp)

| Nội dung                                             | File                           |
| ---------------------------------------------------- | ------------------------------ |
| P0 / M0 + ghi chú môi trường                         | `docs/ai/progress/p0.md`       |
| P1: task 1.1–1.12, ánh xạ số task P1                 | `docs/ai/progress/p1.md`       |
| P2: task 2.1–2.12                                    | `docs/ai/progress/p2.md`       |
| P3: task 3.1–3.8                                     | `docs/ai/progress/p3.md`       |
| P4: task 4.1–4.5b + bàn giao                         | `docs/ai/progress/p4.md`       |
| Ingest video, mở rộng scope, giá trị ruleset đã chốt | `docs/ai/progress/planning.md` |

## Checklist phase (P0–P9) — chi tiết task: `docs/plan/MASTER-PLAN.md`

- [x] P0 — Setup monorepo + tooling (= M0)
- [x] P1 — Engine core vanilla + RulesetConfig + golden replay/fuzz (bản nháp, chờ duyệt; task 1.1–1.12)
- [ ] P2 — Vertical slice: solo vs AI dummy (API + FE Duel + Sandbox) — 2.1–2.3, event-filter, 2.5–2.12 xong (nháp);
      chỉ còn 2.4 (trang debug) chờ người dùng test
- [ ] P3 — Effect system + Chain + 10 card mẫu — 3.1, 3.2, 3.2b, 3.3, 3.4, 3.4b, 3.4c, 3.5, 3.6, 3.7, 3.8 xong (nháp)
- [ ] P4 — Card batches + Special/Equip/Field/Counter/Fusion — 4.1 (batch 1), 4.2a–d (Special Summon, Flip Summon,
      Equip + nối wire), 4.3 + 4.3b (Field / Continuous + nối wire), 4.4 + 4.4b (Counter Trap + Negate + nối wire), 4.4c
      (cửa sổ triệu hồi trước trigger + Equip đã Set), 4.5 + 4.5b (Fusion + nối wire) xong (nháp); còn 4.7 batch 2/3
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
