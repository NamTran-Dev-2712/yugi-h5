### Review Packet — Task 1.6: DeclareAttack (tấn công)

**Đã làm gì (1-3 dòng):** Action `DeclareAttack { playerIndex, attackerInstanceId, targetInstanceId? }` — quái ngửa Tấn công của mình tấn công trực tiếp hoặc vào 1 quái đối thủ, tính damage/phá quái theo bảng đã duyệt (`RULES-REVIEW-SHEET.md` dòng 29-34), phát 3 event mới (`AttackDeclared`/`MonsterDestroyed`/`DamageDealt`), ghi `attackedTurn`. **Sửa lại 2 chỗ trong bảng damage của brief ban đầu** cho khớp với luật đã duyệt (xem "So với reference").

**Cách xem:** `pnpm --filter @yugi/game-engine test` → `src/actions/handlers/declare-attack.test.ts` (37 test); toàn bộ engine 263 test xanh, không sửa test cũ nào. `pnpm --filter @yugi/game-engine lint`/`typecheck` xanh.

**5 điều cần kiểm tra:**

1. Chỉ tấn công được ở Battle Phase, chỉ turn player, chỉ quái ngửa **đang ở Attack Position** của chính mình; quái úp, quái đang Phòng thủ, quái vừa Summon/Set, quái đã tấn công trong lượt đều bị từ chối bằng mã lỗi riêng. Lượt 1 bị cấm trừ khi bật `ruleset.firstTurnAttack`.
2. Tấn công trực tiếp chỉ hợp lệ khi sân đối thủ **không có quái nào** (kể cả úp) — nếu sân đối thủ chỉ có quái úp, lượt này **không có action tấn công hợp lệ** vào lá đó (chờ Flip-on-attack ở task 1.7).
3. ATK-vs-ATK: bên ATK cao hơn thắng, đối phương mất LP bằng hiệu số; bằng nhau thì cả hai bị phá, không ai mất LP.
4. ATK-vs-DEF (quái Phòng thủ): ATK>DEF chỉ phá quái thủ, **không ai mất LP**; ATK<DEF **không quái nào bị phá**, bên tấn công mất hiệu số; ATK==DEF (`[ASSUMED]`, không có trong bảng gốc) không gì xảy ra.
5. LP không xuống dưới 0 (clamp); **chưa** kiểm tra thắng/thua khi LP=0 (task riêng sau); quái tấn công sống sót thì ghi `attackedTurn`.

**So với reference:** `[RULE]` toàn bộ, theo `docs/reference/notes/RULES-REVIEW-SHEET.md` dòng 28-34 (đã ☑ duyệt trước đó) — **không phải** bảng damage trong brief task 1.6 gửi kèm, vì brief đó ghi 2 dòng ATK-vs-DEF khác với sheet đã duyệt (brief nói "ATK>DEF vẫn gây damage" và "ATK<DEF thì quái tấn công bị phá" — cả hai đều sai so với sheet, đã sửa lại theo sheet, xem ADR 2026-09-22 trong `DECISIONS.md`). Điều kiện tấn công trực tiếp cũng sửa theo sheet ("không có quái nào" thay vì "không có quái ngửa"). `[ASSUMED]` duy nhất còn lại: ATK==DEF vs quái Phòng thủ (không có trong sheet).

**Cần bạn cung cấp:** (không chặn) xác nhận dòng `[ASSUMED]` mới trong `RULES-REVIEW-SHEET.md` (ATK==DEF vs Defense); video có pha tấn công quái Phòng thủ bằng ATK để nâng nhãn lên `[REF]` nếu có. Không cần asset mới.

**Task tiếp theo:** 1.7 — Flip khi bị tấn công (quái úp) + damage step cơ bản; sau đó 1.8 — win condition (LP≤0), hand limit 6, Surrender.
