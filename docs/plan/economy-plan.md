# Economy Plan — Economy & Inventory, Gacha, Shop (P10–P12)

Mức khái niệm/luồng chính, **chưa breakdown task số** (chờ chủ dự án duyệt hướng). Nguyên tắc nền (CLAUDE.md): server là nguồn sự thật,
**không optimistic** với tiền/item; engine duel thuần; TS strict; không asset Konami. Con số kinh tế = `[DECISION]` chờ chủ dự án;
điểm mơ hồ = `[CẦN HỎI CHỦ DỰ ÁN]`. Nhãn độ tin cậy như `MASTER-PLAN.md`; toàn bộ phần này **không có `[REF]`** (chưa có tư liệu Yugi H5 về kinh tế).

> **Xung đột cần duyệt:** CLAUDE.md #5 hiện ghi "DB chỉ lưu User/Collection/Deck/MatchHistory/Progress". Economy cần thêm bảng
> Wallet, InventoryItem, Transaction (ledger), PackOpening (log roll), rồi ở các phase sau QuestProgress, LoginStreak, AdventureProgress,
> ArenaRating, SeasonResult. Nội dung định nghĩa (pack, shop catalog, stage, quest) vẫn **ở `packages/shared`** như card — DB chỉ giữ dữ liệu người chơi.
> Đề xuất sửa #5 nằm trong ADR 2026-09-25; CLAUDE.md root do chủ dự án duyệt.

## Khái niệm

| Khái niệm     | Mô tả                                                                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Currency      | `gold` (kiếm qua chơi), `gem` (cứng hơn, nguồn: `[CẦN HỎI]`), tiền sự kiện (`currencyId` riêng theo sự kiện, có thể hết hạn). Tên hiển thị VI/EN = `[DECISION]`.          |
| Wallet        | Số dư theo (user, currency). Chỉ đổi qua Economy service.                                                                                                                 |
| Inventory     | Bài theo `definitionId` × số lượng sở hữu (mở rộng `Collection`); item khác (vé, mảnh…) theo `itemId`. Sở hữu > 3 bản có cho phép không: `[CẦN HỎI]` (deck vẫn ≤ 3).      |
| Ledger        | Sổ **append-only**: mỗi biến động = 1 dòng (user, currency/item, delta, lý do, ref, `idempotencyKey`, thời điểm server). Số dư = tổng ledger (hoặc cache đối chiếu được). |
| Reward source | Thưởng sau trận, Adventure, Arena, quest, điểm danh, sự kiện — đều gọi cùng Economy service với lý do + ref.                                                              |

## Luồng chính (server-authoritative)

1. **Ghi số dư**: client gửi _ý định_ (mua SKU X / mở pack Y / nhận thưởng Z) + `idempotencyKey`; **không** gửi giá, số lượng nhận, kết quả roll. Server tra định nghĩa ở shared, tính, kiểm số dư, ghi ledger + đổi số dư trong **một DB transaction**, trả kết quả. Lặp lại cùng key → trả kết quả cũ, không trừ thêm.
2. **Thưởng sau trận**: server (nguồn sự thật của kết quả duel) tự cấp; client không báo thắng. Giới hạn farm AI (trần/ngày hoặc giảm dần) = `[DECISION]`.
3. **Gacha (P11)**: pack = định nghĩa data (giá, bảng tỉ lệ theo tầng, pity nếu có). Mở pack = 1 giao dịch: trừ tiền → roll bằng RNG **phía server, có ghi log** (`PackOpening`: seed/kết quả để kiểm toán) → cộng kho → ledger. RNG này **tách khỏi** RNG seeded của engine duel. Xử lý bài trùng, pity, hiển thị tỉ lệ cho người chơi = `[DECISION]`/`[CẦN HỎI]`. Animation mở pack dùng animation queue (P6) — là phần trình chiếu, kết quả đã chốt ở server.
4. **Shop (P12)**: catalog (data shared): SKU (gói, bài lẻ, vật phẩm), giá theo currency, giới hạn mua (ngày/mùa/tài khoản), tab đổi vật phẩm sự kiện (currency sự kiện). Server tính giá và kiểm giới hạn; UI chỉ hiển thị. Rotation/khuyến mãi tự động thuộc Live-ops (P15).

## Bất biến chống cheat (kiểm bằng test khi làm)

- Không có đường ghi số dư/kho ngoài Economy service (không endpoint nhận "số dư mới" từ client).
- Số dư không bao giờ âm dưới đồng thời (test song song); mọi giao dịch idempotent.
- Ledger không sửa/xóa; đối chiếu số dư ↔ ledger được.
- Kết quả roll không suy ra được từ dữ liệu client gửi; log roll đủ để audit.
- Rate limit trên endpoint giao dịch; guest **không** giữ tiền/item lâu dài (cần tài khoản thật — P7).

## `[DECISION]` / `[CẦN HỎI CHỦ DỰ ÁN]` (chưa chốt, AI không tự đặt)

| #   | Mục                                                                                                               | Trạng thái               |
| --- | ----------------------------------------------------------------------------------------------------------------- | ------------------------ |
| E1  | Tên các tầng độ hiếm bài (và số tầng)                                                                             | [CẦN HỎI CHỦ DỰ ÁN]      |
| E2  | Tỉ lệ rơi từng tầng, có pity/bảo hiểm không, số lá/pack                                                           | [DECISION] chờ chủ dự án |
| E3  | Bài trùng: giữ nguyên tới 3 bản, hay quy đổi (gold/mảnh)?                                                         | [CẦN HỎI CHỦ DỰ ÁN]      |
| E4  | Gem kiếm từ đâu (quest/sự kiện/thành tích)? **Có bán bằng tiền thật không** (đề xuất: không — dự án dùng cá nhân) | [CẦN HỎI CHỦ DỰ ÁN]      |
| E5  | Tên/biểu tượng gold, gem; thưởng gold mỗi trận; trần gold/ngày                                                    | [DECISION] chờ chủ dự án |
| E6  | Bảng giá shop (bài/gói/vật phẩm), giới hạn mua                                                                    | [DECISION] chờ chủ dự án |
| E7  | Tiền sự kiện: hết hạn/reset cuối sự kiện? quy đổi sang gold?                                                      | [CẦN HỎI CHỦ DỰ ÁN]      |
| E8  | Cho phép sở hữu > 3 bản mỗi lá? bán lại bài?                                                                      | [CẦN HỎI CHỦ DỰ ÁN]      |
| E9  | Cần thêm trường `rarity` vào `CardDefinition` (đổi contract `packages/shared`) — chốt sau E1                      | [DECISION]               |

## Rủi ro

| Rủi ro                                        | Giảm                                                          |
| --------------------------------------------- | ------------------------------------------------------------- |
| Double-spend / race khi mua-mở pack song song | DB transaction + idempotency key + test đồng thời             |
| Kinh tế lệch (quá dễ/khó) vì chưa có số       | Toàn bộ số ở data + config (`[DECISION]`), đổi không sửa code |
| Pool lá chưa đủ để gacha có nghĩa             | Gacha sau P4/P5; thiếu thì pack test dùng placeholder         |
| Mâu thuẫn CLAUDE.md #5 (DB chỉ lưu…)          | ADR + chủ dự án duyệt sửa trước khi làm P10                   |
