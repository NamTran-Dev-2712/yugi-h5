# Review Packet — Task 3.3: Chain stack + resolve LIFO + PassPriority (engine-only)

### Review Packet — Task 3.3

**Đã làm gì:**
Engine giờ có **chuỗi hiệu ứng (chain)** thật: mỗi lần kích hoạt Phép, lá rời tay, **trả chi phí và chọn mục tiêu ngay lúc kích hoạt**, rồi thành một "mắt xích" trên chain. Đối thủ của người kích hoạt được quyền đáp trả trước; khi hai bên **bỏ qua liên tiếp**, **cả chuỗi** được xử lý **từ mắt xích sau cùng về đầu** (LIFO) — đúng luật chuẩn bạn đã chọn. Mục tiêu đã biến mất lúc xử lý → mắt xích đó "không có hiệu lực" (không lỗi). Người không có lá nào đáp trả được thì engine tự bỏ qua thay họ, nên khi không ai đáp trả được thì mọi thứ xong trong **một lần bấm như cũ** — lá SMP-101 chơi qua server/UI vẫn y như 3.2b. Phần này **chỉ ở engine**: server chưa gửi thông tin chain ra ngoài, giao diện chưa đổi (chờ bạn quyết C13).

**Cách xem** (không có UI mới — xem bằng test và log kịch bản):

1. Chạy test chain: `pnpm --filter @yugi/game-engine exec vitest run src/effects/chain.test.ts --reporter=verbose` → 32 kịch bản có tên tiếng Anh dễ đọc (1 mắt xích, 2 mắt xích, 3 mắt xích, bỏ qua/bỏ qua, sai người bỏ qua, mục tiêu biến mất, trận kết thúc giữa chuỗi, đầu hàng khi đang chờ…).
2. Xem "log" một chuỗi 3 mắt xích thật (bản ghi golden):
   `node -e "const g=require('./packages/game-engine/src/__golden__/chain-three-links.json');for(const s of g.steps)console.log(s.action.type,s.action.payload.cardInstanceId||'',s.ok?'OK':'BỊ TỪ CHỐI '+s.errorCode,(s.events||[]).map(e=>e.type+(e.definitionId?':'+e.definitionId:'')).join(', '))"`
   Dòng kích hoạt thứ 3 (`p0-22`) cho thấy thứ tự xử lý: **G_QP_BURN → G_QP_HEAL → G_DRAW** (ngược thứ tự kích hoạt), rồi `ChainResolved`.
3. Kết quả kiểm tra: `docs/ai/review-packets/task-3.3-red.txt` (test đỏ trước khi code), `task-3.3-mutants.txt` (đột biến).

**5 điều cần kiểm tra** (bảng `docs/reference/notes/RULES-REVIEW-SHEET.md`, 8 dòng "Chain: …" mới, ô duyệt để trống):

1. **Resolve cả chuỗi một mạch, LIFO** — bạn đã chọn trong phiên; xác nhận lại bằng dòng "Chain: resolve".
2. **Chi phí trả ngay lúc kích hoạt** (không phải lúc xử lý): vd bỏ 1 lá để kích hoạt thì lá đó vào Mộ ngay, trước khi hiệu ứng chạy.
3. **Tự bỏ qua khi không có lá đáp trả** `[ASSUMED]`: không có cửa sổ chờ trống. Đổi lại, khi cửa sổ còn mở thì bên kia biết "người đang giữ quyền có lá đáp trả được" — xem ADR, có thể che ở UI sau.
4. **Mục tiêu biến mất**: hết mục tiêu → không hiệu lực, lá vẫn vào Mộ; còn một phần (vd phá 2 lá, 1 lá đã đi) → vẫn phá lá còn lại `[ASSUMED]`.
5. **Trận kết thúc giữa chuỗi**: các mắt xích còn lại không chạy, lá của chúng vẫn vào Mộ, thông báo kết thúc trận là cuối cùng `[ASSUMED]` phần "vẫn vào Mộ".

**So với reference:**

- Luật chain/LIFO/Spell Speed là `[RULE]` YGO chuẩn; video #3/#4 **không có** chain 2 mắt xích nên chưa đối chiếu được với Yugi H5.
- "Chỉ dừng chờ khi có lá đáp trả hợp lệ" `[ASSUMED]` — video #3/#4 gợi ý (Bẫy của đối thủ tự bật, không có hộp thoại cho mình), chưa chắc.
- Lá Phép đang trên chuỗi nằm "trong mắt xích" (không đặt lên ô Phép/Bẫy) — **bạn chọn** trong phiên; bản gốc có thể hiện lá lớn giữa sân (video #2) — sẽ quyết hình ảnh ở 3.3b/3.7.
- Quick-Play (Tốc độ 2) mới có bản tối thiểu **chỉ để test** (từ tay, lượt mình, Main Phase `[ASSUMED]`); chưa có lá thật nào. Bẫy đã úp, Quick-Play úp, Counter Trap là task 3.4.
- Engine **không** đọc setting `chainPrompt` (hỏi "Kích hoạt?"/tự bỏ qua) — đó là UI, chờ C13.

**Cần bạn cung cấp:**

- Quyết định **C13** (cho task 3.7 UI chain): phản ứng = hộp thoại "Kích hoạt?" (G5/C12) hay "chạm lá Bẫy úp trong lúc chờ" (video #3/#4) — `docs/reference/notes/rules-observed.md` mục "Video #3/#4".
- **Video chain 2 lá liên tiếp** (Bẫy/Phép nhanh đáp trả một lá khác, cho task 3.4) + màn cài đặt auto-pass nếu có — `docs/plan/human-tasks.md` mục **P3**.

**Task tiếp theo:** đề xuất **3.4** (Bẫy đã úp + Quick-Play úp + Counter Trap Speed 3 — dùng được chain vừa làm mà không cần C13) nếu có video chain 2 lá; **3.3b** (nối chain lên server/UI) chỉ nên làm sau khi bạn quyết C13.

---

## Chi tiết kỹ thuật (cho người duyệt code)

- **Engine**: `state/types.ts` (`ChainLink`, `ChainWindow`, `GameState.chainStack` có kiểu + trường mới `chainWindow`), `effects/chain.ts` (mới: `pushLink`/`passPriority`/`settle`/`resolveChain`), `effects/activation-candidates.ts` (mới, tách từ `legal-actions.ts`), `actions/handlers/activate-effect.ts` (`execute` → `activate` + chain; Speed/Quick-Play; `hasLegalActivation`), `actions/handlers/pass-priority.ts` (mới), `apply-action.ts` (dispatch + `CHAIN_WINDOW_OPEN`), `errors.ts` (+4 mã), `events/types.ts` (+3 event), `actions/types.ts` (`PassPriorityAction`), `start-duel.ts` (`chainWindow: null`), `legal-actions.ts` (ứng viên `PassPriority`).
- **Test**: `effects/chain.test.ts` (mới, 32), `activate-effect.test.ts` (5 chuỗi event thêm `ChainLinkAdded`/`ChainResolved` — đổi có chủ đích), `legal-actions.spells.test.ts` (+3), `legal-actions.property.test.ts` (junk + tiến triển có `PassPriority`), fuzz (`QPH`/`QPK`, sinh `PassPriority`/đáp trả, bất biến chain, 2 test "checker không rỗng" mới), golden (`G_QP_*`, case `chain-three-links`).
- **Golden diff**: `deck-out`, `direct-attack-lp-zero`, `hand-limit-discard`, `surrender-mid-duel`, `tribute-position-flip-attack`: **chỉ** `"chainWindow": null` ở state cuối (trường mới). `spell-set-and-activate`: thêm `"chainWindow": null` + `ChainLinkAdded {linkId:"link-1-3", chainIndex:1, definitionId:"G_DRAW", spellSpeed:1, targetInstanceIds:[]}` sau `EffectActivated` và `ChainResolved {linkCount:1}` cuối bước kích hoạt (lá kích hoạt giờ lên chain). Case mới `chain-three-links`: 3 mắt xích + 4 lần bị từ chối (`NOT_PRIORITY_HOLDER`, `CHAIN_WINDOW_OPEN`, `SPELL_SPEED_TOO_LOW`, `NO_CHAIN_WINDOW`).
- **API (containment)**: `event-view.ts` (3 event → `null`), `duel-manager.ts` (`ENGINE_ONLY_ACTIONS = {PassPriority}`), `scenario-to-state.ts` (`chainWindow: null`), spec tương ứng (+5 test). `PlayerActionSchema` không đổi. **Web**: 4 khoá i18n × vi/en.
- **Số test**: đỏ trước 32 fail / 435 pass (engine). Sau: shared 113, engine 474 (+3 todo), api 278, web 450 — lint + typecheck toàn workspace xanh.
- **Fuzz**: mặc định 10 seed × 300 xanh; dài `FUZZ_SEEDS=200 FUZZ_STEPS=400` → 211/211 test xanh, **mã thoát 0** (80.000 bước, 1.098 ván, 546 `PassPriority` + 1.523 `ActivateEffect` được chấp nhận, 33.839 lần bị từ chối đúng, chain dài nhất còn chờ giữa hai action: 3 link, 0 vi phạm). Property `legalActions` 8 × 200 xanh.
- **Mutation**: `node tools/mutants-3.3.mjs` → **37/37 bị bắt** (`task-3.3-mutants.txt`). Lần đầu 35/37: mutant "pass khi có prompt" bị che vì link 1 là Draw (guard riêng của `applyDraw`) → đổi test sang HEAL; mutant "không auto-pass sau pass tay" chưa có test → thêm test. Không có mutant tương đương.
- **Smoke HTTP** (`tools/smoke-http.ts`, `play-vs-ai.ts`, `smoke-sandbox.ts`): **chưa chạy** — Docker Desktop tắt trên máy (không kết nối được `dockerDesktopLinuxEngine`). Thay thế: e2e supertest trong `pnpm test` của api (gồm nhóm Spell/Trap + cổng fuzz leak) xanh, và test manager "kích hoạt vẫn xong trong một lần gọi, không lộ event chain".
- **Lệch brief**: (1) resolve cả chain thay vì từng link (chủ dự án chọn); (2) Quick-Play tối thiểu từ tay trong engine để có link 2 (chỉ lá test); (3) `PassPriority` thêm guard `PENDING_PROMPT`; (4) không phát event cho việc pass.
