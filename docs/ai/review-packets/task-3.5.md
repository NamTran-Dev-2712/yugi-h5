### Review Packet — Task 3.5: Hiệu ứng tự kích hoạt "khi được triệu hồi" / "khi bị phá huỷ" (engine-only)

**Đã làm gì (1-3 dòng):**
Quái có hiệu ứng "khi được triệu hồi" và lá có hiệu ứng "khi bị phá huỷ" giờ tự kích hoạt: hiệu ứng **bắt buộc** tự lên chuỗi, hiệu ứng **tuỳ chọn** hỏi chủ lá có muốn dùng không. Chúng đi qua đúng chuỗi của 3.3 nên đối thủ vẫn đáp trả được. Chỉ engine: **chưa chơi được qua giao diện** (nối wire là task sau).

**Cách xem:** (không có UI — xem bằng test)

```bash
pnpm --filter @yugi/game-engine test                                          # toàn bộ test engine
pnpm --filter @yugi/game-engine exec vitest run src/rules/trigger-effects.test.ts
node tools/mutants-3.5.mjs                                                     # đột biến phải bị bắt hết
```

Kịch bản dễ đọc nhất: `packages/game-engine/src/testing/golden/cases.ts` → 3 case mới `on-summon-mandatory` (triệu hồi → tự gây 300 damage), `on-summon-optional-declined` (hỏi → từ chối; lượt sau đối thủ đồng ý hồi 500 LP), `on-destroyed-in-combat` (quái bị đánh chết → từ mộ gây 400 damage lại).

**5 điều cần kiểm tra (đánh dấu trong `docs/reference/notes/RULES-REVIEW-SHEET.md`, 6 dòng "(task 3.5)" cuối bảng):**

1. Triệu hồi thường / hiến tế quái có hiệu ứng bắt buộc → hiệu ứng tự chạy; đối thủ có Bẫy úp thì được đáp trả trước khi nó resolve.
2. Hiệu ứng tuỳ chọn → game **hỏi** chủ lá; từ chối thì không có gì xảy ra (đối thủ vẫn có cửa sổ phản ứng triệu hồi như 3.4c).
3. **Úp quái không kích hoạt** hiệu ứng "khi được triệu hồi" (và lá úp không bị lộ) — bạn đã chốt, lệch câu chữ brief.
4. Lá bị phá (chiến đấu, hiệu ứng, hoặc Bẫy bị phá khi đang chờ trong chuỗi) → hiệu ứng "khi bị phá huỷ" chạy **sau khi** mọi thứ đang diễn ra xong, thành một chuỗi mới; lá nằm yên trong mộ.
5. Hai quái cùng chết: hiệu ứng của người đang tới lượt lên chuỗi trước (resolve sau). Không có mục tiêu / không đủ LP trả / trận đã kết thúc → hiệu ứng không kích hoạt.

**So với reference:**

- Toàn bộ là `[RULE]` luật YGO chuẩn; chưa có `[REF]` Yugi H5 cho hiệu ứng tự kích hoạt (video #3/#4 chỉ có Bẫy).
- `[ASSUMED]` **G15** (bạn đã chốt 2026-09-27): nhiều hiệu ứng của **cùng một người** bắn cùng lúc → theo thứ tự sự kiện, người chơi không tự chọn thứ tự (luật thật cho chọn).
- Quyết định kỹ thuật của AI (ADR 2026-09-27 "Trigger OnSummon / OnDestroyed"): `mandatory` đặt trong `trigger`; hiệu ứng tự kích hoạt chỉ được trả cost bằng LP (chưa có hộp chọn lá để trả cost).
- Lệch brief: brief nói hiệu ứng tự kích hoạt luôn là Speed 1 — đúng với quái/Phép; **Bẫy** có hiệu ứng "khi bị phá huỷ" giữ Speed 2 theo mặc định có sẵn của Bẫy.

**Cần bạn cung cấp:**

- Nếu có: clip Yugi H5 có quái hiệu ứng "khi được triệu hồi" (game có hỏi "Kích hoạt?" không, hay tự chạy) và clip hai hiệu ứng cùng bắn một lúc.
- Quyết **C13** trước task nối wire (UI hỏi "Kích hoạt?" dùng chung cho Bẫy và hiệu ứng tuỳ chọn).

**Task tiếp theo:**

- **3.4b** — nối wire chain + lá úp + cửa sổ phản ứng + prompt `TriggerActivation` (thêm `decline` vào schema, AI ở api phải trả lời prompt này), cần C13.
- Sau đó: `OnFlip`, `OnDestroyed` phân biệt chiến đấu/hiệu ứng, cho người chơi tự sắp thứ tự trigger (nếu tư liệu cần).

---

Phụ lục kỹ thuật: file đổi — shared `effects/{trigger,registry,effect-definition}.ts` (+test); engine `effects/triggers.ts` (mới), `actions/handlers/trigger-activation.ts` (mới), `effects/chain.ts` (trigger sau resolve/đóng cửa sổ, settle dừng khi có prompt, lá trigger không vào mộ), `actions/handlers/{summon,declare-attack,resolve-pending-prompt,activate-effect}.ts`, `legal-actions.ts`, `state/types.ts` (`ChainLinkSource` + `MonsterZone`/`Graveyard`), `actions/types.ts` (`decline?`), `errors.ts` (`INVALID_TRIGGER_ANSWER`), fixture/fuzz/golden/property test; web 2 câu i18n; `tools/mutants-3.5.mjs`. `battle/resolve-attack.ts` và `operations/destroy.ts` **không đổi**. Bằng chứng: `task-3.5-red.txt`, `task-3.5-mutants.txt`, ADR 2026-09-27 "Trigger OnSummon / OnDestroyed".
