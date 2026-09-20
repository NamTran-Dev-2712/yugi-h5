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
