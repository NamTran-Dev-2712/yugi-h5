### Review Packet — Task 3.4: Spell Speed từ data + kích hoạt Bẫy / Phép Nhanh đã úp (engine-only)

**Đã làm gì (1-3 dòng):**
Engine giờ cho kích hoạt **Bẫy đã úp** và **Phép Nhanh (Quick-Play) đã úp** từ sân: lá lật ngửa tại ô, lên chain như mọi link, resolve xong mới vào mộ. Tốc độ phép (Spell Speed) đọc từ dữ liệu lá (`spellSpeed`, bỏ trống thì tự suy ra: Bẫy Phản Đòn = 3, Bẫy thường / Phép Nhanh = 2, còn lại = 1). Phép Nhanh từ tay dùng được ở **mọi phase trong lượt mình**. Chỉ engine + schema: **chưa chơi được qua giao diện** (nối wire là task sau).

**Cách xem:** (không có UI trong task này — xem bằng test)

```bash
pnpm --filter @yugi/game-engine test            # 521 test xanh
pnpm --filter @yugi/game-engine exec vitest run src/rules/trap-activation.test.ts src/actions/handlers/quick-play-and-speed.test.ts
node tools/mutants-3.4.mjs                        # 27/27 đột biến bị bắt (~vài phút)
```

Kịch bản minh hoạ dễ đọc nhất: `packages/game-engine/src/testing/golden/cases.ts` → case `set-trap-quickplay-counter-chain` (kết quả ghi ở `src/__golden__/set-trap-quickplay-counter-chain.json`).

**5 điều cần kiểm tra (đọc tên test / bảng luật, đánh dấu trong `docs/reference/notes/RULES-REVIEW-SHEET.md`):**

1. Bẫy úp trong lượt này **không** kích hoạt được (`TRAP_SET_THIS_TURN`); qua lượt sau thì được — ở **mọi phase** của lượt mình.
2. Bẫy úp của **đối thủ** đáp trả được Phép của mình khi chain đang mở; lá lật ngửa **ở lại ô** tới khi resolve rồi mới vào mộ.
3. Bẫy bị phá khi đang chờ trên chain → hiệu ứng **vẫn** chạy, lá không vào mộ hai lần.
4. Phép Nhanh: từ tay chỉ trong **lượt mình** (mọi phase); đã úp thì dùng được ở lượt đối thủ nhưng **không** trong lượt vừa úp (`SPELL_SET_THIS_TURN`).
5. Bẫy Phản Đòn (Speed 3) đáp được mọi lá; lá Speed 2 **không** đáp được nó (`SPELL_SPEED_TOO_LOW`).

**So với reference:**

- Khớp `[REF]` video #3/#4: Bẫy lật ngửa trên sân khi kích hoạt.
- Theo `[RULE]` chuẩn (bạn đã chốt 2026-09-27): Phép Nhanh từ tay chỉ lượt mình; lá úp lật ngửa ở lại ô; người chơi của lượt dùng lá úp ở mọi phase. **Lệch câu chữ brief** mục 3 (brief cho Phép Nhanh từ tay ngoài lượt) — làm theo lựa chọn của bạn.
- Bảng tốc độ mặc định (Counter 3 / Trap & Quick-Play 2 / còn lại 1) là `[RULE]`; cho phép `spellSpeed` khai tường minh ghi đè (kể cả hạ xuống) là `[DECISION]` của AI.
- **Chưa có** (lệch `[REF]`): video cho thấy Bẫy phản ứng ngay khi **tuyên bố tấn công / triệu hồi**; engine hiện chỉ cho đối thủ đáp trả khi đã có chain đang mở → task riêng.
- Thứ tự / độ trễ của chain 2+ link (Phép Nhanh, Bẫy) chưa có tư liệu Yugi H5 → phần "cảm giác đúng bản gốc" vẫn chờ.
- Không thêm `[GUESS]`/G# mới trong `fidelity-spec.md`.
- Đổi hành vi cũ có chủ đích: Phép thường đã úp báo `NOT_ACTIVATABLE` thay vì `CARD_NOT_IN_HAND` (1 dòng golden).

**Cần bạn cung cấp:**

- Video/GIF chain 2+ link (Phép Nhanh, Bẫy nối nhau) — `docs/plan/human-tasks.md` dòng "Video/GIF chain, activate spell/trap" (P3).
- Quyết **C13** (có hộp thoại "Kích hoạt?" hay chạm lá Bẫy úp) trước khi nối wire/UI chain.
- Duyệt các dòng mới trong `RULES-REVIEW-SHEET.md` (ô ☐ ở mục Quick-Play / lá Set / Speed 3).

**Task tiếp theo:**

- **3.4b** — nối wire chain + lá úp (event chain qua HTTP, nút Pass, chain công khai trong view, cổng fuzz chống lộ bài với lá úp đáp trả); cần C13.
- Hoặc: **cửa sổ phản ứng khi tuyên bố tấn công / triệu hồi** (khớp video #3/#4).
- Để P4: Phép/Bẫy Liên tục, kích hoạt Phép thường đã úp, Bẫy Phản Đòn thật (cần operation Negate).

---

Phụ lục kỹ thuật: file đổi — `packages/shared/src/effects/effect-definition.ts` (+test), `packages/shared/src/duel/event-view.ts`; engine `effects/spell-speed.ts` (mới), `actions/handlers/activate-effect.ts`, `effects/chain.ts`, `effects/activation-candidates.ts`, `state/types.ts`, `events/types.ts`, `errors.ts`, test/fixture/fuzz/golden; `apps/web` chỉ 2 câu i18n; `apps/api` 0 dòng. Bằng chứng: `task-3.4-red.txt`, `task-3.4-mutants.txt`, ADR 2026-09-27 trong `docs/ai/DECISIONS.md`.
