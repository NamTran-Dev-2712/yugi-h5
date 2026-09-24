# Decisions (ADR log ngắn)

Format: ngày, quyết định, lý do, hệ quả. Thêm mới ở cuối file.

## 2026-09-19 — NestJS 11.x thay vì 12.x (mới nhất)

NestJS 12 vừa release vài ngày trước lúc setup, hệ sinh thái plugin (nestjs-pino,
`@nestjs/swagger`, passport) chưa kịp kiểm chứng đầy đủ. Chọn 11.x cho ổn định.
**Hệ quả**: nâng cấp lên 12 là task riêng sau này, không tự động.

## 2026-09-19 — Vite 7.x thay vì 8.x/Rolldown

Vite 8 (kiến trúc Rolldown, Rust-based) mới ra mắt 3/2026, rủi ro tương thích plugin cho
game dev asset pipeline. Chọn 7.x (esbuild/rollup) cho ổn định. **Hệ quả**: build time chậm
hơn Vite 8 nhưng chấp nhận được ở quy mô hiện tại.

## 2026-09-19 — Validation dùng Zod, không dùng class-validator

Card definitions, Action/Event contract đã là Zod schema trong `packages/shared` theo yêu
cầu kiến trúc (data-driven). Dùng `nestjs-zod` ở `apps/api` để tái dùng cùng schema, tránh
định nghĩa validation 2 lần (DTO class + Zod schema riêng). **Hệ quả**: mọi DTO API mới nên
ưu tiên Zod schema, không thêm `class-validator` decorator.

## 2026-09-19 — Prisma 6.x LTS thay vì 7.x (mới nhất)

Prisma 7 đổi cách cấu hình datasource: bỏ `url` trực tiếp trong `schema.prisma`, yêu cầu
driver adapter (`@prisma/adapter-pg`) + `prisma.config.ts` riêng cho Migrate. Quá phức tạp
cho nhu cầu hiện tại (chỉ cần 1 Postgres instance, không cần Accelerate/multi-adapter).
Fallback xuống 6.x LTS, dùng `datasource.url = env("DATABASE_URL")` như bình thường.
**Hệ quả**: khi nâng cấp Prisma 7 sau này, cần viết `prisma.config.ts` + adapter, không
phải chỉ đổi version number.

## 2026-09-19 — Redis có trong docker-compose nhưng chưa wire vào code

Chỉ cần cho Socket.io adapter/rate-limit ở M7 (PvP realtime). Thêm sớm là complexity thừa
cho M0. **Hệ quả**: `RealtimeModule`/`DuelsModule` hiện tại không có dependency vào Redis;
sẽ thêm `@nestjs-modules/ioredis` hoặc tương đương khi bắt đầu M7.

## 2026-09-19 — Bỏ commitlint

Dự án cá nhân, 1 dev, thêm friction không cần thiết. Husky + lint-staged (eslint --fix +
prettier trên staged files) là đủ cho M0. **Hệ quả**: không có convention bắt buộc cho commit
message; có thể bật lại commitlint dễ dàng nếu sau này cần changelog tự động.

## 2026-09-19 — Test framework cho `apps/api`: Vitest thay vì Jest mặc định của NestJS

Đồng nhất toolchain test với `packages/shared`/`packages/game-engine` (đều dùng Vitest).
**Hệ quả**: `@nestjs/testing` vẫn dùng được (không phụ thuộc Jest), nhưng cần cẩn thận khi
copy ví dụ e2e test từ tài liệu Nest chính thức (thường viết cho Jest) — chuyển API tương ứng
sang Vitest (`vi.fn()` thay `jest.fn()`, v.v.) khi viết e2e ở M3.

## 2026-09-19 — `apps/api` build bằng `tsc` trực tiếp, không dùng `nest build`/`nest start --watch`

`nest build` (Nest CLI, dùng `@nestjs/compiler-core`/webpack ngầm) chạy exit code 0 nhưng
không sinh ra `dist/` trong môi trường setup này (chưa rõ nguyên nhân — có thể liên quan
Windows/incremental cache). `tsc -p tsconfig.json` chạy trực tiếp hoạt động ổn định. Dev
script dùng `concurrently` chạy song song `tsc --watch` + `node --watch dist/main.js`.
**Hệ quả**: không có HMR webpack của Nest CLI (chỉ restart process khi file đổi, chậm hơn
HMR thật nhưng đơn giản và đáng tin cậy hơn). Nếu muốn điều tra lại `nest build` sau này,
kiểm tra `nest-cli.json` + version `@nestjs/cli` trước.

## 2026-09-19 — Port Postgres/Redis đổi sang 5433/6380

Máy dev đã có sẵn container Postgres (5432) và Redis (6379) từ project khác đang chạy.
Đổi port trong `docker-compose.yml` + `.env.example` để tránh xung đột, không đụng container
của project khác. **Hệ quả**: mọi tài liệu/script tham chiếu `DATABASE_URL` phải dùng 5433,
không phải 5432 mặc định.

## 2026-09-19 — Zustand dùng qua `zustand/vanilla`, không phải React hook

`apps/web` không dùng React (Phaser scenes render trực tiếp), nên import gốc `zustand`
(trỏ tới `zustand/react`) lỗi "Cannot find package 'react'". Dùng `createStore` từ
`zustand/vanilla`, truy cập qua `.getState()`/`.setState()`/`.subscribe()`.
**Hệ quả**: không dùng được `useStore()` hook pattern — mọi Phaser Scene đọc state qua
`viewStore.getState()` trực tiếp (đã áp dụng trong `boot-scene.ts`/`menu-scene.ts`).

## 2026-09-20 — Tái cấu trúc M0–M8 thành Phase P0–P9

Đưa vertical slice (solo vs AI dummy, chơi được end-to-end) lên sớm ở P2 trước effect system; tách asset pipeline (P5) và
animation/audio (P6) thành phase riêng; AI rule-based (P8) sau effect. **Hệ quả**: `MASTER-PLAN.md` là nguồn task; ROADMAP dùng P-số.

## 2026-09-20 — Phạm vi luật v1 và `RulesetConfig`

IN: Normal/Tribute/Set/Flip/Special, Fusion (Ritual bỏ khỏi v1, xem ADR G1–G12); Spell/Trap đủ loại (Counter, Field làm ở P4). OUT: Synchro/Xyz/Pendulum/Link, ban-list.
Luật cổ điển (early Master Rule) là mặc định qua `RulesetConfig` nằm trong `state.ruleset` (để replay tái lập). **Hệ quả**: thêm Zod
schema ở `packages/shared`; các hành vi chưa xác nhận Yugi H5 (chain prompt, timer, starting LP) là config `[GUESS]`.

## 2026-09-20 — Nhãn độ tin cậy [REF]/[RULE]/[GUESS]

Không có bản gốc để đối chiếu, nên mọi hành vi ghi nhãn; `[GUESS]` không được trình bày như sự thật và phải vào danh sách xác nhận
(`docs/plan/fidelity-spec.md`). Mục tiêu "giống 100%" thay bằng 5 tầng đo được. **Hệ quả**: parity-board do người dùng duyệt.

## 2026-09-20 — Tool dev đi qua API (dev-only), web không import engine

Duel Sandbox, Replay Viewer, Animation Preview cần chạy engine; giữ nguyên nguyên tắc `apps/web` không import `applyAction` bằng cách dùng
dev-endpoint ở `apps/api` (tắt ở production). **Hệ quả**: `StateView` bổ sung `legalActions`/`legalTargets` để FE không suy luận luật.

## 2026-09-20 — Asset pipeline: art vuông 512×512, khung vẽ bằng code, asset pack ngoài git

Card frame/chữ/sao/ATK-DEF vẽ bằng code; art là 1 ảnh vuông `<cardId>.webp` thả vào `assets/card-art-src/`, thiếu art → placeholder.
`assets/card-art*` và `docs/reference` (media) ignore khỏi git (tránh ảnh bản quyền lên repo public). **Hệ quả**: thêm `sharp` (dev-only) khi làm
task 5.3 — **cần hỏi người dùng trước**; Spine không dùng mặc định (dependency lớn).

## 2026-09-20 — i18n VI+EN từ đầu

Chuỗi UI ở locale files (`apps/web/src/i18n/`), text card ở data (`{vi, en}`). Bootstrap ở task 2.10. **Hệ quả**: không hardcode chuỗi trong scene.

## 2026-09-20 — Nhãn [DECISION] và chốt G1–G12

Thêm nhãn `[DECISION]`: chủ dự án đã chốt thiết kế, chưa có `[REF]`; khác `[GUESS]` ở chỗ không hỏi lại, đổi bằng config khi có tư liệu.
Chốt: G1 `[RULE]` lượt 1 không draw/attack (`firstTurnDraw/Attack`); G2 tribute qua highlight + Xác nhận/Hủy; G3 chạm quái mở menu, chỉ action
hợp lệ theo server; G4 attack bằng kéo hoặc menu rồi chạm target; G5 hỏi "Kích hoạt?" + auto-pass (`chainPrompt`); G6 không Damage Step chi tiết,
Quick chỉ trước khi tính damage, state chừa chỗ mở rộng; G7 solo không timer, PvP 60s/lượt, hết giờ tự EndPhase, AFK nhiều lần thì thua;
G8 Fusion ở P4, **bỏ Ritual khỏi v1**, chừa `extraDeck`; G11 có surrender + log trận; G12 deck 40–60/≤3, chưa gacha/pack. G9/G10 vẫn `[GUESS]`;
LP 8000 giữ `[RULE]/[GUESS]`. Chi tiết: `docs/reference/notes/rules.md`. **Hệ quả**: thêm `chainPrompt`, `turnTimerSec`, `afkLossThreshold`,
`allowSurrender` vào `RulesetConfig`; thêm `Surrender` vào engine (task 1.8); bỏ task 4.6 Ritual; bảng duyệt luật `RULES-REVIEW-SHEET.md`.

## 2026-09-20 — C11: Trap phải Set mới kích hoạt được

`[DECISION]` (chủ dự án): Trap **không** kích hoạt từ tay; phải Set úp trên sân. Trap vừa Set ở lượt nào thì lượt đó chưa được kích hoạt `[RULE]`. Bài Phép thường vẫn kích hoạt từ tay ở Main Phase `[RULE]`. Quan sát video #2 15:17 ("Chuẩn Bị Dung Hợp" dùng từ tay, thấy 1 lần) chỉ vào backlog, không đổi quyết định.
**Hệ quả:** `RulesetConfig` thêm 2 khóa: `allowTrapActivationFromHand` (mặc định `false`, `[DECISION]`) và `trapSetTurnDelay` (mặc định `true`, `[RULE]`) — **đã làm 2026-09-20** (shared + test; thay tên đề xuất cũ `allowTrapFromHand`/`trapSetDelayTurns`). Hành vi engine chưa đổi; hợp đồng trong `docs/design/engine.md`/`protocol.md` (mã lỗi `TRAP_NOT_SET`, `TRAP_SET_THIS_TURN`; `legalActions` không liệt kê "Kích hoạt" cho Trap trên tay), implement ở task 3.4. **C11 đóng.** Quan sát 15:17 → backlog trong `rules-observed.md`.

## 2026-09-21 — Chốt C1–C4, C9, C10, C12 (+ G1/G4/openingHandSize)

Chủ dự án chốt sau khi ingest 2 video (bản web Yugi H5 quay 2023 là [REF] duy nhất, là chuẩn tham chiếu):

- **C1** `[DECISION]`: chưa làm Link/EX zone trong P1–P4. `RulesetConfig.extraMonsterZones` (mặc định 0, **chỉ lưu**, engine bỏ qua). UI vẽ 2 ô EX placeholder khóa. Link → backlog sau P4.
- **C2/C10** `[DECISION]` (**dựa trên giả thuyết**): `startingLP` mặc định 8000 cho cả hai bên (video #2, 4/4 ván); 10000 ở video #1 được giả định là chế độ khác. `StartDuel.payload.startingLP?: [n, n]` ghi đè LP từng bên.
- **C3** `[REF thấp, 1 nguồn]`: `extraDeckSize` = 20 (max schema nâng 15 → 20).
- **C4** `[DECISION]`: UI 1 nút hex 3 trạng thái (Công/Kết thúc/Thủ), không thanh phase; engine giữ đủ phase. Nghĩa của "Công" vẫn là suy luận — không hard-code.
- **C9**: tribute = overlay chọn lá + "Đồng ý" `[REF]`; nút "Hủy" là `[DECISION]` (chưa thấy trong tư liệu).
- **C12** `[DECISION]`: giữ prompt "Kích hoạt?" khi người chơi có bài hợp lệ + setting auto-pass (video chưa phân biệt được "không có bài hợp lệ").
- **G1**: lượt 1 người đi trước không draw `[REF, 4/4 ván]`; không attack `[RULE, chưa thấy]`. **G4**: kéo mũi tên tấn công là cách chính `[REF]`; "chọn Tấn công rồi chạm target" là phụ `[DECISION]`; G3 giữ `[DECISION]`.
- `openingHandSize` = 5 `[REF]`; hand limit 6, bỏ bài bằng kéo `[REF 1 lần]`; deck max 60 / max 3 bản `[REF]`, min 40 `[RULE]`.
- Backlog (chỉ ghi): điều kiện "thắng trong 20 lượt" (PvE), bong bóng "Đang suy nghĩ N" (timer), Link monster. Ngoài phạm vi: gacha/shop/guild/sự kiện/skill hệ thống riêng.

**Hệ quả:** task 1.1b (shared `extraMonsterZones`, `extraDeckSize` 20; engine `StartDuel` LP từng bên). Task 1.2 hết bị chặn.

## 2026-09-21 — Draw của lượt thực hiện khi rời Draw phase (task 1.2)

`StartDuel` giữ nguyên (phase `Draw`, chưa rút); `EndPhase` từ `Draw` rút 1 lá (bỏ qua lượt 1 nếu `!firstTurnDraw`, `[RULE]`/`[REF]`). Một đường code cho lượt 1 và các lượt sau, không phải đổi `StartDuel`. Chuỗi phase không rút gọn ở lượt 1; cấm attack lượt 1 để `DeclareAttack` (1.6) đọc `firstTurnAttack`. Reject = `throw Error` (mã lỗi chuẩn hoá ở tầng API sau). **Hệ quả:** UI 1 nút hex (C4) phải gọi `EndPhase` nhiều lần hoặc server auto-advance — quyết ở P2.

## 2026-09-21 — NormalSummon/SetMonster: zoneIndex, Set tiêu tốn quyền, Level ≥ 5 chặn tạm, tra card qua ctx (task 1.3)

- **`zoneIndex` (0–4) nằm trong payload**: khớp thao tác kéo thả vào ô; engine không tự chọn ô. Repo chưa có convention riêng nên theo `playerIndex` + tham số như `Draw`/`EndPhase`.
- **Set tiêu tốn quyền Normal Summon** `[RULE]` (Summon và Set dùng chung 1 quyền/lượt).
- **Level ≥ 5 bị từ chối cả Summon lẫn Set** với thông báo rõ; Tribute Summon/Set là task 1.4 (không làm sớm).
- **`ActionContext.cardDefinitions`** (resolver do caller truyền): giữ engine data-driven, không import dữ liệu lá cụ thể; test tự dựng lá level 1/4/5/6/7. `apps/api` sẽ truyền resolver ở P2.
- **`MonsterSet` không có `definitionId`**: lá úp, tránh lộ khi sau này lọc event theo góc nhìn từng người chơi. `NormalSummoned` có `definitionId` (lá ngửa).
- **`resetTurnFlags`** gom mọi reset cờ theo lượt, gọi khi rời End Phase.
  **Hệ quả:** `apps/api` bắt buộc truyền `cardDefinitions` khi gọi `applyAction` cho action đọc dữ liệu lá.

## 2026-09-21 — `EngineError` có mã lỗi + `ActionContext.cardDefinitions` bắt buộc

Reject bằng `throw new EngineError(code, message)` thay cho `Error` trần: `code` là union string literal ổn định (API map sang HTTP/socket error, test kiểm `code`, không kiểm text message — regex ngắn kiểu `/already/i` từng dễ trùng nhầm/vỡ khi đổi câu chữ). `message` giữ nguyên nội dung. `ActionContext.cardDefinitions` thành bắt buộc trong type; `applyAction` dùng overload để `StartDuel`/`Draw`/`EndPhase` vẫn gọi không cần ctx, còn lại bắt buộc ctx, kèm guard runtime `NO_CARD_RESOLVER` cho caller không qua type. `LP override` sai cũng dùng `INVALID_STARTING_LP`. **Hệ quả:** action mới phải khai báo code trong `errors.ts`; `apps/api` (P2) phải truyền resolver. Mutation test 17 đột biến trên `summon.ts`: 0 sống.

## 2026-09-21 — Tribute Summon/Set (task 1.4): mở rộng action, ô giải phóng, prompt tách khỏi 1.4

- **Mở rộng `NormalSummon`/`SetMonster` bằng `tributeInstanceIds?`, không thêm action mới**: server vẫn nhận 1 action nguyên tử (FE chọn tribute rồi gửi một lần), không có trạng thái trung gian trong engine, replay đơn giản. Số tribute lấy từ Level của definition `[RULE]` (1–4:0, 5–6:1, 7+:2); code `TRIBUTE_COUNT_MISMATCH`/`INVALID_TRIBUTE` (`LEVEL_NEEDS_TRIBUTE` bị gỡ). Trùng id cũng là `INVALID_TRIBUTE`; check số lượng trước tính hợp lệ.
- **Ô giải phóng `[RULE]`**: `zoneIndex` được trỏ vào ô của quái vừa bị tribute (sân đầy 5 quái vẫn triệu hồi được); ô có quái không bị tribute → `ZONE_OCCUPIED`.
- **Event `MonsterTributed`** (chưa có event graveyard chung): `ownerIndex, instanceId, definitionId, zoneIndex`, có `definitionId` vì mộ public; phát trước event Summon/Set. Quái vào mộ với `position: null`.
- **`PendingPrompt SelectTribute` tách khỏi 1.4** (chủ dự án chốt): overlay chọn lá + Đồng ý `[REF]`, nút Hủy `[DECISION]` (C9/G2) làm ở task UI (gần 2.6) như bước thu thập input phía client trước khi gửi 1 action. `ResolvePendingPrompt` giữ cho các prompt thật sự cần engine chờ (chain, target) ở P3.
- Nguồn luật `docs/reference/02-yugi-h5-mechanics.md` **chưa có trong repo**; ngưỡng tribute dựa `[RULE]`, đối chiếu khi file được thêm.
  **Hệ quả:** MASTER-PLAN 1.4 sửa bỏ SelectTribute; task UI phải tự dựng tribute selection rồi gửi `tributeInstanceIds`.

## 2026-09-21 — ChangePosition (task 1.5): dấu lượt theo quái, `toPosition` tường minh, luật ASSUMED

- **Trạng thái theo quái = dấu lượt trên `CardInstance`** (`summonedTurn`, `positionChangedTurn`, `attackedTurn`, optional, giá trị = `state.turnCount`). "Trong lượt này" ⇔ dấu === `turnCount`, nên **tự hết hiệu lực**, không cần reset thủ công và `resetTurnFlags` không đổi (cờ boolean theo quái sẽ phải quét mọi ô mỗi lượt và dễ quên cờ mới). Chỉ ghi ở `summon.ts` bằng cách dựng `CardInstance` mới khi đặt quái (không `...card`), nên quái từng ở sân rồi quay lại không mang dấu cũ. Hành vi Summon/Set giữ nguyên, toàn bộ test 1.2–1.4 xanh không sửa. Tên `attackedThisTurn` trong yêu cầu được biểu diễn thành `attackedTurn`; `DeclareAttack` (1.6) chịu trách nhiệm ghi.
- **`ChangePosition { playerIndex, cardInstanceId, toPosition }` với `toPosition` tường minh** (`Attack | DefenseUp`), không toggle: client dùng state cũ không thể đổi nhầm chiều; đổi sang cùng tư thế là `SAME_POSITION`. Đích `DefenseDown` bị `INVALID_POSITION` (úp là Set/Flip). Chỉ quái ngửa của chính người gọi; quái úp → `MONSTER_FACE_DOWN` (Flip Summon là task riêng).
- **Event `PositionChanged`** dùng `instanceId` (theo convention các event hiện có, không phải `cardInstanceId` như tên payload action) và có `definitionId` vì chỉ quái ngửa mới đổi được.
- **Nhãn:** toàn bộ luật đổi thế là `[RULE]` (RULES-REVIEW-SHEET, rules-coverage); **không có `[REF]`** (video #2 không thấy thao tác đổi thế). `[ASSUMED]`/thiết kế của AI: `toPosition` tường minh; Tribute Summon và Set cũng tính "vừa Summon" (Set moot vì quái úp); tách `NOT_A_MONSTER` (lá phép/bẫy trên sân của mình) khỏi `CARD_NOT_ON_FIELD` (tay/mộ/quái đối thủ/id lạ — không lộ thông tin lá đối thủ).
- **Hệ quả:** `DeclareAttack` (1.6) đặt `attackedTurn`; `FlipSummon` sau này nên đọc `summonedTurn` (quái vừa Set không Flip cùng lượt `[RULE]`) và ghi dấu riêng nếu cần. Mutation test 25 đột biến trên `change-position.ts`/`summon.ts`: 0 sống, 0 no-op.

## 2026-09-22 — DeclareAttack (task 1.6): 3 event tách riêng, sửa bảng damage theo RULES-REVIEW-SHEET đã duyệt, direct attack chặn theo "có quái" (không phân biệt ngửa/úp)

- **Sửa so với brief nhận được**: prompt task 1.6 đưa ra bảng damage ATK-vs-DEF khác với `docs/reference/notes/RULES-REVIEW-SHEET.md` dòng 33-34 — dòng này **đã được chủ dự án duyệt (☑)** ở phiên trước, nên được coi là nguồn đáng tin hơn một bảng luật mới dán vào chưa qua duyệt. Đã sửa lại theo sheet: ATK > DEF → chỉ phá quái thủ, **không ai mất LP** (không phải "đối thủ nhận damage = hiệu số" như brief); ATK < DEF → bên tấn công mất chênh lệch, **không quái nào bị phá** (không phải "quái tấn công bị destroy" như brief — outcome đó chỉ áp dụng cho nhánh ATK-vs-ATK). Trường hợp ATK == DEF vs quái Thủ không có trong sheet, xử lý `[ASSUMED]`: không ai bị phá, không ai mất LP (thêm dòng mới vào RULES-REVIEW-SHEET, để trống ô duyệt).
- **Điều kiện tấn công trực tiếp** cũng sửa theo sheet dòng 29: chỉ hợp lệ khi đối thủ **không có quái nào trên sân** (kể cả úp), không phải "không có quái ngửa" như suy diễn ban đầu từ brief. Hệ quả: nếu sân đối thủ chỉ có quái úp, người chơi **không có action hợp lệ nào để tấn công lá đó ở task này** (không direct-attack được vì có quái; không target được vì `TARGET_FACE_DOWN`) — lỗ hổng này là chủ đích, lật quái bị tấn công (Flip) thuộc task 1.7.
- **3 event tách riêng** (`AttackDeclared`, `MonsterDestroyed`, `DamageDealt`), không gộp: khớp với danh sách đã ghi sẵn trong `docs/design/engine.md`/comment `events/types.ts`, và tách sẵn giúp FE animate destroy/damage độc lập (không phải mọi attack đều có cả 2). Thứ tự event cố định: `AttackDeclared` → `MonsterDestroyed` (quái đối thủ trước, quái mình sau nếu cả hai bị phá) → `DamageDealt`. `MonsterDestroyed` mirror `MonsterTributedEvent` (không có field `reason` — YAGNI, thêm sau nếu effect-destroy cần phân biệt nguồn phá hủy).
- **Không thêm mã lỗi `ALREADY_ATTACKED`** như brief gợi ý — tái dùng `ATTACKED_THIS_TURN` đã có từ task 1.5 (cùng ý nghĩa, tránh 2 mã trùng). 6 mã mới: `FIRST_TURN_ATTACK_BANNED`, `ATTACKER_IN_DEFENSE_POSITION`, `JUST_SUMMONED_CANNOT_ATTACK`, `MUST_TARGET_MONSTER`, `TARGET_FACE_DOWN`, `INVALID_TARGET`.
- **`resolveMonster` (trước đây private trong `summon.ts`) được export** để `declare-attack.ts` tái dùng thay vì chép lại logic resolve `MonsterCardDefinition` — thuần đổi visibility, không đổi hành vi.
- **State 2 phía**: khác `change-position.ts`/`summon.ts` (chỉ đụng 1 bên qua ternary `[next, other]`), `declare-attack.ts` build `nextAttackingPlayer`/`nextOpponent` độc lập rồi ráp lại theo `playerIndex`, vì quái tấn công và quái mục tiêu thường ở 2 phía khác nhau.
- **Chưa xử lý win condition** (LP về 0 → kết thúc trận) — chỉ `Math.max(0, lp - damage)` clamp về 0, để task riêng sau xử lý `winnerIndex`/`DuelEnded`. **Hệ quả:** `DeclareAttack` type/handler/event mới xong; mutation test 24 đột biến trên `declare-attack.ts`: 0 sống. Task tiếp theo (win condition + hand limit + Surrender) đọc `RULES-REVIEW-SHEET.md` dòng 42-45.

## 2026-09-22 — Win condition LP ≤ 0 (task 1.7): widen `winnerIndex` để chứa hòa, helper riêng cho reuse, đổi số thứ tự task

- **`GameState.winnerIndex` mở rộng từ `0 | 1 | null` sang `0 | 1 | 'draw' | null`**: `null` sẵn đang mang nghĩa "đang đấu" (mọi handler check `winnerIndex !== null` để chặn `DUEL_ENDED`) — nếu biểu diễn hòa bằng `null` thì mọi guard đó âm thầm ngừng chặn action sau 1 trận hòa, là bug thật chứ không phải tiểu tiết. Đổi type là thay đổi cộng thêm (additive), mọi chỗ `state.winnerIndex !== null` hiện có (`change-position.ts`, `summon.ts`, `declare-attack.ts`, `end-phase.ts`) không cần sửa vì `'draw' !== null`. Xác nhận bằng `grep`: `winnerIndex` hiện chỉ dùng trong `packages/game-engine`, chưa chạm `apps/api` (P2 chưa bắt đầu) nên an toàn đổi type. Đã xác nhận bằng mutation test ở mức type: revert type về `0 | 1 | null` làm `tsc` báo lỗi ngay tại chỗ gán `winnerIndex: 'draw'` trong `declare-attack.ts` — chứng minh việc mở rộng type thật sự cần thiết cho logic mới, không phải thừa.
- **Event `DuelEnded { winnerIndex: 0 | 1 | null; reason: 'LP_ZERO' }`** giữ `winnerIndex: null` = hòa (không nhập nhằng với "đang đấu" vì event chỉ phát khi duel thật sự kết thúc). `reason` là string literal union để sau này thêm lý do khác (deck-out, effect) không phải đổi shape event.
- **Helper riêng `state/win-condition.ts` (`checkLifePointsWinCondition`)** thay vì nhét thẳng logic vào `declare-attack.ts`, theo đúng tinh thần `state/turn-flags.ts` đã có (helper state dùng chung, không phải nằm trong 1 handler) — để loss condition sau này (deck-out phát `DuelEnded`, effect damage/burn) tái dùng thay vì chép lại. LP đã được `damage()` trong `declare-attack.ts` clamp `>= 0` trước khi helper chạy, nên `<= 0` ⇔ `=== 0`, không cần đổi cách clamp.
- **`draw.ts`'s `DeckOut` không đổi** — vẫn set `winnerIndex` trực tiếp mà không phát `DuelEnded`, đúng theo phạm vi brief (ngoài phạm vi task 1.7).
- **[ASSUMED]**: cả hai LP cùng về 0 trong cùng 1 lần damage → hòa (`winnerIndex: 'draw'`), không throw. Không có tư liệu; hợp lý theo luật YGO chuẩn nhưng chưa `[REF]`. Test dựng fixture LP đối thủ đã sẵn 0 (giả tạo, không thể đạt qua chơi bình thường vì `DUEL_ENDED` sẽ chặn trước) để exercise nhánh này không crash.
- **Đổi số thứ tự task**: `PROGRESS.md` trước đó ghi 1.7 = Flip-on-attack, 1.8 = win condition; brief lần này gọi win condition là "1.7" nên làm trước, Flip-on-attack đẩy xuống task kế tiếp (số thứ tự cụ thể chưa chốt). **Hệ quả:** `checkLifePointsWinCondition` chỉ gọi từ `declare-attack.ts`; task deck-out/hand-limit/Surrender sau này nên tái dùng helper này thay vì viết lại logic LP≤0. Mutation test 12 đột biến trên `win-condition.ts`/`declare-attack.ts` (11 runtime + 1 type-level cho việc widen `winnerIndex`): 0 sống.

## 2026-09-23 — Flip-on-Attack (task 1.8): `DefenseDown → DefenseUp` khi lật, event `MonsterFlipped`, xoá `TARGET_FACE_DOWN`

- **Target face-down giờ hợp lệ, không còn `TARGET_FACE_DOWN`**: `declare-attack.ts` không còn reject target úp — thay vào đó lật nó lên rồi chạy tiếp damage calc y hệt logic ATK-vs-DEF của task 1.6 (không viết công thức mới). Mã lỗi `TARGET_FACE_DOWN` bị xoá khỏi `errors.ts` (không còn dùng ở đâu khác trong repo, đã grep xác nhận).
- **Lật `DefenseDown → DefenseUp`** (không phải field `faceDown` riêng): engine không có khái niệm "face-up nhưng vẫn Defense-down" tách biệt — model `CardPosition` chỉ có 3 giá trị (`Attack | DefenseUp | DefenseDown`), nên "lật ngửa, giữ Defense" chỉ có một cách biểu diễn hợp lý là chuyển sang `DefenseUp`. Theo luật cổ điển, quái Set bị tấn công lật ngửa và **giữ nguyên Defense Position** cho damage calc, không tự chuyển Attack — khớp với representation này. Quái không tự úp lại sau đó (không có cơ chế nào trong repo làm việc đó).
- **Event `MonsterFlippedEvent { ownerIndex, instanceId, definitionId, zoneIndex }`** theo đúng convention `MonsterTributedEvent`/`MonsterDestroyedEvent` (mộ/sân là public zone nên `definitionId` được lộ ra khi lật, đúng như 2 event kia). Phát **ngay sau** `AttackDeclared` và **trước** `MonsterDestroyed`/`DamageDealt` — theo yêu cầu task brief (UI animate lật trước khi thấy kết quả combat), khớp thứ tự event cố định đã có từ task 1.6.
- **Không sửa `resolveMonster`** (`summon.ts`): hàm chỉ đọc `definitionId`, không quan tâm `position`, nên target sau khi lật (đã đổi `position` nhưng giữ nguyên `definitionId`) chạy qua `resolveMonster` không cần thay đổi gì — xác nhận qua đọc code trước khi sửa (theo yêu cầu brief).
- **Direct-attack condition (`opponent.board.monsterZones.some((c) => c !== null)`) KHÔNG đổi**: đọc lại code xác nhận điều kiện này từ task 1.6 đã đúng theo ADR 1.6/1.7 (chặn direct attack khi đối thủ có bất kỳ quái nào, úp hoặc ngửa) — task brief gọi đây là "sửa lỗi 1.6 để lại" nhưng thực tế không có lỗi cần sửa ở nhánh này, chỉ cần test coverage rõ ràng hơn (đã thêm). Task brief cũng tự lưu ý khả năng này và yêu cầu dừng lại báo cáo nếu phát hiện mâu thuẫn — đây là trường hợp đó, ghi nhận ở đây thay vì tự ý đổi logic không cần thiết.
- **`summonedTurn`/`positionChangedTurn` của quái đối thủ không chặn việc nó bị target/lật** — hai dấu lượt này (task 1.5) chỉ chặn hành động chủ động của chính quái đó (đổi thế, tấn công), không liên quan đến việc nó bị tấn công/lật; thêm test riêng xác nhận.
- **Chưa làm Flip Effect thật** (chờ effect system P3) — `MonsterFlippedEvent` chỉ mang đủ thông tin (`instanceId`, `definitionId`, `zoneIndex`, `ownerIndex`) để hook vào sau, không tự ý mở rộng sang effect system trong task này.
- **[ASSUMED]**: ATK == DEF chống lại target vừa lật cũng không ai bị phá/mất LP — tái dùng đúng `[ASSUMED]` đã có từ task 1.6 cho case ATK-vs-DEF thường (không phải luật mới), vì downstream dùng chung nhánh code.
  **Hệ quả:** `docs/design/engine.md` cập nhật đoạn `DeclareAttack`; `RULES-REVIEW-SHEET.md` dòng "Quái úp bị tấn công" đổi tên test thật, để trống ô duyệt (nội dung cụ thể hơn bản nháp cũ, cần user duyệt lại); `parity-board.md` cập nhật ghi chú "Attack / damage". 277 test xanh (270 cũ + test mới, 1 test cũ đổi tên/hành vi có chủ đích). Mutation test thủ công trên đoạn code sửa trong `declare-attack.ts`: xem review packet task 1.8.

## 2026-09-23 — Surrender (task 1.9): chặn `DUEL_ENDED` + `SURRENDER_DISABLED`, thêm reason `'SURRENDER'`

- **Chỉ thêm giá trị mới, không đổi shape**: `DuelEndedEvent.reason` mở rộng `'LP_ZERO'` → `'LP_ZERO' | 'SURRENDER'`; `winnerIndex` (state và event) giữ nguyên. Surrender luôn có người thắng (đối thủ của người đầu hàng), không bao giờ hòa.
- **Validate `DUEL_ENDED` rồi `SURRENDER_DISABLED`** `[RULE]`/`[DECISION]` (G11): không `NOT_TURN_PLAYER`, `WRONG_PHASE` — cả hai bên đầu hàng được ở mọi phase. **Không chặn bởi `PENDING_PROMPT`** (khác `ChangePosition`/`Summon`/`DeclareAttack`): người chơi bị treo ở prompt (target/chain sau này) vẫn phải thoát được trận. Đây là thiết kế của AI dựa trên "bất kỳ phase nào", được test riêng.
- **Handler thuần**: chỉ đổi `winnerIndex` + `version + 1`, không đụng LP/board/hand/`pendingPrompt`; không tái dùng `checkLifePointsWinCondition` vì không liên quan LP.
- **Engine đọc `state.ruleset.allowSurrender`** (field có sẵn, mặc định `true`): `false` → `SURRENDER_DISABLED`. Sửa lại sau review: bản đầu để `apps/api` tự kiểm, lệch dòng "(nếu `allowSurrender`)" đã duyệt trong RULES-REVIEW-SHEET và nguyên tắc mọi thay đổi trạng thái đi qua engine. Thứ tự guard: `DUEL_ENDED` trước (trạng thái cấp cao hơn), rồi `SURRENDER_DISABLED`.
- **Đánh số lại**: Surrender là 1.9; hand limit 6 + deck-out phát `DuelEnded` là task kế tiếp; golden replay/fuzz đẩy xuống sau đó.
  **Hệ quả:** API chỉ cần map `SURRENDER_DISABLED`; UI ẩn nút theo `legalActions`. Mutation test thủ công 14 đột biến trên `surrender.ts` (10 + 4 cho `allowSurrender`): 0 sống.

## 2026-09-23 — Deck-out (task 1.10): giữ `DeckOut`, thêm `DuelEnded 'DECK_OUT'`, guard `DUEL_ENDED` cho `Draw`

- **Logic rút bài đã có sẵn** (`draw.ts`, và `EndPhase` gọi khi rời Draw phase) nên task chỉ bổ sung phần thiếu: deck-out trước đây chỉ set `winnerIndex` + phát `DeckOut`, **không** phát `DuelEnded`. Không phải làm lại Draw Phase.
- **Giữ `DeckOut` rồi thêm `DuelEnded { winnerIndex: đối thủ, reason: 'DECK_OUT' }`** (không thay): `DeckOut` cho UI animate lần rút hụt, `DuelEnded` là tín hiệu kết thúc thống nhất với `LP_ZERO`/`SURRENDER` (cùng mẫu `DamageDealt` → `DuelEnded`). Chỉ thêm giá trị `reason`, không đổi shape.
- **Deck rỗng chỉ thua khi phải rút** `[RULE]`: rút đầu lượt (không ở lượt 1 nếu `!firstTurnDraw`, `[REF]` G1) hoặc `Draw` với `count > deck.length`. Deck vừa đủ (rút hết lá cuối) hợp lệ.
- **`applyDraw` thêm guard `DUEL_ENDED`**: trước đó gọi `Draw` trực tiếp sau khi trận kết thúc vẫn chạy. Sửa nhỏ cần để yêu cầu "action sau deck-out bị chặn" đúng với mọi action.
- **Test cũ phải đổi (bắt buộc)**: 2 assertion `events` toEqual `[DeckOut]` (`apply-action.test.ts`, `end-phase.test.ts`) nay có thêm `DuelEnded`. Không test nào khác đổi.
  **Hệ quả:** không thêm mã lỗi. Mutation test thủ công 9 đột biến trên `draw.ts`/`end-phase.ts`: 0 sống.

## 2026-09-23 — Hand limit (task 1.11): prompt thật đầu tiên, `ResolvePendingPrompt` vỏ chung, `Draw` bị chặn khi có prompt

- **Trước task này chưa handler nào tạo `PendingPrompt`** (chỉ có type + guard). Chủ dự án chọn dùng prompt thật (không gộp lá bỏ vào `EndPhase` như tribute ở ADR 1.4): tay > `handLimit` thì `EndPhase` từ `Main2` đặt `pendingPrompt {kind:'DiscardToHandLimit', payload:{count}}` và **không tiến phase**; người chơi trả lời bằng `ResolvePendingPrompt`. Lý do: dựng sớm cơ chế chung mà P3 (target/chain) cần; đổi lại thêm 1 action + trạng thái trung gian.
- **`promptId` tất định** `discard-<turnCount>` (không RNG/đồng hồ, replay tái lập; mỗi lượt tối đa 1 prompt này).
- **`ResolvePendingPrompt` là vỏ chung**: guard `DUEL_ENDED` → `NO_PENDING_PROMPT` → `PROMPT_MISMATCH` (sai `promptId` hoặc người) rồi dispatch theo `kind` (kind lạ → `UNKNOWN_PROMPT_KIND`). Với `DiscardToHandLimit`: đúng `count` lá khác nhau từ tay người được hỏi, không thì `INVALID_DISCARD`; state không đổi khi reject. Xong: lá vào mộ `position: null` (quy ước như tribute), phát `CardDiscarded` từng lá theo thứ tự chọn (mộ public nên có `definitionId`), xoá prompt, tiến `Main2 → End`. Payload answer hiện chỉ có `cardInstanceIds`; kind sau này thêm field riêng.
- **Thời điểm kiểm = rời Main2** `[RULE]` (theo brief). `[REF]` video #2 18:36 chỉ thấy "bấm Kết thúc với tay 7 → overlay kéo bài bỏ", việc ánh xạ sang Main2→End là `[ASSUMED]`. Giới hạn đọc `ruleset.handLimit` (mặc định 6, `[REF]` 1 lần).
- **`Draw` thêm guard `PENDING_PROMPT`** (trước đó thiếu; `EndPhase` đã tự guard trước khi gọi `applyDraw` nên không đổi hành vi có sẵn). `Surrender` vẫn bỏ qua prompt (ADR 1.9).
- **Không đổi test cũ nào.** Mutation test thủ công 17 đột biến (`end-phase.ts`, `resolve-pending-prompt.ts`, `draw.ts`): 16 bị bắt; 1 sống là **mutant tương đương** — bỏ `position: null` khi vào mộ không đổi gì quan sát được vì lá trên tay luôn có `position: null` (giữ dòng đó để phòng thủ).
  **Hệ quả:** API/UI phải hiển thị overlay khi `pendingPrompt.kind === 'DiscardToHandLimit'` và gửi `ResolvePendingPrompt`; `legalActions` (P2) liệt kê action này khi có prompt.

## 2026-09-23 — Golden replay + fuzz harness (task 1.12): baseline JSON commit, cập nhật bằng env, không thêm dependency

- **Golden = INPUT trong code, OUTPUT ghi từ engine**: `GOLDEN_CASES` chỉ chứa `StartDuel` + danh sách action; `src/__golden__/<case>.json` lưu events + `version` từng bước, mã lỗi khi action bị reject, và final state. Không lưu state từng bước (file nhỏ; events + version + final state đủ bắt regression). Một hàm `replay` + một assertion cho mọi case. Reject cũng được đóng băng (bắt được đổi mã lỗi/thứ tự guard).
- **Cập nhật baseline bằng `UPDATE_GOLDEN=1`** trong chính test (dùng `node:fs` chỉ ở `*.test.ts`, không vào build) thay vì thêm `tsx`/script riêng — không thêm dependency. Diff JSON phải được xem trước khi commit.
- **Fuzz**: PRNG riêng theo seed (không dùng `state.rng`), generator theo phase (~85% hợp lệ có chủ đích, ~15% rác) để không toàn bị reject; engine truyền vào được (`apply`) để test rằng harness bắt được engine bị phá. State đầu vào deep-freeze ⇒ mutate = throw ⇒ vi phạm. Chỉ `EngineError` là reject hợp lệ.
- Invariant chi tiết ở `docs/ai/review-packets/task-1.12.md`. Suite thường 10 seed × 300; chạy dài bằng `FUZZ_SEEDS`/`FUZZ_STEPS`. **Hệ quả:** khi thêm action/lá mới (P3+) phải mở rộng generator + `FUZZ_DEFS` và thêm golden case; đổi shuffle/thứ tự event làm golden đỏ (chủ đích).

## 2026-09-23 — StateView filter (task 2.1): type ở shared, lá ẩn là union, Spell/Trap fail-closed, chưa lọc event

- **Type `StateView` ở `packages/shared`** (types only) vì `apps/web` chỉ được import shared; hàm `toStateView` ở `apps/api/src/modules/duels/state-view.ts` (thuần, dùng type `GameState` từ engine). Không sửa game-engine.
- **Lá ẩn = `HiddenCardView {hidden:true, instanceId, ownerIndex}`**, lá thấy = `VisibleCardView {hidden:false, ...}` (discriminant `hidden`). Giữ `instanceId` để FE định vị/animate; `instanceId` engine sinh dạng `p<i>-<n>` không chứa `definitionId` nên không rò. Tay đối thủ = mảng lá ẩn cùng độ dài + `handCount`.
- **Deck/Extra Deck: chỉ count cho cả hai bên** (kể cả chủ, theo yêu cầu). Extra Deck không có trong yêu cầu — chọn ẩn nội dung `[ASSUMED]`, đổi khi UI cần chủ xem Extra Deck (P4).
- **Không gửi `rng` và `chainStack`** (rng lộ thứ tự shuffle; chainStack là `unknown`). `pendingPrompt` gửi nguyên (public theo yêu cầu); prompt tương lai chứa thông tin riêng (chọn target...) phải lọc theo `playerIndex` khi làm P3.
- **Quái úp ⇔ `position === 'DefenseDown'`. Spell/Trap/Field của đối thủ: fail-closed** — chỉ thấy khi `position` là `Attack`/`DefenseUp`; engine chưa có handler đặt Spell/Trap và chưa có marker ngửa/úp riêng nên `[ASSUMED]`, chốt lại ở task 3.4.
- **Event filter chưa làm (ngoài scope 2.1)**: `MonsterSet` đã không có `definitionId` (ADR 1.3), nhưng cần xem lại `CardDrawn`/`CardDiscarded`(tay)/`MonsterFlipped`... khi lọc theo viewer; phải xong trước khi 2.3 phát event thô cho đối thủ.
  **Hệ quả:** 2.2/2.3 chỉ trả state qua `toStateView`. Mutation test thủ công 5 đột biến: 0 sống.

## 2026-09-23 — DuelService (task 2.2): manager thuần + store async, mutex theo duel, lỗi có cấu trúc

- **Tách `DuelManager` (thuần, không Nest) khỏi `DuelService` (`@Injectable`, kế thừa, chỉ nối store + card pool)**: logic test được không cần DI; một test riêng (`duels.module.spec.ts`) kiểm DI chạy thật. Store là `DuelStore` async (`get/save/delete`) để thay bằng DB/Redis không sửa manager; `InMemoryDuelStore` là mặc định (mất phiên khi restart, chưa TTL/dọn duel bỏ dở — backlog).
- **Session bất biến**: mỗi thay đổi `save` object mới (`state`, `actionLog`); reject/lỗi lạ không gọi `save` nên state giữ nguyên tham chiếu cũ. Lưu `seed`, `startAction` và `actionLog` (chỉ action **được chấp nhận** + `version` sau khi áp) — đủ để replay (có test replay = state cuối). Không lưu events (tái sinh được), không timestamp (giữ tất định).
- **Mutex = chuỗi promise theo `duelId`**, cả `submitAction` và `closeDuel` đi qua; `get → apply → save` nằm trọn trong critical section; task lỗi không làm kẹt hàng đợi; duel khác nhau không chặn nhau. Đủ cho 1 process; nhiều instance (Redis) cần lock phân tán hoặc version check khi thay store.
- **Kiểm tra ở service trước engine**: `StartDuel`/`Draw` từ người chơi → `FORBIDDEN_ACTION` (Draw là nội bộ của `EndPhase`); `payload.playerIndex !== playerIndex` người gọi → `PLAYER_MISMATCH` (chống mạo danh). Lượt/prompt/`DUEL_ENDED`... để engine quyết (đã có test) và được bọc thành `ACTION_REJECTED` + `engineCode`. Lỗi không phải `EngineError` → `INTERNAL_ERROR` (state nguyên, không lộ message nội bộ). Mã khác: `DUEL_NOT_FOUND`, `INVALID_CONFIG`, `UNKNOWN_CARD`.
- **`[ASSUMED]` cần duyệt**: (1) `submitAction` trả `events` **thô** (theo yêu cầu) — chỉ dùng nội bộ, không forward cho đối thủ tới khi có task lọc event; (2) service nhận `playerIndex` trực tiếp, ánh xạ user/guest→playerIndex là việc 2.3; (3) không validate cỡ deck 40–60/≤3 (chỉ cấu trúc + card tồn tại) — để 2.3/P7; (4) `closeDuel` id lạ → `DUEL_NOT_FOUND` (không idempotent); (5) `getView`/`getDuel` không qua mutex (đọc bản đã lưu gần nhất); (6) `getDuel` trả session thô — chỉ nội bộ.
  **Hệ quả:** 2.3 chỉ gọi `DuelService`, map `DuelServiceError.code` sang HTTP. Mutation test thủ công 9 đột biến (bỏ mutex, bỏ log, bỏ PLAYER_MISMATCH, cho Draw, sai viewer, close không kiểm tra, queue kẹt, bỏ validate card, nuốt EngineError): 0 sống.

## 2026-09-23 — Event filter (task event-filter): phân loại theo loại event, deny by default, `eventsByViewer`

- **Bảng phân loại** (`docs/design/event-visibility.md`): trong 15 event của engine chỉ `CardDrawn` là OWNER_ONLY (chủ thấy `card` đầy đủ, đối thủ nhận `HiddenCardView` `{hidden:true, instanceId, ownerIndex}` dùng lại kiểu của StateView); 14 event còn lại PUBLIC và giữ nguyên shape engine (FE đọc cùng field). Chưa có event HIDDEN.
- **Quyết định chỉ theo loại event, không cần state trước/sau**: engine đã phát event với ngữ nghĩa lộ/ẩn dựng sẵn (vd `MonsterSet` không mang `definitionId`). **Bất biến engine**: event không mang `definitionId` của lá còn ẩn với đối thủ, trừ `CardDrawn`. Nếu sau này cần trạng thái để lọc, thêm tham số tường minh vào `toEventView`, không suy đoán.
- **Deny by default**: `switch` vét cạn + `const x: never = event`; thêm loại event mới mà chưa phân loại làm `tsc` đỏ (đã kiểm chứng bằng probe tạm rồi hoàn tác), runtime loại lạ trả `null` (bị bỏ). Type `EventView` khai báo lại trong `packages/shared` (shared không import engine); test `Record<GameEvent['type'], …>` và phép gán compile-time giữ hai bên đồng bộ shape.
- **`DuelManager.submitAction` trả `{view, events, eventsByViewer}`**; events thô của engine không còn ra khỏi lớp. `events` = `eventsByViewer[người gửi]` (giữ tương thích test 2.2). Không lưu event vào session.
- **`[ASSUMED]`**: `MonsterSet` PUBLIC (lộ `instanceId` lá tay vừa Set, khớp StateView); tribute/phá/bỏ bài lá úp công khai danh tính vì vào mộ; `instanceId` `p<i>-<n>` không rò nội dung (đối thủ không biết decklist).
  **Hệ quả:** 2.3 chỉ phát `eventsByViewer[i]` cho người chơi `i`. Test chéo (replay qua `DuelManager`, so event với `toStateView` sau mỗi action) là lưới an toàn cho bất biến engine; nên mở rộng khi P3 thêm Spell/Trap. Mutation test thủ công 9 đột biến: 0 sống.

## 2026-09-24 — HTTP duel solo (task 2.3): solo-debug, guest stateless, `duel-access`, deck qua `validateDeck`

- **`solo-debug`**: chưa có AI nên một guest sở hữu cả 2 ghế và gửi action cho cả hai (`playerIndex` trong body), xem bằng `?viewer`. `DuelSession` có `mode` + `ownerId` (optional; thiếu = không ai truy cập, fail closed). Ánh xạ guest → ghế nằm trọn ở `duel-access.ts` (`assertMayControl`/`assertMayView`/`playerIdsFor`); thêm `solo-vs-ai`/`pvp` = thêm nhánh `switch`. Người khác → `NOT_OWNER` (403, mã `DuelErrorCode` mới). Kiểm quyền đi qua `DuelManager.getMeta` (chỉ mode + owner), không đụng `getDuel` thô. Người không phải chủ vẫn phân biệt được 404 (id lạ) và 403 (id có thật): chấp nhận vì id là UUID.
- **Guest stateless**: `POST /auth/guest` chỉ ký JWT (`sub=guestId`, `kind:"guest"`), không ghi DB (DB/upgrade sang account là P7). Guard tự viết (`GuestAuthGuard`, `@nestjs/jwt`), không dùng passport. TTL riêng `GUEST_TOKEN_TTL` (12h) vì chưa có refresh. `env.schema` thêm refine: production từ chối secret bắt đầu bằng `change-me` (thiếu secret đã fail-fast sẵn).
- **`createDuel` trả `{duelId, views, eventsByViewer}`** (cộng thêm) để trả event mở đầu (`DuelStarted` + 10 `CardDrawn`, lá đối thủ ẩn). Controller trả đúng `viewer` được yêu cầu.
- **Response chỉ 1 ghế**: action trả `{view, events}` của ghế `playerIndex`; không bao giờ trả `eventsByViewer` nguyên mảng hay view ghế kia (ghế kia lấy bằng GET với `?viewer`).
- **Deck**: `deck` (cả hai ghế dùng chung) hoặc `decks` (mỗi ghế một deck), loại trừ nhau; không có = `STARTER_DECK`. `validateDeck` (shared, thuần, trả _danh sách_ lỗi; tầng HTTP thêm `seat`). Pool placeholder mở rộng lên 20 lá (thêm 15 quái SMP-004…018) vì 5 lá cũ không thể lập deck ≥40 lá ≤3 bản; starter deck = 14 quái đầu × 3 = 42 (không Spell/Trap vì engine chưa xử lý chúng).
- **Validate bằng Zod nhưng qua `ZodPipe` tự viết** (~20 dòng) thay vì pipe của `nestjs-zod`: pipe đó xoay quanh DTO class/metadata decorator, mà Vitest (esbuild) không phát `emitDecoratorMetadata`. Vì vậy provider trong luồng test khai `@Inject(Token)` tường minh (kể cả `AllExceptionsFilter`, sửa nhỏ).
- **Chỉ kiểm vỏ action ở HTTP** (`type` thuộc 9 loại, `payload.playerIndex`); `StartDuel`/`Draw` vẫn lọt qua schema để `DuelManager` trả `FORBIDDEN_ACTION` (403) đúng hợp đồng. Payload méo mà engine ném lỗi không phải `EngineError` → `500 INTERNAL_ERROR` (state không đổi). Schema Action đầy đủ ở shared là việc để dành.
- **Lỗi middleware Express** (body-parser 413/400) không phải `HttpException` nên `AllExceptionsFilter` từng biến chúng thành 500; giờ lỗi 4xx có `expose:true` giữ nguyên status.
- **`configureApp`** dùng chung `main.ts` và e2e (`bodyParser:false` + `json` limit 100kb + CORS nhiều origin bằng dấu phẩy). Thêm devDependency `supertest` + `@types/supertest`.
- **Hệ quả:** 2.4 (AI) thêm mode `solo-vs-ai` ở `duel-access.ts` + `DuelMode`; FE (2.5+) gọi 4 endpoint này. Mutation test thủ công 12 đột biến: 12/12 bị bắt (1 mutant sống lần đầu → thêm test "sender thấy lá mình rút đầy đủ").

## 2026-09-24 — Trang debug solo (task 2.4): Action schema ở shared, không `legalActions`, entry Vite thứ hai

- **Đổi số task**: 2.4 = trang debug thô (kiểm luật bằng mắt trước khi làm UI Phaser/AI); AI dummy → 2.5, các task sau +1 (Duel scene 2.6 … i18n 2.11). Lý do: 2.3 chưa từng được chơi thử thật; người dùng không code nên cần một công cụ nhìn được để duyệt luật.
- **Action schema ở `packages/shared/src/duel/action-schema.ts`** (`PlayerActionSchema` 7 action chặt `.strict()`, `ActionInputSchema` = 7 action + vỏ `StartDuel`/`Draw`). Engine không được sửa và shared không được import engine, nên `Action` vẫn định nghĩa ở engine; **shared định nghĩa hình dạng mạng**, `apps/api` (`duels.dto.ts`) có assertion compile-time `ExactOptional<PlayerAction> extends Action` để hai bên lệch nhau là `tsc` đỏ (mutant "schema cho `DefenseDown`" bị bắt). Cần `ExactOptional` vì `exactOptionalPropertyTypes`: `z.infer` sinh `?: T | undefined`, engine là `?: T`; Zod không sinh key `undefined` ở runtime nên chỉ là chuẩn hoá kiểu.
- **Payload méo → 400 `VALIDATION_FAILED` + `issues[]`** (trước: 500 khi engine ném lỗi lạ). Phân vai: hình dạng = schema (400), luật = engine (409 + `engineCode`). `StartDuel`/`Draw` vẫn lọt vỏ để nhận 403 như hợp đồng 2.3. Giới hạn số lượng trong schema chỉ là chặn trên hào phóng (mảng ≤20, id ≤64 ký tự); số tribute/số lá bỏ đúng bao nhiêu do engine quyết.
- **Type body phản hồi** (`ViewResponse`, `CreateSoloResponse`, `ApiErrorBody`...) ở `packages/shared/src/duel/http-types.ts`, types-only (giống `StateView`). Controller chưa dùng chúng làm kiểu trả về (khỏi sửa API ngoài phạm vi).
- **Không có `legalActions`**: repo chưa có (chỉ nằm trong thiết kế). Trang debug dựng nút từ `StateView` (`build-actions.ts`), **không sao chép luật**: nút Triệu hồi/Úp cho mọi quái trên tay, tribute là danh sách quái của mình tick tuỳ ý, nút Attack cho mọi quái ngửa ở tư thế Attack, mục tiêu = mọi quái đối thủ + "trực tiếp". Sai luật → server 409 + `engineCode` hiện đỏ, state giữ nguyên (`applyActionError` giữ nguyên tham chiếu `view`). Đổi lại nút hiện cả lúc bấm sẽ lỗi — chấp nhận, vì mục đích là để người dùng thử luật. `legalActions` thật vẫn là việc P2 sau (Duel scene) khi cần.
- **`apps/web/src/api/duel-api.ts` tách khỏi giao diện tạm** (`src/debug/`): client HTTP tiêm `fetch`/`storage` (test bằng mock), `DuelApiError {status, code, engineCode, issues}`, token guest lưu `localStorage` (bọc try/catch), 401 xoá token. Phaser dùng lại được. `src/net/api-client.ts` (health) để nguyên.
- **Entry Vite thứ hai** `apps/web/debug.html` (+ `rollupOptions.input` trong `vite.config.ts`) thay vì route trong Phaser: không đụng scene, gỡ bằng xoá 3 chỗ. `build` cũng xuất `dist/debug.html`; nó chỉ gọi endpoint public như mọi client nên không mở thêm bề mặt, nhưng khi có deploy production nên loại khỏi bản build (việc để dành).
- **Logic thuần có test** (không cần DOM): `describe-event` (vét cạn `never`, thêm `EventView` mới = `tsc` đỏ), `build-actions` (+ `toAction` đi qua `PlayerActionSchema.parse`, `pickViewer`, `shouldContinueEndTurn`), `debug-state` (`applyActionError`/`applyActionSuccess`). `End Turn` là đường tắt phía client: lặp `EndPhase` (tối đa 12) — chỉ điều phối các action hợp lệ, không quyết luật.
- **Smoke test boot thật** (chạy lần 2, sau khi bật Docker): không cần sửa code nào để boot. Kết quả và request/response thật ở `docs/ai/review-packets/task-2.4-smoke.md`. Thêm script `tools/` (Node 22 `--experimental-strip-types`, không thêm dependency, ngoài mọi package) để lặp lại: `smoke-http.ts`, `play-duel.ts` (`HEAVY=1` cho nhánh Tribute). Hook PreToolUse `block-heredoc.js` chặn heredoc có nháy (quyết định của người dùng). Task 2.4 để trạng thái "chờ người dùng test", chỉ người dùng chuyển sang xong.
  **Hệ quả:** 2.5 (AI) thêm mode `solo-vs-ai` + `duel-access`; trang debug là công cụ duyệt cho mọi task engine sau (Spell/Trap thêm nút = thêm nhánh trong `build-actions.ts`).

## 2026-09-24 — legalActions (task 2.5): sinh ứng viên theo cấu trúc, lọc bằng dry-run `applyAction`

- **Đổi số task**: 2.5 = legalActions; AI dummy + `solo-vs-ai` → 2.6; các task sau +1 (Duel scene 2.7 … i18n 2.12). Lý do: AI (2.6), trang debug và Phaser (highlight ô hợp lệ) đều cần cùng một nguồn "được làm gì bây giờ".
- **Không sao chép luật**: `getLegalActions(state, seat, ctx)` (engine, `legal-actions.ts`, chỉ THÊM export; 362 test cũ không đổi) liệt kê ứng viên thuần cấu trúc (mỗi lá tay × Summon/Set × 5 ô × tập tribute cỡ 0–2 của quái mình; mỗi quái × đổi thế; mỗi quái × (mỗi quái đối thủ | trực tiếp); EndPhase; Surrender; mọi tổ hợp bỏ bài của prompt) rồi giữ ứng viên mà `applyAction` chấp nhận (handler thuần, ném `EngineError` khi reject). Luật thêm/đổi trong engine tự phản ánh; chỉ một **loại action mới** mới cần bộ sinh ứng viên mới. Lỗi không phải `EngineError` được ném lại (không nuốt bug).
- **Tribute không bùng nổ**: ứng viên là tập con cỡ 0..2 của ≤5 quái (≤16 tập) — không suy số tribute từ Level (sao chép luật), validator loại tập sai cỡ. Trần 2 phản ánh luật hiện có (Lv7+ = 2, `summon.ts`); thêm luật cần >2 tribute = nâng hằng `MAX_TRIBUTES`. Tổ hợp bỏ bài giới hạn 200. Đo: đầy sân + tay 7 (Lv7/5/4) ≈ **14–17 ms/lần** (~1100 dry-run), 107 action hợp lệ; test chặn ở 300 ms để không flake khi cả workspace chạy song song.
- **`ctx` bắt buộc** (khác chữ ký `(state, playerIndex)` trong yêu cầu): dry-run gọi `applyAction`, mà Summon/Set/Attack cần `cardDefinitions`.
- **Điểm lệch yêu cầu #3, đã duyệt ở bước plan**: `Surrender` luôn có trong danh sách của **cả hai ghế**, kể cả khi có prompt hoặc không đến lượt (engine chấp nhận, ADR 1.9); nên "ghế không phải trả lời prompt → `[]`" thành `[Surrender]` (chỉ `[]` khi duel kết thúc hoặc `allowSurrender=false`). Bỏ Surrender khỏi list = danh sách sai so với engine (property "ngoài list ⇒ bị từ chối" sẽ đỏ).
- **Không sinh `Draw`/`StartDuel`** (server-internal/bị cấm ở API; khớp `PlayerActionSchema`). Property (b) cũng loại hai loại này khỏi tập âm.
- **Wire**: `legalActions: PlayerAction[]` nằm cạnh `view` ở `ViewResponse`/`GetViewResponse` (không trong `StateView`, giữ `StateView` = ảnh chụp thuần); luôn của ghế `view.viewerIndex`, tính trên state **sau** action (POST). Chỉ id/ô/tư thế, không `definitionId` (mục tiêu lá úp đối thủ chỉ theo `instanceId` đã có trong view). `DuelManager` cast `Action[]` → `PlayerAction[]` sau khi lọc `StartDuel`/`Draw` (một chỗ, có kiểm chứng bằng `PlayerActionSchema.safeParse` trong e2e).
- **Trang debug**: `applyLegality` (thuần, có test) gắn cờ `legal` cho từng nút bằng cách khớp type + trường cố định (`cardInstanceId`, `toPosition`...) với `legalActions`; khi công tắc "Cho phép thử hành động sai luật" TẮT thì ô chọn cũng bị thu hẹp về giá trị hợp lệ; BẬT thì nút mờ bấm được và ô chọn đủ giá trị để thấy 409. Không import engine.
- **Test harness**: `runFuzz` thêm callback tuỳ chọn `onState` (chỉ THÊM, dùng cho property test). Một assertion cũ ở `event-visibility.spec.ts` (tập key của `submitAction` result) và hai fixture `debug-state.test.ts` phải cập nhật vì shape response đổi có chủ đích.
  **Hệ quả:** 2.6 (AI) chọn action từ `getLegalActions`; Phaser (2.7+) đọc `legalActions` từ response; P3 thêm bộ sinh ứng viên cho Activate/Chain và mở rộng generator/property test.

## 2026-09-24 — AI rule-based + `solo-vs-ai` (task 2.6): AI ở api, chỉ thấy StateView, driver trong khoá duel

- **Đổi tên/nội dung task**: MASTER-PLAN ghi 2.6 là "AI dummy random-legal"; làm luôn bản rule-based đơn giản (theo yêu cầu) vì random-legal vẫn được giữ làm _đối chứng sức mạnh_ (`randomPolicy` trong test). Số task sau giữ nguyên (2.7 Duel scene … 2.12 i18n).
- **Vị trí: `apps/api/src/modules/duels/ai/`** (không phải `packages/shared`/`game-engine`): shared chỉ được chứa type/schema/data, engine không được biết "người chơi máy"; `StateView` + `toStateView` đã ở api và AI chỉ tiêu thụ `StateView`/`PlayerAction` (type ở shared). Không sửa engine (0 dòng đổi). Khi cần AI mạnh hơn (P8) có thể tách package riêng mà giao diện `AiPolicy` không đổi.
- **Không nhìn trộm bằng kiểu dữ liệu**: `chooseAction({view, legalActions, cardDefinitions, rng, config?})` không nhận `GameState`; mọi thứ nó biết là những gì server cho ghế AI thấy (tay đối thủ, deck, lá úp, thứ tự rút đều là ẩn/đếm). `DuelManager` chỉ đưa `toStateView(state, aiSeat)` + `getLegalActions(state, aiSeat)`. Bảo đảm bằng: (1) kiểu, (2) test metamorphic (hai state khác nhau **chỉ** ở tay/deck/danh tính lá úp của đối thủ cho ra cùng `StateView` và cùng action; test còn khẳng định hai raw state thật sự khác nhau để không rỗng), (3) test spy ở manager (policy chỉ nhận đúng 4 khoá, view của ghế AI, tay đối thủ không chứa `definitionId`).
- **Chính sách** (số mặc định `[ASSUMED]`, đổi ở `ai-config.ts`): bỏ bài = ATK thấp nhất (Spell/Trap = 0); Summon lá có lợi ròng lớn nhất (`ATK − ATK hiến tế`), Tribute chỉ khi `ATK ≥ ATK hiến tế + 300`; quái không thắng nổi quái tấn công mạnh nhất của đối thủ (ngửa, Attack) → Set (DEF cao nhất); đổi thế: Attack→DefenseUp khi ATK < mối đe doạ, DefenseUp→Attack (chỉ Main1) khi ATK > mọi quái ngửa; tấn công trực tiếp luôn; đánh quái ngửa chỉ khi `ATK >` ATK/DEF (không đổi mạng hoà); quái úp chỉ khi ATK ≥ 1800; còn lại `EndPhase`. Mọi quyết định chỉ chọn TRONG `legalActions` (số tribute/ô/phase do engine quyết), có guard "ứng viên ∈ legalActions" rồi mới trả.
- **Không bao giờ `Surrender`**: policy không chọn nó; fallback `EndPhase` → action đầu không phải `Surrender` → nếu chỉ còn `Surrender` thì ném `AiNoActionError` (không tự đầu hàng). Thêm guard thứ hai ở `DuelManager` (policy khác trả `Surrender` → `INTERNAL_ERROR`, duel không bị kết thúc).
- **Driver nằm trong `DuelManager`, trong khoá duel**: `applyAndSave` là đường DUY NHẤT thay đổi duel (validate/engine, action log, save) cho cả người lẫn AI; `submitAction` và `createDuel` gọi `driveAi` **bên trong cùng `runExclusive`**, nên không request nào xen vào giữa lượt AI, log gồm cả action AI (`playerIndex` = ghế AI) và replay từ log ra đúng state cuối (có test). Seed tie-break của AI = `${seed}:ai:${actionLog.length}` ⇒ tất định, replay không phụ thuộc bộ nhớ.
- **Trần 200 action AI/request → `AI_LOOP_LIMIT`** (mã mới, HTTP 500): state đã lưu tới bước đó vẫn hợp lệ (mỗi bước lưu riêng), duel không hỏng; kế thừa tính chất "state không đổi khi lỗi" ở mức từng action. Engine từ chối action của chính AI = bug server → `INTERNAL_ERROR` (không trả 409 cho người).
- **Quyền**: `duel-access` thêm `solo-vs-ai`: chủ chỉ có ghế còn lại (ghế 0), ghế AI không điều khiển/không xem được (`403 NOT_OWNER`); tạo duel với `viewer` = ghế AI → `400 INVALID_VIEWER`; `DuelManager` cũng chặn ghế AI (nhiều lớp). Ghế 0 luôn đi trước nên người ghế 0, AI ghế 1; nhánh "AI đi trước" chỉ kiểm được ở tầng manager/test (ghế AI = 0) — HTTP cố định người ở ghế 0 `[ASSUMED]`.
- **Response**: `events` = event của người rồi của AI (đã lọc cho ghế người); thêm `aiActions: {action, eventsFrom, eventsTo}[]` thay vì đánh dấu từng event, để client/Phaser tách theo từng hành động mà không đổi shape `EventView`. Action AI chỉ có id/ô/tư thế nên không lộ gì mới ngoài event công khai (e2e quét `instanceId`↔`definitionId` của bài AI còn trên tay).
- **Chi phí đo được**: mỗi bước tính `legalActions` (dry-run engine) ~15–30 ms ⇒ một ván AI-vs-AI ≈ 4–6 s; nên suite mô phỏng mặc định nhỏ (3 ván/loại), bản dài chạy song song nhiều process (xem review packet). Số liệu 200 ván: xem `docs/ai/review-packets/task-2.6.md`.
  **Hệ quả:** thêm `solo-vs-ai` cho FE Phaser (2.7+) = gọi cùng 4 endpoint; PvP (P9) dùng lại `applyAndSave`; AI mạnh hơn (P8) thay `AiPolicy` hoặc nâng chính sách mà không đổi driver.
