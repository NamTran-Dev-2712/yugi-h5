# Parity Board

Nhãn: `[REF]` · `[RULE]` · `[DECISION]` (chủ dự án đã chốt, chưa có [REF]; đổi bằng config khi có tư liệu) · `[GUESS]`.
Trạng thái: ⬜ chưa làm · 🟨 có bản nháp · ✅ đã duyệt bởi bạn. Nhãn độ tin cậy `[REF]/[RULE]/[GUESS]`. AI cập nhật cuối mỗi task; chỉ bạn được chuyển 🟨 → ✅.

## Cơ chế / luật

| Mục                                    | Nhãn                                     | Trạng thái | Ghi chú                                                                                                                                 |
| -------------------------------------- | ---------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Draw + phase flow                      | [RULE]; lượt 1 không rút [REF] (4/4 ván) | 🟨         | video #2; không thấy thanh phase                                                                                                        |
| Normal Summon / Set                    | [RULE]                                   | 🟨         |                                                                                                                                         |
| Tribute Summon                         | [RULE]                                   | 🟨         | task 1.4 (Summon + Set); prompt/UI chưa làm                                                                                             |
| Position / Flip                        | [RULE]                                   | 🟨         | Change Position: task 1.5 (nháp); Flip Summon chưa làm                                                                                  |
| Attack / damage                        | [RULE]                                   | 🟨         | task 1.6 (nháp) + flip-on-attack task 1.8 (nháp): quái úp bị tấn công lật lên rồi tính ATK-vs-DEF; direct attack vẫn cần đối thủ 0 quái |
| Win / lose + Surrender                 | [RULE]/[DECISION]                        | 🟨         | LP về 0: task 1.7 (nháp); Surrender: task 1.9 (nháp, có `allowSurrender`); hand limit/deck-out chưa làm, G11                            |
| Timer PvP / AFK                        | [DECISION]                               | ⬜         | 60s, config (G7)                                                                                                                        |
| Hand limit / luật attack               | [RULE]; hand limit 6 [REF] (thấy 1 lần)  | ⬜         | xem RULES-REVIEW-SHEET; video #2 18:36                                                                                                  |
| Spell/Trap activation                  | [RULE]/[DECISION] (C11)                  | ⬜         | Trap phải Set; config đã có, hành vi ở P3                                                                                               |
| Chain (prompt "Kích hoạt?", auto-pass) | [RULE]/[DECISION]                        | ⬜         | G5                                                                                                                                      |
| Triggers / Continuous                  | [RULE]                                   | ⬜         |                                                                                                                                         |
| Equip / Field / Counter                | [RULE]                                   | ⬜         |                                                                                                                                         |
| Fusion (Ritual ngoài v1)               | [RULE]                                   | ⬜         | G8; Link → backlog sau P4 (C1)                                                                                                          |

## Màn hình / UI

| Mục                    | Nhãn                                                         | Trạng thái | Ghi chú                                                                           |
| ---------------------- | ------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------- |
| Duel layout            | [REF] một phần                                               | 🟨         | video #1 + #2; 1 nút hex 3 trạng thái, 2 ô EX placeholder khóa (C1/C4 [DECISION]) |
| Drag-drop flow (G2–G4) | [REF] (tribute overlay, kéo attack) + [DECISION] (Hủy, menu) | 🟨         | tribute overlay + Đồng ý/Hủy; attack kéo mũi tên chính, nhãn nổi ATK/DEF          |
| Card Detail panel      | [GUESS]                                                      | ⬜         |                                                                                   |
| Chain UI               | [DECISION]                                                   | 🟨         | prompt Kích hoạt? + auto-pass (C12)                                               |
| Menu                   | [GUESS]                                                      | ⬜         |                                                                                   |
| Deck Builder           | [GUESS]                                                      | ⬜         |                                                                                   |
| Match Result           | [REF] (thấy 1 lần, ván thắng)                                | ⬜         | video #2 27:03.5; màn thua chưa thấy                                              |

## Animation / âm thanh

| Mục                        | Nhãn                                                                               | Trạng thái | Ghi chú                        |
| -------------------------- | ---------------------------------------------------------------------------------- | ---------- | ------------------------------ |
| Draw / Summon / Set / Flip | [REF] một phần (thấy 1 lần: draw đối thủ, Normal/Tribute Summon); Set/Flip [GUESS] | ⬜         | `notes/animation-durations.md` |
| Attack / Damage / Destroy  | [REF] (thấy 1 lần mỗi mục)                                                         | ⬜         | `notes/animation-durations.md` |
| Activate / Chain           | [REF] một phần (Phép/Bẫy/Fusion thấy 1 lần); Chain nhiều link [GUESS]              | ⬜         |                                |
| LP / Phase / Win-Lose      | [REF] (thấy 1 lần: LP chạy, banner đổi lượt, thắng→kết quả)                        | ⬜         |                                |
| SFX / BGM                  | [GUESS]                                                                            | ⬜         |                                |

## Card

| Batch                         | Trạng thái  | Ghi chú |
| ----------------------------- | ----------- | ------- |
| Batch 0 (5 mẫu + ~10 vanilla) | 🟨 5 mẫu có |         |
| Batch 1                       | ⬜          |         |
| Batch 2                       | ⬜          |         |
| Batch 3                       | ⬜          |         |

> Ghi chú ingest video #1: bố cục Duel (G9) có `[REF]` một phần — xem `docs/reference/notes/layout-analysis.md`. Các mục UI vẫn ⬜ (chưa làm), chưa ✅ vì chưa có bản dựng để duyệt.

> Ghi chú ingest video #2 (2026-09-20): xem `docs/reference/notes/rules-observed.md`; mâu thuẫn C9–C12 chờ chủ dự án. Chưa mục nào lên ✅.
