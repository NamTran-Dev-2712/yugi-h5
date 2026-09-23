### Review Packet — Task 2.3: HTTP duel solo + guest token (API + Shared; không đụng game-engine)

**Đã làm gì:** 4 endpoint (`POST /auth/guest`, `POST /duels/solo`, `GET /duels/:id?viewer`, `POST /duels/:id/actions`) trên `DuelService`; `validateDeck` + `STARTER_DECK` ở `packages/shared`; chế độ `solo-debug` (một guest điều khiển cả 2 ghế). File chính: `modules/duels/{duels.controller,duels.dto,duel-access,duel-http,duel-error.filter,card-pool}.ts`, `modules/auth/{auth.controller,auth.module,guest-auth.guard}.ts`, `common/pipes/zod-pipe.ts`, `configure-app.ts`, `packages/shared/src/deck/*`. Sửa nhỏ: `duel-manager.ts` (mode/owner, `createDuel` trả view + event mở đầu, `getMeta`), `env.schema.ts` (`GUEST_TOKEN_TTL`, chặn secret `change-me` ở production), `all-exceptions.filter.ts` (giữ 4xx của middleware, `@Inject` tường minh), `main.ts`. Docs: `protocol.md`, `apps/api/CLAUDE.md`, ADR 2026-09-24, `PROGRESS.md`, `parity-board.md`.

**Cách xem:** `pnpm lint && pnpm typecheck && pnpm test` toàn repo; `git diff packages/game-engine` rỗng. Chạy tay: `POST /auth/guest` → dùng token gọi `/duels/solo`. api 128 test (e2e 45 bằng supertest), shared 26.

**Hành vi đã test:** token thiếu/sai scheme/rác/ký khác secret/hết hạn/không phải guest → 401 ở cả 3 route; duel người khác → 403 `NOT_OWNER` (GET cả 2 ghế, actions); id lạ → 404; body sai (key lạ, viewer=2, deck sai kiểu, `deck`+`decks`, thiếu action, type lạ, playerIndex=2, mảng) và JSON hỏng → 400; body 150kb → 413; deck sai → 400 `INVALID_DECK` kèm `seat`; action sai lượt → 409 + `engineCode`, state/version không đổi; `Draw`/`StartDuel` → 403 `FORBIDDEN_ACTION`; envelope ≠ payload → 403 `PLAYER_MISMATCH`; action sau Surrender → 409 `DUEL_ENDED`; CORS (nhiều origin, origin lạ bị bỏ). **Ván ngắn qua HTTP** (Summon → Set → Attack lật quái úp → Surrender): sau MỖI action quét cả 2 view + response, không object nào chứa `definitionId` của lá đang ẩn với phía kia (tay + quái úp), tay đối thủ luôn toàn `hidden:true`, không có `rng`. Response tạo duel của viewer 0 không chứa id lá chỉ có ở deck phía 1 (và ngược lại). `validateDeck`: 39/40/60/61 lá, 3/4 bản, lá lạ, nhiều lỗi cùng lúc; starter deck hợp lệ.

**Mutation test thủ công (12):** mọi guest được sở hữu ghế; view sai ghế khi tạo; events của ghế kia khi gửi action _(sống lần đầu → thêm test "sender thấy lá mình rút đầy đủ", giờ bị bắt)_; 409→500; bỏ `validateDeck` ở solo; bỏ `PLAYER_MISMATCH`; body limit 10mb; nhận token không phải guest; bỏ kiểm quyền ở GET; 4 bản/lá được phép; min 39 lá; lỗi 4xx của middleware thành 500 → 12/12 bị bắt.

**Cần bạn duyệt (`[ASSUMED]`):**

1. Guest **stateless** (không DB), TTL 12h (`GUEST_TOKEN_TTL`), chưa refresh; `playerIds` engine = `<guestId>:0` / `:1`.
2. Envelope action `{playerIndex, action}`; HTTP chỉ kiểm vỏ (type + `payload.playerIndex`). Payload méo mà engine ném lỗi lạ → `500` (state không đổi), chưa phải `400`. Schema Action đầy đủ = việc riêng.
3. `deck` áp cho cả 2 ghế, hoặc `decks` mỗi ghế một deck (thêm ngoài yêu cầu, để test leak có ý nghĩa); `viewer` mặc định 0.
4. **Thêm 15 lá quái placeholder** (SMP-004…018, tên tự đặt) vì 5 lá cũ không lập nổi deck ≥40; starter deck = 14 quái × 3 = 42, không có Spell/Trap (engine chưa xử lý). Điều này đổi `GET /cards`.
5. `createDuel` mở rộng kiểu trả về (cộng thêm); mã `NOT_OWNER` mới; body limit 100kb; thêm devDependency `supertest` (+types).
6. 404 vs 403 phân biệt được (id có thật hay không) cho người không phải chủ — chấp nhận vì id UUID.
7. Không dùng `nestjs-zod` pipe mà tự viết `ZodPipe` (lý do trong ADR).
8. Production từ chối secret bắt đầu bằng `change-me` (thay đổi hành vi boot nhỏ ngoài yêu cầu).

**Việc để dành:** fuzz/golden lộ thông tin qua HTTP (**cổng bắt buộc trước P3**), TTL dọn duel + store bền, lịch sử event/resync, Extra Deck của chủ cho Fusion, schema Action ở shared, guest → account (P7).

**Task tiếp theo:** 2.4 AI dummy (`solo-vs-ai`).
