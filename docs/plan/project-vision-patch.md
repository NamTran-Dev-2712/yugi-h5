# Project Vision — bản vá (dán vào `01-project-vision.md`)

> `01-project-vision.md` (Project Instructions) nằm ngoài repo nên không sửa trực tiếp được. File này chứa đúng nội dung cần
> thay/thêm; chủ dự án dán vào Project Instructions. Nguồn chi tiết: `MASTER-PLAN.md` (P10–P15), `economy-plan.md`,
> `modes-and-liveops-plan.md`, ADR 2026-09-25 "Mở rộng scope" trong `docs/ai/DECISIONS.md`.

## 1. THAY mục "Không ưu tiên lúc đầu" bằng

### Ưu tiên theo giai đoạn (cập nhật 2026-09-25)

**Ưu tiên tuyệt đối (KHÔNG đổi):** core duel mechanics (luật, engine, flow lượt, kéo thả) là số 1. Mọi hệ thống mới bên dưới
được xây **SAU** khi core duel + auth/account nền tảng (P7) + AI rule-based (P8) + realtime (P9) đã ổn định, **không chen ngang**.

**Giai đoạn gần (đã có kế hoạch P0–P9):**

- Duel solo vs AI, effect/chain, card batches, asset pipeline, animation/audio, Deck Builder, Collection, AI rule-based.
- PvP **Room private** (phòng theo mã, chơi với bạn bè, không xếp hạng) — P9.1, giữ nguyên.
- PvE nhẹ (chuỗi đối thủ AI + deck định sẵn) — P9.5, chỉ là **bản tối giản**; bản đầy đủ là Adventure (P13).

**Giai đoạn xa (trong scope, xây sau; xem mục 2):** Economy, Gacha/pack, Shop, Adventure/Campaign, Arena (PvP ladder), Live-ops.
Trước đây "Skin, gacha, progression phức tạp" và "Story / Adventure map" bị loại; nay **nằm trong scope**. "PvP online" được tách:
Room private = ưu tiên gần; **Arena/ladder công khai = ưu tiên xa hơn**.

**Vẫn ngoài scope:** Ritual, Synchro, Xyz, Pendulum, Link, ban-list (Link ở backlog sau P4); thanh toán bằng tiền thật; giao dịch
bài giữa người chơi; admin panel/CMS. _(Các dòng này chờ chủ dự án xác nhận — xem `[CẦN HỎI]` trong `economy-plan.md`.)_

## 2. THÊM mục mới "Hệ thống mở rộng (scope 2026-09-25)"

| Hệ thống                           | Tóm tắt                                                                                               | Phase |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- | ----- |
| Economy & Inventory                | Ví gold / gem / tiền sự kiện, kho item, sổ giao dịch (ledger) — nền cho mọi hệ thống có tiền/vật phẩm | P10   |
| Gacha / mở gói bài                 | Mở "pack" ngẫu nhiên theo tỉ lệ, phân tầng độ hiếm (tên tầng: `[CẦN HỎI CHỦ DỰ ÁN]`)                  | P11   |
| Cửa hàng                           | Mua bài/gói/vật phẩm bằng gold hoặc gem; đổi vật phẩm sự kiện bằng tiền riêng theo sự kiện            | P12   |
| Adventure / Campaign (PvE mở rộng) | Bản đồ ải, đối thủ AI + deck định sẵn, thưởng gold/thẻ/pack, tiến độ lưu                              | P13   |
| Arena (PvP ladder)                 | PvP xếp hạng theo rating + mùa + bảng xếp hạng; **khác** Room private                                 | P14   |
| Live-ops                           | Điểm danh hằng ngày, nhiệm vụ ngày, sự kiện đua top/bảng xếp hạng theo mùa                            | P15   |

Nguyên tắc kiến trúc giữ nguyên: server là nguồn sự thật (đặc biệt với tiền/vật phẩm — không optimistic), client không gửi giá/số
lượng/kết quả roll, engine duel thuần và tách khỏi UI, TypeScript strict, không dùng asset/tên bài Konami. Mọi con số kinh tế
(giá, tỉ lệ gacha, thưởng) là `[DECISION]` do chủ dự án chốt — AI không tự đặt.
