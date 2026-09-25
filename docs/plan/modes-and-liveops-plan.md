# Modes & Live-ops Plan — Adventure, Arena, Live-ops (P13–P15)

Mức khái niệm/luồng chính, **chưa breakdown task số** (chờ chủ dự án duyệt hướng). Nguyên tắc nền: server là nguồn sự thật, không optimistic
(đặc biệt thưởng/tiến độ/rating), engine thuần tách UI, TS strict, không asset Konami. Phần thưởng đi qua Economy service (`economy-plan.md`).
Số liệu = `[DECISION]` chờ chủ dự án; mơ hồ = `[CẦN HỎI CHỦ DỰ ÁN]`. Không có `[REF]` cho các hệ thống này.

## Phân biệt các mode PvP/PvE (không gộp)

| Mode                   | Phase   | Đối thủ              | Rating | Ghi chú                                    |
| ---------------------- | ------- | -------------------- | ------ | ------------------------------------------ |
| Solo vs AI (hiện có)   | P2/P8   | AI                   | Không  | Luyện tập                                  |
| PvE nhẹ (bản tối giản) | P9.5    | AI theo chuỗi        | Không  | Chỉ chuỗi đối thủ + deck định sẵn          |
| **Adventure/Campaign** | **P13** | AI theo ải           | Không  | Mở rộng P9.5: bản đồ, sao, thưởng, tiến độ |
| **Room private**       | P9.1    | Bạn bè (mã phòng)    | Không  | **Giữ nguyên**, không phải Arena           |
| **Arena (ladder)**     | **P14** | Người chơi công khai | Có     | Ranking, mùa, bảng xếp hạng                |

## Adventure / Campaign (P13)

- Cấu trúc: chương → ải; mỗi ải = đối thủ AI (độ khó P8) + deck định sẵn + điều kiện thắng (có thể thêm điều kiện sao). Mở khóa tuần tự. Số chương/ải, boss, ải ẩn: `[CẦN HỎI CHỦ DỰ ÁN]`.
- Tiến độ (ải đã qua, sao, đã nhận thưởng lần đầu) lưu DB theo user; định nghĩa map/ải ở `packages/shared` (data-driven, thêm ải = thêm data).
- Thưởng: lần đầu vs lặp lại; gold / thẻ / pack — số lượng `[DECISION]`; cấp qua Economy sau khi **server** xác nhận thắng duel (client không báo kết quả).
- Deck người chơi vs deck cố định (ải "mượn deck"?), stamina/năng lượng: `[CẦN HỎI CHỦ DỰ ÁN]`.
- Liên hệ P9.5: 9.5 giữ nguyên là bản tối giản trước (không thưởng/không tiến độ phức tạp); P13 thay thế/mở rộng nó, dùng lại phần "dựng duel với deck định sẵn".

## Arena — PvP ladder (P14)

- Matchmaking theo rating (tìm đối thủ gần rating, nới dần theo thời gian chờ), tạo duel qua cùng hạ tầng Realtime của P9 (reconnect, version sync, AFK/timeout).
- Rating/rank: hệ thống (Elo/MMR, bậc rank…) `[CẦN HỎI CHỦ DỰ ÁN]`. Kết quả trận do server chốt; surrender/AFK tính thua.
- Mùa (Season): độ dài, reset một phần rating, thưởng cuối mùa qua Economy. `[DECISION]`.
- **Leaderboard/Season service**: dùng chung với Live-ops (đua top). Có thể cần lưu trữ/cache riêng (sorted set — Redis đã có trong docker-compose nhưng chưa dùng) và job đóng mùa; quyết định hạ tầng khi breakdown, **không thêm dependency lớn khi chưa hỏi**.
- **Rủi ro lớn:** dự án ghi "dùng cá nhân, không phát hành công khai" → số người chơi thực tế rất ít, matchmaking công khai có thể không có ai. Cần chủ dự án chốt quy mô deploy/số người dùng, và có cần bot fallback không: `[CẦN HỎI CHỦ DỰ ÁN]`.
- Chống cheat: validate toàn bộ ở server (đã có), không tin client về kết quả; chống chủ động rút/farm điểm với tài khoản phụ.

## Live-ops (P15)

| Mảng                     | Mô tả                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Điểm danh hằng ngày      | Streak theo ngày (giờ reset/múi giờ theo server: `[CẦN HỎI]`); thưởng theo ngày trong chu kỳ (`[DECISION]`); đứt streak thì sao: `[CẦN HỎI]`.           |
| Nhiệm vụ ngày            | Danh sách nhiệm vụ data-driven (vd "thắng N trận", "mở 1 pack", "qua 1 ải"); tiến độ cập nhật từ **event server** của các mode; nhận thưởng idempotent. |
| Sự kiện đua top theo mùa | Metric (điểm/thắng/…) `[CẦN HỎI]`; bảng xếp hạng dùng Leaderboard service (P14); thưởng cuối sự kiện theo hạng.                                         |
| Tiền/vật phẩm sự kiện    | Currency riêng theo sự kiện (Economy) + tab đổi ở Shop (P12); hết hạn/quy đổi: `[CẦN HỎI]`.                                                             |
| Lịch sự kiện             | Config data có `start/end` ở `packages/shared`; **không có admin panel** → sửa lịch = sửa data + deploy: `[CẦN HỎI CHỦ DỰ ÁN]` nếu cần công cụ.         |

Thời gian dùng đồng hồ **server** (không tin client). Lưu ý: cấm `Date.now()` chỉ áp dụng trong `packages/game-engine`; Live-ops nằm ở `apps/api`.

## Rủi ro chung

| Rủi ro                                    | Giảm                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------ |
| Quá ít người chơi cho Arena/đua top       | Chốt quy mô ở phase P14; bot fallback hoặc chỉ giữ Room private nếu không cần ladder |
| Farm thưởng (AI, tài khoản phụ)           | Trần thưởng, giảm dần, kiểm ở server; log để audit                                   |
| Khối lượng nội dung/art (ải, map, banner) | Placeholder + `human-tasks.md`; data-driven, thêm nội dung không sửa code            |
| Quest phụ thuộc mọi mode → coupling       | Quest chỉ đọc event/kết quả đã có; không sửa logic mode                              |
