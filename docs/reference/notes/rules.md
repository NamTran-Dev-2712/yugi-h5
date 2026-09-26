# Quyết định luật & flow (chủ dự án chốt 2026-09-20)

Nhãn: `[RULE]` luật chuẩn · `[DECISION]` chủ dự án đã chốt, chưa có `[REF]` (không hỏi lại; đổi bằng config khi có tư liệu) · `[GUESS]` chờ tư liệu.
Bảng tổng hợp: `docs/plan/fidelity-spec.md`. Ghi vào ADR: `docs/ai/DECISIONS.md`.

| #   | Nhãn             | Nội dung                                                                                                                                   | Khoá config                         |
| --- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| G1  | [RULE]           | Lượt 1 của người đi trước: không draw, không attack                                                                                        | `firstTurnDraw`, `firstTurnAttack`  |
| G2  | [DECISION]       | Kéo bài xuống zone; nếu cần tribute thì highlight quái của mình để chọn, có nút Xác nhận/Hủy                                               | —                                   |
| G3  | [DECISION]       | Chạm quái mình mở menu (Tấn công / Đổi thế / Lật), chỉ hiện action hợp lệ theo server (`legalActions`)                                     | —                                   |
| G4  | [DECISION]       | Hỗ trợ cả hai: kéo quái sang target; hoặc chọn "Tấn công" rồi chạm target                                                                  | —                                   |
| G5  | [DECISION]       | Hỏi "Kích hoạt?" khi có bài hợp lệ; có setting auto-pass. **Video #3/#4: không thấy dialog, phản ứng bằng chạm lá Bẫy úp → C13 chờ quyết** | `chainPrompt`                       |
| G6  | [DECISION]       | Không Damage Step chi tiết; Quick effect chỉ trước khi tính damage; state chừa chỗ để mở rộng sau                                          | —                                   |
| G7  | [DECISION]       | Solo không timer; PvP 60s/lượt (config), hết giờ tự EndPhase, AFK nhiều lần thì thua                                                       | `turnTimerSec`, `afkLossThreshold`  |
| G8  | [DECISION]       | Fusion để P4; chưa Ritual/Synchro/Xyz/Link/Pendulum; state chừa `extraDeck`                                                                | `extraDeckSize`                     |
| G9  | [REF] (một phần) | Bố cục board — xem `layout-analysis.md` (video #1; còn ô chưa rõ chức năng)                                                                | —                                   |
| G10 | [REF] (một phần) | Thời lượng animation — chỉ có Phép Dung Hợp ~1.25–1.5 s; còn lại chưa có (`frames-index.md`)                                               | —                                   |
| G11 | [DECISION]       | Có surrender và log trận                                                                                                                   | `allowSurrender`                    |
| G12 | [DECISION]       | Deck 40–60, tối đa 3 bản/lá, chưa gacha/pack                                                                                               | `deckMin`, `deckMax`, `copyLimit`   |
| —   | [REF] (một phần) | Số lá mở đầu 5: ván 1 thấy tay 5 lá + deck 45 (deck 50); ván 2 thấy tay 6 + deck 44 _(có thể đã rút đầu lượt)_ — xem mục ingest #1         | `openingHandSize`                   |
| —   | [DECISION]       | `afkLossThreshold` = 3, `extraDeckSize` = 15 (chốt 2026-09-20)                                                                             | `afkLossThreshold`, `extraDeckSize` |
| —   | [RULE]/[GUESS]   | Starting LP 8000 (giữ cho tới khi có tư liệu)                                                                                              | `startingLP`                        |

Khi bạn nộp tư liệu: xem "Khi bạn báo đã nộp" trong `docs/reference/README.md`. Nếu tư liệu mâu thuẫn với một `[DECISION]`, tôi sẽ nêu
mâu thuẫn và chờ bạn quyết (không tự đổi).

## Kết quả ingest video #1 (2026-09-20) — chi tiết `layout-analysis.md`, `frames-index.md`

Nguồn: quay màn hình bản web Yugi H5 thật (2023-11-13), 2 ván PvE, ~10 phút duel + ~16 phút menu/deck builder/shop.

### Xác nhận `[REF]`

| Nội dung                                                                                                         | Mức chắc                                      |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Canvas 16:9 landscape; mình ở dưới, đối thủ ở trên; LP + avatar góc dưới-trái (mình) / trên-phải (đối thủ)       | Cao                                           |
| Tay mình dưới-giữa (ngửa); tay đối thủ trên-giữa (5 lá úp)                                                       | Cao                                           |
| Deck giới hạn **tối đa 3 bản/lá** (text lá: "Trong cùng bộ bài được có tối đa 3 lá"); deck hiển thị dạng "50/60" | Cao (max 3, max 60); **min 40 chưa xác nhận** |
| Số lá mở đầu **5** trong ván 1 (tay 5, deck 45 khi deck 50)                                                      | Trung bình (1 ván)                            |
| Prompt chọn lá: nền tối + hàng lá + nút "Đồng ý"; prompt Dung Hợp ghi nguồn nguyên liệu (Bộ bài / Bài trên tay)  | Cao                                           |
| Skill hiển thị dạng "Kỹ năng" có tên + "Từ khóa" (archetype)                                                     | Cao                                           |

### Mâu thuẫn với `[DECISION]` / mặc định hiện tại — **cần chủ dự án quyết** (tôi chưa đổi gì)

| #   | Quan sát trong video                                                                                          | Đang ghi trong repo                              | Đề xuất                                                                                                                                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Game có **Link monster** (thẻ "LINK n") và **2 ô "EX"** giữa bàn (giống Extra Monster Zone của Master Rule 5) | G8: chưa Link; luật cổ điển, không EMZ (`zones`) | Đây không phải "early Master Rule". Cân nhắc: giữ v1 như cũ (Link/EX sau) **hoặc** đưa EX zone + Link vào kế hoạch. Hiện state chỉ có 5 ô quái — **ĐÃ QUYẾT 2026-09-21 `[DECISION]`:** chưa làm Link/EX zone trong P1–P4; `extraMonsterZones` (mặc định 0, chỉ lưu); UI 2 ô EX placeholder khóa; Link → backlog sau P4. |
| C2  | **LP người chơi = 10000** ở cả 2 ván (đối thủ 10000 và 8000)                                                  | `startingLP` 8000 `[RULE]/[GUESS]`               | Đổi mặc định 10000? và cho phép LP **khác nhau mỗi bên** (config hiện 1 giá trị) — **ĐÃ QUYẾT 2026-09-21 `[DECISION]` (dựa giả thuyết):** `startingLP` 8000 cả hai bên (video #2); 10000 của video #1 giả định là chế độ khác; `StartDuel` ghi đè LP từng bên.                                                          |
| C3  | Extra Deck hiển thị **20/20**                                                                                 | `extraDeckSize` = 15 (bạn vừa chốt)              | Đổi 20? (không đổi khi chưa có lệnh) — **ĐÃ QUYẾT 2026-09-21:** `extraDeckSize` = 20 `[REF thấp, 1 nguồn]`.                                                                                                                                                                                                             |
| C4  | Không thấy **thanh phase**; chỉ 1 nút "Kết thúc"/"Công"                                                       | `ui-plan.md`: phase bar Draw→End                 | Cân nhắc: UI đơn giản hoá (1 nút); engine vẫn giữ phase — **ĐÃ QUYẾT 2026-09-21 `[DECISION]`:** UI 1 nút hex 3 trạng thái (Công/Kết thúc/Thủ), bỏ phase bar; engine giữ đủ phase; nghĩa "Công" là suy luận, không hard-code.                                                                                            |
| C5  | Chạm quái mở panel **"Kỹ năng chủ động"** (liệt kê skill), không thấy menu Tấn công/Đổi thế trong đó          | G3: menu Tấn công/Đổi thế/Lật                    | G3 có thể vẫn đúng ở ô khác; **chưa đủ dữ liệu** — cần video quay thao tác tấn công/đổi thế                                                                                                                                                                                                                             |
| C6  | Hiệu ứng card là "Kỹ năng" (skill) mạnh, không phải text YGO                                                  | `effect-dsl.md` theo trigger YGO                 | Nhất quán với DSL data-driven; không mâu thuẫn, chỉ lưu ý nội dung card sẽ khác                                                                                                                                                                                                                                         |
| C7  | quirks.md: "kéo quái sang quái đối phương để tấn công" — **không thấy** trong mẫu 12s                         | G4 hỗ trợ cả 2 cách                              | Chưa xác nhận/bác bỏ                                                                                                                                                                                                                                                                                                    |
| C8  | Có Tiệm Bài/gacha, Guild, Sự kiện, Thời trang                                                                 | v1 không gacha                                   | Chỉ là chênh lệch phạm vi                                                                                                                                                                                                                                                                                               |

### Còn `[GUESS]`/chưa có tư liệu

G1 (lượt 1 draw/attack — ván 2 tay 6 lá có thể là rút đầu lượt, **không kết luận được**), G2 tribute (không thấy), G5 prompt "Kích hoạt?" (không thấy),
G6 Damage Step, G7 timer/AFK (không thấy timer), G11 surrender/màn kết thúc trận, animation attack/draw/summon/destroy/phase. Cần video quay **đủ 1 lượt chi tiết**
(rút bài, triệu hồi thường, tribute, tấn công, chain, kết thúc trận) và ảnh màn kết quả.
