# Review Packet — Task 3.6: Continuous effect + scriptId registry (Engine + Shared, chưa lên wire)

**Đã làm gì:** Hiệu ứng **liên tục** đầu tiên `ModifyStat` (cộng/trừ ATK/DEF cho quái thoả điều kiện) chạy trong engine: không
kích hoạt, không lên chuỗi, không lưu vào state — engine tính lại mỗi lần cần, nên lá nguồn rời sân/bị úp là hiệu ứng mất ngay.
Combat dùng chỉ số hiệu lực. Thêm `scriptId` ở mức hiệu ứng + registry script (1 script test). Web chỉ thêm 2 câu báo lỗi.

**Cách xem:** chưa có trên giao diện (engine-only, như 3.3–3.5). Xem bằng test:

- `pnpm --filter @yugi/game-engine test continuous` — các tình huống buff/debuff, phá lá nguồn giữa trận.
- Kịch bản ghi sẵn: `packages/game-engine/src/__golden__/continuous-atk-buff.json` (lượt 3: quái 1800 được +500 thắng quái 1800,
  đối thủ mất 500; lượt 4: đối thủ dùng Phép phá lá nguồn; lượt 5: hai quái 1800 đánh nhau, cả hai bị phá, không ai mất LP).
- Mutation: `node tools/mutants-3.6.mjs` (kết quả `task-3.6-mutants.txt`); test đỏ trước: `task-3.6-red.txt`.

**5 điều cần kiểm tra** (đối chiếu `docs/reference/notes/RULES-REVIEW-SHEET.md`, 3 dòng mới task 3.6, ô duyệt để trống):

1. Hiệu ứng liên tục chỉ có tác dụng khi lá nằm **ngửa** trên sân (quái Công hoặc Thủ ngửa); lá úp không có tác dụng.
2. Lá nguồn bị phá → chỉ số trở về như cũ **ngay** (kể cả khi bị phá bằng Bẫy trong lúc đang tấn công, trước khi tính sát thương).
3. Quái úp bị tấn công → lật lên → được tính cả hiệu ứng liên tục của chính nó khi tính sát thương.
4. Nhiều nguồn cộng dồn; ATK/DEF không bao giờ âm.
5. Không có nút "Kích hoạt" cho hiệu ứng liên tục (thử kích hoạt → mã `CONTINUOUS_NOT_ACTIVATABLE`).

**So với reference:**

- Toàn bộ hành vi là `[RULE]` (luật YGO chuẩn), chưa có `[REF]` Yugi H5 cho hiệu ứng liên tục.
- `[DECISION]` (chủ dự án chốt 2026-09-28): nguồn = lá ngửa trên sân; **kích hoạt lá Phép/Bẫy Liên tục để nó nằm ngửa → P4**
  (hiện chỉ Sandbox/fixture đặt được). `scriptId` ở mức hiệu ứng, chạy sau các operation.
- Lệch nhỏ so với brief: thư mục script tên `effect-scripts/` (không phải `scripts/`) vì `.gitignore` gốc chặn mọi thư mục
  `scripts`; và không thêm lọc riêng "chỉ Phép/Bẫy subType Continuous" — dữ liệu lá quyết định (data-driven).
- Chưa làm: hiển thị ATK/DEF hiệu lực trên giao diện/AI (StateView vẫn gửi chỉ số in trên lá), hiệu ứng liên tục kiểu "cấm hành động".

**Kiểm chứng:** shared 122, engine 606, api 278, web 450 test xanh; lint + typecheck 4 package xanh; 12 golden cũ không đổi +
1 case mới; fuzz 200 seed × 400 bước sạch (có bất biến mới: chỉ số hiệu lực ≥ 0 và bằng chỉ số in khi không có nguồn);
mutation 28/30 bị bắt, 2 còn lại là mutant tương đương (ghi rõ trong script).

**Cần bạn cung cấp:** không bắt buộc cho task này. Vẫn chờ: quyết **C13** (UI chuỗi / prompt "Kích hoạt?") và tư liệu chuỗi 2+ link
(`docs/plan/human-tasks.md`). Nếu có video Yugi H5 có lá "tăng ATK cho quái cùng loại" thì gửi để chuyển `[RULE]` → `[REF]`.

**Task tiếp theo:** 3.4b nối wire chain + lá Set + cửa sổ phản ứng + prompt trigger (cần C13), gộp thêm **chỉ số ATK/DEF hiệu lực
trong StateView** để UI/AI thấy buff; hoặc 3.7 (UI chain) sau C13.
