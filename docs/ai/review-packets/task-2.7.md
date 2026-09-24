### Review Packet — Task 2.7: Phaser Duel Scene tĩnh + `solo-vs-ai` (Frontend)

**Lớp:** Frontend (`apps/web`). Không đổi `game-engine`, `apps/api`, `packages/shared`. Chưa commit (theo quy ước: bạn duyệt xong mới tách 2 commit feat + docs).

**Đã làm gì**

- Menu có nút **"Đấu với AI"** (guest → `POST /duels/solo` mode `solo-vs-ai`) rồi vào `DuelScene`. `debug.html` giữ nguyên.
- `DuelScene` (1280×720, `Scale.FIT` giữa màn hình): 5 ô quái + 5 ô Spell/Trap mỗi bên, tay bạn ở dưới (ngửa), tay đối thủ ở trên (chỉ mặt sau, đủ số lượng), Deck / Mộ / Extra kèm số lá, thanh LP + số hai bên, chỉ báo lượt + phase, panel chi tiết lá (rê chuột/bấm: tên, loại, Level, ATK/DEF, thế, mô tả), log sự kiện dạng text (kể cả dòng "🤖 AI …"), banner thắng/thua/hòa + "Về menu".
- Nút: **Phase tiếp theo** (1 `EndPhase`), **Kết thúc lượt** (lặp `EndPhase` tới khi sang lượt), **Đầu hàng** (bấm lần 1 đổi thành "Xác nhận đầu hàng?", bấm lần 2 mới gửi). Mỗi nút chỉ bật khi đúng action đó nằm trong `legalActions` của bạn, và gửi chính action server liệt kê. Đang chờ server: nút tắt + hiện "AI đang suy nghĩ…" (khi gửi `EndPhase`).
- Kiến trúc: lớp thuần `apps/web/src/duel/` (`layout`, `presenter`, `duel-controller`, `theme`, `asset-manifest`, `strings`, `fixtures`, `detail-text`, `labels`) — scene chỉ vẽ `RenderModel`. Placeholder sinh bằng code ở Boot theo manifest. Danh sách asset: `docs/plan/asset-list-vertical-slice.md`.
- **Fixture (không cần server, chỉ DEV):** `http://localhost:5173/?fixture=midgame|handfull|gameover` (menu DEV cũng có 3 nút).
- Đổi lộ trình (bạn yêu cầu): 2.7 = scene tĩnh, 2.8 = kéo thả + highlight, 2.9 = animation theo event + nhịp AI. Đã sửa `MASTER-PLAN.md` (dòng 2.7–2.10 và chú thích 1.4 "SelectTribute UI → 2.8") và `PROGRESS.md`.

**Khác biệt so với MASTER-PLAN cũ (đã sửa):** trước đó 2.7 = "layout board + CardSprite", 2.8 = "Hand + kéo thả Summon/Set", 2.9 = "Kéo attack + LP bar + phase bar", 2.10 = "log + kết thúc trận". LP/phase/log/banner nay nằm ở 2.7; 2.10 còn phần bật/tắt + lọc log. Không viết lại phase khác. `docs/plan/ui-plan.md` chưa sửa (bản vẽ wireframe vẫn `[GUESS]`).

**Kiểm chứng**

- `pnpm lint / typecheck / test / build` toàn repo **xanh**: shared 58, engine 381 (+7 todo), api 190, web **112** (43 test mới).
- Test thuần: layout (mọi ô nằm trong khung, không chồng lấn, đối xứng trên/dưới và trái/phải, tay 0–20 lá không tràn, 0–11 lá không chồng), presenter (LP/số lá/phase/lượt, tay đối thủ úp, nút ⇔ `legalActions`, ghế viewer), **quét rò rỉ** (JSON render model của cả 3 fixture không chứa `definitionId` dạng `SMP-xxx` và không chứa tên/id của lá ẩn), controller với API giả (thinking, chặn bấm đúp, Đầu hàng 2 lần, lỗi 409 giữ nguyên view, end-turn dừng đúng chỗ).
- **12 mutant thủ công: 12/12 bị bắt** (lần đầu 11/12; mutant "chú thích LP đảo bên" sống → đã thêm test). Gồm: lộ tên lá úp đối thủ (bỏ phòng thủ), tay đối thủ ngửa, nút bật khi không có trong `legalActions`, action của ghế kia được nhận, đảo ghế viewer, layout chồng ô, tay không co khi đông, sai số Deck, gửi action ngoài danh sách, Đầu hàng không xác nhận.
- Build production **không chứa dữ liệu fixture** (grep `dist`: không có `fixture-ai`, `p1-h1`...).
- **Screenshot** (Edge có sẵn ở chế độ headless, không cài gì thêm): `docs/ai/review-packets/task-2.7-screens/{menu,midgame,handfull,gameover}.png`. Playwright chưa cài / MCP không kết nối nên không dùng.

**Chưa kiểm chứng được (nói thẳng)**

- **Chưa chạy thật "Đấu với AI" với API**, và **chưa chạy lại `tools/smoke-http.ts`, `tools/play-vs-ai.ts`**: Docker Desktop đang tắt trên máy này (`docker ps` lỗi pipe) nên không có Postgres 5433. Tôi không tự bật Docker/cài gì. API không bị sửa nên các script không có lý do đổi kết quả, nhưng đó là suy luận, chưa phải kết quả. Đường mạng của scene được kiểm bằng test controller với API giả + `duel-api.test.ts` cũ, không bằng ván thật. **Bạn (hoặc tôi sau khi bạn bật Docker) cần chạy bước "Ván thật" bên dưới.**
- Quy trình: phần thuần được viết **trước rồi mới viết test** (không đúng "đỏ trước" như yêu cầu); bù bằng bộ mutant ở trên (test đủ chặt để bắt các lỗi cố ý), nhưng bạn nên biết thứ tự thật.
- Bố cục/màu/cỡ chữ chưa đối chiếu ảnh Duel gốc `[REF]` (chưa có screenshot gốc trong repo).

**Xem thử trong < 3 phút**

1. `pnpm dev` (chỉ cần web cho phần fixture) → mở `http://localhost:5173/?fixture=midgame`. Nhìn: tay đối thủ là 5 lưng bài, không có chữ; 1 quái úp của đối thủ chỉ là lưng bài; quái của bạn: 1 thế công, 1 quái úp nằm ngang, 1 thế thủ ngửa nằm ngang; số Deck/Mộ; LP 5200 vs 6400; 3 nút bên phải sáng. Rê chuột lên lá của bạn → panel trái hiện tên/Level/ATK-DEF; rê lên lá đối thủ úp/tay → không hiện tên.
2. `?fixture=handfull`: tay 7 lá dàn gọn trong khung; lá có viền vàng; dòng vàng "Tay quá giới hạn…"; hai nút phase tắt; bấm 1 lá không làm gì (fixture không có server).
3. `?fixture=gameover`: mờ nền + "BẠN THẮNG" + nút Về menu; các nút bên phải tắt.
4. **Ván thật** (cần Docker): `docker compose up -d` → `pnpm --filter @yugi/api prisma:migrate` (nếu chưa) → `pnpm dev` → mở `http://localhost:5173/` → "Đấu với AI" → bấm "Kết thúc lượt" vài lần. Nhìn: sau khi bạn kết thúc lượt có chữ "AI đang suy nghĩ…" rồi board cập nhật, log có dòng "🤖 AI …" và "Lượt N". Ở lượt thứ 3 của bạn (nếu chưa đánh bài nào) sẽ hiện prompt bỏ bài (bấm 1 lá vàng để bỏ). Không có Summon/Set/Attack ở task này nên **không chơi hết ván bằng UI được** — muốn thử luật đầy đủ dùng `debug.html`.
5. Thử "Đầu hàng": bấm 1 lần thấy "Xác nhận đầu hàng?", bấm lần nữa → banner "BẠN THUA".

**Cần bạn duyệt (`[ASSUMED]`)**

1. Toạ độ bố cục (5+5 ô mỗi bên, Deck trái/Mộ phải hàng Spell-Trap, Field trái/Extra phải hàng quái, panel chi tiết trái, log + nút phải, LP ở hai góc trái) là `[GUESS]` theo `ui-plan.md`, chưa có `[REF]`.
2. Nút hiện là chữ ("Phase tiếp theo" / "Kết thúc lượt" / "Đầu hàng"), chưa phải nút hex 3 trạng thái (C4). Nút "Kết thúc lượt" (lặp EndPhase) là tiện ích thêm, nằm ngoài yêu cầu gốc.
3. "AI đang suy nghĩ" hiện khi đang chờ response của `EndPhase` (suy luận: chỉ action này có thể chuyển lượt); chưa phát lại từng bước AI.
4. Đầu hàng xác nhận bằng "bấm 2 lần cùng nút" (không dùng hộp thoại).
5. Bỏ bài quá giới hạn: bấm 1 lá = câu trả lời 1 lá có sẵn trong `legalActions`; nhiều lá chờ 2.8. Đây là thêm ngoài yêu cầu, để ván không kẹt ở lượt thứ 3 của bạn.
6. Chủ sở hữu thấy tên lá úp của mình trong panel chi tiết (lá vẫn vẽ mặt sau); quái ngửa `DefenseDown` của đối thủ (server không bao giờ gửi) được coi là ẩn.
7. Quái thế thủ vẽ xoay 90° và thu nhỏ để vừa ô; Extra Deck hiện số (đang luôn 0).
8. Chuỗi UI tiếng Việt hardcode ở `strings.ts` (i18n = 2.12). `CardDefinition` chỉ có `effectText`, không có `description`/bản dịch.
9. Log giữ 200 dòng, hiện 24 dòng cuối, neo đáy; dòng dài có thể chiếm nhiều dòng hiển thị.
10. Lá trong log của event "ẩn" gọi là "lá ẩn"/"lá úp" (không lộ tên).
