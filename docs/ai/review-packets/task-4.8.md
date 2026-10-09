# Review Packet — Task 4.8: Sửa lỗi "câu hỏi không ai trả lời được" + quái tự bấm hiệu ứng + "mỗi lượt 1 lần" (chỉ lõi luật)

**Đã làm gì (3 việc, đều ở lõi luật — bạn chưa thấy gì đổi trên màn hình):**

1. **Sửa lỗi thật tìm ra ở task 4.7** (mục P7): khi một quái đang mang lá Trang bị bị phá, game có thể hỏi một câu mà
   **mọi câu trả lời đều bị từ chối** — người bị hỏi chỉ còn nút Đầu hàng, và nếu là máy thì máy đứng hình. Nay không còn.
2. **Quái trên sân tự bấm hiệu ứng** (kiểu "trả 500 LP: gây 500 sát thương") — lõi luật đã làm được.
3. **Giới hạn "mỗi lượt 1 lần"** cho một hiệu ứng.

**Ba điều bạn nên biết trước khi đọc tiếp:**

- **Việc 2 và 3 đang nằm sau một công tắc TẮT.** Chưa ván nào (game, Sandbox, máy) dùng được, chưa lá thật nào có hiệu
  ứng bấm. Đúng như bạn chọn ở hộp thoại: nối vào màn hình + 3 lá thật là task **4.8b**. Vì vậy task này **không có ảnh**.
- **Không lá nào, bộ bài nào bị đổi.** 26 lá của 4.7 giữ nguyên (kể cả SMP-056 — bạn đã duyệt nó ở dạng "rút 1 lá").
- **Mọi ván đã ghi lại trước đây chạy ra đúng kết quả cũ, từng byte**: 30 ván mẫu ("golden") không đổi, và 370 ván ngẫu
  nhiên cũ đi đúng từng nước như trước (đo 3 lần: sau việc 1, sau việc 2–3, lúc cuối).

## 0. Phase 0 và câu trả lời của bạn (chi tiết: `task-4.8-triage.md`)

| Câu hỏi                                                  | Bạn chọn                           | Tôi đã làm theo thế nào                                                             |
| -------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------- |
| Phạm vi task                                             | **Tách 3 task** (4.8 / 4.8b / 4.9) | Task này chỉ lõi luật, công tắc tắt; 4.8b = màn hình + 3 lá thật; 4.9 = các mục sau |
| Quái vừa được triệu hồi có bấm hiệu ứng ngay được không? | **Được** (luật chuẩn)              | Không chặn theo lượt triệu hồi. (Tấn công thì vẫn phải chờ lượt sau — luật G22 cũ)  |
| "Mỗi lượt 1 lần" tính theo gì?                           | **Theo từng bản lá**               | 2 bản cùng tên: mỗi bản 1 lần. Bản rời sân rồi vào lại = bản mới                    |
| Task 4.7 (26 lá) đã duyệt chưa?                          | **Đã duyệt cả 26 lá**              | Ghi vào tài liệu. Bảng theo dõi vẫn 🟨 — chỉ bạn mới chuyển ✅                      |

Đường cơ sở trước khi sửa: lint + typecheck xanh; test shared 267, engine 1230, api 551, web 734; 30 ván mẫu.

## 1. Cách tự kiểm (không cần chạy lệnh, không cần đọc code)

Vì không có gì đổi trên màn hình, đây là bảng **TRƯỚC / SAU** lấy thẳng từ các test tôi viết trước khi sửa (lúc đó chúng đỏ,
giờ xanh). Bạn chỉ cần đọc cột "SAU" và tự hỏi: _"đây có đúng là điều mình muốn game làm không?"_

### 1a. Lỗi "câu hỏi không ai trả lời được"

Tình huống chung: **đối thủ** có một quái mang hiệu ứng _"khi bị phá: phá 1 Phép/Bẫy của đối phương"_ (đây là bản đầu của
SMP-056). **Bạn** gắn lá Trang bị "Xiềng Xích Rỉ Sét" (SMP-122, −600 ATK) lên quái đó rồi dùng quái mạnh hơn đánh chết nó.

| Bạn còn Phép/Bẫy nào khác trên sân?           | TRƯỚC (lỗi)                                                                                                                                                    | SAU                                                                                                                          |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Không (chỉ có lá Trang bị)                    | Game hỏi đối thủ "chọn 1 Phép/Bẫy để phá" và chỉ liệt kê lá Trang bị — lá đã vào mộ. Trả lời gì cũng bị từ chối, kể cả "Không". **Ván kẹt, chỉ còn Đầu hàng.** | **Không hỏi gì cả.** Lá Trang bị vào mộ cùng quái, hiệu ứng không có gì để nhắm nên không xảy ra. Bạn chơi tiếp bình thường. |
| Có 1 lá úp, hiệu ứng **tuỳ chọn**             | Game liệt kê 2 lá: lá Trang bị (đã vào mộ) + lá úp. Chọn lá Trang bị thì bị từ chối.                                                                           | Game chỉ liệt kê **lá úp**. Đối thủ chọn nó (lá úp bị phá) hoặc bấm "Không" (không có gì xảy ra).                            |
| Có 1 lá úp, hiệu ứng **bắt buộc**             | Game bắt đối thủ chọn giữa 2 lá, một lá là lá đã vào mộ.                                                                                                       | Chỉ còn đúng 1 mục tiêu nên **không hỏi**: lá úp của bạn bị phá ngay.                                                        |
| (Phòng xa) hiệu ứng được hỏi đã hết dùng được | Mọi câu trả lời đều bị từ chối.                                                                                                                                | Trả lời gì cũng được hiểu là "không kích hoạt"; các hiệu ứng xếp hàng phía sau vẫn chạy.                                     |

Trong mọi trường hợp: lá Trang bị **"được gửi vào mộ" cùng quái** (như cũ), không bao giờ "bị phá" bởi hiệu ứng kia.

### 1b. Quái tự bấm hiệu ứng (khi công tắc được bật — hiện đang TẮT)

Quái mẫu trong test: _"Trả 500 LP: gây 500 sát thương cho đối thủ"_.

| Tình huống                                                            | TRƯỚC                            | SAU, công tắc TẮT (mọi ván hiện nay) | SAU, công tắc BẬT (sẽ dùng ở 4.8b)                                                         |
| --------------------------------------------------------------------- | -------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------ |
| Quái ngửa của mình, Main Phase lượt mình, bấm hiệu ứng                | Bị từ chối (game không làm được) | Bị từ chối, y như trước              | **Được**: mình mất 500 LP, đối thủ mất 500 LP, **quái vẫn ở trên sân**                     |
| Quái vừa được triệu hồi trong lượt này                                | —                                | —                                    | **Bấm được ngay** (bạn chọn ở hộp thoại)                                                   |
| Bấm ở Battle Phase / trong lượt đối thủ / quái đang úp / quái đối thủ | —                                | —                                    | Bị từ chối                                                                                 |
| Bấm để đáp trả khi đang có chuỗi                                      | —                                | —                                    | Bị từ chối (hiệu ứng bấm của quái không dùng để đáp trả)                                   |
| Đối thủ có lá úp đáp trả được                                         | —                                | —                                    | Đối thủ được đáp trả trước; lá của họ thực hiện trước, rồi tới hiệu ứng quái               |
| Đối thủ dùng "Lời Ru Câm Lặng" (SMP-212, lá thật) để vô hiệu          | —                                | —                                    | Hiệu ứng không xảy ra; 500 LP đã trả **không hoàn**; quái **vẫn ở trên sân**               |
| Cost "bỏ 1 lá trên tay"                                               | —                                | —                                    | Người chơi chọn lá để bỏ; không chọn / chọn sai thì bị từ chối, không mất gì               |
| Cost "hiến tế 1 quái"                                                 | —                                | —                                    | Hiến tế **quái khác** thì được. Hiến tế **chính nó**: bị từ chối (chưa hỗ trợ — xem mục 5) |

### 1c. "Mỗi lượt 1 lần" (khi công tắc bật)

Quái mẫu: như trên, nhưng ghi thêm "mỗi lượt 1 lần".

| Tình huống                                                      | Kết quả                                                    |
| --------------------------------------------------------------- | ---------------------------------------------------------- |
| Bấm lần 2 trong cùng lượt (kể cả sang Main Phase 2)             | Bị từ chối, **không mất LP**; nút không còn được gợi ý     |
| Sang lượt sau của mình                                          | Bấm lại được                                               |
| Có 2 bản cùng tên trên sân                                      | Mỗi bản bấm được 1 lần (tổng 2 lần) — bạn chọn ở hộp thoại |
| Bản đã bấm bị phá / bị hiến tế rồi được gọi lại ngay trong lượt | Là bản mới: bấm lại được                                   |
| Lần bấm bị đối thủ vô hiệu                                      | **Vẫn tính là đã dùng** lượt này (luật chuẩn)              |
| Hiệu ứng **không** ghi "mỗi lượt 1 lần"                         | Bấm bao nhiêu lần cũng được, miễn trả đủ cost              |

### 1d. Công tắc tắt nghĩa là gì (đã kiểm ở phía server)

Tôi thử **cố bật** công tắc bằng mọi lối đang có: lúc tạo ván và trong một màn Sandbox ghi sẵn "bật". Server gỡ công tắc ở
cả hai lối: không liệt kê hiệu ứng quái, từ chối nếu ai gửi lên, máy không dùng, và dữ liệu gửi ra trình duyệt không có
dấu vết nào của công tắc.

## 2. Số liệu thật (đo trên máy này, 2026-10-09)

| Hạng mục                                             | Kết quả                                                                                                                                                                                      |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint` / `pnpm typecheck`                       | Xanh cả hai (lint còn 1 cảnh báo có từ task 4.5b ở một file test tôi không đụng)                                                                                                             |
| Test từng gói (chạy riêng)                           | shared **270** (trước 267) · engine **1300** (trước 1230; 100 file) · api **561** (trước 551; 42 file) · web **734** (không đổi) — tất cả xanh                                               |
| Test đỏ viết trước (`task-4.8-red.txt`)              | shared 2 / 65 đỏ · engine 36 / 44 đỏ · api (chặn công tắc) 4 / 7 đỏ — rồi xanh hết sau khi sửa                                                                                               |
| Ván mẫu ("golden")                                   | **30 ván cũ không đổi một byte** + 3 ván mới = 33 (1 cho lỗi câu hỏi, 2 cho quái bấm hiệu ứng)                                                                                               |
| Dấu vân tay 370 ván ngẫu nhiên cũ                    | **Giống hệt** trước / sau, đo 3 lần (nước đi + số liệu thống kê của từng ván)                                                                                                                |
| Fuzz lõi luật, bản dài (`task-4.8-fuzz-long.txt`)    | 7 nhóm bài × 200 seed × 400 bước = **560.000 bước, 0 vi phạm** (gồm phép kiểm mới "câu hỏi nào cũng trả lời được")                                                                           |
| Tình huống lỗi cũ có thật sự xảy ra trong fuzz không | Có: 27 lần "quái có hiệu ứng nhắm Phép/Bẫy bị phá khi mang lá Trang bị" trong 60 seed × 400 bước; 506 câu hỏi được kiểm                                                                      |
| Quái bấm hiệu ứng trong fuzz (công tắc bật)          | 173 lần bấm · 5 lần bị vô hiệu · 32 lần bị chặn vì "mỗi lượt 1 lần" · 13 lần dùng lại ở lượt sau · cost: trả LP 120, bỏ bài 37, hiến tế 2                                                    |
| Fuzz "không lộ bài" của server, bản dài              | 60 seed × 300 bước cho mọi biến thể: **275 / 275 xanh** (`task-4.8-leak-fuzz-long.txt`)                                                                                                      |
| Mô phỏng máy đấu (`task-4.8-ai-sim.txt`)             | 18 kiểu × 20 ván = **360 ván, 0 ván kẹt, 0 câu hỏi không trả lời được**, 0 nước bị từ chối (mọi bộ bài mẫu cũ + batch 2 + bộ bài dựng lại tình huống lỗi)                                    |
| Mutation (`task-4.8-mutants.txt`)                    | **21 / 21 bị giết bởi test hành vi** (test luật / fuzz / spec api); 0 mutant chỉ chết bởi ván mẫu; 0 mutant không biên dịch được. Bản "trả lại lõi luật như trước 4.8" bị cả 4 nhóm test bắt |
| Smoke qua HTTP thật (Docker + API)                   | `smoke-http` **38 / 38** · `smoke-sandbox` **116 / 116**                                                                                                                                     |
| `play-vs-ai` qua HTTP thật, từng bộ bài              | default 47 / 47 · effect 50 / 50 · batch1 74 / 74 · mech 116 / 116 · negate 66 / 66 · fusion 115 / 115 · batch2 79 / 79 · **field 69 / 71** (xem mục 3, điểm 10)                             |
| Dòng mã lõi luật đổi (không tính test)               | engine: +176 / −40 ở 7 file (riêng 2 chỗ sửa lỗi: +17 / −6) · shared: +13 · api: +26 / −3 và 1 file mới 32 dòng · web: 2 câu chữ                                                             |

## 3. Lệch kế hoạch / nói thẳng

1. **Công tắc không có "giá trị mặc định là tắt" mà là "vắng mặt = tắt".** Brief bảo làm theo mẫu một công tắc cũ (có ghi
   sẵn `false`). Làm vậy thì cả 30 ván mẫu đổi byte (chúng lưu nguyên bảng cấu hình) — trái đúng ràng buộc cứng của brief.
   "Vắng mặt = tắt" cho cùng hành vi mà không đổi byte nào. Tôi nêu điều này trong plan trước khi làm.
2. **Brief ghi mã lỗi hiện tại của quái trên sân là `NOT_A_SPELL_TRAP`; thực tế là `CARD_NOT_IN_HAND`.** "Công tắc tắt = y
   như cũ" được hiểu là giữ đúng mã thật (có test ghim).
3. **Màn Sandbox tự nhận công tắc mới** (khuôn của nó sao theo bảng cấu hình), nên tôi phải chặn ở server tại 2 chỗ, không
   phải 1 như dự kiến lúc đầu.
4. **Quái tự hiến tế chính nó làm cost**: mã cũ vô tình cho phép. Tôi **chặn lại** thay vì đoán nó nên chạy thế nào (mục 5).
5. **Một lần chạy `pnpm test` cả kho đã đỏ vì tôi**: bản đầu của phép kiểm "câu hỏi nào cũng trả lời được" quá nặng, làm bộ
   test chậm gấp đôi; khi 4 gói chạy song song, một test của api (giới hạn 5 giây) quá giờ. Tôi đổi sang cách kiểm rẻ hơn
   (chỉ thử các câu trả lời của câu hỏi, không thử mọi nước đi) và cho 2 biến thể test mới chạy ít ván hơn. Chạy lại:
   api xanh 561 / 561, không còn test nào quá giờ. Nhưng lượt chạy cả kho vẫn không cho số của engine (điểm 6), nên engine tôi chạy riêng: 1300 / 1300. Sau lần giảm tải cuối tôi **không** chạy lại cả kho thêm lần nữa.
6. **`pnpm test` cả kho vẫn thoát mã 1 dù mọi test xanh** — hiện tượng có từ trước (đã thấy ở đường cơ sở): api báo
   `Timeout calling "onTaskUpdate"` khi máy quá tải. Số liệu ở mục 2 lấy từ từng gói chạy riêng.
7. **Test viết sau code (khai thật):** các test ngẫu nhiên / ván mẫu / mô phỏng (chúng cần lá thử và bộ đếm mới), và 2
   test luật tôi thêm khi rà mutant: "bị phá trong chiến đấu rồi được gọi lại vẫn là bản mới", "đối thủ đang giữ quyền đáp
   trả trong lượt mình không bấm được quái của họ". Mọi test luật còn lại viết trước và đã đỏ (`task-4.8-red.txt`).
8. **Một chỗ tôi cố ý không sửa:** khi nhiều hiệu ứng đang thực hiện nối tiếp, một hiệu ứng vẫn có thể "phá" một lá Trang bị
   đang trên đường vào mộ (nhật ký ghi "bị phá" thay vì "gửi vào mộ"). Không gây kẹt; sửa là đổi hành vi cũ ngoài phạm vi.
9. **Lá thử chỉ nằm trong test** (`P7_*`, `IGN_*`, `MDS`, `MIP`…, `T48-*`): không lá nào vào bộ bài thật. 10. **`play-vs-ai` với bộ bài Môi trường (field) lúc đạt lúc thiếu 2 kiểm tra.** Tôi chạy thêm 7 lần: 4 lần đạt hết, 3 lần
   thiếu đúng 2 kiểm tra "đã Úp một lá Môi trường" (ván chia không cho người chơi của công cụ làm việc đó). Không lần nào
   trượt kiểm tra lộ bài hay hành vi của máy. Tôi **chưa** chạy công cụ trên bản trước task 4.8 để so; tôi chỉ lập luận
   rằng nó không do task này (công tắc tắt thì lõi luật cho đúng kết quả cũ). Nên sửa công cụ cho hết phụ thuộc ván chia,
   như đã làm với bộ bài negate ở 4.7 — tôi chưa làm vì ngoài phạm vi.
10. **Tôi tự bật Docker Desktop** để chạy phần smoke; API đã tắt sau khi xong, Docker vẫn đang chạy.
11. **Thời gian chạy test tăng**: bộ test engine chạy riêng mất khoảng 2,5 phút (thêm 70 test, trong đó có 2 biến thể fuzz).

## 4. Việc cần bạn

1. ~~Trả lời 2 câu ở hộp thoại cuối task~~ — đã xong (mục 5).
2. Đọc bảng TRƯỚC / SAU ở mục 1; thấy chỗ nào khác ý bạn thì nói, tôi sửa ở 4.8b.
3. Nếu đồng ý với bản nháp: tự chuyển ô "Batch 2" (4.7) và các ô 4.8 ở `docs/plan/parity-board.md` sang ✅ khi bạn muốn.
4. Cho làm **4.8b** (đề xuất ở mục 6).

## 5. Hai câu đã hỏi bạn ở hộp thoại cuối task

| #   | Câu hỏi                                                                                              | Hiện đang làm                                                                |
| --- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | Quái hiến tế **chính nó** để trả cost của hiệu ứng của nó ("Hiến tế lá này: …")                      | **Từ chối** (chưa hỗ trợ); để dành cho task 4.9                              |
| 2   | Quái đã bấm hiệu ứng nhưng bị đưa khỏi sân **trước khi hiệu ứng thực hiện** (đối thủ đáp trả phá nó) | Hiệu ứng **vẫn thực hiện** (giống hiệu ứng "khi triệu hồi / bị phá" lâu nay) |

**Bạn đã trả lời cả 2 câu (2026-10-10), đều chọn "giữ":** quái tự hiến tế chính nó **vẫn bị từ chối**, làm ở 4.9; hiệu ứng
**vẫn thực hiện** khi quái đã rời sân. Bảng duyệt luật: 11 dòng mới đều đã có dấu duyệt, **còn đúng 1 ô trống** như trước
(G26 f — nguyên liệu Dung hợp từ Bộ bài, chờ tư liệu).

## 6. Đề xuất nội dung task 4.8b (nối màn hình + lá thật)

1. **Bật công tắc** cho ván thật (bỏ khỏi danh sách chặn ở server) và đưa lên màn hình: **chạm quái ngửa của mình** có
   hiệu ứng bấm được ⇒ viền sáng + mục "Kích hoạt hiệu ứng" (cùng menu với đổi thế / lật), chọn lá trả cost, chọn mục tiêu.
2. **Dấu "đã dùng lượt này"** trên quái (server gửi kèm, màn hình không tự đoán).
3. **3 lá thật** (đề xuất): quái "trả 500 LP: gây 500 sát thương, mỗi lượt 1 lần"; quái "bỏ 1 lá: rút 1 lá, mỗi lượt 1
   lần"; quái "mỗi lượt 1 lần: phá 1 Phép/Bẫy úp của đối thủ". Tên / chỉ số là placeholder tự đặt.
4. Nhật ký + animation cho "quái kích hoạt hiệu ứng"; 2–3 màn Sandbox; ảnh thật; bộ bài mẫu có 3 lá đó.
5. **Máy (AI)**: câu hỏi cho bạn ở 4.8b — máy có được bấm hiệu ứng quái không, hay để tới P8 như các lá khác.
6. Cổng kiểm "không lộ bài" thêm biến thể cho hiệu ứng quái; mô phỏng máy với bộ bài mới.

Sau đó **4.9**: hiệu ứng tự nổ trả giá bằng bỏ bài / hiến tế (cần bước hỏi "bỏ lá nào"), đổi thế quái, gửi bài vào mộ.

## 7. File đổi (tóm tắt)

- **Lõi luật** (`packages/game-engine/src`): `effects/triggers.ts` + `actions/handlers/trigger-activation.ts` (sửa lỗi);
  `actions/handlers/activate-effect.ts`, `effects/activation-candidates.ts`, `state/types.ts`, `errors.ts` (quái bấm hiệu
  ứng, mỗi lượt 1 lần); `legal-actions.ts` (đường kiểm "câu hỏi có câu trả lời").
- **Dữ liệu dùng chung** (`packages/shared/src`): `rules/ruleset-config.ts` (công tắc), `effects/effect-definition.ts`
  (`oncePerTurn`).
- **Server** (`apps/api/src/modules/duels`): `wire-ruleset.ts` (mới), `duel-manager.ts` (gỡ công tắc), `ai/simulate.ts`
  (đếm câu hỏi không trả lời được). **Web**: 1 câu báo lỗi (vi / en).
- **Test**: engine `rules/p7-orphan-equip-trigger.test.ts` (10), `rules/monster-ignition.test.ts` (36), fuzz + property +
  3 ván mẫu; shared 3 test; api `monster-effect-containment.spec.ts` (7), `ai/simulate.equip-trigger.spec.ts` (3), 15 dòng
  kiểm mới ở 7 spec mô phỏng cũ. Lá thử: `testing/sample-card-kit.ts`.
- **Công cụ**: `tools/mutants-4.8.mjs`.
- **Tài liệu**: ADR 071, `DECISIONS` / `INDEX` / `LESSONS` / `OPEN-ISSUES` (xoá P7) / `PROGRESS` + `progress/p4.md`,
  `design/engine.md`, `design/effect-dsl.md`, `plan/fidelity-spec.md` (G28), `rules-coverage`, `MASTER-PLAN` (4.8 nháp, thêm
  4.8b + 4.9), `card-and-effect-plan`, `parity-board` (🟨), `RULES-REVIEW-SHEET` (+11 dòng), `CLAUDE.md` của engine và api.
- **Báo cáo đo** (`docs/ai/review-packets/task-4.8-*`): `triage`, `red`, `mutants`, `fuzz-long`, `leak-fuzz-long`, `ai-sim`,
  `smoke-http`, `smoke-sandbox`, `play-vs-ai`.
- 6 commit trên nhánh `dev` (0/5 … 5/5), **chưa push**.
