# packages/shared

Chứa: card definitions (content data), Action/Event network contracts (Zod schemas),
constants dùng chung giữa `apps/api` và `apps/web`.

Luật riêng:

- Không chứa game logic/rule (đó là việc của `packages/game-engine`). Chỉ types + schema + data tĩnh.
- Mọi type public phải có Zod schema tương ứng nếu nó đi qua network boundary (Action, Event, API DTO).
- Không import từ `apps/*` hay `packages/game-engine`.
- Thêm card mới: xem `.claude/commands/new-card.md` ở root.
