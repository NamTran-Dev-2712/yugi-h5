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

| Cơ chế                                         | a Luật            | b Flow     | c UI       | d Anim  | Kiểm chứng                                                             |
| ---------------------------------------------- | ----------------- | ---------- | ---------- | ------- | ---------------------------------------------------------------------- |
| Phase Draw/Standby/Main/Battle/End             | [RULE]            | [GUESS]    | [GUESS]    | [GUESS] | Test phase; so screenshot phase bar                                    |
| Bỏ draw/attack lượt 1 (G1)                     | [RULE]            | —          | —          | —       | Test rule; config `firstTurnDraw/Attack`                               |
| Normal Summon                                  | [RULE]            | [GUESS]    | [GUESS]    | [GUESS] | Số bước kéo/bấm                                                        |
| Tribute Summon (G2)                            | [RULE]            | [DECISION] | [DECISION] | [GUESS] | Kéo xuống zone → highlight quái mình → Xác nhận/Hủy                    |
| Set monster / spell / trap                     | [RULE]            | [GUESS]    | [GUESS]    | [GUESS] | So screenshot                                                          |
| Đổi position, Flip (G3)                        | [RULE]            | [DECISION] | [DECISION] | [GUESS] | Chạm quái → menu, chỉ action hợp lệ                                    |
| Attack / damage calc / direct (G4)             | [RULE]            | [DECISION] | [DECISION] | [GUESS] | Kéo sang target và menu Tấn công → chạm target                         |
| Damage Step (G6)                               | [DECISION]        | [DECISION] | —          | [GUESS] | Không Damage Step chi tiết; Quick chỉ trước khi tính damage            |
| Chain / Spell Speed (G5)                       | [RULE]            | [DECISION] | [DECISION] | [GUESS] | Hỏi "Kích hoạt?" khi có bài hợp lệ; setting auto-pass                  |
| Trigger optional/mandatory, when/if            | [RULE]            | [GUESS]    | [GUESS]    | [GUESS] | Test + mô tả                                                           |
| Continuous / Equip / Field                     | [RULE]            | [GUESS]    | [GUESS]    | [GUESS] | Test                                                                   |
| Fusion (G8; Ritual ngoài v1)                   | [RULE]            | [DECISION] | [GUESS]    | [GUESS] | P4; state chừa `extraDeck`                                             |
| Hand limit 6                                   | [RULE]            | [GUESS]    | [GUESS]    | —       | Test                                                                   |
| Timer lượt / AFK (G7)                          | [DECISION]        | [DECISION] | [GUESS]    | —       | Solo không timer; PvP 60s, hết giờ tự EndPhase, AFK nhiều lần thì thua |
| Win/lose + Surrender + log trận (G11)          | [RULE]/[DECISION] | [DECISION] | [GUESS]    | [GUESS] | Test                                                                   |
| Deck Builder 40-60, ≤3, không gacha/pack (G12) | [RULE]/[DECISION] | [DECISION] | [GUESS]    | —       | So screenshot                                                          |
| Card detail panel                              | —                 | [GUESS]    | [GUESS]    | —       | Screenshot                                                             |
| Graveyard/Banished viewer                      | —                 | [GUESS]    | [GUESS]    | [GUESS] | Screenshot                                                             |
| Âm thanh (SFX/BGM)                             | —                 | —          | —          | [GUESS] | Cần file/mô tả                                                         |

## Trạng thái các mục G (cập nhật 2026-09-20)

Chi tiết + khoá config: `docs/reference/notes/rules.md`. `[DECISION]` không hỏi lại; khi có `[REF]` mâu thuẫn thì đổi config và chuyển sang `[REF]`.

| #   | Nội dung                                                                            | Nhãn           | Ghi chú                              |
| --- | ----------------------------------------------------------------------------------- | -------------- | ------------------------------------ |
| G1  | Lượt 1 người đi trước: không draw, không attack                                     | [RULE]         | `firstTurnDraw`/`firstTurnAttack`    |
| G2  | Tribute: kéo xuống zone → highlight quái mình → Xác nhận/Hủy                        | [DECISION]     |                                      |
| G3  | Chạm quái mình mở menu (Tấn công/Đổi thế/Lật), chỉ action hợp lệ theo server        | [DECISION]     | cần `legalActions`                   |
| G4  | Attack: kéo quái sang target **và** chọn "Tấn công" rồi chạm target                 | [DECISION]     |                                      |
| G5  | Hỏi "Kích hoạt?" khi có bài hợp lệ; setting auto-pass                               | [DECISION]     | `chainPrompt`                        |
| G6  | Không Damage Step chi tiết; Quick chỉ trước khi tính damage; state chừa chỗ mở rộng | [DECISION]     |                                      |
| G7  | Solo không timer; PvP 60s/lượt, hết giờ tự EndPhase, AFK nhiều lần thì thua         | [DECISION]     | `turnTimerSec`, `afkLossThreshold`   |
| G8  | Fusion ở P4; chưa Ritual/Synchro/Xyz/Link/Pendulum; state chừa `extraDeck`          | [DECISION]     |                                      |
| G9  | Bố cục board (LP, deck, GY, hand, phase bar)                                        | [GUESS]        | Chờ tư liệu (`docs/reference/duel/`) |
| G10 | Thời lượng/phong cách animation                                                     | [GUESS]        | Chờ video (`docs/reference/video/`)  |
| G11 | Có surrender và log trận                                                            | [DECISION]     | `allowSurrender`                     |
| G12 | Deck 40–60, max 3, chưa gacha/pack                                                  | [DECISION]     | `deckMin/Max`, `copyLimit`           |
| —   | Số lá mở đầu 5 (`openingHandSize`)                                                  | [GUESS]        | quirks.md ghi "5 hoặc 6"; chờ video  |
| —   | Starting LP 8000                                                                    | [RULE]/[GUESS] | Giữ tới khi có tư liệu; `startingLP` |

Thiếu tư liệu → UI/animation dùng giả định, đánh dấu "nháp" trong `parity-board.md`. Khi bạn nộp tư liệu, chạy quy trình
`docs/reference/README.md` (mục "Khi bạn báo đã nộp") để chuyển G tương ứng sang `[REF]`.
