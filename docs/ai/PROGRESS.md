# Progress — trạng thái hiện tại

File này được tự nạp mỗi session nên **chỉ giữ trạng thái hiện tại** (trần ~8.000 ký tự). Cuối mỗi task:
(1) thêm mục chi tiết (đã làm gì, số test, mutant, smoke, ảnh) vào CUỐI `docs/ai/progress/p<phase>.md`;
(2) ở đây chỉ sửa "Đang ở đâu", dòng checklist của phase và các danh sách bên dưới. Không chép chi tiết task vào đây.

## Đang ở đâu (cập nhật 2026-10-09, sau task 4.8)

- **Phase đang làm: P4**, xong bản nháp tới **4.8** (engine + shared; api chỉ containment): **sửa lỗi lõi P7** + bất biến
  "prompt đang mở luôn có câu trả lời"; **quái trên sân kích hoạt `Ignition`** + **`oncePerTurn`** sau cờ
  `ruleset.allowMonsterEffectActivation` — **tắt ở mọi ván** (api gỡ khoá). 30 golden cũ không đổi byte, +3. ADR 071, G28. `RULES-REVIEW-SHEET.md` vẫn **1** ô trống (G26 f).
- **Task tiếp theo (đề xuất):** **4.8b** — nối wire + UI cho quái kích hoạt hiệu ứng + 3 lá thật; rồi **4.9**: cost có chọn
  lá cho trigger, `ChangePosition`, `SendToGY` (`docs/plan/card-and-effect-plan.md` mục "Còn thiếu gì").
- P0 xong. P1, P2, P3 và 4.1–4.8 là **bản nháp chờ chủ dự án duyệt** (AI chỉ tới 🟨; chỉ người dùng chuyển ✅ ở
  `docs/plan/parity-board.md`). **Chủ dự án báo đã duyệt 4.7 (cả 26 lá) ngày 2026-10-09** — ô parity-board vẫn chờ chủ
  dự án tự chuyển. P2 còn **2.4 ⏳ chờ người dùng test** theo `docs/design/debug-ui.md`.

## Chờ chủ dự án

- Test tay task 2.4 (mục A/C/D/E của `docs/design/debug-ui.md`); duyệt các bản nháp (review packet từng task:
  `docs/ai/review-packets/task-<số>.md`; mới nhất: `task-4.8.md` — bảng TRƯỚC / SAU bằng tiếng Việt thường, không cần chạy lệnh).
- Scope P10–P15: chốt `[DECISION]`/`[CẦN HỎI]` E1–E9 (`docs/plan/economy-plan.md`) + mục P13–P15
  (`docs/plan/modes-and-liveops-plan.md`); mở rộng danh sách bảng DB ở `CLAUDE.md` #5 (để tới P10) và câu hỏi quy mô
  deploy trước P14 (ADR 043).
- Tư liệu còn thiếu (`docs/plan/human-tasks.md`): chain 2+ link, Set / đổi thế / Lật, màn thắng-thua, ảnh tab Dung
  Hợp, clip Bẫy Phản công / vô hiệu (G23, G24), clip Dung hợp + màn chọn, nguồn nguyên liệu **Bộ bài** (G26, G27), art quái
  Dung hợp; art 26 lá batch 2 (`docs/assets/ASSET_REQUESTS.md`). Mâu thuẫn còn mở: **C14** — `rules-observed.md`.
- `docs/ai/OPEN-ISSUES.md` còn 2 mục: bảng DB cho P10 và G26 (f).

## Đã chốt (không hỏi lại)

- 2026-10-02 (ADR 066): **G23 giữ** — cost không hoàn khi bị vô hiệu; lá / quái bị vô hiệu "được gửi vào mộ". Buff của lá
  Liên tục / Môi trường có hiệu lực **ngay khi lá nằm ngửa**. AI không được dạy dùng lá Negate trước P8.
- 2026-10-03 (ADR 067, 068): cửa sổ phản ứng triệu hồi đứng trước trigger, nhận **mọi** lá đáp trả (G25). Fusion: nguyên
  liệu **đích danh**; là Special Summon, **không** cửa sổ triệu hồi; nguồn là tham số của lá, chọn lúc resolve (G26).
- 2026-10-04 (ADR 069): **Extra Deck theo ghế**; **ghế AI không có Extra Deck** ở ván thật; nguồn `Deck` **không lên
  wire**; luôn hỏi bước chọn quái. **G22 là `[DECISION]`**: quái vừa triệu hồi / Set không tấn công trong lượt đó.
- 2026-10-08 (ADR 070, hộp thoại): batch 2 = 24 lá + 2 quái Dung hợp, **mức mạnh cổ điển** (quái ≤ 2500 ATK); G22 **giữ**;
  quái "tự bấm kích hoạt" **không làm ở 4.7** (thay lá, không sửa engine).
- 2026-10-09 (ADR 071, hộp thoại): tách **4.8** (engine, cờ tắt) / **4.8b** (wire + UI + 3 lá thật) / **4.9**; **G28**: quái
  bấm `Ignition` được ngay lượt vừa triệu hồi / lật; "mỗi lượt 1 lần" tính **theo từng bản lá**; **4.7 đã duyệt** (26 lá). 2026-10-10: quái tự hiến tế chính nó làm cost **vẫn từ chối** tới 4.9;
  quái rời sân trước khi hiệu ứng resolve thì hiệu ứng **vẫn resolve**.

## Giới hạn / quan sát chưa sửa

- **Quái kích hoạt hiệu ứng chỉ có trong engine, cờ tắt**: chưa ván nào (game / Sandbox / máy) dùng được; chưa lá thật
  nào có `Ignition` / `oncePerTurn` trên quái. Hiệu ứng `Quick` của quái chưa có; quái tự hiến tế chính nó làm cost bị từ
  chối; trigger của quái chỉ trả cost bằng LP. Chưa có Duration, `ChangePosition`, `SendToGY`, `Return`, `Search`, filter
  `atk` / `def`.
- Batch 2 chỉ chơi qua Sandbox hoặc body API (`deck` + `extraDeck`); trang game chưa có chọn deck (P7). AI không được dạy lá
  nào của batch 2: nó chỉ trả lời prompt và dùng Phép Tức thời gây hại trong cửa sổ (đã có từ 3.4b).
- Panel Nhật ký tràn lên trên tiêu đề khi log dài. Trong lúc phát animation bàn vẫn là view cũ (thiết kế 2.9).
- Fusion: dải chọn che một phần hàng quái đối thủ, chữ trong dải nhỏ; chưa có trình xem Extra Deck. Trang Sandbox chỉ tiếng
  Việt. Sandbox cho phép scenario khai Extra Deck cho ghế AI; AI không tự Dung hợp.
- `ScenarioSchema` chưa có ô Field: scenario cần lá ở ô Môi trường phải bắt đầu từ tay + `script`.
- Câu báo lỗi `NOTHING_TO_RESPOND_TO` / `NOTHING_TO_NEGATE` chưa có ảnh trang debug. Scenario `trigger-optional-real` diễn
  ra khác ảnh 3.8 (`tools/ui-chain-real-shots.ts` chưa chụp lại).
- Chưa có trong engine: chọn ô cho Continuous Spell từ tay (G20); "vô hiệu **hiệu ứng**"; Fusion nguyên liệu "chung", lá dung
  hợp Quick-Play / Bẫy, chọn ô / tư thế cho quái Fusion; Special Summon từ mộ đối thủ; người chơi tự xếp thứ tự trigger
  (G15); replay khi mất mục tiêu tấn công (G14); cửa sổ "chỉ lá vô hiệu triệu hồi" (G25).
- AI server không tự Set/kích hoạt Phép/Bẫy ngoài cửa sổ ưu tiên, không dùng lá Negate, không Dung hợp (P8);
  `STARTER_DECK` chỉ quái vanilla (deck có effect: `EFFECT_` / `BATCH1_` / `MECH_` / `FIELD_` / `NEGATE_` / `FUSION_` /
  `BATCH2_DEMO_DECK` qua body).
- Cửa sổ chuỗi còn mở cho đối thủ biết "bên kia có lá đáp trả" (chỉ quan trọng ở PvP, P9).
- `InMemoryDuelStore`: mất phiên khi restart, mutex chỉ đúng 1 process; guest token 12h không refresh, guest chưa lưu DB.
- Chuỗi Tribute Summon dài hơn bản gốc (ADR 041); cảm ứng thật chưa thử; bản dịch `en` do AI viết, chưa duyệt.

## Backlog còn mở

- TTL/dọn duel bỏ dở + store bền (DB/Redis); lịch sử event/resync; guest chưa lưu DB (upgrade = P7); lưu Extra Deck vào
  DB + tab "Dung Hợp" của Deck Builder (P7).

## Nhật ký chi tiết (đọc khi cần, không tự nạp)

| Nội dung                                             | File                           |
| ---------------------------------------------------- | ------------------------------ |
| P0 / M0 + ghi chú môi trường                         | `docs/ai/progress/p0.md`       |
| P1: task 1.1–1.12, ánh xạ số task P1                 | `docs/ai/progress/p1.md`       |
| P2: task 2.1–2.12                                    | `docs/ai/progress/p2.md`       |
| P3: task 3.1–3.8                                     | `docs/ai/progress/p3.md`       |
| P4: task 4.1–4.8 + bàn giao                          | `docs/ai/progress/p4.md`       |
| Ingest video, mở rộng scope, giá trị ruleset đã chốt | `docs/ai/progress/planning.md` |

## Checklist phase (P0–P9) — chi tiết task: `docs/plan/MASTER-PLAN.md`

- [x] P0 — Setup monorepo + tooling (= M0)
- [x] P1 — Engine core vanilla + RulesetConfig + golden replay/fuzz (bản nháp, chờ duyệt; task 1.1–1.12)
- [ ] P2 — Vertical slice: solo vs AI dummy — chỉ còn 2.4 (trang debug) chờ người dùng test
- [ ] P3 — Effect system + Chain + 10 card mẫu — 3.1–3.8 xong (nháp)
- [ ] P4 — Card batches + Special/Equip/Field/Counter/Fusion — 4.1, 4.2a–d, 4.3 + 4.3b, 4.4 + 4.4b, 4.4c, 4.5 + 4.5b, 4.7
      (batch 2), 4.8 (sửa P7 + quái Ignition / oncePerTurn, engine) xong (nháp); đề xuất 4.8b (wire + UI) rồi 4.9, batch 3
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
