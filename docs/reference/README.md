# Reference Capture Kit — tư liệu Yugi H5 gốc

Bạn thả tư liệu vào đây để AI đối chiếu. **Không có tư liệu → cơ chế đó giữ nhãn `[GUESS]`** (xem `docs/plan/fidelity-spec.md`).
Không cần nộp đủ một lần; nộp dần theo `docs/plan/human-tasks.md`. Nhắn "đã nộp <loại> <số lượng>" sau mỗi lần.

## Cấu trúc thư mục

```
docs/reference/
  menu/          screenshot menu chính, chọn chế độ
  duel/          screenshot trận đấu theo trạng thái
  deck-builder/  screenshot deck builder, collection
  result/        màn kết quả thắng/thua
  card/          khung bài, card detail, ví dụ các loại card
  video/         video/GIF ngắn theo hành động
  notes/         ghi chú chữ (rules.md, quirks.md, ui.md)
```

- `02-yugi-h5-mechanics.md` — tóm tắt luật cốt lõi từ project brief; nguồn chi tiết là `notes/rules*.md`.

## Quy ước tên file

`<screen>-<state>-<nn>.png` — chữ thường, gạch ngang, số thứ tự 2 chữ số.
Ví dụ: `duel-turn-start-01.png`, `duel-tribute-select-01.png`, `duel-attack-declare-01.png`, `deck-builder-main-01.png`.
Video: `video/<action>-<nn>.mp4` (hoặc `.gif`), kèm dòng ghi chú thời lượng trong `notes/ui.md` nếu biết.

## Cần chụp (tối thiểu)

### Screenshot (PNG, độ phân giải cao nhất có thể, chụp nguyên màn hình game)

| Màn hình/trạng thái          | Tên gợi ý                                        |
| ---------------------------- | ------------------------------------------------ |
| Menu chính                   | `menu-main-01`                                   |
| Chọn chế độ / chọn deck      | `menu-mode-01`, `menu-deck-01`                   |
| Duel — đầu lượt              | `duel-turn-start-01`                             |
| Duel — chọn summon (kéo)     | `duel-summon-select-01`                          |
| Duel — chọn tribute          | `duel-tribute-select-01`                         |
| Duel — chọn vị trí (ATK/DEF) | `duel-position-prompt-01`                        |
| Duel — declare attack        | `duel-attack-declare-01`                         |
| Duel — chain / hỏi kích hoạt | `duel-chain-prompt-01`                           |
| Duel — prompt chọn target    | `duel-target-select-01`                          |
| Duel — mở graveyard          | `duel-graveyard-01`                              |
| Duel — card detail           | `duel-card-detail-01`                            |
| Duel — kết thúc (thắng/thua) | `duel-end-win-01`, `duel-end-lose-01`            |
| Deck Builder                 | `deck-builder-main-01`, `deck-builder-filter-01` |
| Kết quả trận                 | `result-main-01`                                 |

### Video/GIF ngắn (≤ 30s, ghi chú thời lượng nếu biết)

Rút bài · Normal Summon · Tribute Summon · Set · Đổi position/Flip · Attack + damage · Destroy monster · Activate Spell/Trap · Chain (2+ link) ·
LP thay đổi · Đổi phase · Thắng/thua.

### Ghi chú chữ (`notes/*.md`, viết tự do, gạch đầu dòng)

Những quirk bạn nhớ, ví dụ:

- Lượt 1 có draw/attack không? Starting LP? Timer mỗi lượt?
- Có auto-chain không? Có hỏi "Kích hoạt?" mỗi lần không? Có tắt được không?
- Tribute chọn trước hay sau? Đổi position bằng nút hay kéo?
- Có surrender, log trận, cheat-sheet luật không?
- Có Extra Deck/Fusion/Ritual không? Deck limit? Có pack/gacha?
- Âm thanh, phong cách hiệu ứng (nhanh/kịch tính), thời lượng gần đúng.

## Lưu ý

- Ảnh/video bản quyền chỉ dùng **tham chiếu cá nhân**; thư mục này có thể để ngoài git (xem `.gitignore`) — không commit lên repo public.
- Nếu không thể chụp thứ gì, ghi vào `notes/` "không có/không nhớ" để tôi đánh dấu `[GUESS]` có chủ đích.

## Khi bạn báo "đã nộp" (quy trình của AI, chạy bằng `/ingest-reference`)

1. **Video → frame**: kiểm tra `ffmpeg -version`. Nếu chưa có thì báo bạn, **không tự cài**. Nếu có: cắt frame (mặc định 4 fps, nhiều hơn quanh
   chuyển động) vào `docs/reference/frames/<tên-video>/`, kèm bảng `frames-index.md` (frame, timestamp).
2. **Ảnh → mô tả bố cục**: đọc từng ảnh, viết vào `notes/layout-analysis.md` vị trí LP, deck, GY, hand, phase bar… (tỉ lệ % màn hình).
3. **Thời lượng animation**: ước lượng từ timestamp frame (nêu sai số theo fps).
4. **Cập nhật nhãn**: chuyển G tương ứng `[GUESS]` → `[REF]` trong `fidelity-spec.md`, `parity-board.md`, `notes/rules.md`; ghi rõ **chỗ chắc / chỗ không chắc**.
   Mâu thuẫn với `[DECISION]` thì nêu ra chờ bạn quyết.
5. **Không bịa**: chi tiết tư liệu không cho thấy thì ghi "không thấy trong tư liệu" và giữ `[GUESS]`.
