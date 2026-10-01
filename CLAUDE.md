# Yugi H5 Recreate

Duel card game 2D kiểu Yu-Gi-Oh bản cũ/early Master Rule, dùng cá nhân, không phát hành
công khai. **Không dùng art/tên bài chính thức của Konami** — mọi card trong repo là
placeholder tự đặt tên. Ưu tiên theo thứ tự: (1) core duel mechanics, (2) cảm giác kéo thả +
flow lượt, (3) UI manga/classic, (4) Deck Builder cơ bản, (5) AI rule-based. Xem thêm:
[`docs/design/`](./docs/design) (engine/effect-DSL/protocol), [`docs/ai/`](./docs/ai)
(tiến độ + quyết định).

@docs/ai/PROGRESS.md
@docs/ai/INDEX.md
@docs/ai/LESSONS.md

Ba file trên được tự nạp: trạng thái hiện tại, bản đồ "task nào đọc file nào", bài học chung. **Quyết định thiết kế
(ADR) và nhật ký task KHÔNG tự nạp** — mục lục ở `docs/ai/DECISIONS.md`, mỗi ADR một file trong `docs/ai/decisions/`,
nhật ký ở `docs/ai/progress/`: phải chủ động đọc theo `docs/ai/INDEX.md` trước khi sửa code thuộc chủ đề đó. Giữ tổng
các file tự nạp dưới 40.000 ký tự: không `@import` thêm file lớn, không chép lịch sử task vào các file này.

## Kiến trúc bất biến

1. **`packages/game-engine` là pure TypeScript.** Không import `phaser`, `@nestjs/*`,
   `socket.io`, DB/Node/browser API. API công khai duy nhất: `applyAction(state, action, ctx)
-> { state, events }`. Deterministic: RNG seeded qua `state.rng`, không `Math.random()`/
   `Date.now()`. State immutable (spread, không mutate), serialize được (JSON thuần).
2. **Server là nguồn sự thật.** Mọi action ảnh hưởng game state (kể cả solo vs AI) phải
   validate + chạy qua engine ở `apps/api`. Client không tự đổi state. View gửi cho client
   phải ẩn thông tin đối thủ (bài trên tay, bài úp).
3. **Effect là data-driven.** Card effect = `EffectDefinition` (trigger/condition/cost/
   target/operation) + `scriptId` registry cho lá quá phức tạp. Thêm lá mới = thêm data,
   không sửa core engine.
4. **Animation suy ra từ `GameEvent[]`.** FE xếp event vào animation queue, không tự suy
   luận logic game.
5. **Card definitions nằm ở `packages/shared`.** DB (`apps/api/prisma`) chỉ lưu
   User/Collection/Deck/MatchHistory/Progress, không lưu effect/content.
6. **Auth: Guest + Account, JWT** (access + refresh), guest nâng cấp được thành account.
7. **TypeScript strict toàn bộ.** Simplicity + correctness trước, optimize sau.

## Dependency rule giữa packages

| Package                | Được import                               | Không được import                                                                                      |
| ---------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `packages/game-engine` | `packages/shared` (types)                 | `phaser`, `@nestjs/*`, `socket.io`, Node/browser API                                                   |
| `packages/shared`      | (không phụ thuộc package khác trong repo) | `apps/*`, `packages/game-engine`                                                                       |
| `apps/api`             | `packages/shared`, `packages/game-engine` | `apps/web`                                                                                             |
| `apps/web`             | `packages/shared`                         | `packages/game-engine` rule logic (`applyAction`...); chỉ được dùng type/utility export rõ ràng nếu có |

## Lệnh thường dùng

```bash
pnpm dev                                  # chạy web + api (build packages phụ thuộc trước)
pnpm lint / pnpm typecheck / pnpm test / pnpm build   # toàn workspace
pnpm --filter <pkg> <script>              # 1 package cụ thể, vd @yugi/api, @yugi/game-engine
pnpm --filter @yugi/api prisma:migrate    # tạo/áp dụng Prisma migration
docker compose up -d                      # Postgres (5433) + Redis (6380, chưa dùng)
```

## Coding standards

- TS strict, không `any` (ESLint chặn `@typescript-eslint/no-explicit-any`).
- Không hardcode effect logic trong engine — luôn qua `EffectDefinition`/`scriptId`.
- Đặt tên: file kebab-case, type/class PascalCase, action/event dùng PascalCase
  (`NormalSummon`, `CardDrawn`).
- Test: Vitest. `packages/game-engine` ưu tiên test-first cho mọi rule mới (xem
  `docs/design/engine.md` cho danh sách Action/Event).
- Import nội bộ package `game-engine`/`shared` dùng đuôi `.js` (ESM/NodeNext); `apps/api`
  dùng import không đuôi (CommonJS).

## Quy trình bắt buộc cho MỖI task

1. Đọc `docs/ai/PROGRESS.md` + `CLAUDE.md` của package liên quan + các file/ADR mà
   `docs/ai/INDEX.md` trỏ tới cho chủ đề của task, trước khi làm.
2. Nêu rõ task thuộc lớp nào: Engine / API / Frontend / Realtime / Shared.
3. Plan ngắn → làm từng bước nhỏ; ưu tiên viết test trước với engine.
4. Trước khi báo hoàn thành: chạy lint + typecheck + test của package liên quan
   (`pnpm --filter <pkg> lint/typecheck/test`).
5. Cập nhật `docs/ai/PROGRESS.md` (bắt buộc; chỉ trạng thái hiện tại) và thêm mục chi tiết của task
   vào cuối `docs/ai/progress/p<phase>.md` (bắt buộc); nếu có quyết định thiết kế mới: tạo file ADR
   trong `docs/ai/decisions/` + 1 dòng ở mục lục `docs/ai/DECISIONS.md` (bài học dùng chung → thêm
   `docs/ai/LESSONS.md`); `docs/design/*` nếu đổi contract; `CLAUDE.md` liên quan nếu phát sinh
   luật mới.
6. Báo cáo cuối task: đã làm gì, file đổi, cách verify, việc tiếp theo đề xuất.
   - (6b) Task có đổi hiển thị UI: kèm screenshot thật ở `docs/ai/review-packets/task-<số>-screens/`
     (mẫu: `tools/ui-drag-shots.ts`, `tools/ui-anim-shots.ts`) và nêu đường dẫn trong báo cáo.
7. **Kết thúc mỗi task bằng Review Packet** cho người duyệt (`/review-packet`) + cập nhật
   `docs/plan/parity-board.md` (AI chỉ tới 🟨 "nháp"; chỉ người dùng chuyển ✅).

Slash commands hỗ trợ quy trình này: `/task-start`, `/task-done`, `/next-task`, `/new-card`,
`/new-effect-type`, `/new-action`, `/review`, `/review-packet`, `/fidelity-check`, `/asset-request`,
`/write-prompt` (xem `.claude/commands/`).

## Kế hoạch tổng thể & vai trò

Người dùng **không code**: chỉ cung cấp tư liệu (`docs/reference/`), asset (`assets/`), duyệt và trả lời câu hỏi. AI viết mọi
code/test/tooling/docs. Nguồn task: [`docs/plan/MASTER-PLAN.md`](./docs/plan/MASTER-PLAN.md) (Phase P0–P9, dùng `/next-task`).
Tài liệu: `docs/plan/{fidelity-spec,rules-coverage,card-and-effect-plan,card-art-pipeline,ui-plan,animation-plan,backend-plan,
testing-strategy,dev-tools-and-review,human-tasks,parity-board}.md`.

**Nhãn độ tin cậy** trong mọi tài liệu/quyết định về hành vi Yugi H5 gốc: `[REF]` (có tư liệu trong `docs/reference/`), `[RULE]`
(luật YGO chuẩn), `[DECISION]` (chủ dự án đã chốt, chưa có [REF]: không hỏi lại, đổi bằng config khi có tư liệu), `[GUESS]` (đoán). Không bao giờ trình bày `[GUESS]` như sự thật; `[GUESS]` phải nằm trong danh sách G# của
`fidelity-spec.md`. Task Engine xong → cập nhật `docs/reference/notes/RULES-REVIEW-SHEET.md`. Người dùng báo "đã nộp" tư liệu →
`/ingest-reference` (thiếu ffmpeg thì báo, không tự cài; không bịa chi tiết ngoài tư liệu).

**Khi cần asset/tư liệu**: tạo yêu cầu trong `docs/plan/human-tasks.md` hoặc `docs/assets/ASSET_REQUESTS.md` (`/asset-request`) và
dùng placeholder — KHÔNG tự bịa/tải asset. Không thêm `sharp`/Spine/lib hash mật khẩu khi chưa hỏi người dùng.

**Dev tool** (Sandbox, Replay, Animation Preview) đi qua dev-endpoint ở `apps/api` (tắt ở production); `apps/web` vẫn không import engine.

**Tạo file bằng Write/Edit, không bằng Bash heredoc có dấu nháy** (`<<'EOF'`, `<<"EOF"`): hook PreToolUse `.claude/hooks/block-heredoc.js` (đăng ký trong `.claude/settings.json`, test: `node --test .claude/hooks/block-heredoc.test.js`) chặn lệnh Bash chứa heredoc kiểu đó và nhắc "Tạo file bằng Write". **Script chạy thật qua HTTP** ở `tools/` (không thuộc package nào, không thêm dependency): `node --experimental-strip-types tools/smoke-http.ts` (smoke API thật, ghi `docs/ai/review-packets/task-2.4-smoke.md`) và `tools/play-duel.ts` (tự chơi 1 ván; `HEAVY=1` để có nhánh Tribute) — cần API + Postgres đang chạy.

## TUYỆT ĐỐI KHÔNG

- Import `phaser`/`@nestjs/*`/`socket.io`/Node API vào `packages/game-engine`.
- Để client (`apps/web`) tự đổi game state hoặc tự chạy rule logic.
- Dùng `Math.random()`/`Date.now()` trong engine.
- Dùng asset/tên lá bài chính thức của Konami (kể cả để "test tạm").
- Thêm dependency lớn (framework, ORM khác, state lib khác...) khi chưa hỏi user.
- Refactor ngoài phạm vi task đang làm.
