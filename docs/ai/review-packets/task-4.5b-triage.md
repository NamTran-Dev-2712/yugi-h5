# Task 4.5b — Phase 0: kết quả dọn nợ duyệt (2026-10-04)

**AI duyệt thay: 1 · Đã chốt trong brief: 5 · Chủ dự án chọn qua hộp thoại (6 câu): 4 dòng, trong đó 3 duyệt + 1 giữ tạm ·
Còn mở: 1.** Chỉ sửa tài liệu; 0 dòng code / test game. Không đáp án nào đòi đổi luật engine ⇒ không sinh task engine.

Đếm bằng script (không đoán): trước Phase 0 sheet có 99 dòng luật, **10 ô duyệt trống**; sau Phase 0 còn **1** (G26 f).
Ký hiệu ở cột "Tôi đã duyệt" sau Phase 0: `☑` trần 59 (của chủ dự án, không đụng) · "AI duyệt thay" 15 (+1) · "chọn qua
hộp thoại" 17 (+4, tính cả dòng có hai vế) · "chọn qua brief" 7 (+4) · trống 1.

## A. Bảng 10 dòng

| Dòng (`RULES-REVIEW-SHEET.md`)                                  | Nhóm | Quyết định                                                                             | Bằng chứng                                                                                                                                                                                                                       |
| --------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quái vừa được triệu hồi: tấn công (G22)                         | C    | **Chốt: không được tấn công** ⇒ nhãn `[GUESS]` → `[DECISION]`, ☑ hộp thoại             | Câu 1. Test `rejects a monster Summoned or Set this turn` (`declare-attack.test.ts`) có thật                                                                                                                                     |
| Thứ tự và việc mở lại cửa sổ sau lần hỏi đầu (G25 b, c)         | C    | (b) hiệu ứng "khi triệu hồi" xếp trước; (c) không hỏi lại ⇒ ☑ hộp thoại                | Câu 2, 3. Hai test ở `rules/summon-window-order.test.ts` có thật                                                                                                                                                                 |
| Kích hoạt lá Phép dung hợp                                      | B    | ☑ brief 4.5b                                                                           | Brief 4.5 (1) nguyên liệu đích danh, (3) nguồn là tham số + không cost / chọn lúc resolve, (5) Phép Thường; brief 4.5b (b) lá demo giữ tay + sân. 12 test nhóm `Fusion — activation` xanh                                        |
| Chọn quái Dung hợp và nguyên liệu lúc lá resolve                | B    | ☑ brief 4.5b                                                                           | Brief 4.5 (3) chọn lúc resolve, nguyên liệu vào mộ; brief 4.5b (c) luôn hỏi bước chọn quái, (d) ô trống thấp nhất + Tư thế Công. Nhóm `Fusion — resolution` (22 test) xanh                                                       |
| Triệu hồi Dung hợp là Triệu hồi Đặc biệt                        | B    | ☑ brief 4.5b; vế "không tấn công lượt đó" theo đáp án câu 1                            | Brief 4.5 (2). Nhóm `Fusion — it is a Special Summon` (4 test) xanh                                                                                                                                                              |
| Chặn một lần Dung hợp                                           | B    | ☑ brief 4.5b                                                                           | Brief 4.5 (4): chỉ vô hiệu việc kích hoạt lá Phép; không cửa sổ triệu hồi. 3 test có tên trong dòng xanh                                                                                                                         |
| Nguyên liệu bị phá để đáp trả lá dung hợp (G26 d)               | C    | Lá Phép mất, không có gì xảy ra; hiệu ứng "khi bị phá" chờ dung hợp xong ⇒ ☑ hộp thoại | Câu 4, 5. 3 test nhóm `Fusion — on a chain` có thật                                                                                                                                                                              |
| Quái Dung hợp không lên sân bằng đường khác; rời sân thì vào mộ | B    | ☑ brief 4.5b                                                                           | Brief 4.5 (5). Nhóm `Fusion Monsters — no other way onto the field` (4 test) xanh                                                                                                                                                |
| Nguyên liệu lấy từ Deck (G26 f)                                 | C    | **Giữ tạm, chờ tư liệu** ⇒ ô để trống, mục P6 ở `OPEN-ISSUES.md`                       | Câu 6. Brief 4.5b (b) chỉ chốt "nguồn Deck không lên wire", không chốt cách xử lý của engine                                                                                                                                     |
| Extra Deck lúc bắt đầu ván và kiểm tra bộ bài                   | A    | ☑ AI duyệt thay                                                                        | (1) luật chuẩn `[RULE]`; (2) 4 test `start-duel.extra-deck.test.ts` + 7 test `validateDeck — Extra Deck (task 4.5)` xanh; (3) đã đọc thân test, khớp từng vế của cột "Kết quả mong đợi"; (4) không mâu thuẫn dòng đã ☑ / ADR 068 |

**Nói thẳng về dòng nhóm A:** nhãn của dòng là "`[RULE]`; cỡ 20 `[REF thấp]` (C3)" — không thuần `[RULE]` theo nghĩa hẹp. Tôi
vẫn duyệt thay vì vế "20 lá" đã được chính chủ dự án tick `☑` ở dòng "Cấu hình luật mặc định" (Extra Deck 20, C3); phần còn
lại của dòng là luật chuẩn. Nếu bạn muốn chặt hơn, xoá ký hiệu ở dòng này và tôi sẽ hỏi lại.

**Lần chạy test làm bằng chứng (2026-10-04):** `vitest run src/rules/fusion.test.ts
src/actions/handlers/start-duel.extra-deck.test.ts` → 58 / 58 đạt; `vitest run src/deck/validate-deck.test.ts` (shared) →
20 / 20 đạt.

## B. Câu đã hỏi và đáp án (hộp thoại, 2026-10-04)

| #   | Câu hỏi (rút gọn)                                                                                             | Đáp án                                            | Hệ quả                                                            |
| --- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | Quái vừa triệu hồi có được tấn công ngay trong lượt đó không?                                                 | **Chốt: không được tấn công**                     | G22 thành `[DECISION]`; xoá mục P5 ở `OPEN-ISSUES.md`; engine giữ |
| 2   | Triệu hồi quái A (hiệu ứng khi triệu hồi), đối thủ phá quái B (hiệu ứng khi bị phá): cái nào lên chuỗi trước? | **A trước, B sau** (khuyến nghị)                  | G25 (b) giữ nguyên                                                |
| 3   | Đối thủ đã cho qua, bạn từ chối hiệu ứng tuỳ chọn: có hỏi đối thủ lần nữa không?                              | **Không hỏi lại** (khuyến nghị)                   | G25 (c) giữ nguyên                                                |
| 4   | Nguyên liệu trên sân bị phá để đáp lá dung hợp, không còn cách dung hợp: lá Phép ra sao?                      | **Lá Phép mất, không có gì xảy ra** (khuyến nghị) | G26 (d) giữ nguyên                                                |
| 5   | Quái có hiệu ứng "khi bị phá" bị phá để đáp lá dung hợp, vẫn dung hợp được: hiệu ứng đó xảy ra lúc nào?       | **Sau khi dung hợp xong** (khuyến nghị)           | G26 (d) giữ nguyên                                                |
| 6   | Lá dung hợp lấy nguyên liệu từ Bộ bài (chưa có lá nào): vào mộ + xáo Bộ bài?                                  | **Giữ tạm, chờ tư liệu** (khuyến nghị)            | Ô để trống; `OPEN-ISSUES.md` P6; không lên wire ở 4.5b            |

## C. Còn chờ chủ dự án

1. G26 (f) — nguyên liệu từ Bộ bài: cần video bản gốc có nhãn "Bộ bài" (`docs/plan/human-tasks.md`).
2. Mở rộng `CLAUDE.md` #5 cho P10+ (ADR 043) — để tới P10 (không đổi).

## D. Tài liệu đã sửa ở Phase 0

`docs/reference/notes/RULES-REVIEW-SHEET.md` (9 ô duyệt; nhãn dòng G22 và vế G22 của dòng "Triệu hồi Dung hợp…"),
`docs/ai/OPEN-ISSUES.md` (xoá P5, thêm P6), `docs/plan/fidelity-spec.md` (G22 → `[DECISION]`; ghi chú G25, G26), file này.

## E. Dòng mới do phần code 4.5b thêm vào sheet (cùng quy trình, làm ở cuối task)

7 dòng mới ⇒ **A 1 · B 5 · C 1** (hỏi thêm 1 câu qua hộp thoại, 2026-10-04). Sau bước này sheet có 106 dòng luật, **còn
đúng 1 ô trống** (G26 f).

| Dòng mới                                    | Nhóm | Quyết định                  | Bằng chứng                                                                                                                             |
| ------------------------------------------- | ---- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Extra Deck: ai thấy gì                      | B    | ☑ brief 4.5b                | Quyết định (a) của brief 4.5b. `fusion-wire.spec.ts` (20 test) + fuzz `fusion-leak-<i>` xanh                                           |
| Đấu với máy: Extra Deck của máy             | B    | ☑ brief 4.5b                | Brief 4.5b mục tiêu 2 ("ghế AI luôn Extra Deck rỗng"). Test `solo-vs-ai: the AI seat ALWAYS starts with an empty Extra Deck…` xanh     |
| Kiểm tra Extra Deck khi tạo ván             | A    | ☑ AI duyệt thay             | Thuần `[RULE]`; 7 test e2e tên có "task 4.5b" xanh; đã đọc thân test (tôi viết ở task này), khớp cột mong đợi; không mâu thuẫn ADR 068 |
| Màn chọn Dung hợp                           | B    | ☑ brief 4.5b                | `[REF]` video #2 + brief 4.5b mục tiêu 4 (hai bước, nhãn nguồn, "Đồng ý" chỉ sáng khi đủ) và quyết định (c). 6 test web xanh           |
| Chi tiết thao tác ở màn chọn Dung hợp (G27) | C    | **Chấp nhận** ⇒ ☑ hộp thoại | Câu 7 (dưới). 3 test web xanh                                                                                                          |
| Animation và nhật ký Dung hợp               | B    | ☑ brief 4.5b                | Brief 4.5b mục tiêu 4 (~1,25–1,5 s, placeholder "lá Phép hiện → xoáy → quái phát sáng"). 3 test web xanh                               |
| Nguồn "Bộ bài" chưa có trên màn hình        | B    | ☑ brief 4.5b                | Quyết định (b) của brief 4.5b. Test `[DECISION] brief 4.5b (b): no real card takes fusion materials from the Deck…` xanh               |

| #   | Câu hỏi (rút gọn)                                                                                                                      | Đáp án                      | Hệ quả               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | -------------------- |
| 7   | Màn chọn Dung hợp: không có nút Hủy; chỉ chạm được lá trong dải giữa bàn; chọn 1 quái thì chạm lá khác = đổi lựa chọn — bạn duyệt chứ? | **Chấp nhận** (khuyến nghị) | G27 giữ như đang làm |

**Tổng cả task (17 dòng đã xét):** A 2 · B 10 · C 5 (4 duyệt qua hộp thoại, 1 giữ tạm). **Còn mở: 1** (G26 f).
