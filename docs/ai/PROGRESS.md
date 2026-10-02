# Progress — trạng thái hiện tại

File này được tự nạp mỗi session nên **chỉ giữ trạng thái hiện tại** (trần ~8.000 ký tự). Cuối mỗi task:
(1) thêm mục chi tiết (đã làm gì, số test, mutant, smoke, ảnh) vào CUỐI `docs/ai/progress/p<phase>.md`;
(2) ở đây chỉ sửa "Đang ở đâu", dòng checklist của phase và các danh sách bên dưới. Không chép chi tiết task vào đây.

## Đang ở đâu (cập nhật 2026-10-02, sau task 4.3b)

- **Phase đang làm: P4** (card batches + luật mở rộng), xong bản nháp tới **4.3b** (4.3 đã lên wire + UI ô Môi trường).
- **Task tiếp theo (đề xuất): 4.4** — Counter Trap / Negate (SMP-201 vẫn placeholder); hoặc task engine nhỏ "Equip Spell đã
  Set". Chi tiết: mục "Bàn giao sau 4.3b" ở `docs/ai/progress/p4.md`.
- P0 xong. P1, P2, P3 và 4.1–4.3b là **bản nháp chờ chủ dự án duyệt** (AI chỉ tới 🟨; chỉ người dùng chuyển ✅ ở
  `docs/plan/parity-board.md`). P2 còn **2.4 ⏳ chờ người dùng test** theo `docs/design/debug-ui.md`.

## Chờ chủ dự án

- Test tay task 2.4 (mục A/C/D/E của `docs/design/debug-ui.md`); duyệt các bản nháp (review packet từng task:
  `docs/ai/review-packets/task-<số>.md`).
- Scope P10–P15: chốt `[DECISION]`/`[CẦN HỎI]` E1–E9 (`docs/plan/economy-plan.md`) + mục P13–P15
  (`docs/plan/modes-and-liveops-plan.md`); đề xuất **mở rộng** danh sách bảng DB ở `CLAUDE.md` #5 cho P10+ và câu hỏi
  quy mô deploy trước P14 (ADR 043). (Câu #5 đã sửa khớp `schema.prisma` hiện tại — chủ dự án chọn 2026-10-01.)
- Tư liệu còn thiếu (`docs/plan/human-tasks.md`): chain 2+ link, Set / đổi thế / Lật, màn thắng-thua, ảnh tab Dung
  Hợp. Mâu thuẫn còn mở: **C14** (Bẫy chọn chế độ lúc Set) — `docs/reference/notes/rules-observed.md`.
- Còn chờ sau lượt dọn 4.3b Phase 0 (bảng `docs/ai/OPEN-ISSUES.md`, 5 mục): gỡ dependency `nestjs-zod`; AI Flip Summon
  quái úp (ADR 062); id SMP-208 cho Bẫy Liên tục (ADR 063); **G22** — quái vừa triệu hồi chưa tấn công được trong lượt đó
  (`[GUESS]`, "giữ tạm" tới khi có video; đổi luật = task engine riêng).
- Câu hỏi mở từ 4.3b (ADR 064): hiệu ứng liên tục của lá Field/Continuous có hiệu lực **ngay khi lá nằm ngửa**, kể cả khi
  mắt xích kích hoạt còn chờ đáp trả (luật chuẩn: sau khi xử lý xong) — giữ hay đổi (task engine)?
- Kết quả dọn nợ duyệt 2026-10-01 (đã hỏi qua hộp thoại, không hỏi lại): `docs/ai/review-packets/task-4.3b-triage.md`.
  `RULES-REVIEW-SHEET.md`: 59 ☑ cũ + 10 "AI duyệt thay" + 11 "chủ dự án chọn qua hộp thoại"; còn trống 1 dòng (G22).

## Giới hạn / quan sát chưa sửa

- Caption animation (dải giữa bàn) vẫn đè lên dòng lượt/phase trong lúc đang phát animation (thanh chọn thì đã dời, 4.3b).
- `ScenarioSchema` chưa có ô Field: scenario cần lá ở ô Môi trường phải bắt đầu từ tay + `script`.
- Chưa có trong engine: Equip Spell đã Set; người chơi chọn ô cho Continuous Spell từ tay (G20); Negate/Counter Trap thật
  (4.4 — SMP-201 vẫn placeholder); Fusion (4.5); Duration; Special Summon từ mộ đối thủ; người chơi tự xếp thứ tự
  trigger (G15); replay khi mất mục tiêu tấn công (G14).
- AI server không tự Set/kích hoạt Phép/Bẫy ngoài cửa sổ ưu tiên (kể cả lá Field/Continuous); `STARTER_DECK` chỉ quái
  vanilla (deck có effect: `EFFECT_DEMO_DECK` / `BATCH1_DEMO_DECK` / `MECH_DEMO_DECK` / `FIELD_DEMO_DECK` gửi qua body `deck`).
- Cửa sổ chuỗi còn mở cho đối thủ biết "bên kia có lá đáp trả" (chỉ quan trọng ở PvP, P9).
- `InMemoryDuelStore`: mất phiên khi restart, mutex chỉ đúng 1 process; guest token 12h không refresh, guest chưa lưu DB.
- Chuỗi Tribute Summon dài hơn bản gốc (ADR 041); cảm ứng thật chưa thử; bản dịch `en` do AI viết, chưa duyệt; trang
  debug/sandbox chỉ tiếng Việt.

## Backlog (đã dọn 2026-10-01, task 4.3b; số trong ngoặc = số mục của PROGRESS cũ)

- Còn mở: (2≡7) TTL/dọn duel bỏ dở + store bền (DB/Redis; `InMemoryDuelStore` mất phiên khi restart, mutex chỉ đúng 1
  process; guest token 12h không refresh); (3≡8) Extra Deck của chủ sở hữu cho task Fusion (hiện `StateView` chỉ có
  `extraDeckCount`); (4) lịch sử event/resync (event chưa lưu vào session; client mất event = phải GET view); (10) guest
  chưa lưu DB (upgrade lên account = P7).
- Đã xong, đã gạch: (1) `validateDeck` ở `packages/shared/src/deck/validate-deck.ts` (2.3, ADR 035); (5) event mở đầu
  từ `createDuel` (2.3); (6) cổng fuzz/golden chống rò với Spell/Trap (3.2b, ADR 048); (9) schema Action đầy đủ
  `PlayerActionSchema` (2.4, ADR 036).

## Nhật ký chi tiết (đọc khi cần, không tự nạp)

| Nội dung                                             | File                           |
| ---------------------------------------------------- | ------------------------------ |
| P0 / M0 + ghi chú môi trường                         | `docs/ai/progress/p0.md`       |
| P1: task 1.1–1.12, ánh xạ số task P1                 | `docs/ai/progress/p1.md`       |
| P2: task 2.1–2.12                                    | `docs/ai/progress/p2.md`       |
| P3: task 3.1–3.8                                     | `docs/ai/progress/p3.md`       |
| P4: task 4.1–4.3b + bàn giao                         | `docs/ai/progress/p4.md`       |
| Ingest video, mở rộng scope, giá trị ruleset đã chốt | `docs/ai/progress/planning.md` |

## Checklist phase (P0–P9) — chi tiết task: `docs/plan/MASTER-PLAN.md`

- [x] P0 — Setup monorepo + tooling (= M0)
- [x] P1 — Engine core vanilla + RulesetConfig + golden replay/fuzz (bản nháp, chờ duyệt; task 1.1–1.12)
- [ ] P2 — Vertical slice: solo vs AI dummy (API + FE Duel + Sandbox) — 2.1, 2.2, event-filter, 2.3 xong (nháp), 2.4 (trang debug) chờ người dùng test, 2.5 (legalActions) + 2.6 (AI, solo-vs-ai) xong (nháp); 2.7 (Phaser Duel Scene tĩnh) + 2.8 (kéo thả) + 2.9 (animation) + 2.10 (log panel) + 2.11 (Sandbox) + 2.12 (i18n) xong (nháp); chỉ còn 2.4 chờ người dùng test (2.8 = kéo thả, 2.9 = animation; 2.4 = trang debug, 2.5 = legalActions, AI dummy → 2.6, i18n → 2.12)
- [ ] P3 — Effect system + Chain + 10 card mẫu — 3.1, 3.2, 3.2b, 3.3 (chain, engine-only), 3.4 (Spell Speed + Trap/Quick-Play đã Set, engine-only), 3.4c (cửa sổ phản ứng tấn công/triệu hồi, engine-only), 3.5 (trigger OnSummon/OnDestroyed, engine-only), 3.6 (Continuous `ModifyStat` + `scriptId` registry, engine-only), 3.4b (nối wire chain / lá Set / cửa sổ phản ứng / trigger, C13), 3.7 (UI chuỗi Phaser, fixture DEV), 3.8 (10 lá effect thật + deck demo + scenario Sandbox) xong (nháp)
- [ ] P4 — Card batches + Special/Equip/Field/Counter/Fusion — 4.1 (batch 1: 20 vanilla + 10 Phép/Bẫy + `BATCH1_DEMO_DECK`), 4.2a (Special Summon operation), 4.2b (Flip Summon + OnFlip), 4.2c (Equip Spell), 4.2d (nối wire 4.2a/b/c + 3 lá + UI), 4.3 (Field Spell + kích hoạt lá Continuous Spell/Trap + Phép đã Set, engine-only; 4 lá SMP-113/114/115/208), 4.3b (dọn nợ duyệt + nối wire 4.3: ô Môi trường trên wire/UI, `FIELD_DEMO_DECK`, 4 scenario) xong (nháp)
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
