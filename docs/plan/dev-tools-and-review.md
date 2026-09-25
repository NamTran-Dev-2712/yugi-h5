# Dev Tools & Review — giao diện review cho người không code

Tool dev chạy qua `apps/api` dev-only endpoints (chỉ bật ngoài production); `apps/web` không import engine (CLAUDE.md #2).
Trang dev nằm dưới `/dev/*` trong web, ẩn khỏi production build.

| Tool              | Việc                                                                                                                                      | Phase | Task                                                      |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----- | --------------------------------------------------------- |
| Event/Action Log  | Panel trong Duel, bật/tắt, hiện action + event theo thời gian                                                                             | P2    | 2.7 (log cơ bản) + 2.9 (animation) + 2.10 (bật/tắt + lọc) |
| Duel Sandbox      | Nạp `scenarios/*.json` (board state) → thao tác thủ công → xem event log; scenario mẫu: `tribute-summon`, `attack-defense`, `chain-basic` | P2    | 2.11                                                      |
| Card Gallery      | Xem/lọc card; art thật hay placeholder; effect dạng text; lọc thiếu art; theo batch/tag                                                   | P5    | 5.5                                                       |
| Animation Preview | Chọn GameEvent/VFX → phát lại, chỉnh tốc độ, so với reference, đánh dấu duyệt                                                             | P6    | 6.5                                                       |
| Replay Viewer     | Nạp seed + action log → bước từng action, xem state/event                                                                                 | P6    | 6.7                                                       |
| Parity Board      | `docs/plan/parity-board.md`: trạng thái từng cơ chế/animation/màn hình                                                                    | P2+   | mỗi task                                                  |
| Review Packet     | Cuối MỖI task (lệnh `/review-packet`)                                                                                                     | mọi   | —                                                         |

> Numbering đã đổi so với bản đầu (log panel gốc có từ 2.7, animation ở 2.9, bật/tắt + lọc ở 2.10, Sandbox ở 2.11); đối chiếu `MASTER-PLAN.md` là nguồn đúng.

## Scenario JSON (Duel Sandbox)

Định dạng: `{ name, ruleset?, seed, players: [{ lp, hand[], deck[], field: {monsters[], spellTraps[]}, gy[] }, ...], turn, phase, script?: Action[] }`.
Bạn chỉ cần sửa danh sách card id — không cần code. Validate bằng Zod trước khi nạp.

## Review Packet (mẫu, dùng cuối mỗi task)

```
### Review Packet — <task>
**Đã làm gì (1-3 dòng):**
**Cách xem:** lệnh + URL + bấm gì
**5 điều cần kiểm tra:** 1..5
**So với reference:** khớp / lệch chỗ nào (nhãn [REF]/[RULE]/[GUESS])
**Cần bạn cung cấp:** asset / tư liệu / câu trả lời (link mục trong human-tasks.md)
**Task tiếp theo:**
```

## Lịch làm sớm

Log panel + Sandbox ở P2 (bạn tự dựng tình huống), Gallery ở P5, Animation Preview + Replay ở P6. Parity board và Review Packet ngay từ task đầu.
