# UI Plan

Phaser 3 + Vite. Landscape **1280×720** (Scale FIT, letterbox), chuột + touch. Client chỉ gửi Action intent, vẽ theo `GameEvent`
(CLAUDE.md #2, #4). Mọi layout `[GUESS]` cho tới khi có screenshot `[REF]`.

## Danh sách màn hình

| Màn hình     | Phase | Ghi chú                                          | Cần [REF] |
| ------------ | ----- | ------------------------------------------------ | --------- |
| Boot         | P0 ✅ | Load asset, kiểm tra API                         | —         |
| Login/Guest  | P7    | Chơi ngay (guest) / đăng nhập / nâng cấp         | Có        |
| Menu         | P2/P7 | Solo vs AI, Deck, PvP (P9), Settings             | Có        |
| Duel         | P2    | Màn chính                                        | **Có**    |
| Deck Builder | P7    | List, lọc, thêm/bớt, validate                    | Có        |
| Collection   | P7    | Xem card sở hữu (có thể gộp Deck Builder)        | Có        |
| Match Result | P7    | Thắng/thua, LP, tóm tắt                          | Có        |
| Settings     | P9    | Ngôn ngữ, âm lượng, tốc độ animation, auto-chain | —         |
| Dev pages    | P2–P6 | Gallery, Sandbox, Anim Preview, Replay           | —         |

## Duel — wireframe (1280×720, `[GUESS]`)

```
┌───────────────────────────────────────────────────────────────────────┐
│ [Opp name]  LP ████████ 8000            [Phase: Main1 ▶ Battle ▶ End] │
│ Opp hand (úp)  ▮▮▮▮▮                                       [Log ☰]   │
│ ┌ST┐┌ST┐┌ST┐┌ST┐┌ST┐                                                │
│ ┌M ┐┌M ┐┌M ┐┌M ┐┌M ┐        [Opp Deck] [Opp GY]                     │
│ ─────────────────────── [Field] ───────────────────────────────────── │
│ ┌M ┐┌M ┐┌M ┐┌M ┐┌M ┐        [My Deck]  [My GY]   ┌Card Detail──────┐│
│ ┌ST┐┌ST┐┌ST┐┌ST┐┌ST┐                                │ art  name  ★★★★ ││
│ My hand: ▯ ▯ ▯ ▯ ▯ ▯                                 │ ATK/DEF  text   ││
│ [Me] LP ████████ 8000     [End Turn]                 └─────────────────┘│
└───────────────────────────────────────────────────────────────────────┘
```

## Inventory component

| Component                                 | State chính                                             | Phase |
| ----------------------------------------- | ------------------------------------------------------- | ----- |
| `CardSprite`                              | definitionId, faceUp, position, highlight, dragging     | P2    |
| `Hand`                                    | cards[], hover, selecting                               | P2    |
| `MonsterZone`/`SpellTrapZone`/`FieldZone` | slot occupied, validDropTarget                          | P2    |
| `PileZone` (Deck/GY/Banished)             | count, top card, open viewer                            | P2    |
| `LPBar`                                   | current, animating delta                                | P2    |
| `PhaseBar`                                | phase, enabled transitions                              | P2    |
| `PromptPanel`                             | kind (SelectTribute/Position/Target/Activate?), options | P2/P3 |
| `ChainUI`                                 | chain links[], resolving index                          | P3    |
| `CardDetailPanel`                         | card shown, effect text (i18n)                          | P2    |
| `PileViewer`                              | list cards GY/Banished/Extra                            | P4    |
| `LogPanel`                                | events[], toggle                                        | P2    |
| `AnimationOverlay`                        | queue state, skip/speed                                 | P6    |
| `Toast/Error`                             | server reject messages                                  | P2    |

## Tương tác kéo thả (`[GUESS]` — chỉnh theo reference)

| Ý định              | Thao tác                                                   | Action gửi                    | Ghi chú                                                             |
| ------------------- | ---------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------- |
| Normal Summon       | Kéo từ Hand → Monster Zone trống (thả vào zone ngửa)       | `NormalSummon`                | Level 5+: prompt chọn tribute (highlight quái mình)                 |
| Set monster         | Kéo → Monster Zone + chọn "Set" (hoặc thả vào ô úp)        | `SetMonster`                  | G3                                                                  |
| Set Spell/Trap      | Kéo → Spell/Trap Zone                                      | `SetSpellTrap`                | P3                                                                  |
| Activate Spell      | Kéo → S/T Zone (ngửa) hoặc chạm → menu "Kích hoạt"         | `ActivateEffect`              | P3                                                                  |
| Attack              | Kéo quái mình → quái đối phương / vùng đối phương (direct) | `DeclareAttack`               | Highlight target hợp lệ; G4                                         |
| Đổi position        | Chạm quái → menu (Tấn công/Thủ/Lật)                        | `ChangePosition`/`FlipSummon` | G3                                                                  |
| Xem chi tiết        | Chạm/hover                                                 | (không gửi)                   | Card Detail panel                                                   |
| Menu action         | Chạm giữ hoặc chạm 1 lần → menu hành động hợp lệ           | tuỳ                           | Chỉ hiện action hợp lệ theo server (`legalActions` trong StateView) |
| Kết thúc phase/lượt | Nút phase bar / End Turn                                   | `EndPhase`                    |                                                                     |

Quy tắc chung: kéo có "ghost" + highlight drop target hợp lệ; thả sai chỗ → snap về; chỉ tạo intent, UI đổi khi có event.
Đề xuất `legalActions` (hoặc `legalTargets`) trong `StateView` để FE không suy luận luật — **cần cập nhật protocol.md** ở task 2.1.

## Responsive / Scale

- Thiết kế 1280×720, Scale FIT + center; hỗ trợ tỉ lệ 16:9 đến 21:9 (letterbox).
- Hit-area tối thiểu 44×44 px (touch). Hand fan thu gọn khi >6 lá.
- Portrait: hiện overlay "hãy xoay ngang" (v1, không làm layout dọc).

## Accessibility tối thiểu

Không dựa vào màu đơn thuần (thêm icon/viền); cỡ chữ ≥ 14px ở 720p; giảm animation (tốc độ ×2 / tắt); phím tắt cơ bản (End Turn, Skip anim).

## i18n

`t(key)` với locale `vi`/`en` ở `apps/web/src/i18n/`. Không hardcode chuỗi trong scene. Text card lấy từ data. Font hỗ trợ tiếng Việt có dấu.

## Cần [REF] từ bạn

Screenshot: Duel (mọi trạng thái), Menu, Deck Builder, Match Result, Prompt tribute/position/target, Chain, Card Detail, GY viewer.
Chi tiết ở `docs/reference/README.md`.
