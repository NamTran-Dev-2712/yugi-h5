### Review Packet — Task 1.7: Win Condition Detection (LP ≤ 0)

**Đã làm gì (1-3 dòng):** Sau khi damage áp dụng trong `DeclareAttack`, engine tự kiểm tra LP hai bên; bên nào về 0 thì bên kia thắng, cả hai cùng 0 thì hòa. Phát event `DuelEnded {winnerIndex, reason:'LP_ZERO'}`; `GameState.winnerIndex` mở rộng thêm `'draw'` để biểu diễn hòa mà không đụng nghĩa "đang đấu" của `null`. Guard `DUEL_ENDED` đã có sẵn từ trước (task 1.2-1.6) tự động kích hoạt, không cần sửa.

**Cách xem:** `pnpm --filter @yugi/game-engine test` → `src/actions/handlers/declare-attack.test.ts` (44 test, thêm 7 test mới trong describe "win condition"); toàn bộ engine 270 test xanh, không sửa test cũ nào. `pnpm --filter @yugi/game-engine lint`/`typecheck` xanh.

**5 điều cần kiểm tra:**

1. Tấn công trực tiếp hoặc qua combat khiến LP một bên về đúng 0 → duel kết thúc ngay trong cùng lần xử lý `DeclareAttack`, không cần action riêng.
2. Damage vượt quá LP còn lại (LP sẽ âm) vẫn clamp về 0 và vẫn kích hoạt thắng thua — không phải chờ giá trị âm.
3. Cả 2 hướng damage đều được kiểm tra: đối thủ nhận damage (direct attack, ATK-vs-ATK thắng) lẫn chính người tấn công tự nhận damage (ATK-vs-ATK thua, ATK<DEF).
4. Sau khi duel kết thúc, mọi action tiếp theo (kể cả của bên "thắng") bị từ chối `DUEL_ENDED` — xác nhận guard cũ hoạt động đúng trên state thật, không chỉ trên fixture giả lập.
5. Trường hợp cả hai cùng về 0 trong cùng 1 lần damage (`[ASSUMED]`, hiếm) → hòa, không throw/crash.

**So với reference:** `[RULE]` cho luật "LP về 0 thì thua" (RULES-REVIEW-SHEET dòng 44, đã ☑ duyệt trước). `[ASSUMED]` duy nhất: trường hợp hòa khi cả hai cùng về 0 — không có tư liệu gốc, chọn theo luật YGO chuẩn (dòng mới trong RULES-REVIEW-SHEET, tick để trống).

**Cần bạn cung cấp:** (không chặn) xác nhận dòng `[ASSUMED]` "LP về 0 cùng lúc cả hai bên" trong `RULES-REVIEW-SHEET.md`. Lưu ý: task này đổi số thứ tự so với `PROGRESS.md` trước đó (1.7 giờ là win condition thay vì Flip-on-attack) — nếu bạn muốn giữ thứ tự cũ, báo lại để đổi tên task trong docs.

**Task tiếp theo:** Flip khi bị tấn công (quái úp) + damage step cơ bản — đóng lỗ hổng "sân đối thủ chỉ có quái úp → không tấn công được" từ task 1.6. Sau đó: hand limit 6, `Surrender`, deck-out phát `DuelEnded`.
