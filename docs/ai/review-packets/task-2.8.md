### Review Packet — Task 2.8: Kéo thả trong DuelScene (Frontend)

**Lớp:** Frontend (`apps/web`). Không đổi `game-engine`, `apps/api`, `packages/shared`. Chưa commit (bạn duyệt trước).

## Bước 0 — xác nhận 2.7 bằng ván thật (làm trước khi viết code 2.8)

- Git sạch (2.7 đã commit), Docker đang chạy (Postgres 5433 healthy), migrate + `pnpm dev` OK (`/health` ok).
- `tools/smoke-http.ts` **23/23**, `tools/play-vs-ai.ts` **142/142**.
- `DuelController` chạy **đường mạng thật** (fetch thật, không API giả): `controller.start()` → `press('endTurn')` qua 3 lượt, trả lời prompt bỏ bài (1 lần), `turnCount 1 → 7`, 92 dòng log có dòng "AI", lượt quay lại người chơi. **Không có lỗi ở 2.7 → không có mục "sửa lỗi 2.7".**
- Vì controller import không đuôi `.js` nên không chạy được bằng Node thuần: chạy qua vitest e2e (`apps/web/vitest.e2e.config.ts`, `src/e2e/*.e2e.ts`, **không** nằm trong `pnpm test`), bọc bằng **`node --experimental-strip-types tools/play-duel-ui.ts [bộ lọc]`**.

## Đã làm gì

- **Máy trạng thái tương tác thuần** `apps/web/src/duel/interaction.ts` (không Phaser): `idle → dragging-card / dragging-attack → choosing-option → selecting-tribute → pending-server → idle`. `reduce(state, event, ctx) → {state, effects}`; effect chỉ có `send(action)` và `toast(text)`.
  - **Mọi action gửi đi là phần tử của `legalActions`** (`emit` kiểm lại bằng so sánh cấu trúc, độc lập thứ tự khoá); client không dựng action, không có logic luật. Lookup từ `legalActions` nằm ở `legal-index.ts` (chỉ lọc/nhóm).
  - Kéo lá tay → tô ô hợp lệ (suy ra từ `legalActions`) → thả: 1 lựa chọn thì gửi luôn; có cả Triệu hồi và Úp thì hiện menu chỉ với lựa chọn có trong danh sách; cần tribute thì `selecting-tribute`: chọn quái trên sân, **Xác nhận chỉ bật khi tập chọn khớp đúng một action liệt kê** (theo ô đã thả, kể cả ô đang có quái mà server cho dùng khi hiến tế chính nó), Hủy → về idle, không gửi gì.
  - Bấm quái của mình (không kéo) → menu Đổi thế (chỉ khi có `ChangePosition` trong danh sách). Kéo quái → mũi tên tấn công: mục tiêu = ô quái đối thủ (kể cả lá úp, chỉ theo vị trí/`instanceId`) hoặc khu LP đối thủ (direct, chỉ khi server liệt kê). Ngưỡng kéo 8px.
  - Thả sai chỗ / lá không kéo được: lá quay về (không có gì thay đổi vì không optimistic) + toast tiếng Việt. Bỏ bài nhiều lá (prompt count>1) tự mở overlay chọn, không Hủy được; bỏ 1 lá vẫn là bấm 1 lá như 2.7.
  - **Không optimistic**: board chỉ đổi khi server trả state; `pending-server` (hoặc controller `busy`, ví dụ AI đang đi) bỏ qua mọi input; server từ chối (409/403…) → `serverRejected` → về idle + toast; `view`/`legalActions` giữ nguyên tham chiếu.
- `interaction-driver.ts` (không Phaser): nối máy với `DuelController` (effect `send` → `controller.submit` → `serverOk/serverRejected`), nhận `viewChanged` từ controller, bấm nút ("Phase tiếp theo"/"Kết thúc lượt"/"Đầu hàng") bằng hit-test. Scene chỉ chuyển pointer events cho driver và vẽ overlay.
- `layout.ts` (thêm): `pointInRect`, `zoneIndexAt`, `optionRects`, `hitTest` (lá trên cùng theo thứ tự vẽ → LP → nút) + `layout.overlay` (Xác nhận/Hủy). Chuột và cảm ứng dùng chung Phaser pointer events (`this.input.on('pointerdown|move|up')`), Esc/chuột phải/nhả ngoài canvas = Hủy.
- `error-messages.ts`: 33 mã engine + mã API → câu tiếng Việt; mã lạ → "Không thực hiện được (mã X)". Test đọc `packages/game-engine/src/errors.ts` **như văn bản** (không import) nên thêm mã engine mới mà chưa có câu = test đỏ.
- `duel-controller.ts` (chỉ thêm): `submit` trả `SubmitResult` (`{ok, sent}` | `{ok:false, message}`), guard bằng so sánh cấu trúc; chế độ fixture chỉ ghi log `sẽ gửi: <action>` và không đổi state.
- Scene: overlay riêng (ô hợp lệ xanh, mục tiêu đỏ, mũi tên, lá "ma" theo con trỏ + lá gốc mờ, menu, thanh Xác nhận/Hủy, toast 2,5 s). Không animation bay/đánh (2.9).
- Fixture DEV mới: `?fixture=summon-choice|tribute|attack|drag-illegal` + **`attack-direct`** (thêm ngoài yêu cầu, xem [ASSUMED]). Menu DEV xếp 8 nút thành 2 hàng.
- Không có asset mới (mũi tên/viền/menu/toast vẽ bằng code, màu ở `theme.ts`); manifest không đổi. Không có ảnh tham chiếu bố cục gốc trong `docs/reference/duel/` (thư mục rỗng) nên **không đoán thêm** (yêu cầu #12 bỏ qua).

## Quy trình test — ĐỎ trước (kể đúng những gì đã xảy ra)

1. Viết **stub** cho `legal-index`, `error-messages`, `interaction`, `interaction-driver`, hit-test trong `layout` (chữ ký thật, thân rỗng), fixture mới và `interaction.harness.ts` (helper test), rồi viết toàn bộ test, rồi mới viết code.
2. Chạy lần đỏ: **69 test đỏ / 78 xanh** (147). Danh sách đầy đủ tên test + lý do fail: `docs/ai/review-packets/task-2.8-red.txt`. Ví dụ: `interaction.test.ts :: drag a hand card onto a zone opens a menu with exactly the legal choices — expected 'idle' to be 'choosing-option'`; `legal-index.test.ts :: draggableHandCards … — expected [] to deeply equal ['p0-1','p0-3']`; `layout.hit-test.test.ts :: zoneIndexAt … — expected null to be 0`; `error-messages.test.ts … — expected '' not to be ''`; `interaction-driver.test.ts … — Error: not implemented` (8/8).
3. **Nói thật về lần đỏ:** (a) các test "không gửi gì / không lộ" pass ngay với stub rỗng (vô nghĩa lúc đó) — độ chặt của chúng được chứng minh bằng mutant bên dưới; (b) trước khi code có **3 lỗi ở chính test/fixture của tôi** đã sửa: test đọc `errors.ts` dùng `import.meta.url` (jsdom không phải `file:`) → đổi sang `process.cwd()`; test khoá `pending` dùng 2 `await Promise.resolve()` (sai thời điểm) → `vi.waitFor`; fixture `drag-illegal` dùng `SMP-011`, lá mà test rò rỉ cũ của presenter quy ước là "bí mật" → đổi `SMP-014` (test cũ giữ nguyên, không sửa); (c) 2 test được **thêm sau** khi mutant #18/#19 sống (xem dưới). Ngoài ra, vài thứ **không phải logic** có mặt trước lần đỏ: toạ độ `layout.overlay`, kiểu `SubmitResult`, chữ ký stub; các chuỗi tiếng Việt mới ở `strings.ts` và bảng `error-messages.ts` được viết cùng lúc với code (test dùng chuỗi cố định "Triệu hồi"/"Úp (Set)" nên vẫn đỏ đúng lý do).
4. Sau khi code: web **218 test xanh** (112 cũ không sửa + 106 mới), toàn repo lint/typecheck/test/build xanh: shared 58, engine 381 (+7 todo), api 190, web 218.

Test bắt buộc đều có: thả vào ô có quái → không gửi; ngoài Main Phase (Battle) → lá không kéo được; không có `DeclareAttack` (lượt 1/không Battle) → không mũi tên; Normal Summon đã dùng → tay không có ô hợp lệ; tribute thiếu/thừa → Xác nhận tắt; Hủy tribute → không gửi; pending/busy → bỏ qua input; server từ chối → về idle + toast + view giữ nguyên; property test 7 fixture × 40 seed × 60 sự kiện ngẫu nhiên: **mọi `send` ∈ `legalActions`** (và có >20 lần gửi thật); ghế viewer 1; rò rỉ (model, overlay, state, effect, log "sẽ gửi" của viewer 0 không chứa id/tên lá mà viewer không được thấy — "bí mật" = mọi lá mẫu không xuất hiện trong view, có kiểm tra không rỗng).

## Mutant thủ công — 19, **18 bị bắt, 1 tương đương** (`docs/ai/review-packets/task-2.8-mutants.txt`)

| #   | Đột biến                                             | Kết quả                              |
| --- | ---------------------------------------------------- | ------------------------------------ |
| 1   | gửi action không có trong `legalActions` (giả mạo ô) | bắt (3)                              |
| 2   | bỏ khoá `pending-server` (chỉ còn `ctx.busy`)        | **sống — tương đương** (xem dưới)    |
| 3   | bỏ khoá `busy`                                       | bắt (2)                              |
| 4   | không khôi phục khi server từ chối                   | bắt (2)                              |
| 5   | highlight ô sai                                      | bắt (2)                              |
| 6   | cho kéo ngoài Main Phase (mọi lá tay kéo được)       | bắt (1)                              |
| 7   | đảo ghế viewer                                       | bắt (1)                              |
| 8   | tribute không kiểm số lượng                          | bắt (2)                              |
| 9   | Hủy vẫn gửi                                          | bắt (1)                              |
| 10  | thả lên ô có quái lại chọn lựa chọn đầu              | bắt (2)                              |
| 11  | bỏ ngưỡng kéo                                        | bắt (1)                              |
| 12  | hit-test chọn lá dưới thay vì lá trên                | bắt (1)                              |
| 13  | controller gửi cả action không được liệt kê          | bắt (3)                              |
| 14  | direct attack rơi về đánh quái đầu tiên              | bắt (1)                              |
| 15  | driver không reset khi có view mới                   | bắt (1)                              |
| 16  | driver bấm nút khi controller busy                   | bắt (1)                              |
| 17  | bảng lỗi thiếu 1 mã                                  | bắt (2)                              |
| 18  | hiện mũi tên cho quái chỉ đổi thế được               | **lần 1 sống** → thêm test → bắt (1) |
| 19  | fixture mode gửi thật khi controller còn API         | **lần 1 sống** → thêm test → bắt (1) |

#2 là **mutant tương đương**: mọi handler pointer đều đã bỏ qua trạng thái `pending-server` nên guard ở đầu `reduce` là lớp phòng thủ dư; giữ lại để handler mới sau này không vô tình mở khoá.

## Chơi thật qua UI layer + API thật (không trình duyệt)

`node --experimental-strip-types tools/play-duel-ui.ts play-with-machine` — mọi nước đi là **sự kiện con trỏ tính từ toạ độ layout** (nhấn lá, kéo vào ô, bấm mục menu, chọn tribute, bấm Xác nhận, kéo mũi tên, bấm nút phase) đi qua `controller + máy trạng thái + hit-test`; chính sách chỉ chọn _cái gì_ từ `legalActions`. Toast hoặc server từ chối = lỗi UI = test đỏ.

| Kịch bản                    | Kết quả                                                                                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| aggressive (30 lượt)        | **thắng** (winner 0) ở turnCount 27; 14 triệu hồi (**3 có tribute**), 23 tấn công (9 direct), 81 lần bấm phase; ~63 s (gần hết là chờ throttle 429 của API) |
| turtle                      | 2 lần đổi thế qua menu, không tấn công; AI thắng ở turnCount 10 (chính sách phòng thủ yếu — không phải lỗi)                                                 |
| hoarder (không đánh lá nào) | 3 lần bỏ bài bằng cách bấm lá (prompt `DiscardToHandLimit`)                                                                                                 |

Không có lần server từ chối nào, không toast bất ngờ. Cuối task chạy lại: `tools/smoke-http.ts` **23/23**, `tools/play-vs-ai.ts` **117/117** (lần chạy sau cùng 102/102: số check phụ thuộc độ dài ván). Chạy lại cả 4 e2e lần cuối: 4/4 xanh (aggressive thắng ở turnCount 23, 3 tribute qua UI).

## Thử trong trình duyệt thật (Phaser thật, chuột thật)

`node --experimental-strip-types tools/ui-drag-shots.ts` điều khiển Edge headless bằng CDP (`Input.dispatchMouseEvent`, không thêm dependency), chụp từng bước → `docs/ai/review-packets/task-2.8-screens/interaction/*.png`: `summon-1-dragging` (ô hợp lệ xanh + lá ma), `summon-2-menu`, `summon-3-sent` (log "sẽ gửi: NormalSummon…", board không đổi), `tribute-1..4` (ứng viên viền vàng, quái đã chọn viền xanh dương, Xác nhận), `attack-1-arrow` (mũi tên tới quái úp, 3 mục tiêu viền đỏ), `direct-1-arrow`, `illegal-2-toast` ("Lá này chưa thể dùng lúc này."). Ảnh tĩnh từng fixture: `task-2.8-screens/{menu,summon-choice,tribute,attack,attack-direct,drag-illegal}.png`. Đây là xác nhận scene nối đúng với máy trạng thái; **cảm ứng thật trên điện thoại chưa thử** (chỉ chuột).

## Chơi thử bằng chuột với AI (dưới 5 phút)

1. `docker compose up -d` (nếu chưa) → `pnpm dev` → mở `http://localhost:5173/` → **Đấu với AI**.
2. Bấm **Phase tiếp theo** 2 lần (Draw → Standby → Main 1). Ở Main 1: **giữ chuột trên một lá quái ở tay, kéo ra** → lá mờ đi ở tay, một lá "ma" theo chuột, các ô quái hợp lệ của bạn viền **xanh**. Thả vào ô xanh → hiện menu **Triệu hồi / Úp (Set)**; bấm một mục → quái xuất hiện sau khi server trả lời (không nhảy trước).
3. Thử thả **lệch chỗ** (ô đối thủ, ô Spell/Trap, ngoài bàn) → lá về lại tay + **toast đỏ** ngắn tiếng Việt.
4. Ở lượt sau, kéo lá **Level 5+**: thả vào ô → chọn Triệu hồi → thanh "Chọn quái để hiến tế" + **Xác nhận** mờ; bấm quái của bạn (viền vàng → xanh dương), Xác nhận sáng lên khi đủ số; Hủy = không gửi gì.
5. **Bấm (không kéo)** một quái của bạn đã ngửa → menu **Đổi sang Phòng thủ/Tấn công**.
6. **Phase tiếp theo** tới **Battle** (từ lượt 3 của bạn; lượt 1 không tấn công): **kéo quái của bạn sang quái đối thủ** (kể cả lá úp) → mũi tên vàng, mục tiêu hợp lệ viền đỏ; thả lên mục tiêu để tấn công; nếu sân đối thủ trống, kéo vào khung **LP đối thủ** (góc trên trái) để đánh trực tiếp.
7. Bấm **Kết thúc lượt**: ô nhập bị khoá lúc "AI đang suy nghĩ…", log ghi các nước AI. Muốn xem trước mà không cần server: `?fixture=summon-choice|tribute|attack|attack-direct|drag-illegal` (bấm "gửi" chỉ ghi `sẽ gửi: …` vào log).

## `[ASSUMED]` cần bạn duyệt

1. Ngưỡng kéo **8px** (nhấn-nhả dưới ngưỡng = click, không phải kéo).
2. Click không kéo trên lá tay chỉ có tác dụng khi server biến nó thành câu trả lời 1 lá (bỏ bài); click lá thường không làm gì. Kéo một lá tay mà server không liệt kê ô nào (Spell/Trap hiện chưa có action, Normal Summon đã dùng, sai phase) = **không theo chuột**, thả ra chỉ toast "Lá này chưa thể dùng lúc này" (câu chung, không nói lý do vì client không biết luật).
3. Menu chọn mục theo **nhả chuột** (không nhấn giữ); thứ tự mục cố định: Triệu hồi rồi Úp; menu Đổi thế luôn hiện dù chỉ có 1 lựa chọn.
4. Thả lên **ô đang có quái** chỉ hợp lệ khi server liệt kê action tribute vào ô đó (luật ô giải phóng của task 1.4); khi đó chỉ quái bị hiến tế đúng ô đó được liệt kê làm ứng viên.
5. Bỏ **nhiều** lá dùng lại cùng máy `selecting-tribute` (`purpose:'discard'`), tự mở khi có prompt và **không có nút Hủy** (prompt bắt buộc). Bỏ 1 lá vẫn là bấm 1 lá. Test đơn vị có; **chưa gặp prompt nhiều lá trong ván thật** (engine hiện chỉ sinh count = 1).
6. **Fixture thứ 5 `attack-direct`** (ngoài 4 tên bạn yêu cầu) để xem đánh trực tiếp, vì `attack` có quái đối thủ nên không có action direct.
7. Toast 2,5 s, đặt giữa bàn phía trên thanh phase; thanh Xác nhận/Hủy đè lên panel phase khi chọn tribute.
8. Thả mũi tên tấn công ngoài mục tiêu hợp lệ → toast "Không thể tấn công mục tiêu này" (không phân biệt vì sao, client không biết luật).
9. Right-click, phím **Esc** và nhả chuột ngoài canvas = Hủy thao tác đang kéo/menu/tribute (không Hủy được bỏ bài bắt buộc).
10. Chuỗi UI mới ở `strings.ts` (chờ i18n 2.12); bảng mã lỗi ở `error-messages.ts` cũng là tiếng Việt cứng.
11. `sẽ gửi: <action JSON>` trong fixture dùng dấu phẩy + khoảng trắng để tự xuống dòng ở panel log hẹp.
12. `tools/ui-drag-shots.ts` giả định Edge ở đường dẫn mặc định (đổi bằng biến `EDGE`) và dev server ở `:5173`.

## Tệp đổi

Mới: `apps/web/src/duel/{interaction,interaction-driver,legal-index,error-messages,interaction.harness}.ts` + 6 file test, `apps/web/src/e2e/{real-api,controller-real.e2e,play-with-machine.e2e}.ts`, `apps/web/vitest.e2e.config.ts`, `tools/{play-duel-ui,ui-drag-shots}.ts`, `docs/ai/review-packets/task-2.8*`. Sửa: `duel/{duel-controller,layout,strings,theme,fixtures,fixture-names}.ts`, `scenes/{duel-scene,menu-scene}.ts`.

## Việc tiếp theo đề xuất

**2.9** — animation theo `GameEvent[]` + phát lại `aiActions` từng bước (lúc này bảng "nhảy" tới trạng thái mới). Trước P3 vẫn còn cổng bắt buộc: fuzz/golden kiểm bất biến không lộ thông tin qua HTTP khi có Spell/Trap. Khi có ảnh Duel gốc `[REF]`, đối chiếu bố cục/màu overlay.
