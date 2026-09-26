# Layout analysis — video #1 (Yugi H5, quay màn hình 2023-11-13)

Nguồn: `docs/reference/video/Yugi H5 Cách chơi Hero Anh Hùng cơ bản ... (1080p).mp4` (1573s, 1920×1080, 30fps). Đây là **quay màn hình bản web
thật** (`id.yugih5.com`), không phải bản dựng lại. Frame lấy mẫu 1 frame/12s (131 ảnh, `docs/reference/frames/main/`, không commit).

**Độ chắc:** mô tả bằng mắt từ ảnh 960px, **không đo pixel**. Sai số vị trí ước lượng ±3% canvas. Chỉ ghi điều nhìn thấy; chỗ suy luận
đánh dấu _(suy luận)_. Chỉ có **2 ván PvE** trong video (đối thủ tên "S06_St.Dragon 5" và "Song Sinh Yêu Tinh"), chưa thấy PvP.

## Canvas

- Canvas game **16:9 landscape** (≈820×462 trong frame 960×540 → ~1640×924 trong video gốc), có thanh đen hai bên (letterbox) trong cửa sổ trình duyệt. ✔ khớp
  quyết định 1280×720 FIT. **[REF]**
- Vị trí bên dưới là % của canvas (x từ trái, y từ trên).

## Màn Duel (bố cục) — chắc: cao (vị trí tổng thể), trung bình (chi tiết nhỏ)

| Thành phần               | Vị trí (% canvas)                                                         | Ghi chú                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Người chơi (mình)        | **dưới**                                                                  | Avatar + "LP: 10000" góc dưới-trái (x 0–20%, y 80–100%)                                                                                                                 |
| Đối thủ                  | **trên**                                                                  | Avatar + tên + "LP: …" góc trên-phải (x 80–100%, y 0–16%); tên đối thủ nằm phía trên LP                                                                                 |
| Tay đối thủ              | trên-giữa, x 30–70%, y 0–7%                                               | 5 lá úp (mặt sau vàng), bị cắt bởi mép trên                                                                                                                             |
| Tay mình                 | dưới-giữa, x 30–70%, y 78–99%                                             | Lá ngửa, nhỏ, hiện ATK/DEF; lá phép có nhãn "Bài Phép", bẫy nhãn "Bài Bẫy"                                                                                              |
| Vùng quái                | 2 hàng × 5 ô lớn, x 16–79%; đối thủ y 7–36%, mình y 45–75%                | Quái hiện art + ATK/DEF + sao/level (số cạnh biểu tượng thuộc tính)                                                                                                     |
| **Ô "EX"**               | hàng giữa, y 38–43%; ô đỏ x 29–41%, ô xanh x 55–67%                       | Hai ô Extra Monster Zone ở giữa bàn (**chưa chắc** đỏ/xanh thuộc về ai). _(suy luận: dành cho Link/Fusion)_                                                             |
| Cột ô nhỏ bên phải       | 2 cột × 3 hàng mỗi bên (x 81–93%), trên y 7–33%, dưới y 44–75%            | Chưa rõ chức năng _(suy luận: Spell/Trap zone hoặc field)_; ô dưới-cùng bên phải của mình có biểu tượng ngôi sao                                                        |
| Chồng bài trái           | x 8–15%: trên (đối thủ) y 5–21%; dưới (mình) hai chồng y 43–58% và 60–76% | Chồng có **số đếm**. Chồng dưới đếm giảm 13→12→11→10 khi triệu hồi, chồng trên đếm tăng 3→5→6→8→12. _(suy luận: dưới = Extra Deck, trên = Mộ)_                          |
| Số lá deck của mình      | dưới-phải, x 92–99%, y 91–97% (biểu tượng lá bài + số)                    | 45 lúc bắt đầu ván 1 (tay 5 → deck 50 lá), giảm dần                                                                                                                     |
| Nút thao tác             | dưới-phải, lục giác lớn x 92–100%, y 73–86%                               | Hiện chữ **"Kết thúc"** (kèm badge "1") ở Main; hiện **"Công"** ở nhiều frame có quái sẵn sàng _(suy luận: "Công" = vào Battle)_. Không thấy thanh phase Draw/Standby/… |
| Cột trái                 | gear (3%,15%), "Điều khiển" (3%,24%), hex "x4" (3%,34%)                   | Cài đặt; "Điều khiển" chưa rõ; **x4 có thể là tốc độ** _(suy luận)_                                                                                                     |
| Bộ đếm góc trên-trái     | x 1–8%, y 2–8%, biểu tượng lá + số ("55" ván 1, "1" ván 2)                | **Chưa rõ** (không phải deck của mình)                                                                                                                                  |
| Hai biểu tượng tròn dưới | x ~83–88%, y ~90%                                                         | Chưa rõ chức năng                                                                                                                                                       |

## Các panel/prompt nhìn thấy

| Prompt                                       | Mô tả                                                                                                                                    | Chắc       |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| "Chọn 1 mục tiêu" / "Chọn mục tiêu dùng hợp" | Nền tối, hàng lá lớn ở giữa, nút xanh **"Đồng ý"** (xám khi chưa hợp lệ, xanh khi hợp lệ); lá chọn viền sáng                             | Cao        |
| "Chọn 2 nguyên liệu dung hợp"                | Hàng lá; **nhãn dưới mỗi lá cho biết nguồn: "Bộ bài" (deck) hoặc "Bài trên tay"**; chọn đủ 2 thì "Đồng ý" sáng                           | Cao        |
| "Kỹ năng chủ động"                           | Khi chạm quái trên sân: panel dưới giữa liệt kê các **skill/lá liên quan** kèm tên; không thấy nút Tấn công/Đổi thế trong panel này      | Trung bình |
| Kích hoạt Phép                               | Lá lớn hiện bên phải/giữa màn hình kèm nhãn "Bài Phép" (viền xanh), rồi hiệu ứng                                                         | Cao        |
| Thông tin lá                                 | Panel "Thông tin/Skin": Tộc, Từ khóa, Miêu tả, **Hạn chế ("Trong cùng bộ bài được có tối đa 3 lá")**, **Kỹ năng tăng** (danh sách skill) | Cao        |
| Sát thương                                   | Số đỏ nổi "-1600" phía trên, LP đổi                                                                                                      | Cao        |

**Không thấy trong mẫu:** thao tác kéo thả, prompt Tribute, prompt "Kích hoạt?" (hỏi chain), Xác nhận/Hủy tribute, màn kết thúc trận, surrender, timer.
Mẫu 12s/frame quá thưa để kết luận là **không có**.

## Các màn khác (mô tả ngắn, chắc: cao ở mức tổng thể)

- **Menu chính** (frame đầu): nhân vật lớn bên trái; các hex "Bộ Bài", "Đấu Trường" (VS, lớn nhất giữa), "Tiệm Bài", "Hộp Ma Thuật", "Guild", "Thời Trang";
  thanh tài nguyên trên-phải (vàng 21590, ngọc 151); biểu tượng sự kiện/nhiệm vụ. Rất nhiều tính năng ngoài phạm vi (guild, gacha, sự kiện nạp).
- **Bộ Bài (Deck Builder)**: tab dọc trái **Quái / Phép / Bẫy / Dung Hợp**; lưới **5×2** lá/trang có mũi tên trang (vd "1/90 Trang"); dưới là **thanh deck**
  xếp ngang với nhãn số bản (x1/x2/x3), bên phải khung tổng "**50/60**" + "Quái 23 · Phép/Bẫy 27" + nút "Hero"(tên deck) và "Xóa"; nút "Phẩm chất"
  (sắp xếp), "Chọn lọc" (lọc), ô tìm kiếm, nút "THAM KHẢO". Mỗi lá trong kho có "0/1", "0/2"… (số đang dùng/giới hạn?). Tab Dung Hợp có khung "**20/20**" _(Extra Deck tối đa 20)_.
- **Tiệm Bài / Hộp Ma Thuật**: cửa hàng gói bài (gacha có tồn tại trong game gốc) — ngoài phạm vi v1 (G12).

## Nội dung lá bài nhìn thấy

- Lá có **art + khung màu (xanh lá = Fusion/hiệu ứng…)**, nhãn hiếm **UR/SR/GR**, thuộc tính biểu tượng góc phải trên, sao, ATK/DEF dưới; **Link monster có "LINK n"** thay DEF.
- Hiệu ứng viết dưới dạng **"Kỹ năng"** (skill) có tên riêng, có "Từ khóa" (archetype) — không phải văn bản YGO nguyên bản.

## Video #2: điều chỉnh/làm rõ (2026-09-20)

Nguồn: `sources.md`; bằng chứng chi tiết `rules-observed.md`, `timestamps-video2.md`. Chỉ những chỗ video #2 làm rõ hoặc mâu thuẫn video #1. Vẫn đọc bằng mắt, không đo pixel.

| Thành phần                         | Video #1                             | Video #2                                                                                                                                                                                                                        |
| ---------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ô "EX" giữa bàn                    | Có 2 ô EX (đỏ/xanh)                  | **KHÔNG THẤY** trong 4 ván. Bàn: 5 ô quái/bên, lưới nhỏ 2×3 bên phải mỗi bên, cột chồng bài bên trái, đường sáng ngang giữa bàn. Fusion lên **hàng quái thường** (25:41)                                                        |
| Lưới nhỏ bên phải (2 cột × 3 hàng) | Chưa rõ                              | Lá **úp của đối thủ** (ô cam) nằm ở lưới phải-trên (8:52.5, 9:00) → vùng Phép/Bẫy; ô ngôi sao dưới-cùng có thể là Field _(suy luận)_                                                                                            |
| Cột chồng bài trái                 | Chưa rõ; số đếm                      | Chồng có số tăng khi lá bị dùng/phá: +3 khi 3 nguyên liệu Dung hợp bị dùng (9→12, 25:37–25:40); Mộ đối thủ 4→5→6 khi quái bị phá (13:18–13:31). Mình có **3 chồng**, đối thủ 1 chồng ngửa + lá úp trên cùng (deck) _(suy luận)_ |
| Bộ đếm góc trên-trái               | Chưa rõ ("55"/"1")                   | "2" (10:04), "0" (18:26, không có lá úp phía trên) → có thể là **số lá trên tay đối thủ** _(suy luận, yếu)_                                                                                                                     |
| Nút hex phải-dưới                  | "Kết thúc"/"Công", không thanh phase | Có 3 trạng thái: **"Công"** (xám, khi đang animation), **"Kết thúc"** (xanh, bấm được), **"Thủ"** (lượt đối thủ); huy hiệu số tăng theo lượt. Không thanh phase (ủng hộ C4)                                                     |
| Cột trái                           | gear / "Điều khiển" / "x4"           | gear / "Điều khiển" (biểu tượng bàn tay) / **"x1"** → x1 & x4 là 2 giá trị của hex tốc độ _(suy luận)_                                                                                                                          |
| Banner đổi lượt                    | Không thấy                           | Banner giữa màn "Lượt ban đầu" / "Lượt của bạn" / "Lượt đối thủ" (đối thủ có banner)                                                                                                                                            |
| LP hai bên                         | Mình 10000                           | Mình **8000** ở cả 4 ván (C10)                                                                                                                                                                                                  |
| Số lượng deck                      | 50 (hiển thị "45" sau chia)          | **40** (40→35 sau chia bài)                                                                                                                                                                                                     |
| Tay đối thủ                        | 5 lá úp trên-giữa                    | Lá úp ở mép trên (thấy 4–5 lá lúc đầu ván); còn ở mép trên khi đối thủ có bài                                                                                                                                                   |
| Bong bóng đối thủ                  | Không thấy                           | Chỉ ở M4: "Đang suy nghĩ N" (đếm ngược) cạnh avatar đối thủ; "Thua rồi" khi thua                                                                                                                                                |
| Overlay chọn lá                    | Nền tối, "Đồng ý"                    | Xác nhận thêm: "Hãy chọn N Quái Hiến Tế", "Chọn mục tiêu dung hợp" (+ nút "Chọn"), "Chọn 3 nguyên liệu dung hợp" (nhãn "Bài trên Tay" dưới mỗi lá), "Chọn 1 mục tiêu"; nút "Đồng ý" xám→xanh                                    |
| Overlay bỏ bài                     | Không thấy                           | "Kéo bài trên tay đến khu này" + "Bài trên tay đã đầy, cần bỏ bớt 1 lá bài" (18:36)                                                                                                                                             |
| Màn kết quả                        | Không thấy                           | Nền cam + nhân vật, thanh EXP, "Phần Thưởng" (3 icon), nút "Trở về" / "Chia sẻ", popup nhiệm vụ (27:03.5)                                                                                                                       |
| Màn chọn đối thủ                   | Không thấy                           | Danh sách nhân vật + tab "Thường / Tinh Anh / Ác Mộng", panel "Bộ bài phòng thủ", "Điều kiện: Chiến thắng trong 20 lượt", VS (hai bàn tay, hai lá úp)                                                                           |

## Bổ sung từ video #3/#4 (2026-09-26) — UI quanh Phép/Bẫy

Tỉ lệ % theo khung 1920×1080 (đo trên frame 1280×720).

- **Bảng "Thông tin" lá** (xem lá, kể cả lá úp của mình): nền tối phủ toàn màn; khung mô tả x ≈ 23–66%, y ≈ 12–95% (mục "Miêu tả", "Hạn chế",
  "Kỹ năng Tăng"); tab "Thông tin" bên trái x ≈ 14–23%, y ≈ 21–31%; ảnh lá lớn x ≈ 67–86%, y ≈ 12–62%, nhãn loại ("Bài Bẫy"). **Không có nút** hành động.
- **Lá lớn khi kích hoạt Bẫy**: bên phải x ≈ 76–89%, y ≈ 24–58% (khung tím "Bài Bẫy"); ô Bẫy trên sân sáng viền xanh lá trước đó.
- **Cột Phép/Bẫy**: lưới 2 cột bên phải sân, x ≈ 81–93%; 3 hàng trên (y ≈ 8–38%) của đối thủ, 3 hàng dưới (y ≈ 44–75%) của mình. Lá úp = ô cam vân xoáy.
- **Overlay "Chọn kỹ năng muốn nhận"**: nền tối, tiêu đề giữa trên (y ≈ 11%), 2 thẻ lựa chọn ngang hàng (x ≈ 17–43% và 57–83%, y ≈ 35–50%), mỗi thẻ có
  biểu tượng tím + tên đỏ + mô tả.
- **Toast** ("Hiện tại Phép không có hiệu lực", "Không thể tấn công, hãy chọn mục tiêu khác"): bong bóng trắng nhỏ gần giữa-phải sân.
- **Không thấy**: hộp thoại "Kích hoạt?", nút Bỏ qua/Pass, đồng hồ đếm ngược phản ứng, số thứ tự chain.
