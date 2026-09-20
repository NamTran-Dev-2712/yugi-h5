# Fidelity Spec — "giống" nghĩa là gì

Không có bản gốc để đối chiếu → **không thể đạt 100%**. Mục tiêu thực tế: đúng luật (a) tuyệt đối, đúng
flow (b) gần đúng, UI (c) và animation (d) "cảm giác tương đương", nội dung card (e) placeholder.
Mỗi hạng mục thiếu `[REF]` vẫn là `[GUESS]`.

Nhãn: `[REF]` có tư liệu · `[RULE]` luật chuẩn · `[DECISION]` chủ dự án đã chốt thiết kế, chưa có `[REF]` (không hỏi lại; đổi bằng config khi có tư liệu) · `[GUESS]` đoán (phải xác nhận).

## 5 tầng và tiêu chí

| Tầng | Tên                       | Tiêu chí đo được                                                                                  | Ưu tiên | "Gần đúng chấp nhận được"                             |
| ---- | ------------------------- | ------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------- |
| a    | Luật/logic                | 100% test rule pass; golden replay khớp; không có hành động hợp lệ bị chặn/không hợp lệ được phép | P0      | Luật YGO chuẩn `[RULE]` khi thiếu `[REF]`             |
| b    | Flow lượt & số bước bấm   | Số click từ "muốn Summon" → xong ≤ số click ở reference; ghi bảng so sánh trong Review Packet     | P1      | Flow hợp lý, chỉnh được qua `RulesetConfig`/setting   |
| c    | Bố cục UI                 | Vị trí zone/LP/phase bar/hand khớp reference ±10% trên 1280×720; so ảnh cạnh nhau                 | P2      | Bố cục tương đương chức năng, không cần pixel-perfect |
| d    | Animation/timing/âm thanh | Mỗi animation: thời lượng ±20% reference, có skip; duyệt trong Animation Preview                  | P3      | Tier 1 tween/particle bằng code                       |
| e    | Nội dung card             | Card placeholder tự đặt tên (không Konami); cơ chế effect tương đương                             | P3      | Placeholder + art bạn cung cấp                        |

## Ma trận cơ chế × tầng

| Cơ chế                                         | a Luật                                       | b Flow                                          | c UI          | d Anim  | Kiểm chứng                                                             |
| ---------------------------------------------- | -------------------------------------------- | ----------------------------------------------- | ------------- | ------- | ---------------------------------------------------------------------- |
| Phase Draw/Standby/Main/Battle/End             | [RULE]                                       | [GUESS]                                         | [GUESS]       | [GUESS] | Test phase; so screenshot phase bar                                    |
| Bỏ draw/attack lượt 1 (G1)                     | [RULE]; rút lượt 1 [REF] (4/4 ván, video #2) | —                                               | —             | —       | Test rule; config `firstTurnDraw/Attack`; tấn công lượt 1 chưa thấy    |
| Normal Summon                                  | [RULE]                                       | [GUESS]                                         | [GUESS]       | [GUESS] | Số bước kéo/bấm                                                        |
| Tribute Summon (G2)                            | [RULE]                                       | [DECISION]                                      | [DECISION]    | [GUESS] | Kéo xuống zone → highlight quái mình → Xác nhận/Hủy                    |
| Set monster / spell / trap                     | [RULE]                                       | [GUESS]                                         | [GUESS]       | [GUESS] | So screenshot                                                          |
| Đổi position, Flip (G3)                        | [RULE]                                       | [DECISION]                                      | [DECISION]    | [GUESS] | Chạm quái → menu, chỉ action hợp lệ                                    |
| Attack / damage calc / direct (G4)             | [RULE]                                       | [DECISION]                                      | [DECISION]    | [GUESS] | Kéo sang target và menu Tấn công → chạm target                         |
| Damage Step (G6)                               | [DECISION]                                   | [DECISION]                                      | —             | [GUESS] | Không Damage Step chi tiết; Quick chỉ trước khi tính damage            |
| Chain / Spell Speed (G5)                       | [RULE]                                       | [DECISION]                                      | [DECISION]    | [GUESS] | Hỏi "Kích hoạt?" khi có bài hợp lệ; setting auto-pass                  |
| Trigger optional/mandatory, when/if            | [RULE]                                       | [GUESS]                                         | [GUESS]       | [GUESS] | Test + mô tả                                                           |
| Continuous / Equip / Field                     | [RULE]                                       | [GUESS]                                         | [GUESS]       | [GUESS] | Test                                                                   |
| Fusion (G8; Ritual ngoài v1)                   | [RULE]                                       | [DECISION]                                      | [GUESS]       | [GUESS] | P4; state chừa `extraDeck`                                             |
| Hand limit 6                                   | [RULE]                                       | [REF] (thấy 1 lần, video #2 18:36: bỏ bằng kéo) | [REF] (1 lần) | —       | Test                                                                   |
| Timer lượt / AFK (G7)                          | [DECISION]                                   | [DECISION]                                      | [GUESS]       | —       | Solo không timer; PvP 60s, hết giờ tự EndPhase, AFK nhiều lần thì thua |
| Win/lose + Surrender + log trận (G11)          | [RULE]/[DECISION]                            | [DECISION]                                      | [GUESS]       | [GUESS] | Test                                                                   |
| Deck Builder 40-60, ≤3, không gacha/pack (G12) | [RULE]/[DECISION]                            | [DECISION]                                      | [GUESS]       | —       | So screenshot                                                          |
| Card detail panel                              | —                                            | [GUESS]                                         | [GUESS]       | —       | Screenshot                                                             |
| Graveyard/Banished viewer                      | —                                            | [GUESS]                                         | [GUESS]       | [GUESS] | Screenshot                                                             |
| Âm thanh (SFX/BGM)                             | —                                            | —                                               | —             | [GUESS] | Cần file/mô tả                                                         |

## Trạng thái các mục G (cập nhật 2026-09-20)

Chi tiết + khoá config: `docs/reference/notes/rules.md`. `[DECISION]` không hỏi lại; khi có `[REF]` mâu thuẫn thì đổi config và chuyển sang `[REF]`.

| #   | Nội dung                                                                            | Nhãn                                          | Ghi chú                                                                                                                                             |
| --- | ----------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | Lượt 1 người đi trước: không draw, không attack                                     | [RULE] + [REF] (phần draw: 4/4 ván video #2)  | `firstTurnDraw`/`firstTurnAttack`; người đi sau có rút ở lượt đầu; **tấn công lượt 1 chưa thấy**                                                    |
| G2  | Tribute: overlay chọn lá + "Đồng ý" [REF]; nút "Hủy" [DECISION] (C9 đã đóng)        | [REF] + [DECISION] (Hủy)                      | video #2 (2 lần); chưa thấy "Hủy"                                                                                                                   |
| G3  | Chạm quái mình mở menu (Tấn công/Đổi thế/Lật), chỉ action hợp lệ theo server        | [DECISION]                                    | cần `legalActions`                                                                                                                                  |
| G4  | Attack: kéo mũi tên đỏ là cách chính [REF]; "chọn Tấn công rồi chạm target" là phụ  | [REF] (kéo) + [DECISION] (menu)               | Video #2: kéo ≥6 lần; menu chưa thấy; nhãn nổi "Tấn công N"/"Phòng thủ N"                                                                           |
| G5  | Hỏi "Kích hoạt?" khi có bài hợp lệ; setting auto-pass (C12 đã đóng)                 | [DECISION]                                    | `chainPrompt`; video #2 không thấy prompt nhưng chưa phân biệt được "không có bài hợp lệ"                                                           |
| G6  | Không Damage Step chi tiết; Quick chỉ trước khi tính damage; state chừa chỗ mở rộng | [DECISION]                                    |                                                                                                                                                     |
| G7  | Solo không timer; PvP 60s/lượt, hết giờ tự EndPhase, AFK nhiều lần thì thua         | [DECISION]                                    | `turnTimerSec`, `afkLossThreshold`; video #2: đếm ngược "Đang suy nghĩ N" thấy ở ván Quyết Đấu (không thấy ở PvE) — **ủng hộ**, không đổi nhãn      |
| G8  | Fusion ở P4; chưa Ritual/Synchro/Xyz/Link/Pendulum; state chừa `extraDeck`          | [DECISION]                                    |                                                                                                                                                     |
| G9  | Bố cục board (LP, deck, GY, hand, phase bar)                                        | [REF] (một phần)                              | `notes/layout-analysis.md`; còn ô chưa rõ chức năng                                                                                                 |
| G10 | Thời lượng/phong cách animation                                                     | [REF] (một phần, mỗi mục thấy 1 lần)          | video #1: Phép Dung Hợp; video #2: đổi lượt, rút (đối thủ), summon, tribute, tấn công, LP, Bẫy/Phép, Fusion, thắng → `notes/animation-durations.md` |
| G11 | Có surrender và log trận                                                            | [DECISION]                                    | `allowSurrender`                                                                                                                                    |
| G12 | Deck 40–60, max 3, chưa gacha/pack                                                  | [DECISION]                                    | `deckMin/Max`, `copyLimit`                                                                                                                          |
| —   | Số lá mở đầu 5 (`openingHandSize`)                                                  | [REF] (5 lá, 4/4 ván video #2 + video #1)     | deck 40→35 (video #2), 50→45 (video #1)                                                                                                             |
| —   | Starting LP 8000, `StartDuel` ghi đè từng bên                                       | [DECISION] (dựa giả thuyết)                   | Video #2: 8000 cả hai bên (4/4 ván); video #1 10000 giả định là chế độ khác → C2/C10 đã đóng                                                        |
| —   | `extraDeckSize` 20                                                                  | [REF thấp, 1 nguồn]                           | C3 đã đóng (video #1: "20/20")                                                                                                                      |
| —   | UI 1 nút hex 3 trạng thái (Công/Kết thúc/Thủ), không thanh phase                    | [REF] (3 trạng thái) + [GUESS] (nghĩa "Công") | C4 đã đóng; engine giữ đủ phase                                                                                                                     |
| —   | Link/ô EX: chưa làm P1–P4 (`extraMonsterZones`=0, UI 2 ô EX khóa)                   | [DECISION]                                    | C1 đã đóng; Link → backlog sau P4                                                                                                                   |

Thiếu tư liệu → UI/animation dùng giả định, đánh dấu "nháp" trong `parity-board.md`. Khi bạn nộp tư liệu, chạy quy trình
`docs/reference/README.md` (mục "Khi bạn báo đã nộp") để chuyển G tương ứng sang `[REF]`.

**Ingest video #1 (2026-09-20):** phát hiện 8 điểm lệch/mâu thuẫn (Link + ô EX, LP 10000, Extra Deck 20, không thấy phase bar…). Xem `docs/reference/notes/rules.md` mục C1–C8. Chưa đổi `[DECISION]` nào.

**Đã đóng 2026-09-21:** C1, C2, C3, C4, C9, C10, C12 (xem `docs/ai/DECISIONS.md`). C2/C10 dựa trên giả thuyết.

**C11 đã đóng (2026-09-20):** `[DECISION]` Trap phải Set mới kích hoạt (không từ tay); `[RULE]` Trap vừa Set chưa kích hoạt trong lượt đó; `[RULE]` Spell thường kích hoạt từ tay ở Main Phase. Quan sát 15:17 (video #2) chỉ là backlog "hỏi lại sau khi có thêm tư liệu", không phải căn cứ. Khoá: `allowTrapActivationFromHand`, `trapSetTurnDelay`.

**Ingest video #2 (2026-09-20):** chi tiết `docs/reference/notes/rules-observed.md`, `timestamps-video2.md`, `animation-durations.md`. Chuyển `[GUESS]→[REF]` chỉ ở: số lá mở đầu 5, rút bài lượt 1 (G1, phần draw), hand limit 6 (thấy 1 lần), một phần G10. Mâu thuẫn mới cần chủ dự án quyết: **C9** (tribute = overlay chọn lá + "Đồng ý", không thấy "Hủy" vs G2), **C10** (LP mình 8000 vs 10000 ở video #1), **C11** (Bài Bẫy dùng thẳng từ tay, 1 lần — **đã quyết 2026-09-20: cấm kích hoạt Trap từ tay, xem DECISIONS.md**), **C12** (không thấy prompt "Kích hoạt?" vs G5). Không đổi `[DECISION]` nào.
