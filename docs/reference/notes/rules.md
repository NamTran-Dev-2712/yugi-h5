# Quyết định luật & flow (chủ dự án chốt 2026-09-20)

Nhãn: `[RULE]` luật chuẩn · `[DECISION]` chủ dự án đã chốt, chưa có `[REF]` (không hỏi lại; đổi bằng config khi có tư liệu) · `[GUESS]` chờ tư liệu.
Bảng tổng hợp: `docs/plan/fidelity-spec.md`. Ghi vào ADR: `docs/ai/DECISIONS.md`.

| #   | Nhãn           | Nội dung                                                                                               | Khoá config                        |
| --- | -------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| G1  | [RULE]         | Lượt 1 của người đi trước: không draw, không attack                                                    | `firstTurnDraw`, `firstTurnAttack` |
| G2  | [DECISION]     | Kéo bài xuống zone; nếu cần tribute thì highlight quái của mình để chọn, có nút Xác nhận/Hủy           | —                                  |
| G3  | [DECISION]     | Chạm quái mình mở menu (Tấn công / Đổi thế / Lật), chỉ hiện action hợp lệ theo server (`legalActions`) | —                                  |
| G4  | [DECISION]     | Hỗ trợ cả hai: kéo quái sang target; hoặc chọn "Tấn công" rồi chạm target                              | —                                  |
| G5  | [DECISION]     | Hỏi "Kích hoạt?" khi có bài hợp lệ; có setting auto-pass                                               | `chainPrompt`                      |
| G6  | [DECISION]     | Không Damage Step chi tiết; Quick effect chỉ trước khi tính damage; state chừa chỗ để mở rộng sau      | —                                  |
| G7  | [DECISION]     | Solo không timer; PvP 60s/lượt (config), hết giờ tự EndPhase, AFK nhiều lần thì thua                   | `turnTimerSec`, `afkLossThreshold` |
| G8  | [DECISION]     | Fusion để P4; chưa Ritual/Synchro/Xyz/Link/Pendulum; state chừa `extraDeck`                            | `extraDeckSize`                    |
| G9  | [GUESS]        | Bố cục board (LP, deck, GY, hand, phase bar) — chờ tư liệu                                             | —                                  |
| G10 | [GUESS]        | Thời lượng/phong cách animation — chờ tư liệu                                                          | —                                  |
| G11 | [DECISION]     | Có surrender và log trận                                                                               | `allowSurrender`                   |
| G12 | [DECISION]     | Deck 40–60, tối đa 3 bản/lá, chưa gacha/pack                                                           | `deckMin`, `deckMax`, `copyLimit`  |
| —   | [RULE]/[GUESS] | Starting LP 8000 (giữ cho tới khi có tư liệu)                                                          | `startingLP`                       |

Khi bạn nộp tư liệu: xem "Khi bạn báo đã nộp" trong `docs/reference/README.md`. Nếu tư liệu mâu thuẫn với một `[DECISION]`, tôi sẽ nêu
mâu thuẫn và chờ bạn quyết (không tự đổi).
