# Yugi H5 Recreate

Tái tạo (cá nhân, không phát hành công khai) một game duel card 2D kiểu Yu-Gi-Oh bản cũ /
early Master Rule: kéo thả, chain stack, deck builder, AI rule-based, và về sau là PvP
real-time riêng tư cho bạn bè. **Không dùng art/tên bài chính thức của Konami** — mọi card
trong repo là placeholder tự đặt tên.

Chi tiết kiến trúc, luật bất biến, coding standards: xem [`CLAUDE.md`](./CLAUDE.md).
Thiết kế engine/effect DSL/protocol: xem [`docs/design/`](./docs/design).
Tiến độ + quyết định thiết kế: xem [`docs/ai/`](./docs/ai).

## Yêu cầu môi trường

- Node.js `22.x` (xem `.nvmrc`)
- pnpm `11.x` (bật qua `corepack enable`)
- Docker Desktop (cho Postgres + Redis qua `docker-compose.yml`)

## Chạy lần đầu

```bash
pnpm install

# Postgres (port 5433) + Redis (port 6380, chưa dùng tới) — đổi port để tránh đụng
# container Postgres/Redis mặc định (5432/6379) của các project khác trên máy bạn.
docker compose up -d

# Tạo file env thật từ mẫu, rồi chỉnh JWT secret nếu cần
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Migrate DB (chạy 1 lần, hoặc mỗi khi đổi prisma/schema.prisma)
pnpm --filter @yugi/api prisma:migrate

# Chạy web (http://localhost:5173) + api (http://localhost:3000) song song
pnpm dev
```

Kiểm tra nhanh: `GET http://localhost:3000/health` phải trả `{"status":"ok","database":"ok"}`,
Swagger UI ở `http://localhost:3000/docs`. Mở `http://localhost:5173` sẽ thấy Menu hiển thị
"API: Connected" nếu health check qua được.

> **Docker Desktop phải đang chạy** trước `docker compose up -d`. API cần Postgres để khởi động
> (`PrismaService` kết nối lúc boot): không có DB thì `pnpm dev` báo `P1001 Can't reach database
server at localhost:5433`. Chạy `pnpm test` thì không cần DB.
> Các giá trị mẫu trong `apps/api/.env.example` chạy được ngay ở dev; production từ chối JWT secret
> bắt đầu bằng `change-me`.

### Chơi thử một ván bằng trang debug (task 2.4)

Sau khi `pnpm dev` chạy, mở **http://localhost:5173/debug.html** — trang thô để kiểm luật bằng mắt
(một người điều khiển cả hai ghế, xem JSON thô để kiểm bài úp có bị lộ không). Kịch bản chơi thử và
checklist "điều cần để ý": [`docs/design/debug-ui.md`](./docs/design/debug-ui.md).

Thử API bằng tay (ví dụ chuỗi guest → duel → action → xem):

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/guest | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).accessToken")
DUEL=$(curl -s -X POST http://localhost:3000/duels/solo -H "Authorization: Bearer $TOKEN" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).duelId")
curl -s -X POST http://localhost:3000/duels/$DUEL/actions -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"playerIndex":0,"action":{"type":"EndPhase","payload":{"playerIndex":0}}}'
curl -s "http://localhost:3000/duels/$DUEL?viewer=1" -H "Authorization: Bearer $TOKEN"
```

## Lệnh thường dùng

| Lệnh                                                        | Ý nghĩa                                                              |
| ----------------------------------------------------------- | -------------------------------------------------------------------- |
| `pnpm dev`                                                  | Chạy dev cho toàn bộ apps (build packages phụ thuộc trước qua turbo) |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build` | Chạy trên toàn workspace                                             |
| `pnpm --filter <pkg> <script>`                              | Chạy script cho 1 package/app cụ thể (vd `@yugi/api`, `@yugi/web`)   |
| `pnpm --filter @yugi/api prisma:migrate`                    | Tạo/áp dụng migration mới                                            |
| `docker compose up -d` / `docker compose down`              | Bật/tắt Postgres + Redis                                             |

## Cấu trúc monorepo

```
apps/
  web/            Phaser 3 + Vite 7 client
  api/             NestJS 11 + Prisma + Postgres server
packages/
  shared/         Types, Zod schemas, card definitions dùng chung
  game-engine/    Pure TypeScript rule engine (không phụ thuộc framework nào)
  config/         tsconfig + eslint config dùng chung
docs/
  design/         Engine/effect-DSL/protocol design docs
  ai/             PROGRESS/DECISIONS/GLOSSARY/ROADMAP — tài liệu sống cho AI-assisted work
.claude/          Slash commands + subagents hỗ trợ vibe-coding đúng kiến trúc
```

## Ghi chú

- Redis đã có trong `docker-compose.yml` nhưng chưa wire vào `apps/api` — sẽ bật lại khi làm
  module `realtime` (M7). Xem `docs/ai/DECISIONS.md`.
- Chưa có CI (GitHub Actions) — hiện tại "CI-local" nghĩa là chạy xanh
  `pnpm lint && pnpm typecheck && pnpm test && pnpm build` trước khi commit (husky pre-commit
  chỉ chạy lint-staged, chưa chạy full suite).
