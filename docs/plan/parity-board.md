# Parity Board

Nhãn: `[REF]` · `[RULE]` · `[DECISION]` (chủ dự án đã chốt, chưa có [REF]; đổi bằng config khi có tư liệu) · `[GUESS]`.
Trạng thái: ⬜ chưa làm · 🟨 có bản nháp · ✅ đã duyệt bởi bạn. Nhãn độ tin cậy `[REF]/[RULE]/[GUESS]`. AI cập nhật cuối mỗi task; chỉ bạn được chuyển 🟨 → ✅.

## Cơ chế / luật

| Mục                                    | Nhãn              | Trạng thái | Ghi chú                |
| -------------------------------------- | ----------------- | ---------- | ---------------------- |
| Draw + phase flow                      | [RULE]            | ⬜         |                        |
| Normal Summon / Set                    | [RULE]            | ⬜         |                        |
| Tribute Summon                         | [RULE]            | ⬜         |                        |
| Position / Flip                        | [RULE]            | ⬜         |                        |
| Attack / damage                        | [RULE]            | ⬜         |                        |
| Win / lose + Surrender                 | [RULE]/[DECISION] | ⬜         | G11                    |
| Timer PvP / AFK                        | [DECISION]        | ⬜         | 60s, config (G7)       |
| Hand limit / luật attack               | [RULE]            | ⬜         | xem RULES-REVIEW-SHEET |
| Spell/Trap activation                  | [RULE]            | ⬜         |                        |
| Chain (prompt "Kích hoạt?", auto-pass) | [RULE]/[DECISION] | ⬜         | G5                     |
| Triggers / Continuous                  | [RULE]            | ⬜         |                        |
| Equip / Field / Counter                | [RULE]            | ⬜         |                        |
| Fusion (Ritual ngoài v1)               | [RULE]            | ⬜         | G8                     |

## Màn hình / UI

| Mục                    | Nhãn       | Trạng thái | Ghi chú                      |
| ---------------------- | ---------- | ---------- | ---------------------------- |
| Duel layout            | [GUESS]    | ⬜         |                              |
| Drag-drop flow (G2–G4) | [DECISION] | ⬜         | tribute, menu, attack 2 cách |
| Card Detail panel      | [GUESS]    | ⬜         |                              |
| Chain UI               | [DECISION] | ⬜         | prompt Kích hoạt?            |
| Menu                   | [GUESS]    | ⬜         |                              |
| Deck Builder           | [GUESS]    | ⬜         |                              |
| Match Result           | [GUESS]    | ⬜         |                              |

## Animation / âm thanh

| Mục                        | Nhãn    | Trạng thái | Ghi chú |
| -------------------------- | ------- | ---------- | ------- |
| Draw / Summon / Set / Flip | [GUESS] | ⬜         |         |
| Attack / Damage / Destroy  | [GUESS] | ⬜         |         |
| Activate / Chain           | [GUESS] | ⬜         |         |
| LP / Phase / Win-Lose      | [GUESS] | ⬜         |         |
| SFX / BGM                  | [GUESS] | ⬜         |         |

## Card

| Batch                         | Trạng thái  | Ghi chú |
| ----------------------------- | ----------- | ------- |
| Batch 0 (5 mẫu + ~10 vanilla) | 🟨 5 mẫu có |         |
| Batch 1                       | ⬜          |         |
| Batch 2                       | ⬜          |         |
| Batch 3                       | ⬜          |         |

> Ghi chú ingest video #1: bố cục Duel (G9) có `[REF]` một phần — xem `docs/reference/notes/layout-analysis.md`. Các mục UI vẫn ⬜ (chưa làm), chưa ✅ vì chưa có bản dựng để duyệt.
