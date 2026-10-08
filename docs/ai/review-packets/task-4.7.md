# Review Packet — Task 4.7: Lô bài thứ 2 (26 lá mới, chỉ bằng dữ liệu) + Phase 0

**Đã làm gì:** Thêm **26 lá mới** vào game — 12 quái có hiệu ứng, 2 quái Dung hợp, 8 Phép, 4 Bẫy — **không sửa một dòng nào
của lõi luật**: mọi lá đều ghép từ những "viên gạch" hiệu ứng đã có. Kèm một bộ bài mẫu 40 lá để chơi thử, 3 màn dựng sẵn
ở Sandbox, và bảng "còn thiếu gì" cho task sau.

**Hai điều bạn nên biết trước khi đọc tiếp:**

1. **Tìm ra một lỗi thật của lõi luật (chưa sửa — mục 6).** Khi một quái đang mang lá Trang bị bị phá, game có thể hỏi một
   câu mà **không ai trả lời được** (chỉ còn nút Đầu hàng). Lỗi có từ trước, lô bài này làm nó dễ gặp hơn. Tôi **không sửa
   lõi** (đúng ràng buộc của task) mà đổi hiệu ứng 1 lá (SMP-056) để lô bài không chạm lỗi; cần bạn cho làm task sửa riêng.
2. **Brief đòi 2 quái "tự bấm kích hoạt trên sân" — game chưa làm được việc đó.** Tôi đã hỏi bạn qua hộp thoại, bạn chọn
   "thay bằng lá khác". Vẫn đủ 12 quái.

**Engine production: 0 dòng đổi; 30 golden giữ nguyên từng byte.**

## 0. Kết quả Phase 0 (chi tiết: `task-4.7-triage.md`)

| Mục                                     | Kết quả                                                                                                                                                                                                                       |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0a — hỏi hướng thiết kế                 | 5 câu, **bạn trả lời cả 5** (không câu nào tôi tự lấy mặc định): 24 lá · mức mạnh cổ điển · có 2 quái Dung hợp · G22 giữ nguyên · quái "tự kích hoạt": thay bằng lá khác                                                      |
| 0b — sheet duyệt luật                   | Vẫn **1 ô trống** (G26 f, chờ tư liệu). Task này **không thêm dòng nào** (không đổi luật) ⇒ không có câu hỏi cuối task                                                                                                        |
| 0c — `play-vs-ai` deck negate chập chờn | **Có từ trước task 4.5**: thiếu 2 kiểm tra ở 4 / 5 lần (HEAD) và 5 / 5 lần (commit `7acddab`). Nguyên nhân: máy co về thủ nên không cửa sổ phản ứng nào mở. **Chỉ sửa công cụ** → 5 / 5 lần đạt. Không rò thông tin ở lần nào |

## 1. Danh sách 26 lá

Tên, chỉ số đều là **placeholder tôi tự đặt** (không dùng tên / hình Konami). Chưa có hình: vẽ khung trống.

| Mã      | Tên                 | Loại                                  | Hiệu ứng (một dòng)                                                          |
| ------- | ------------------- | ------------------------------------- | ---------------------------------------------------------------------------- |
| SMP-048 | Y Sĩ Suối Nguồn     | Quái NƯỚC, Cấp 3, 1100 / 1300         | Khi được triệu hồi: hồi 500 LP (bắt buộc)                                    |
| SMP-049 | Xạ Thủ Đầm Sương    | Quái GIÓ, Cấp 4, 1300 / 1000          | Khi được triệu hồi: có thể trả 800 LP để phá 1 quái ngửa Cấp ≤ 4 của đối thủ |
| SMP-050 | Kẻ Gọi Bầy          | Quái ĐẤT (Thú), Cấp 4, 1400 / 1000    | Khi được triệu hồi: có thể gọi 1 quái Cấp ≤ 3 từ tay ra sân ở thế Thủ        |
| SMP-051 | Thủ Thư Phủ Bụi     | Quái ÁNH SÁNG, Cấp 2, 500 / 1300      | LẬT: rút 1 lá (bắt buộc)                                                     |
| SMP-052 | Chuột Chũi Đào Hầm  | Quái ĐẤT (Thú), Cấp 2, 600 / 1000     | LẬT: có thể phá 1 Phép/Bẫy của đối thủ                                       |
| SMP-053 | Nấm Bào Tử Nổ       | Quái ĐẤT, Cấp 1, 300 / 700            | LẬT: gây 600 sát thương (bắt buộc)                                           |
| SMP-054 | Lãnh Chúa Gò Mộ     | Quái BÓNG TỐI, Cấp 5, 2000 / 1500     | Khi bị phá: có thể gọi 1 quái Cấp ≤ 4 từ mộ mình ra sân ở thế Thủ            |
| SMP-055 | Đá Nổ Lăn Dốc       | Quái LỬA (Đá), Cấp 3, 1200 / 600      | Khi bị phá: gây 500 sát thương (bắt buộc)                                    |
| SMP-056 | Bóng Ma Thợ Rèn     | Quái LỬA, Cấp 4, 1500 / 1100          | Khi bị phá: có thể trả 500 LP để rút 1 lá _(đã đổi — xem mục 6)_             |
| SMP-057 | Sói Đầu Đàn Bờm Xám | Quái ĐẤT (Thú), Cấp 4, 1500 / 1200    | Khi ngửa trên sân: các quái Thú khác của mình +200 ATK                       |
| SMP-058 | Kẻ Nuốt Hoàng Hôn   | Quái BÓNG TỐI, Cấp 4, 1600 / 1000     | Khi ngửa trên sân: quái ÁNH SÁNG của đối thủ −400 ATK                        |
| SMP-059 | Thợ Xây Thành Luỹ   | Quái ĐẤT (Đá), Cấp 3, 800 / 1700      | Khi ngửa trên sân: quái Đá của mình (kể cả nó) +400 DEF                      |
| SMP-060 | Chúa Tể Bầy Hoang   | Quái **Dung hợp**, Cấp 6, 2400 / 1800 | = "Sói Đầu Đàn Bờm Xám" + "Kẻ Gọi Bầy". Không hiệu ứng                       |
| SMP-061 | Bạo Chúa Mộ Đêm     | Quái **Dung hợp**, Cấp 7, 2500 / 2000 | = "Kẻ Nuốt Hoàng Hôn" + "Lãnh Chúa Gò Mộ". Quái đối thủ −200 ATK             |
| SMP-117 | Lệnh Thanh Trừng    | Phép thường                           | Bỏ 1 lá trên tay: phá 1 quái ngửa Cấp ≤ 4 của đối thủ                        |
| SMP-118 | Lễ Vật Tri Thức     | Phép thường                           | Hiến tế 1 quái: rút 2 lá                                                     |
| SMP-119 | Cơn Gió Giật        | Phép Tức thời                         | Phá 1 Phép/Bẫy của đối thủ                                                   |
| SMP-120 | Phục Binh Bụi Rậm   | Phép Tức thời                         | Gọi 1 quái Cấp ≤ 4 từ tay ra sân ở thế Thủ                                   |
| SMP-121 | Khiên Tháp Canh     | Phép Trang bị (quái mình)             | Quái được trang bị +300 ATK, +700 DEF                                        |
| SMP-122 | Xiềng Xích Rỉ Sét   | Phép Trang bị (**quái đối thủ**)      | Quái được trang bị −600 ATK                                                  |
| SMP-123 | Nghi Lễ Chạng Vạng  | Phép Liên tục                         | Khi kích hoạt: hồi 500 LP. Quái BÓNG TỐI của mình +300 ATK                   |
| SMP-124 | Đồng Bằng Phì Nhiêu | Phép Môi trường                       | Mọi quái ĐẤT trên sân (hai bên) +200 ATK, +200 DEF                           |
| SMP-211 | Trỗi Dậy Lần Hai    | Bẫy thường                            | Bỏ 1 lá trên tay: gọi 1 quái từ mộ mình ra sân ở thế Thủ                     |
| SMP-212 | Lời Ru Câm Lặng     | Bẫy thường                            | Khi đối thủ kích hoạt hiệu ứng của một quái: vô hiệu việc kích hoạt đó       |
| SMP-213 | Hàng Khiên Kiên Cố  | Bẫy Liên tục                          | Quái của mình +400 DEF                                                       |
| SMP-214 | Kết Giới Phản Phép  | Bẫy Phản công                         | Bỏ 1 lá trên tay: vô hiệu việc kích hoạt 1 lá Phép của đối thủ               |

Bộ bài mẫu: `BATCH2_DEMO_DECK` (40 lá: đủ 24 lá trên + 2 lá "Lò Hợp Thể" + 6 quái thường) và `BATCH2_FUSION_EXTRA_DECK` (4 lá).

## 2. Cách tự test tay (không cần đọc code)

Cần Docker Desktop đang chạy, rồi `pnpm dev`. Mở `http://localhost:5173/dev/sandbox.html`, chọn mẫu ở ô thả xuống, bấm **Nạp**.

1. **`equip-opponent-real`** — kéo lá "Xiềng Xích Rỉ Sét" (lá đầu trên tay) thả vào một ô Phép/Bẫy của mình → chọn **Kích
   hoạt**. Mong đợi: có đường nối từ lá tới quái của đối thủ, số ATK của nó đổi 1800 → **1200**. Bấm "Phase tiếp theo" sang
   Battle, kéo quái mình vào quái đó: nó bị phá, đối thủ mất 300 LP, lá Trang bị vào mộ **của bạn**.
2. **`beast-pack-real`** — kéo "Sói Đầu Đàn Bờm Xám" ra sân → **Triệu hồi**: "Rùa Lưng Rêu" bên cạnh đổi 900 → **1100** ATK.
   Kéo "Đồng Bằng Phì Nhiêu" vào ô Môi trường → **Kích hoạt**: hai quái của bạn thành 1700 / 1400 và 1300 / 1600; quái NƯỚC
   của đối thủ không đổi.
3. **`revive-on-destroyed-real`** — kéo "Lãnh Chúa Gò Mộ" vào "Rồng Tro Tàn" của đối thủ (mạnh hơn): quái bạn bị phá, mất 700
   LP, hiện dải "Chọn từ mộ" với đúng 1 lá. Chạm lá đó → **Kích hoạt**: "Y Sĩ Suối Nguồn" trở lại ở thế Thủ, rồi bạn hồi 500
   LP (LP cuối: **7800**). Bấm **Không** thì không có gì xảy ra.
4. (Tuỳ chọn) chơi cả ván bằng bộ bài mẫu: `DECK=batch2 node --experimental-strip-types tools/play-vs-ai.ts` (cần API chạy).

## 3. Ảnh thật (`docs/ai/review-packets/task-4.7-screens/`, 15 ảnh — tôi đã mở xem cả 15)

| Ảnh        | Cho thấy                                                                         |
| ---------- | -------------------------------------------------------------------------------- |
| 01, 06     | Khung mô tả lá "Xiềng Xích Rỉ Sét" (trên tay / trên sân) — chữ không tràn        |
| 02, 03     | Kéo lá Trang bị: 5 ô Phép/Bẫy sáng lên; menu "Kích hoạt / Úp"                    |
| 04, 05     | Lá nằm ở ô **của mình**, đường nối tới quái **đối thủ**, ATK 1200 (in 1800)      |
| 07, 08, 09 | Mô tả "Sói Đầu Đàn Bờm Xám"; menu "Triệu hồi / Úp"; quái Thú bên cạnh 900 → 1100 |
| 10, 11     | Phép Môi trường đang hiệu lực: 1700 / 1400 và 1300 / 1600; mô tả lá              |
| 12         | Mô tả dài nhất của lô ("Lãnh Chúa Gò Mộ", 5 dòng) — vừa khung                    |
| 13, 14     | Bị phá → dải "Chọn từ mộ", nút "Kích hoạt" chỉ sáng sau khi chọn lá              |
| 15         | "Y Sĩ Suối Nguồn" ở thế Thủ, LP 7800, nhật ký đủ hai chuỗi                       |

**Quan sát từ ảnh (không sửa trong task này):** chữ mô tả lá **không tràn khung** ở 4 lá
đã chụp, trong đó có lá dài nhất của lô (SMP-054: 138 ký tự tiếng Việt, 5 dòng) — 22 lá còn lại ngắn hơn nên tôi không chụp
riêng; bản tiếng Anh của SMP-054 dài hơn (162 ký tự) **chưa chụp** (trang Sandbox chỉ tiếng Việt); tên dài trên mặt lá
nhỏ bị xuống dòng và chạm dấu "đang hiệu lực" (ảnh 10: "Đồng Bằng Phì Nhiêu"); ảnh 10 chụp khi khung mô tả còn hiện lá vừa
rê chuột trước đó.

## 4. Số liệu thật

| Hạng mục                                          | Kết quả                                                                                                                                                                                                                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test đỏ trước (`task-4.7-red.txt`)                | shared 30 / 31 đỏ, engine 118 / 124 đỏ trước khi có dữ liệu; sau khi thêm dữ liệu **124 / 124 xanh ngay lần đầu**                                                                                                                                                   |
| Test toàn bộ                                      | shared **267** (+37) · engine **1230** (+133) · api **551** (+19) · web **734** (=) — tất cả đạt                                                                                                                                                                    |
| Lint / typecheck / build                          | 4 / 4 · 6 / 6 · 4 / 4 (1 cảnh báo lint có từ trước ở `duel-manager.scenario-fusion.spec.ts`)                                                                                                                                                                        |
| Engine production                                 | `git diff b550a41 -- packages/game-engine/src` (trừ test) **rỗng**; golden 0 / 30 đổi                                                                                                                                                                               |
| Mutation trên dữ liệu lá (`task-4.7-mutants.txt`) | **98 / 98 bị bắt**: 95 mutant trên lá, mỗi cái bị bắt bởi **test hành vi của chính lá đó**; 3 mutant deck. 0 sống, 0 không biên dịch được. (Lần chạy đầu ghi 97 / 98: cái thứ 98 là mẫu chuỗi tôi viết sai trong script, không phải mutant sống — đã sửa, chạy lại) |
| Fuzz engine dài (`task-4.7-fuzz-long.txt`)        | Pool lá thật: **200 seed × 400 bước, 0 vi phạm**. 50 seed cũ: dấu vân tay nhật ký trước / sau **giống hệt**                                                                                                                                                         |
| Fuzz chống rò dài (`task-4.7-leak-fuzz-long.txt`) | 60 seed hai-ghế + 30 seed đấu-với-máy × 300 bước = **25.725 bước, 0 vi phạm**; 235 lần gọi quái từ tay, 226 từ mộ, 450 lần bỏ bài, 26 lần mục tiêu trên tay bị lọc khỏi phía đối thủ                                                                                |
| Mô phỏng AI (`task-4.7-ai-sim.txt`)               | **100 ván × 3 kiểu = 300 ván, 0 ván kẹt**, 0 nước bị từ chối, máy không tự Úp / kích hoạt Phép-Bẫy ngoài cửa sổ                                                                                                                                                     |
| Chạy thật qua HTTP                                | `smoke-http` 38 / 38 · `smoke-sandbox` 116 / 116 · `play-vs-ai`: mặc định 71 / 71, effect 62 / 62, negate 83 / 83 (2 ván), fusion 157 / 157 (2 ván), **batch2 83 / 83** (`task-4.7-play-vs-ai.txt`)                                                                 |

## 5. Còn thiếu gì → đề xuất task 4.8

Bảng đầy đủ ở `docs/plan/card-and-effect-plan.md` mục "Còn thiếu gì". Tóm tắt theo ưu tiên:

| Còn thiếu                                                                                      | Lá đã không làm được                                   | Ưu tiên    |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------- |
| Sửa lỗi "câu hỏi không ai trả lời được" (mục 6)                                                | Bản đầu của SMP-056; mọi lá "bị phá: phá 1 Phép/Bẫy"   | Cao nhất   |
| Quái trên sân tự kích hoạt hiệu ứng + giới hạn "mỗi lượt 1 lần"                                | 2 quái brief yêu cầu (trả LP / bỏ bài để gây hiệu ứng) | Cao        |
| Hiệu ứng tự nổ của quái trả giá bằng bỏ bài / hiến tế                                          | "Khi triệu hồi: bỏ 1 lá để…"                           | Trung bình |
| Đổi thế quái; trả bài về tay; gửi bài vào mộ; buff "tới hết lượt"                              | Các lá khống chế / bounce / buff tạm kiểu cổ điển      | Trung bình |
| Hiệu ứng "khi tấn công / khi gây sát thương / đầu mỗi phase"; lọc theo ATK; tìm bài trong Deck | Lô 3 trở đi                                            | Thấp       |

**Đề xuất 4.8 (primitive set 1):** (1) sửa lỗi mục 6; (2) quái tự kích hoạt + "mỗi lượt 1 lần" (có thể tách phần lõi và phần
màn hình như 4.4 / 4.4b); (3) trả giá có chọn lá cho hiệu ứng tự nổ; (4) đổi thế quái. Mỗi mục kèm 2–3 lá thật.

## 6. Lệch kế hoạch / nói thẳng

- **Lỗi lõi luật tìm ra, CHƯA sửa** (`docs/ai/OPEN-ISSUES.md` P7). Tái hiện bằng 3 thao tác với bản đầu của SMP-056: trang bị
  "Xiềng Xích Rỉ Sét" lên SMP-056 của đối thủ rồi tấn công phá nó → đối thủ bị hỏi "chọn Phép/Bẫy để phá" với ứng viên duy
  nhất là chính lá Trang bị vừa vào mộ → không đáp án nào được nhận, kể cả "Không" → chỉ còn Đầu hàng (ghế máy thì báo lỗi).
  Tìm ra nhờ kiểu mô phỏng "hai ghế cùng chơi hết bài" (ván thứ 7). Fuzz lõi không bắt vì nó coi "Đầu hàng" là còn đường
  đi. **Cách xử lý ở task này:** đổi SMP-056 thành "trả 500 LP: rút 1 lá" (không mục tiêu) + test giữ tình huống. **Chưa
  hết:** với lá cũ, lỗi vẫn tới được qua một chuỗi nhiều mắt xích hiếm gặp (SMP-020 được gọi ra trong cùng chuỗi có một quái
  mang Trang bị bị phá).
- **Quái `Ignition` của brief không làm** (bạn đã chọn "thay bằng lá khác"): hai lá thay là SMP-049 và SMP-056 (hiệu ứng tự
  nổ trả LP); "bỏ bài" dùng ở SMP-117 / 211 / 214.
- **"Mỗi cơ chế ≥ 2 lần" không đạt cho 4 thứ:** hiến tế làm giá (1 lần), vô hiệu đòn tấn công / vô hiệu triệu hồi / Dung hợp
  (0 lần mới — đã có lá từ task trước; lô chỉ có 4 Bẫy).
- **Brief ghi "70 lá hiện có"; đếm lại là 73.** Test tôi viết trước theo con số 70 nên phải sửa số sau lần chạy đầu.
- **Hai test cũ phải ghim lại** vì chúng giả định "4 lá Fusion là cuối danh sách" và "mọi quái Fusion của pool nằm trong
  Extra Deck mẫu của 4.5b" (`fusion.test.ts`, `fusion-demo-deck.test.ts`). Không test cũ nào bị nới.
- **Test viết sau code:** `smp-056.test.ts` (viết lại sau khi đổi lá), các test fuzz / mô phỏng / scenario, variant chống rò.
- **Một kiểm tra tôi tự thêm rồi tự sửa:** ở `play-vs-ai DECK=batch2` lúc đầu tôi đòi "máy không kích hoạt lá nào" — sai, vì
  từ task 3.4b máy được dùng Phép Tức thời gây hại trong cửa sổ nó giữ (nó đã dùng "Cơn Gió Giật" 1 lần). Kiểm tra đúng là
  "máy không tự Úp"; số lần máy kích hoạt được in ra.
- **Bộ sinh nước đi của fuzz lõi có 1 dòng đổi** (`effect?.id ?? 'e1'`): thiếu nó thì Phép/Bẫy thật không bao giờ được kích
  hoạt (độ phủ 0). Đã chứng minh không đổi ván của 50 seed cũ.
- **Không thêm golden mới** (brief ghi "nếu có lợi"): 26 file test từng lá đã có snapshot sự kiện; engine không đổi.
- **Sheet luật không có dòng mới** — vì task không đổi luật; điều cần duyệt là lỗi ở gạch đầu dòng thứ nhất.
- **Môi trường:** tôi tự bật Docker Desktop (Postgres) để chạy smoke; API và dev server **đã tắt**; Docker Desktop **còn
  chạy**. Worktree tạm của commit `7acddab` đã xoá.

## 7. Việc cần bạn

1. **Cho làm task sửa lỗi lõi P7** (đề xuất: mục đầu của 4.8) — hoặc cho biết muốn tách riêng.
2. Duyệt 26 lá (tên, chỉ số, hiệu ứng) — sửa tên / số nào cứ ghi, đó chỉ là dữ liệu.
3. Chốt phạm vi 4.8 (mục 5).
4. Hình cho 26 lá: đã ghi ở `docs/assets/ASSET_REQUESTS.md` (không chặn việc gì).

## 8. File đổi (tóm tắt)

- **shared:** `cards/sample-cards.ts` (+26 lá ở cuối), `cards/batch2.test.ts`, `deck/batch2-demo-deck.ts` + test, `index.ts`,
  3 scenario `scenarios/{equip-opponent,beast-pack,revive-on-destroyed}-real.json`; ghim lại 2 test Fusion cũ.
- **engine (chỉ test):** 26 file `cards/sample/smp-*.test.ts` + snapshot, `testing/sample-card-kit.ts`,
  `testing/fuzz/fuzz.ts` + `fuzz.test.ts`, `legal-actions.property.test.ts`.
- **api (chỉ test):** `event-visibility.fuzz.spec.ts` (bộ lọc `BATCH2_CARDS`, variant thứ sáu, `newStats`),
  `duel-manager.scenario-batch2.spec.ts`, `ai/simulate.batch2-deck.spec.ts`, `dev-sandbox/scenario-to-state.spec.ts`.
- **tools:** `play-vs-ai.ts` (negate hết chập chờn, `DECK=batch2`), `smoke-sandbox.ts`, `mutants-4.7.mjs`,
  `ui-batch2-shots.ts`.
- **docs:** ADR 070, `DECISIONS` / `INDEX` / `LESSONS` / `OPEN-ISSUES` (P7) / `PROGRESS` / `progress/p4.md`,
  `card-and-effect-plan` (bảng còn thiếu), `parity-board` (Batch 2 🟨), `MASTER-PLAN`, `rules-coverage`, `effect-dsl`,
  `ASSET_REQUESTS`, `CLAUDE.md` của engine + api, các file `task-4.7-*`.
