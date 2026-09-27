### Review Packet — Task 3.4c: Cửa sổ phản ứng khi tấn công / triệu hồi (engine-only)

**Đã làm gì (1-3 dòng):**
Sau khi tuyên bố tấn công (trước khi lật/phá/tính damage) và sau khi triệu hồi hoặc úp quái, **đối thủ** giờ có một cửa sổ để kích hoạt Bẫy / Phép Nhanh đã úp — đúng như video #3/#4. Cửa sổ chỉ mở khi đối thủ thật sự có lá dùng được; không có thì mọi thứ chạy như cũ. Chỉ engine: **chưa chơi được qua giao diện** (nối wire là task sau).

**Cách xem:** (không có UI — xem bằng test)

```bash
pnpm --filter @yugi/game-engine test                                        # 540 test xanh
pnpm --filter @yugi/game-engine exec vitest run src/rules/reaction-window.test.ts
node tools/mutants-3.4c.mjs                                                  # 16/16 đột biến bị bắt
```

Kịch bản dễ đọc nhất: `packages/game-engine/src/testing/golden/cases.ts` → case `attack-and-summon-reaction` (úp quái → đối thủ bỏ qua; tấn công trực tiếp → Bẫy của đối thủ phá quái tấn công → không mất LP).

**5 điều cần kiểm tra (đọc tên test / bảng luật, đánh dấu trong `docs/reference/notes/RULES-REVIEW-SHEET.md`, các dòng "Phản ứng…", "Không có lá đáp trả", "Mất quái tấn công…"):**

1. Tuyên bố tấn công khi đối thủ có Bẫy úp dùng được → **dừng lại** trước khi lật quái úp / tính damage; đối thủ bỏ qua (1 lần) thì đòn tấn công tiếp tục.
2. Bẫy phá quái tấn công → đòn dừng, không ai mất LP. Bẫy phá mục tiêu → đòn dừng (không chọn lại mục tiêu), quái tấn công vẫn tính đã tấn công.
3. Triệu hồi (kể cả hiến tế) và **úp quái** đều cho đối thủ cửa sổ; Bẫy có thể phá quái vừa triệu hồi (như R2).
4. Đối thủ không có lá nào dùng được → không có cửa sổ, tấn công/triệu hồi y như trước (7 golden cũ không đổi).
5. Trong lúc cửa sổ mở, người chơi của lượt không làm gì được ngoài Đầu hàng; Bẫy gây damage chí mạng thì trận kết thúc, đòn tấn công không tiếp.

**So với reference:**

- Khớp `[REF]` video #3/#4: Bẫy kích hoạt sau tuyên bố tấn công, trước damage (R1, R3, R4, R5); Bẫy phản ứng triệu hồi (R2).
- `[ASSUMED]` (bạn đã chốt 2026-09-27, gom ở **G14** trong `fidelity-spec.md`): chỉ mở khi đối thủ có lá hợp lệ; 1 lần bỏ qua là đóng; mất quái/mục tiêu thì dừng đòn, **không replay** (luật YGO chuẩn có replay).
- `[DECISION]`: úp quái cũng mở cửa sổ (theo brief). **Lệch tư liệu**: `rules-observed.md` chỉ ghi phản ứng với **triệu hồi** (R2), chưa thấy với úp quái.
- Chưa có: điều kiện riêng của từng Bẫy ("chỉ dùng khi đối phương tấn công") — Bẫy test hiện dùng được bất cứ lúc nào có cửa sổ; cần mở rộng DSL trigger sau.

**Cần bạn cung cấp:**

- Nếu có: clip Bẫy phản ứng khi **úp** quái (xác nhận `[DECISION]` SetMonster), và clip Bẫy phá mục tiêu tấn công (xem game có cho chọn lại mục tiêu không) — mục "Video/GIF chain, activate spell/trap" trong `docs/plan/human-tasks.md`.
- Quyết **C13** trước task nối wire.

**Task tiếp theo:**

- **3.4b** — nối wire chain + lá úp + cửa sổ phản ứng (event mở cửa sổ cho UI, nút Bỏ qua/PassPriority trên wire, **AI ở api phải biết pass** khi có Bẫy thật), cần C13.
- Sau đó: điều kiện kích hoạt riêng cho Bẫy (trigger "khi bị tấn công/khi triệu hồi") + replay khi mất mục tiêu nếu tư liệu xác nhận.

---

Phụ lục kỹ thuật: file đổi — `state/types.ts` (`ChainWindow.reactionTo?`), `effects/chain.ts` (`openReactionWindow`, giữ `reactionTo`, 1 pass đóng, `continueAfterWindow`), `battle/resolve-attack.ts` (mới, chuyển nguyên damage step), `cards/resolve-monster.ts` (mới, chuyển từ `summon.ts`), `actions/handlers/{declare-attack,summon}.ts`, test/fixture/fuzz/golden, `tools/mutants-3.4c.mjs`. `apps/*` và `packages/shared` 0 dòng. Bằng chứng: `task-3.4c-red.txt`, `task-3.4c-mutants.txt`, ADR 2026-09-27 "Cửa sổ phản ứng".
