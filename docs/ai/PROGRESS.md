# Progress — trạng thái hiện tại

File này được tự nạp mỗi session nên **chỉ giữ trạng thái hiện tại** (trần ~8.000 ký tự). Cuối mỗi task:
(1) thêm mục chi tiết (đã làm gì, số test, mutant, smoke, ảnh) vào CUỐI `docs/ai/progress/p<phase>.md`;
(2) ở đây chỉ sửa "Đang ở đâu", dòng checklist của phase và các danh sách bên dưới. Không chép chi tiết task vào đây.

## Đang ở đâu (cập nhật 2026-10-01, sau task 4.2d)

- **Phase đang làm: P4** (card batches + luật mở rộng), xong bản nháp tới **4.2d**.
- **Task tiếp theo (đề xuất): 4.3** — Field Spell + Continuous Spell/Trap đầy đủ (Engine). Việc nhỏ có thể gộp: xem
  dòng "Bàn giao sau 4.2d" ở `docs/ai/progress/p4.md`.
- P0 xong. P1, P2, P3 và 4.1–4.2d là **bản nháp chờ chủ dự án duyệt** (AI chỉ tới 🟨; chỉ người dùng chuyển ✅ ở
  `docs/plan/parity-board.md`). P2 còn **2.4 ⏳ chờ người dùng test** theo `docs/design/debug-ui.md`.

## Chờ chủ dự án

- Test tay task 2.4 (mục A/C/D/E của `docs/design/debug-ui.md`); duyệt các bản nháp (review packet từng task:
  `docs/ai/review-packets/task-<số>.md`).
- Scope P10–P15: chốt `[DECISION]`/`[CẦN HỎI]` E1–E9 (`docs/plan/economy-plan.md`) + mục P13–P15
  (`docs/plan/modes-and-liveops-plan.md`); duyệt **đề xuất sửa `CLAUDE.md` #5** và câu hỏi quy mô deploy trước P14
  (ADR 043).
- Tư liệu còn thiếu (`docs/plan/human-tasks.md`): chain 2+ link, Set / đổi thế / Lật, màn thắng-thua, ảnh tab Dung
  Hợp. Mâu thuẫn còn mở: **C14** (Bẫy chọn chế độ lúc Set) — `docs/reference/notes/rules-observed.md`.
- Cần xác nhận từ 4.2: `OnSummon` bắn cả với Flip Summon (ADR 060); AI Flip Summon quái úp (ADR 062).
- Mâu thuẫn tài liệu ↔ code tìm thấy khi tách docs: `docs/ai/OPEN-ISSUES.md`.

## Giới hạn / quan sát chưa sửa

- Banner cửa sổ phản ứng giữ chữ "Đối thủ tấn công" khi đã có mắt xích (thấy ở 3.8).
- Câu log AI "bỏ … xuống mộ" cho mọi câu trả lời prompt có id (sai với prompt target).
- Chưa có trong engine: kích hoạt lá Continuous Spell/Trap, Normal Spell/Equip đã Set (4.3); Negate/Counter Trap thật
  (4.4 — SMP-201 vẫn placeholder); Fusion (4.5); Duration; Special Summon từ mộ đối thủ; người chơi tự xếp thứ tự
  trigger (G15); replay khi mất mục tiêu tấn công (G14).
- AI server không tự Set/kích hoạt Phép/Bẫy ngoài cửa sổ ưu tiên; `STARTER_DECK` chỉ quái vanilla (deck có effect:
  `EFFECT_DEMO_DECK` / `BATCH1_DEMO_DECK` / `MECH_DEMO_DECK` gửi qua body `deck`).
- Cửa sổ chuỗi còn mở cho đối thủ biết "bên kia có lá đáp trả" (chỉ quan trọng ở PvP, P9).
- `InMemoryDuelStore`: mất phiên khi restart, mutex chỉ đúng 1 process; guest token 12h không refresh, guest chưa lưu DB.
- Chuỗi Tribute Summon dài hơn bản gốc (ADR 041); cảm ứng thật chưa thử; bản dịch `en` do AI viết, chưa duyệt; trang
  debug/sandbox chỉ tiếng Việt.

## Backlog (nguyên văn từ PROGRESS cũ)

- **Việc để dành (backlog P2+):** (1) `validateDeck` trong `packages/shared` (40–60 lá, ≤3 bản; dùng ở 2.3/P7); (2) TTL/dọn duel bỏ dở + store bền (DB/Redis; mutex hiện chỉ đúng 1 process); (3) Extra Deck của chủ sở hữu cho task Fusion (hiện `StateView` chỉ có `extraDeckCount`); (4) lịch sử event/resync (event chưa lưu vào session; client mất event = phải GET view); (5) ~~event mở đầu chưa trả từ `createDuel`~~ **xong ở 2.3**; (6) ~~cổng fuzz/golden "không lộ definitionId" với Spell/Trap~~ **xong ở 3.2b**; (7) TTL/dọn duel bỏ dở (`InMemoryDuelStore` mất phiên khi restart; guest token 12h không refresh); (8) Extra Deck của chủ cho Fusion; (9) schema Action đầy đủ ở `packages/shared` (HTTP mới kiểm phần vỏ; payload méo có thể ra `500` thay vì `400`); (10) guest chưa lưu DB (upgrade lên account = P7).

- Ghi chú khi tách file (2026-10-01, cần xác nhận trước khi gạch): (1) `validateDeck` đã có ở `packages/shared` từ
  2.3; (9) schema Action đầy đủ đã có từ 2.4 (`PlayerActionSchema`); (2) trùng (7); (3) trùng (8).

## Nhật ký chi tiết (đọc khi cần, không tự nạp)

| Nội dung                                             | File                           |
| ---------------------------------------------------- | ------------------------------ |
| P0 / M0 + ghi chú môi trường                         | `docs/ai/progress/p0.md`       |
| P1: task 1.1–1.12, ánh xạ số task P1                 | `docs/ai/progress/p1.md`       |
| P2: task 2.1–2.12                                    | `docs/ai/progress/p2.md`       |
| P3: task 3.1–3.8                                     | `docs/ai/progress/p3.md`       |
| P4: task 4.1–4.2d + bàn giao                         | `docs/ai/progress/p4.md`       |
| Ingest video, mở rộng scope, giá trị ruleset đã chốt | `docs/ai/progress/planning.md` |

## Checklist phase (P0–P9) — chi tiết task: `docs/plan/MASTER-PLAN.md`

- [x] P0 — Setup monorepo + tooling (= M0)
- [x] P1 — Engine core vanilla + RulesetConfig + golden replay/fuzz (bản nháp, chờ duyệt; task 1.1–1.12)
- [ ] P2 — Vertical slice: solo vs AI dummy (API + FE Duel + Sandbox) — 2.1, 2.2, event-filter, 2.3 xong (nháp), 2.4 (trang debug) chờ người dùng test, 2.5 (legalActions) + 2.6 (AI, solo-vs-ai) xong (nháp); 2.7 (Phaser Duel Scene tĩnh) + 2.8 (kéo thả) + 2.9 (animation) + 2.10 (log panel) + 2.11 (Sandbox) + 2.12 (i18n) xong (nháp); chỉ còn 2.4 chờ người dùng test (2.8 = kéo thả, 2.9 = animation; 2.4 = trang debug, 2.5 = legalActions, AI dummy → 2.6, i18n → 2.12)
- [ ] P3 — Effect system + Chain + 10 card mẫu — 3.1, 3.2, 3.2b, 3.3 (chain, engine-only), 3.4 (Spell Speed + Trap/Quick-Play đã Set, engine-only), 3.4c (cửa sổ phản ứng tấn công/triệu hồi, engine-only), 3.5 (trigger OnSummon/OnDestroyed, engine-only), 3.6 (Continuous `ModifyStat` + `scriptId` registry, engine-only), 3.4b (nối wire chain / lá Set / cửa sổ phản ứng / trigger, C13), 3.7 (UI chuỗi Phaser, fixture DEV), 3.8 (10 lá effect thật + deck demo + scenario Sandbox) xong (nháp)
- [ ] P4 — Card batches + Special/Equip/Field/Counter/Fusion — 4.1 (batch 1: 20 vanilla + 10 Phép/Bẫy + `BATCH1_DEMO_DECK`), 4.2a (Special Summon operation), 4.2b (Flip Summon + OnFlip), 4.2c (Equip Spell), 4.2d (nối wire 4.2a/b/c + 3 lá + UI) xong (nháp)
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
