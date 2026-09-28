# Review Packet — Task 3.7: UI chuỗi trong Phaser (Frontend, chỉ `apps/web`)

**Đã làm gì:** Màn đấu Phaser giờ dùng được chuỗi theo **C13**. Lá úp của bạn kích hoạt được thì có **viền tím**, chạm vào là kích
hoạt luôn, không có hộp thoại. Nút **Bỏ qua** hiện ở chỗ "Phase tiếp theo" khi đến lượt bạn đáp trả. Có dải **banner tím** báo đang
chờ phản ứng. Prompt trigger hiện overlay **Kích hoạt / Không**. ATK/DEF bị buff/debuff hiện **xanh/đỏ** trên lá. Engine/API/shared
**0 dòng đổi**.

**Cách xem** (không cần API/Docker):

1. `pnpm --filter @yugi/web dev`, rồi mở:
   - `http://localhost:5173/?fixture=chain-reaction`: AI đang tấn công, bạn giữ quyền đáp trả. Chạm lá úp viền tím (ô Phép/Bẫy thứ 2)
     → log ghi `sẽ gửi: ActivateEffect…`. Tải lại trang, bấm **Bỏ qua** → log ghi `sẽ gửi: PassPriority`.
   - `?fixture=chain-respond`: chuỗi 1 mắt xích của đối thủ, 2 lá úp đáp trả được; "Pháp Sư Triều Dâng" hiện ATK **1800** màu xanh
     (rê chuột: panel ghi thêm "chỉ số in: ATK 1500"); quái đối thủ hiện DEF màu đỏ.
   - `?fixture=trigger-optional`: overlay "Kích hoạt hiệu ứng của Kỵ Sĩ Mồi Lửa (thử)?". Chọn 1 quái đối thủ → **Kích hoạt**, hoặc **Không**.
   - Thêm `&lang=en` để xem bản tiếng Anh.
2. Ảnh thật (11 ảnh): `docs/ai/review-packets/task-3.7-screens/`. Chụp lại bằng `node --experimental-strip-types tools/ui-chain-shots.ts`
   (cần dev server).
3. Lưu ý: đây là **fixture** (dữ liệu dựng sẵn, lá test `FIX-*`), nên bấm chỉ ghi "sẽ gửi", bàn không đổi. Deck thật chưa có lá nào
   mở cửa sổ phản ứng. Luồng chơi thật sẽ có sau 3.8.

**5 điều cần kiểm tra** (theo checklist QA `testing-strategy.md`):

1. (#1/#4) Chạm lá úp viền tím = kích hoạt ngay, chỉ 1 thao tác, không hộp thoại. Có đúng ý C13 không? Lá úp không viền (Rào Chắn
   Hộ Vệ) bấm vào thì không có gì xảy ra.
2. (#6) **Bỏ qua** nằm ở chỗ nút "Phase tiếp theo" (lúc đó nút này vốn không bấm được). Vị trí này có ổn không, hay bạn muốn một nút riêng?
3. (#6) Banner tím: câu "Đối thủ tấn công… / Đối thủ triệu hồi… / Chuỗi N mắt xích (trên cùng: …)" có rõ và đủ nổi không?
4. (#2) Overlay trigger: "Không" chỉ hiện với trigger không bắt buộc; "Kích hoạt" chỉ sáng khi đã chọn đủ mục tiêu.
5. (#9) Tiếng Anh (`&lang=en`): banner/nút/overlay có bị tràn chữ không? Số ATK/DEF xanh/đỏ trên lá có dễ đọc không?

**So với reference:**

- `[DECISION]` C13: chạm lá, không dialog, "Bỏ qua" là nút riêng, trigger hỏi Có/Không. Đã khớp.
- `[REF]` video #3/#4: Bẫy phản ứng sau tấn công/triệu hồi. Banner phân biệt được hai trường hợp này.
- `[GUESS]` **G16** (mới, `fidelity-spec.md`): toàn bộ bố cục gồm viền tím, dải banner, nút Bỏ qua đặt thay chỗ, số hiệu lực xanh/đỏ,
  chỉ số in trong panel. Chưa có ảnh gốc về chuỗi hay chỉ số bị buff.
- Animation 3 event chuỗi giữ caption `[GUESS]` từ 3.4b.

**Kiểm chứng:**

- Lint, typecheck và test 4 package đều xanh: web 534 (+64), engine 606, api 312, shared 129. `pnpm --filter @yugi/web build` xanh;
  `dist` không chứa lá `FIX-*`.
- Test đỏ trước: `task-3.7-red.txt` (33 fail).
- Mutation 24/24 (`task-3.7-mutants.txt`). Lần đầu 22/24 → đã thêm test cho chuỗi 2 mắt xích và lá úp đối thủ.
- Sửa kèm 2 chỗ nhỏ:
  - bấm trượt khỏi menu giờ mở lại prompt đang chờ (trước đây có thể kẹt);
  - overlay prompt có sẵn hiện ngay khi vào màn (trước đây phải rê chuột mới hiện).
- **Chưa chạy** smoke HTTP/`play-vs-ai` vì task chỉ đổi web và deck thật không mở cửa sổ.

**Cần bạn cung cấp:** không bắt buộc. Nếu có: ảnh/video bản gốc lúc chuỗi đang mở hoặc lúc quái bị tăng/giảm ATK (để chuyển G16
từ `[GUESS]` sang `[REF]`), xem `docs/plan/human-tasks.md` (tư liệu chuỗi 2+ link). Vẫn chờ **C14** (Bẫy chọn chế độ lúc Set).

**Task tiếp theo:** **3.8**: 10 lá mẫu thật dùng đủ DSL (Trap/Quick-Play/trigger/Continuous) vào `SAMPLE_CARDS`, rồi chụp lại UI chuỗi
qua Sandbox + API thật và chạy `play-vs-ai`. Sau đó sang P4.
