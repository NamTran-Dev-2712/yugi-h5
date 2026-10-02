# Rules Coverage — luật engine cần hỗ trợ

Độ khó S/M/L. Rủi ro = khả năng thiết kế sai phải sửa lớn. Nhãn: `[RULE]` chuẩn, `[GUESS]` cần xác nhận.

| Luật                                            | Nhãn              | Phase | Khó | Rủi ro  | Ghi chú                                                                                                                                                                                           |
| ----------------------------------------------- | ----------------- | ----- | --- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase Draw/Standby/Main1/Battle/Main2/End       | [RULE]            | P1    | S   | Thấp    | `Phase` đã có; thêm `EndPhase`                                                                                                                                                                    |
| Draw đầu lượt, deck-out thua                    | [RULE]            | P1    | S   | Thấp    | Đã có `DeckOut`                                                                                                                                                                                   |
| Lượt 1: không draw/attack                       | [RULE]            | P1    | S   | Thấp    | Qua `RulesetConfig`; xem G1                                                                                                                                                                       |
| Normal Summon 1 lần/lượt                        | [RULE]            | P1    | S   | Thấp    | `hasNormalSummonedThisTurn` đã có                                                                                                                                                                 |
| Tribute Summon/Set (5-6: 1, 7+: 2)              | [RULE]            | P1    | M   | Trung   | `PendingPrompt`; xem G2                                                                                                                                                                           |
| Set monster (face-down DEF)                     | [RULE]            | P1    | S   | Thấp    |                                                                                                                                                                                                   |
| Đổi position (1 lần/turn, không vừa summon/set) | [RULE]            | P1    | S   | Thấp    |                                                                                                                                                                                                   |
| Flip Summon                                     | [RULE]            | P1    | S   | Thấp    |                                                                                                                                                                                                   |
| Attack: ATK vs ATK/DEF, direct                  | [RULE]            | P1    | M   | Trung   | Damage calc, mỗi quái attack 1 lần/lượt                                                                                                                                                           |
| Battle damage/destroy, flip khi bị attack       | [RULE]            | P1    | M   | Trung   |                                                                                                                                                                                                   |
| Hand limit 6 ở End Phase                        | [RULE]            | P1    | S   | Thấp    |                                                                                                                                                                                                   |
| Win/lose: LP ≤ 0, deck-out, surrender           | [RULE]            | P1/P2 | S   | Thấp    |                                                                                                                                                                                                   |
| Set + activate Spell/Trap                       | [RULE]            | P3    | M   | Trung   | Trap không activate lượt vừa Set                                                                                                                                                                  |
| Chain + Spell Speed 1/2/3, LIFO                 | [RULE]            | P3    | L   | **Cao** | Cốt lõi; test property. **3.3 🟨 (engine-only)**: ChainLink, LIFO cả chain, Speed 1/2 (Speed 3 = 3.4), fuzz + golden                                                                              |
| Priority/pass, response window                  | [RULE]/[GUESS]    | P3    | L   | **Cao** | Xem G5; **3.3 🟨**: `PassPriority`, ưu tiên sang đối thủ sau mỗi link, auto-pass người không đáp trả được `[ASSUMED]`; engine không đọc `chainPrompt` (UI = 3.7, C13)                             |
| Trigger effect, optional vs mandatory           | [RULE]            | P3    | L   | **Cao** | When/if, missing timing (đơn giản hoá)                                                                                                                                                            |
| Continuous effect                               | [RULE]            | P3    | M   | Trung   | Không lên chain                                                                                                                                                                                   |
| Quick-Play Spell                                | [RULE]            | P3    | M   | Trung   | Speed 2, chỉ activate lượt mình. **3.3**: bản tối thiểu từ tay (Main1/Main2 `[ASSUMED]`), chỉ lá test; úp/ngoài lượt = 3.4                                                                        |
| Ignition/Quick effect monster                   | [RULE]            | P3/P4 | M   | Trung   |                                                                                                                                                                                                   |
| Equip Spell                                     | [RULE]            | P4    | M   | Trung   | Phụ thuộc target; rời sân khi monster đi                                                                                                                                                          |
| Field Spell                                     | [RULE]/[DECISION] | P4    | M   | Thấp    | **4.3 🟨 (engine-only)**: Field Zone 1 lá/người, Set hoặc kích hoạt từ tay, lá mới thay lá của chính mình (vào mộ), bị "phá 1 Phép/Bẫy" phá được; G20                                             |
| Kích hoạt lá Continuous Spell/Trap              | [RULE]            | P4    | M   | Thấp    | **4.3 🟨 (engine-only)**: lên chain rồi ở lại sân ngửa (đọc từ subType); Continuous Trap phải Set, chờ 1 lượt                                                                                     |
| Phép Speed 1 đã Set                             | [RULE]            | P4    | S   | Thấp    | **4.3 🟨**: Normal/Continuous/Field đã Set kích hoạt ở Main Phase lượt mình, được ngay lượt vừa Set (chỉ Quick-Play/Bẫy phải chờ)                                                                 |
| Counter Trap                                    | [RULE]            | P4    | M   | Trung   | **4.4 🟨 (engine) + 4.4b 🟨 (wire, deck demo, UI)**: Speed 3, chỉ kích hoạt để đáp trả (mắt xích hoặc cửa sổ phản ứng), không mở chuỗi; chỉ Speed 3 đáp Speed 3                                   |
| Negate (kích hoạt / tấn công / triệu hồi)       | [RULE]/[ASSUMED]  | P4    | M   | Trung   | **4.4 🟨 (engine) + 4.4b 🟨 (wire, deck demo, UI)**: `NegateActivation` (link ngay dưới; lá vào mộ kể cả Liên tục/Môi trường, cost không hoàn), `NegateAttack`, `NegateSummon` (Normal/Flip); G23 |
| Special Summon (effect)                         | [RULE]            | P4    | L   | Trung   | Từ tay/GY/Extra Deck                                                                                                                                                                              |
| Fusion Summon (Extra Deck)                      | [RULE]            | P4    | L   | Trung   | Xem G8                                                                                                                                                                                            |
| Ritual Summon                                   | OUT v1 [DECISION] | —     | —   | —       | Ngoài phạm vi v1 (G8)                                                                                                                                                                             |
| Damage Step                                     | [DECISION]        | P1/P3 | S   | Thấp    | Đơn giản hoá (G6): Quick effect chỉ trước khi tính damage; state chừa chỗ mở rộng                                                                                                                 |
| Timeout / AFK                                   | [DECISION]        | P9    | M   | Thấp    | G7: solo không timer; PvP 60s/lượt, hết giờ tự EndPhase, AFK nhiều lần thì thua                                                                                                                   |
| Surrender                                       | [DECISION]        | P1    | S   | Thấp    | G11                                                                                                                                                                                               |
| Replay/determinism                              | —                 | P1    | M   | Thấp    | Golden replay ngay từ P1                                                                                                                                                                          |

## Early Master Rule vs modern — cấu hình bằng `RulesetConfig`

Engine đọc `state.ruleset` (JSON, nằm trong state để replay tái lập). Mặc định = early Master Rule.

| Khía cạnh                    | Early Master Rule (mặc định) `[RULE]`                                      | Modern `[RULE]`           | Khoá config                                            |
| ---------------------------- | -------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------ |
| Zone                         | 5 Monster + 5 S/T + 1 Field; EX zone chưa làm P1–P4 `[DECISION]` (C1)      | Master Rule 5: có EMZ     | `extraMonsterZones` (0, chỉ lưu)                       |
| Draw lượt 1 (người đi trước) | Không draw                                                                 | Không draw                | `firstTurnDraw`                                        |
| Attack lượt 1                | Không                                                                      | Không                     | `firstTurnAttack`                                      |
| Extra Deck                   | 0–20 (mặc định 20 `[REF thấp]`), Fusion; chỉ có Fusion trong v1            | Có Synchro/Xyz/Link (OUT) | `extraDeckSize`                                        |
| Field Spell                  | `[DECISION]` 2026-10-01: mỗi người 1 lá; lá mới thay lá **của chính mình** | Mỗi người 1 lá            | `fieldSpellReplace` (`false` = ô đã có lá thì từ chối) |
| Deck size                    | 40–60, ≤3/lá                                                               | Giống                     | `deckMin/Max`, `copyLimit`                             |
| Hand limit                   | 6                                                                          | 6                         | `handLimit`                                            |
| Starting LP                  | 8000 `[DECISION]` (dựa giả thuyết, C2/C10); ghi đè từng bên ở `StartDuel`  | 8000                      | `startingLP`                                           |
| Missing-timing / SEGOC       | Đơn giản hoá, không SEGOC đầy đủ                                           | Có SEGOC                  | `segoc`                                                |
| Tribute Summon               | Chuẩn                                                                      | Chuẩn                     | —                                                      |
| Chain prompt                 | Theo `[GUESS]` Yugi H5 (mặc định: hỏi khi có bài hợp lệ)                   | —                         | `chainPrompt`                                          |
| Turn timer                   | `[GUESS]`                                                                  | —                         | `turnTimerSec`                                         |

Việc cần làm ở task 1.1: định nghĩa `RulesetConfig` (Zod trong `packages/shared`), truyền qua `StartDuel`.

## Luật chuẩn bổ sung (chủ dự án yêu cầu 2026-09-20) — test tên mô tả luật, xem `RULES-REVIEW-SHEET.md`

| Luật                                                                               | Nhãn       | Phase | Khó | Task |
| ---------------------------------------------------------------------------------- | ---------- | ----- | --- | ---- |
| Mỗi quái chỉ tấn công 1 lần/lượt                                                   | [RULE]     | P1    | S   | 1.6  |
| Direct attack chỉ khi đối thủ không có quái                                        | [RULE]     | P1    | S   | 1.6  |
| ATK vs ATK: chênh lệch trừ LP bên thua; bằng nhau cả hai bị phá, không mất LP      | [RULE]     | P1    | S   | 1.6  |
| ATK vs DEF: ATK > DEF phá quái không trừ LP; ATK < DEF bên tấn công mất chênh lệch | [RULE]     | P1    | S   | 1.6  |
| Quái úp bị tấn công thì lật rồi mới tính damage                                    | [RULE]     | P1    | M   | 1.7  |
| Quái vừa Summon/Set hoặc đã tấn công thì không đổi thế trong lượt đó               | [RULE]     | P1    | S   | 1.5  |
| Trap/Quick-Play vừa Set không kích hoạt trong lượt đó                              | [RULE]     | P3    | S   | 3.4  |
| Trap phải Set trên sân mới kích hoạt; Trap trên tay chỉ có Set (C11, đã đóng)      | [DECISION] | P3    | S   | 3.4  |
| Spell thường kích hoạt từ tay ở Main Phase của mình                                | [RULE]     | P3    | S   | 3.4  |
| Hand limit 6 ở End Phase                                                           | [RULE]     | P1    | S   | 1.8  |

## Khoá RulesetConfig bổ sung

`chainPrompt` (`ask`|`auto-pass`, G5), `turnTimerSec` (`null` solo, `60` PvP, G7), `afkLossThreshold` (G7), `allowSurrender` (G11),
`firstTurnDraw`/`firstTurnAttack` (G1, mặc định `false`), `startingLP` (8000 `[DECISION]`), `extraMonsterZones` (0 `[DECISION]`, chỉ lưu),
`allowTrapActivationFromHand` (C11 `[DECISION]`, mặc định `false`), `trapSetTurnDelay` (C11 `[RULE]`, mặc định `true`). Hai khoá đã có trong shared; hành vi engine ở task 3.4.
