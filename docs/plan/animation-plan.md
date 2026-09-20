# Animation & Audio Plan

Nguyên tắc (CLAUDE.md #4): animation suy ra từ `GameEvent[]`; FE không suy luận logic. Mọi thời lượng bên dưới là `[GUESS]`
cho tới khi có video `[REF]` — chỉnh được qua file config, không hardcode rải rác.

## (a) Kiến trúc EventAnimationQueue

| Thành phần            | Vai trò                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| `EventAnimationQueue` | Nhận `GameEvent[]` từ server, xếp hàng; phát tuần tự, cho phép nhóm song song (vd damage + LP bar)       |
| `Animator<E>`         | Registry: `GameEvent.type` → hàm trả `Promise` (Phaser tween/timeline). Thiếu animator → no-op + log     |
| `ViewApplier`         | Sau mỗi animator, cập nhật view state (zone/LP) — **state view lấy từ server**, animation chỉ che độ trễ |
| Skip / speed          | Nút Skip (kết thúc nhanh mọi anim trong queue), hệ số tốc độ 1×/2×/instant (Settings)                    |
| Không block logic     | Queue chỉ ảnh hưởng hiển thị. Input mới bị chặn có chủ đích khi có prompt của server, không vì animation |
| Reconnect/replay      | Nhận `StateView` full + bỏ qua animation cũ (fast-forward: apply instant, không animate)                 |
| Version guard         | Event có `version`; lệch → yêu cầu re-sync, xả queue                                                     |

Sự kiện đến khi queue đang chạy: nối đuôi. Animator lỗi → log + apply state instant, không treo queue (timeout mỗi animator).

## (b) Catalog theo GameEvent

Tier 1 = tween/flash/shake bằng code; Tier 2 = particle/spritesheet; Tier 3 = cinematic (Spine/video).
Độ khó: S/M/L. Thời lượng `[GUESS]`.

| Event                        | Animation                                   | Tier | Khó | Thời lượng đề xuất |
| ---------------------------- | ------------------------------------------- | ---- | --- | ------------------ |
| `DuelStarted`                | Deck xuất hiện, chia 5 lá                   | 1    | M   | ~1.5s              |
| `CardDrawn`                  | Bay từ deck → hand, lật nếu là mình         | 1    | S   | ~0.4s              |
| `CardSummoned` (Normal)      | Lá từ hand → zone, scale-in + flash nhẹ     | 1    | M   | ~0.6s              |
| Tribute                      | Tribute mờ dần/tan → summon                 | 1→2  | M   | ~0.6s              |
| `CardSet`                    | Bay úp xuống zone                           | 1    | S   | ~0.4s              |
| Flip / `PositionChanged`     | Xoay/lật 90°                                | 1    | S   | ~0.4s              |
| `AttackDeclared`             | Quái lao tới target, trở về                 | 1    | M   | ~0.7s              |
| `DamageDealt`                | Flash + shake + số damage nổi               | 1→2  | M   | ~0.6s              |
| `MonsterDestroyed`           | Dissolve/vỡ + bay về GY                     | 1→2  | M   | ~0.7s              |
| To graveyard / banish        | Trượt về pile, fade                         | 1    | S   | ~0.4s              |
| Activate Spell/Trap          | Lật lá + glow + hiện card lớn giữa màn hình | 1→2  | M   | ~0.8s              |
| `ChainLinkAdded`             | Số chain badge, xếp chồng                   | 1    | M   | ~0.4s/link         |
| `ChainResolved`              | Resolve ngược từng link, highlight          | 1    | M   | ~0.5s/link         |
| LP change                    | Bar chạy + số đếm                           | 1    | S   | ~0.6s              |
| `PhaseChanged`/`TurnChanged` | Banner "Battle Phase" trượt qua             | 1    | S   | ~0.5s              |
| `DuelEnded`                  | WIN/LOSE banner + overlay                   | 1→2  | M   | ~1.5s              |
| Monster mạnh / Fusion/Ritual | Summon đặc biệt (cinematic)                 | 3    | L   | tuỳ; làm sau P9    |

Mức đầu tư: hoàn tất Tier 1 hết ở P6; Tier 2 chọn lọc ở P9; Tier 3 chỉ khi bạn yêu cầu.

## (c) Công nghệ

| Lựa chọn          | Đề xuất                                                                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| Tween/timeline    | **Phaser tween + timeline** (đủ dùng, không thêm dependency)                                                          |
| Particle          | Phaser particle emitter                                                                                               |
| Spritesheet/atlas | Phaser atlas (từ pipeline `assets/vfx/`)                                                                              |
| Shader/post-FX    | Phaser pipeline (WebGL) cho glow/dissolve — chỉ sau P6, có fallback canvas                                            |
| Spine             | **Không dùng mặc định** (dependency lớn + cần asset skeletal); cân nhắc Tier 3 nếu bạn có asset — cần bạn duyệt riêng |

## (d) Thư viện VFX tái sử dụng (code trước, asset sau)

`flash`, `shake`, `slash`, `glow`, `dissolve`, `burst`, `floatingNumber`, `pulse`, `trail`, `bannerSlide`. Mỗi VFX = hàm
`(scene, target, opts) => Promise<void>` + tham số (màu, thời lượng), dùng trong Animation Preview.

## (e) Âm thanh

| Mục             | Đề xuất                                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Audio manager   | Wrapper Phaser sound: `playSfx(key)`, `playBgm(key)`, volume master/sfx/bgm, mute; fail-soft khi thiếu file                                                                                |
| Quy ước tên     | `sfx-<event>.ogg` (vd `sfx-card-draw`, `sfx-summon`, `sfx-attack`, `sfx-damage`, `sfx-destroy`, `sfx-activate`, `sfx-chain`, `sfx-phase`, `sfx-win`, `sfx-lose`, `sfx-click`, `sfx-error`) |
| BGM             | `bgm-menu`, `bgm-duel`, `bgm-result`                                                                                                                                                       |
| Mapping         | File `audio-map.ts`: `GameEvent.type` → sfx key (data, chỉnh dễ)                                                                                                                           |
| Ngân sách       | ~20 SFX + 2–3 BGM; validate thiếu theo danh sách event                                                                                                                                     |
| Autoplay policy | Bắt đầu audio sau tương tác đầu tiên (màn Menu)                                                                                                                                            |

## (f) Ngân sách hiệu năng

| Chỉ số    | Mục tiêu                                                 |
| --------- | -------------------------------------------------------- |
| FPS       | ≥ 55 trên máy bạn; ≥ 30 trên mobile tầm trung            |
| Bundle JS | ≤ ~1.5 MB gzip ban đầu (Phaser đã lớn; lazy-load scene)  |
| Texture   | Mỗi atlas ≤ 2048×2048; thumbnail 128px; tổng VRAM hợp lý |
| Draw call | Gom atlas; tránh > 200 game object đồng thời             |
| Load      | Lazy theo deck; preload SFX chính                        |

Đo bằng bảng FPS/objects trong dev overlay (task 6.5); ghi kết quả vào Review Packet.

## (g) Animation Preview (công cụ duyệt)

Trang dev `/dev/anim`: chọn 1 GameEvent hoặc 1 VFX → phát lại; chỉnh tốc độ, tham số, lặp; so cạnh video `[REF]` nếu có; nút "đánh dấu đã duyệt"
(ghi vào `parity-board.md`). Làm ở task 6.5.
