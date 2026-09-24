# Trang debug solo — hướng dẫn chơi thử từng bước

Trang này là **công cụ kiểm luật bằng mắt**, không phải giao diện game cuối. Bạn tự chơi cả hai bên (P0 và P1) trên cùng một trang để xem luật có đúng không. Bạn không cần biết code: chỉ bấm, đọc, và báo lại những chỗ thấy sai (mẫu báo cáo ở mục D).

## A. Khởi động (làm lại mỗi lần bật máy)

Cần 3 thứ chạy: **Docker Desktop**, **cơ sở dữ liệu**, **server + web**.

1. Mở **Docker Desktop** và đợi tới khi nó báo _Engine running_ (biểu tượng cá voi đứng yên, không xoay).
2. Mở terminal, vào thư mục dự án `E:\code\game\turn_battle\yugi-h5`, chạy:
   ```bash
   docker compose up -d
   ```
   Kỳ vọng: thấy `Container yugi-h5-postgres-1  Running` (hoặc `Started`).
3. Chạy server + web (giữ cửa sổ terminal này mở, đừng đóng):
   ```bash
   pnpm dev
   ```
   Đợi ~20–40 giây tới khi có dòng báo API đã lắng nghe và Vite in `Local: http://localhost:5173/`.
4. Kiểm tra server sống: mở http://localhost:3000/health → phải thấy `{"status":"ok","database":"ok"}`.
5. **Mở trang debug: http://localhost:5173/debug.html**

Chỉ lần đầu tiên trên máy mới (đã làm rồi trên máy này): `pnpm install`, `cp apps/api/.env.example apps/api/.env`, `cp apps/web/.env.example apps/web/.env`, `pnpm --filter @yugi/api prisma:migrate`.

**Tắt:** bấm `Ctrl+C` ở terminal đang chạy `pnpm dev`; muốn tắt cả cơ sở dữ liệu thì `docker compose down` (KHÔNG thêm `-v`, sẽ xoá dữ liệu).

Nếu trang báo lỗi:

| Thấy gì                             | Nghĩa là                                        | Làm gì                                                  |
| ----------------------------------- | ----------------------------------------------- | ------------------------------------------------------- |
| `0 NETWORK_ERROR — Failed to fetch` | server chưa chạy                                | kiểm tra terminal `pnpm dev`, xem `logs/dev.log` nếu có |
| `401 …`                             | token guest hết hạn (12 giờ)                    | bấm **Tạo duel mới**                                    |
| `404 DUEL_NOT_FOUND`                | server đã khởi động lại nên mất ván (lưu ở RAM) | bấm **Tạo duel mới**                                    |
| `429`                               | gửi quá ~120 yêu cầu/phút                       | đợi 1 phút                                              |
| `health` báo database lỗi / `P1001` | chưa bật Docker/Postgres                        | làm lại bước 1–2                                        |

## B. Cách đọc trang

- **Thanh trên cùng:** nút **Tạo duel mới** (tạo ván mới, deck mẫu 42 quái cho cả hai bên); **Xem là P0 / Xem là P1** (đổi góc nhìn: bạn thấy bài của bên đó, còn bên kia bị ẩn); ô **tự chuyển viewer** (bật: sau mỗi action, trang tự chuyển sang bên đang được server chờ — người đến lượt hoặc người có prompt); ô **Raw JSON**.
- **Khung đỏ** = lỗi vừa nhận từ server, dạng `409 ACTION_REJECTED / <MÃ_LỖI> — …`. Lỗi **không** làm đổi ván (xem `version` ở dòng trạng thái: không tăng).
- **Khung xanh** = trận kết thúc.
- **Dòng trạng thái:** `Lượt N · lượt của Px · phase … · version …` và, nếu có, `PROMPT …`.
- **Hai khung người chơi:** LP, Deck, Tay (số lá), Extra, Mộ; 5 ô quái; danh sách Mộ; Tay. Bên đối thủ chỉ hiện `Tay N lá (ẩn)`; quái úp của đối thủ hiện `? [mã]`.
- **Ô quái** ghi `Tên Lv ATK/DEF`, rồi `tư thế [mã]`. Tư thế: `Attack`, `DefenseUp` (thủ ngửa), `DefenseDown` (úp; chỉ chủ nhân thấy tên).
- **Khung "Hành động của Px"** (cho bên đang xem): mỗi dòng một nút. Từ task 2.5, nút **không nằm trong `legalActions` của server thì bị mờ và tắt** (rê chuột để xem lý do); ô chọn (ô quái, tribute, mục tiêu) chỉ còn các giá trị hợp lệ. Bật công tắc **"Cho phép thử hành động sai luật"** để nút mờ bấm được và ô chọn hiện đủ giá trị → server trả `409` như trước (kiểm tra server không tin client). Không có nút "Draw": bài được rút tự động khi bạn rời phase Draw.

### Xem thử legalActions (dưới 5 phút)

1. **Tạo duel mới** → P0 đến lượt: chỉ `EndPhase`, `End Turn`, `Surrender` sáng; nếu chuyển **Xem là P1** thì chỉ còn `Surrender` (P1 không đến lượt), mọi nút khác mờ.
2. Xem là P0, bấm `EndPhase` 2 lần tới **Main1**: các nút `Triệu hồi`/`Úp` của quái Lv ≤ 4 sáng, ô quái đủ 5; lá Lv ≥ 5 mờ (chưa có quái để tribute). `Tấn công`/`Đổi thế` không có (chưa có quái).
3. `Triệu hồi` một lá: **mọi** nút `Triệu hồi`/`Úp` còn lại mờ (đã dùng Normal Summon); nút `Đổi thế` của quái vừa triệu hồi mờ (vừa triệu hồi).
4. Bấm `EndPhase` tới **Battle** ở lượt 1: `Tấn công` mờ (lượt 1 không tấn công). Qua lượt sau, quái đủ điều kiện sẽ hiện `Tấn công`, và ô Mục tiêu chỉ có "Tấn công trực tiếp" khi đối thủ không có quái.
5. Bật công tắc **Cho phép thử hành động sai luật**, bấm một nút mờ (vd `Triệu hồi` lần hai) → khung đỏ `409 ACTION_REJECTED / NORMAL_SUMMON_USED`, `version` không tăng.
6. Để tay > 6 rồi rời Main2: chỉ còn nút bỏ bài (`Bỏ N lá`) và `Surrender` sáng cho bên phải trả lời.

- **Nhật ký event** ở dưới: mỗi hành động ghi các dòng như `P0 rút 1 lá: …`, `P0 Triệu hồi … ở ô 0`. Lưu ý: nhật ký là những gì **bên vừa gửi action** nhận được. Dòng bắt đầu bằng `✗` là action bị từ chối.

### Bảng lá trong deck mẫu (Level và chỉ số, để bạn chọn lá cho từng bước)

Mỗi lá có 3 bản. Trang **không** hiện Level của lá trên tay, hãy tra bảng này.

| Tên                       | Lv    | ATK  | DEF  |     | Tên              | Lv  | ATK  | DEF  |
| ------------------------- | ----- | ---- | ---- | --- | ---------------- | --- | ---- | ---- |
| Wandering Squire          | 3     | 1200 | 800  |     | Hollow Marauder  | 4   | 1700 | 1000 |
| **Iron Bulwark Guardian** | **6** | 1800 | 2400 |     | Dawnbreak Cleric | 3   | 1000 | 1200 |
| **Ashfall Wyrm**          | **8** | 2700 | 2000 |     | Rustfang Wolf    | 2   | 800  | 500  |
| Lantern Sprite            | 2     | 700  | 600  |     | Brine Serpent    | 4   | 1400 | 1300 |
| Mossback Tortoise         | 3     | 900  | 1400 |     | Ember Acolyte    | 1   | 500  | 400  |
| Tidecaller Adept          | 4     | 1500 | 1100 |     | Stormwing Scout  | 3   | 1100 | 800  |
| Cinder Hound              | 3     | 1300 | 700  |     |                  |     |      |      |
| Gale Skirmisher           | 4     | 1600 | 900  |     |                  |     |      |      |

Level 1–4: không cần tribute. **Iron Bulwark Guardian (Lv6)** cần 1 tribute; **Ashfall Wyrm (Lv8)** cần 2 tribute. Chỉ có hai lá Level cao, nên để test Tribute hãy bấm **Tạo duel mới** cho tới khi tay P0 (hoặc P1) có Iron Bulwark Guardian (xác suất ~1/3 mỗi ván).

## C. Kịch bản chơi thử theo từng lượt

Mỗi bước: **bấm gì → kỳ vọng thấy gì**. Ghi lại bước nào lệch (mục D). `[RULE]` = luật Yu-Gi-Oh chuẩn; mọi luật chưa có tư liệu Yugi H5 gốc, bạn là người duyệt.

### Lượt 1 — P0

1. **Tạo duel mới.** → P0 đến lượt, phase `Draw`, LP 8000/8000, P0 Tay 5, Deck 37; P1 `Tay 5 lá (ẩn)`. Nhật ký đầu: `Trận bắt đầu, P0 đi trước`, 5 dòng `P0 rút 1 lá: <tên>`, 5 dòng `P1 rút 1 lá (ẩn)`.
2. **`EndPhase (đang ở Draw)`.** → phase `Standby`; **Deck vẫn 37, Tay vẫn 5** (lượt 1 của người đi trước không rút). Log: `Phase Draw → Standby`.
3. **`EndPhase` lần nữa.** → `Main1`.
4. **Normal Summon:** chọn một quái Level ≤4 trong tay (`Triệu hồi <tên> [mã]`), chọn `ô 0 (trống)`, không tick tribute, bấm nút. → quái hiện ở ô 0 tư thế `Attack`; Tay 4; `Đã Normal Summon: rồi`; log `P0 Triệu hồi … ở ô 0`.
5. **Thử Normal Summon lần 2 cùng lượt** (một quái Level ≤4 khác, `ô 1`). → khung đỏ `409 ACTION_REJECTED / NORMAL_SUMMON_USED`; ván không đổi (`version` giữ nguyên, Tay vẫn 4).
6. **Set cùng lượt cũng bị chặn:** bấm `Úp <một quái khác>`. → cũng `409 … NORMAL_SUMMON_USED` (Summon và Set dùng chung 1 quyền/lượt `[RULE]`).
7. **Thử tấn công lượt 1:** `EndPhase` tới `Battle`, bấm `Tấn công bằng …` → mục tiêu `Tấn công trực tiếp`. → `409 … FIRST_TURN_ATTACK_BANNED`.
8. **Thử sai người:** bấm **Xem là P1**, bấm `EndPhase`. → `409 … NOT_TURN_PLAYER` (lượt của P0). Bấm **Xem là P0** để quay lại.
9. Bấm **`End Turn`**. → trang tự đi qua Main2, End rồi sang lượt 2, tự chuyển sang xem P1. (Nếu tay P0 > 6, sẽ có prompt bỏ bài, xem bước "Bỏ bài".)

### Lượt 2 — P1

10. Phase `Draw`, P1 Tay 5, Deck 37. **`EndPhase`.** → **P1 rút 1 lá**: Deck 36, Tay 6; log `P1 rút 1 lá: <tên>`; phase `Standby`.
11. **`EndPhase`** → `Main1`. **Set quái úp:** `Úp <quái Level ≤4>` ô 0. → ô 0 của P1 hiện tư thế `DefenseDown` (bạn là chủ nên thấy tên); log `P1 úp 1 quái ở ô 0` **không có tên lá**.
12. Bấm **Xem là P0**. → ô 0 của P1 giờ hiện **`? [mã]`** (không tên). Đây là kiểm tra ẩn bài quan trọng.
13. **Xem là P1**, bấm `End Turn`.

### Lượt 3 — P0: Normal Summon thứ hai, đổi thế

14. `EndPhase` ×2 tới `Main1` (P0 rút, Deck 36). **Normal Summon** quái thứ hai (Level ≤4) vào `ô 1`.
15. **Đổi thế:** ở quái đã Summon từ lượt 1, bấm `Đổi thế … → DefenseUp`. → tư thế đổi thành `DefenseUp`; log `P0 đổi thế … : Attack → DefenseUp`.
16. Bấm nút đổi thế của **chính quái đó** lần nữa (`→ Attack`). → `409 … POSITION_ALREADY_CHANGED`.
17. Bấm `Đổi thế` của quái **vừa Summon lượt này**. → `409 … SUMMONED_THIS_TURN` (`[RULE]` quái vừa Summon không đổi thế).
18. `EndPhase` tới `Battle`: quái vừa Summon **không** tấn công được (`Tấn công bằng …` → từ chối, `JUST_SUMMONED_CANNOT_ATTACK`); quái đang `DefenseUp` không có nút tấn công. `End Turn`.

### Lượt 4 — P1: có quái ngửa để đánh

19. Rút bài (`EndPhase`×2). **Normal Summon** một quái Level ≤4 **vào ô 1** (nó ở tư thế `Attack`, dùng để test ATK vs ATK). `End Turn`.

### Lượt 5 — P0: tấn công

20. Rút bài, `Main1`. Bấm `Đổi thế` đưa quái đang `DefenseUp` về `Attack` (lượt mới thì được). Nếu có **Iron Bulwark Guardian**, làm bước Tribute (mục dưới) rồi quay lại đây.
21. `EndPhase` → `Battle`. **Tấn công quái úp của P1** (ô 0) bằng một quái ngửa `Attack`. → log: `P0 tấn công … bằng …`, rồi **`P1 lật <tên> (ô 0)`** (quái úp lật lên **trước** khi tính sát thương), rồi kết quả.
22. **Kiểm tra sát thương**, theo bảng `RULES-REVIEW-SHEET.md` (P0 tấn công, P1 chịu):

    | Tình huống                                                  | Kỳ vọng                                               |
    | ----------------------------------------------------------- | ----------------------------------------------------- |
    | ATK của bạn **>** ATK của mục tiêu (mục tiêu tư thế Attack) | mục tiêu bị phá; **P1 mất (ATK − ATK)** LP            |
    | ATK **<** ATK mục tiêu (Attack)                             | **quái của bạn** bị phá; **bạn mất (chênh lệch)** LP  |
    | ATK **=** ATK mục tiêu (Attack)                             | cả hai bị phá, không ai mất LP                        |
    | ATK **>** DEF mục tiêu (thủ)                                | mục tiêu bị phá; **không ai mất LP**                  |
    | ATK **<** DEF mục tiêu (thủ)                                | **không quái nào bị phá**; **bạn mất (DEF − ATK)** LP |
    | ATK **=** DEF (thủ)                                         | không gì xảy ra (`[ASSUMED]`, chưa có tư liệu)        |
    | Tấn công trực tiếp (P1 không còn quái nào)                  | P1 mất đúng ATK của quái tấn công                     |

    Đối chiếu số trên màn hình (LP trước/sau, mộ, ô quái) với bảng. Ví dụ: Tidecaller Adept (1500) đánh Lantern Sprite `Attack` (700) → Lantern Sprite vào mộ, P1 mất 800.

23. Mỗi quái chỉ tấn công 1 lần/lượt: bấm tấn công lần 2 bằng cùng quái → `409 … ATTACKED_THIS_TURN`.
24. Thử **tấn công trực tiếp khi P1 còn quái** → `409 … MUST_TARGET_MONSTER` (chỉ được tấn công trực tiếp khi đối thủ hết quái, kể cả quái úp).

### Tribute Summon (cần Iron Bulwark Guardian Lv6 trong tay và ≥1 quái của bạn trên sân)

25. Chọn `Triệu hồi Iron Bulwark Guardian`, một ô trống, **không tick tribute**. → `409 … TRIBUTE_COUNT_MISMATCH`.
26. Tick **2 quái** làm tribute (nếu bạn có 2). → `409 … TRIBUTE_COUNT_MISMATCH` (Lv5–6 cần đúng 1).
27. Tick **đúng 1 quái**, bấm. → log `P0 hiến tế … (ô N)` rồi `P0 Triệu hồi Iron Bulwark Guardian`; quái bị hiến tế nằm trong **Mộ**. Dùng ô của quái vừa hiến tế được, kể cả khi sân đầy 5 quái. (Việc này dùng luôn quyền Normal Summon của lượt.)
28. Với **Ashfall Wyrm (Lv8)**: cần đúng 2 tribute (1 tribute → `TRIBUTE_COUNT_MISMATCH`).

### Bỏ bài khi tay quá 6

29. Cho một bên chỉ bấm `End Turn` mỗi lượt (không đánh bài). Mỗi lượt bên đó rút 1 lá; khi tay **7 lá** lúc rời `Main2` → phase **không** chuyển, dòng trạng thái hiện `PROMPT DiscardToHandLimit cho Px: {"count":1}` và có nút `Bỏ 1 lá (prompt)` kèm ô tick các lá trong tay.
30. **Không tick gì / tick sai số lượng**, bấm. → `409 … INVALID_DISCARD`, ván không đổi.
31. Tick đúng 1 lá, bấm. → log `Px bỏ <tên> xuống mộ`, Tay còn 6, phase sang `End`.

### Kết thúc trận

32. **Cách 1 — LP về 0:** cho P1 hết quái rồi tấn công trực tiếp bằng mọi quái. → LP P1 giảm đúng ATK từng đòn; khi về 0: log `P1 mất N LP` rồi `Trận kết thúc: P0 thắng (LP_ZERO)`; **khung xanh** hiện; mọi nút biến mất.
33. **Cách 2 — Surrender:** bấm `Surrender` (bên nào, lúc nào cũng được kể cả không tới lượt). → `Trận kết thúc: <bên kia> thắng (SURRENDER)`.
34. Sau khi kết thúc, dùng **Xem là …** vẫn xem được; gửi thêm action (ví dụ bằng `curl`, vì nút đã ẩn) → `409 … DUEL_ENDED`.

## D. Cách nhận biết lộ bài (Raw JSON)

Bật ô **Raw JSON** (cuộn xuống cuối trang): hiện phản hồi thành công gần nhất của server, đúng những gì trình duyệt nhận. Khi bạn đang **Xem là P0**:

- `view.players[1].hand` (tay P1) phải toàn `{"hidden": true, "instanceId": "...", "ownerIndex": 1}` — **không có** `definitionId`.
- Quái úp của P1 trong `view.players[1].board.monsterZones` cũng chỉ có `hidden: true`.
- Không được có: `"rng"`, danh sách deck, hay `actionLog`. Deck chỉ có số (`deckCount`).
- `events`: dòng `CardDrawn` của P1 có `card.hidden: true` (không tên); `MonsterSet` không có `definitionId`.
- Mẹo tìm nhanh: dùng Ctrl+F tìm `definitionId` — chỉ được xuất hiện ở lá **của bạn** hoặc lá **đã lật/ngửa/ở mộ**. Nếu thấy một `definitionId` đứng cạnh `instanceId` bắt đầu bằng `p1-` mà lá đó đang **ẩn** với bạn, đó là **lỗi lộ bài** — chụp lại.
- Làm tương tự khi **Xem là P1** và soi P0.

## E. Mẫu báo lỗi

Chép mẫu này, điền, gửi:

```
Bước số: (ví dụ: bước 22, lượt 5)
Đang xem là: P0 / P1      Lượt: ..  Phase: ..  version: ..
Tôi đã bấm: (tên nút + các ô đã chọn, ví dụ "Triệu hồi Iron Bulwark Guardian, ô 2, tick 1 tribute")
Kỳ vọng: (theo hướng dẫn hoặc theo luật bạn biết)
Thực tế: (mô tả)
Chữ trong khung đỏ (nếu có): (chép nguyên văn, ví dụ "409 ACTION_REJECTED / NOT_TURN_PLAYER — …")
Dòng nhật ký liên quan: (chép 3–5 dòng cuối)
Raw JSON (nếu liên quan tới lộ bài / số liệu): (dán đoạn liên quan)
Ảnh chụp màn hình: (nếu có)
```

## F. Hai script kiểm tra tự động (không thay cho buổi test của bạn)

```bash
node --experimental-strip-types tools/smoke-http.ts   # 23 kiểm tra API thật (gồm legalActions); ghi docs/ai/review-packets/task-2.4-smoke.md
node --experimental-strip-types tools/play-duel.ts    # tự chơi 1 ván tới LP 0 + 1 ván Surrender; mọi action gửi đều đối chiếu legalActions (được liệt kê ⇔ server chấp nhận)
HEAVY=1 node --experimental-strip-types tools/play-duel.ts   # như trên nhưng deck nhiều quái Lv5+ để chạy nhánh Tribute
```

Cần `pnpm dev` (API + Postgres) đang chạy. Chúng chỉ bắt lỗi rõ ràng; luật chưa có trong script vẫn cần bạn duyệt.

## Giới hạn đã biết

- Chưa có Spell/Trap/effect/Flip Summon (engine chưa làm): deck mẫu chỉ có quái.
- Extra Deck chỉ hiện số lượng.
- Nhật ký chỉ có event của bên vừa gửi action.
- Ván lưu trong RAM của server: khởi động lại server là mất ván.
- Gỡ trang này: xoá `apps/web/debug.html`, `apps/web/src/debug/` và khoá `debug` trong `apps/web/vite.config.ts` (`src/api/` giữ lại cho Phaser).
