> **ADR 043** · 2026-09-25 · Task: Plan · Lớp: Plan
> **Trạng thái:** Hiệu lực. Mục lục: `docs/ai/DECISIONS.md`.
>
> Ghi chú đọc kèm (thêm khi tách file 2026-10-01; KHÔNG thuộc ADR gốc, phần dưới giữ nguyên văn):
>
> - Thay một phần ADR 011 (`011-2026-09-20-phases-p0-p9.md`), ADR 012 (`012-2026-09-20-rules-scope-v1-ruleset-config.md`), ADR 017 (`017-2026-09-20-decision-label-g1-g12.md`) (G12), ADR 019 (`019-2026-09-21-c1-c4-c9-c10-c12.md`) ("ngoài phạm vi").
> - Còn chờ chủ dự án: E1–E9 và đề xuất sửa `CLAUDE.md` #5 (xem `docs/ai/PROGRESS.md`).

## 2026-09-25 — Mở rộng scope: Economy, Gacha, Shop, Adventure, Arena, Live-ops (P10–P15)

- **Chủ dự án mở rộng scope** (ghi đè): "Ngoài phạm vi: gacha/shop/guild/sự kiện" (ADR 2026-09-21), "G12 chưa gacha/pack" và "OUT story mode" (MASTER-PLAN) **không còn hiệu lực** cho: Gacha/pack, Shop (gold + gem + tiền sự kiện), Live-ops (điểm danh, nhiệm vụ ngày, đua top theo mùa), Adventure/Campaign, Arena (PvP ladder). Guild và skill hệ thống riêng vẫn chưa nằm trong scope. **P9.1 Room private giữ nguyên** (không rating); Arena là mục mới. Core duel vẫn ưu tiên số 1: các hệ thống mới xây SAU P7/P8/P9, không chen ngang.
- **Thứ tự phase theo phụ thuộc thật, không theo thứ tự liệt kê**: P10 Economy (sau P7: cần tài khoản thật) → P11 Gacha → P12 Shop (Shop bán pack nên cần định nghĩa pack trước — đổi thứ tự so với danh sách ban đầu) → P13 Adventure (sau P8; nguồn gold, không cần realtime) → P14 Arena (sau P9; rủi ro cao nhất; xây Leaderboard/Season service) → P15 Live-ops (cuối: quest/đua top bám mọi mode; đua top dùng Leaderboard P14). P11/P13/P14 độc lập sau P10 nên đổi thứ tự được. 9.5 (PvE nhẹ) là bản tối giản, bản đầy đủ = P13.
- **Chỉ mô tả ở tầm phase, chưa breakdown task con** (chờ duyệt hướng + chốt `[DECISION]`/`[CẦN HỎI CHỦ DỰ ÁN]`; danh sách E1–E9 ở `economy-plan.md`). Không có con số kinh tế nào được AI tự chốt.
- **Bất biến giữ nguyên cho hệ thống mới**: server là nguồn sự thật, không optimistic với tiền/item/thưởng/rating; client không gửi giá/số lượng/kết quả roll; ledger append-only + idempotency key + DB transaction; RNG gacha phía server có log, tách khỏi RNG engine; engine duel thuần; không asset Konami.
- **Mâu thuẫn cần chủ dự án duyệt — ĐỀ XUẤT sửa CLAUDE.md #5** (AI không tự sửa CLAUDE.md root): "DB (`apps/api/prisma`) chỉ lưu User/Collection/Deck/MatchHistory/Progress" → thêm "và dữ liệu Economy/Live-ops của người chơi (Wallet, InventoryItem, Transaction, PackOpening, QuestProgress, LoginStreak, AdventureProgress, ArenaRating, SeasonResult); **định nghĩa nội dung** (card, pack, shop catalog, ải, quest, lịch sự kiện) vẫn ở `packages/shared`, không lưu DB".
- **Cảnh báo quy mô**: dự án ghi "dùng cá nhân, không phát hành công khai" nhưng Arena/đua top cần nhiều người chơi → `[CẦN HỎI CHỦ DỰ ÁN]` về quy mô deploy/bot fallback trước P14.
- `01-project-vision.md` nằm ngoài repo; bản vá để dán vào: `docs/plan/project-vision-patch.md`.
  **Hệ quả:** `MASTER-PLAN.md` (P10–P15, sơ đồ, ánh xạ), `economy-plan.md`, `modes-and-liveops-plan.md`, `human-tasks.md`, `backend-plan.md` cập nhật; `PROGRESS.md` checklist thêm P10–P15. Không đổi code, không đổi task đang làm (tiếp theo vẫn 2.10).
