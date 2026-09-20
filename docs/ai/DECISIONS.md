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
