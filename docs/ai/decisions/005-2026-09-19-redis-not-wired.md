> **ADR 005** · 2026-09-19 · Task: P0 · Lớp: API, Infra
> **Trạng thái:** Hiệu lực. Mục lục: `docs/ai/DECISIONS.md`.

## 2026-09-19 — Redis có trong docker-compose nhưng chưa wire vào code

Chỉ cần cho Socket.io adapter/rate-limit ở M7 (PvP realtime). Thêm sớm là complexity thừa
cho M0. **Hệ quả**: `RealtimeModule`/`DuelsModule` hiện tại không có dependency vào Redis;
sẽ thêm `@nestjs-modules/ioredis` hoặc tương đương khi bắt đầu M7.
