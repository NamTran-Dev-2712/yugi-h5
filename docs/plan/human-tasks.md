# Human Tasks — việc của bạn

File dùng hàng ngày. Tick khi xong. "Hạn" = cần có **trước** task nào (để AI không bị chặn). Thiếu tư liệu → mục đó vẫn `[GUESS]`, AI vẫn làm tiếp
với giả định và đánh dấu "nháp". Nộp = thả file vào thư mục ghi ở cột "Nộp".

## Việc cần làm ngay (trước P1/P2)

| ☐   | Việc                                                                 | Spec/định dạng     | Số lượng | Cần trước    | Nộp                              | Ai kiểm |
| --- | -------------------------------------------------------------------- | ------------------ | -------- | ------------ | -------------------------------- | ------- |
| ☐   | Duyệt bộ plan này (MASTER-PLAN + ADR)                                | Trả lời "OK"/góp ý | 1        | P1           | Chat                             | Bạn     |
| ☐   | Trả lời câu G1–G2 (lượt 1 draw/attack? tribute flow?)                | Chữ/ảnh            | 2 câu    | Task 1.2/1.4 | `docs/reference/notes/rules.md`  | AI      |
| ☐   | Screenshot Duel gốc (đầu lượt, chọn summon, tribute, attack, prompt) | PNG ≥1080p         | ≥ 8      | Task 2.6     | `docs/reference/duel/`           | AI      |
| ☐   | Ghi chú quirk luật/flow (auto-chain? timer? hỏi activate?)           | Markdown tự do     | 1 file   | Task 2.6     | `docs/reference/notes/quirks.md` | AI      |

## Theo phase

| Phase | ☐   | Việc                                                                                                   | Spec                              | SL        | Cần trước                | Nộp                                   |
| ----- | --- | ------------------------------------------------------------------------------------------------------ | --------------------------------- | --------- | ------------------------ | ------------------------------------- |
| P2    | ☐   | Chơi thử vertical slice + điền checklist QA                                                            | `testing-strategy.md` checklist   | 1 ván     | Kết P2                   | Chat                                  |
| P2    | ☐   | Screenshot Menu, Match Result                                                                          | PNG                               | 2–4       | Task 7.4                 | `docs/reference/menu/`, `.../result/` |
| P3    | ☐   | Video/GIF chain, activate spell/trap                                                                   | MP4/GIF ≤ 30s                     | 3–5       | Task 3.4                 | `docs/reference/video/chain/`         |
| P3    | ☐   | Trả lời G5–G6 (chain prompt, damage step)                                                              | Chữ                               | 2         | Task 3.4                 | `docs/reference/notes/rules.md`       |
| P4    | ☐   | Danh sách card mong muốn (tên placeholder + effect ý tưởng)                                            | CSV/Markdown                      | 30–60     | Batch 1                  | `data/cards/wishlist.md`              |
| P4    | ☐   | Trả lời G8 (Extra Deck/Fusion)                                                                         | Chữ + ảnh                         | 1         | Task 4.5                 | `docs/reference/notes/rules.md`       |
| P5    | ☐   | Art batch đầu                                                                                          | 512×512 WebP/PNG, `<cardId>.webp` | 10        | Task 5.6                 | `assets/card-art-src/`                |
| P5    | ☐   | Art tiếp theo theo `ASSET_REQUESTS.md`                                                                 | Như trên                          | 10–20/lần | Theo batch               | `assets/card-art-src/`                |
| P5    | ☐   | Background Duel/Menu                                                                                   | 1280×720 hoặc 1920×1080 WebP      | 2–3       | Task 5.4                 | `assets/backgrounds/`                 |
| P5    | ☐   | Icon UI (thuộc tính, loại bài, sao, nút)                                                               | PNG 64×64 trong suốt              | ~25       | Task 5.1                 | `assets/ui/`                          |
| P6    | ☐   | Video/GIF: draw, summon, attack, destroy, LP, phase                                                    | MP4/GIF + ghi chú thời lượng      | ≥ 8       | Task 6.3                 | `docs/reference/video/`               |
| P6    | ☐   | SFX theo danh sách event                                                                               | OGG ≤ 100KB `sfx-<event>.ogg`     | ~20       | Task 6.6                 | `assets/audio/sfx/`                   |
| P6    | ☐   | BGM                                                                                                    | OGG loop `bgm-<scene>.ogg`        | 2–3       | Task 6.6                 | `assets/audio/bgm/`                   |
| P6    | ☐   | Duyệt từng animation trong Animation Preview                                                           | Tick trong `parity-board.md`      | mỗi anim  | Kết P6                   | Chat/parity-board                     |
| P7    | ☐   | Screenshot Deck Builder + Collection                                                                   | PNG                               | 3–5       | Task 7.5                 | `docs/reference/deck-builder/`        |
| P7    | ☐   | Duyệt hoặc đổi Q: `sharp`, thư viện hash mật khẩu                                                      | Trả lời OK                        | 2         | Task 5.3/7.1             | Chat                                  |
| P8    | ☐   | Nhận xét độ khó AI                                                                                     | Chữ                               | 1         | Kết P8                   | Chat                                  |
| P9    | ☐   | Trả lời G7 (timer/AFK); thử PvP với bạn                                                                | Chữ/kết quả                       | —         | Task 9.3                 | Chat                                  |
| P10   | ☐   | Chốt tên/nhãn gold, gem; nguồn kiếm + trần/ngày; thưởng mỗi trận; xác nhận KHÔNG bán tiền thật (E4)    | Chữ/bảng                          | 1 bảng    | Trước P10                | `docs/plan/economy-plan.md` (bảng E)  |
| P10   | ☐   | Duyệt đề xuất sửa CLAUDE.md #5 (DB thêm Wallet/Inventory/Transaction)                                  | Trả lời OK                        | 1         | Trước P10                | Chat                                  |
| P11   | ☐   | Đặt tên các tầng độ hiếm bài [CẦN HỎI]; tỉ lệ rơi, pity, số lá/pack, xử lý bài trùng [DECISION]        | Chữ/bảng                          | 1 bảng    | Trước P11                | `docs/plan/economy-plan.md`           |
| P11   | ☐   | Art pack / rương / hiệu ứng mở pack (placeholder trước)                                                | 512×512 hoặc theo spec sau        | tùy       | Task P11 (sau breakdown) | `assets/` (theo `ASSET_REQUESTS.md`)  |
| P12   | ☐   | Bảng giá shop + giới hạn mua; quy tắc tiền sự kiện (hết hạn?)                                          | Bảng/chữ                          | 1         | Trước P12                | `docs/plan/economy-plan.md`           |
| P12   | ☐   | Icon gold/gem/tiền sự kiện, icon SKU                                                                   | PNG 64×64 trong suốt              | ~10       | Task P12                 | `assets/ui/`                          |
| P13   | ☐   | Cấu trúc Adventure: số chương/ải, boss, thưởng lần đầu/lặp, stamina?, deck cố định hay mượn            | Chữ/bảng                          | 1         | Trước P13                | `docs/plan/modes-and-liveops-plan.md` |
| P13   | ☐   | Art map ải/nhân vật đối thủ (placeholder trước)                                                        | WebP theo spec sau                | tùy       | Task P13                 | `assets/`                             |
| P14   | ☐   | Chốt quy mô deploy/số người chơi + có bot fallback không [CẦN HỎI]; hệ rank/rating, độ dài mùa, thưởng | Chữ                               | 1         | Trước P14                | Chat / `modes-and-liveops-plan.md`    |
| P15   | ☐   | Danh sách nhiệm vụ ngày + thưởng; chu kỳ điểm danh; giờ/múi giờ reset; streak đứt thì sao              | Bảng                              | 1         | Trước P15                | `docs/plan/modes-and-liveops-plan.md` |
| P15   | ☐   | Lịch sự kiện đua top + metric xếp hạng + thưởng theo hạng; cách sửa lịch (không admin)                 | Bảng/chữ                          | 1         | Trước P15                | `docs/plan/modes-and-liveops-plan.md` |

## Cách nộp (tóm tắt)

- Tên file/thư mục: xem `docs/reference/README.md` và `docs/plan/card-art-pipeline.md`.
- Sau khi nộp: nhắn "đã nộp <loại> <số lượng>" — AI chạy validate và báo cáo.
- Yêu cầu asset chi tiết theo đợt: `docs/assets/ASSET_REQUESTS.md`.
