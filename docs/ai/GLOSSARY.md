# Glossary

- **CardDefinition** — dữ liệu tĩnh, author-time của 1 lá bài (tên, stat, effect text,
  `scriptId`). Sống ở `packages/shared`. Bất biến, không có state.
- **CardInstance** — bản runtime của 1 CardDefinition khi vào ván đấu (instanceId, vị trí,
  position, owner). Sống trong `GameState` (`packages/game-engine`). Nhiều CardInstance có
  thể cùng trỏ tới 1 CardDefinition (vd 3 bản sao trong deck).
- **Zone** — 1 ô trên bàn đấu: Monster Zone (5), Spell/Trap Zone (5), Field Zone (1, chưa
  dùng tới cho đến khi có Field Spell), Hand, Deck, Graveyard, Banished, Extra Deck.
- **Tribute** — hi sinh 1 (level 5-6) hoặc 2 (level 7+) monster đang có trên sân để Normal
  Summon/Set 1 monster level cao hơn.
- **Position** — trạng thái 1 monster trên sân: Attack, DefenseUp (ngửa, thủ), DefenseDown
  (úp, thủ — "Set").
- **Phase** — giai đoạn trong 1 lượt: Draw → Standby → Main1 → Battle → Main2 → End.
- **Spell Speed** — tốc độ 1 effect: 1 (Normal Spell/Trap thường, chỉ activate khi không có
  gì trên chain), 2 (Quick-Play Spell, Trap, most Trigger/Ignition effect — activate được để
  đáp trả Spell Speed 1/2), 3 (Counter Trap — activate được để đáp trả bất kỳ spell speed nào).
- **Chain** (Chain Stack) — khi nhiều effect được activate để đáp trả nhau, chúng xếp vào 1
  stack và resolve theo thứ tự LIFO (activate sau cùng, resolve trước).
- **Trigger effect** — effect tự kích hoạt khi 1 điều kiện xảy ra (vd "khi lá này được
  Summon..."), phải activate qua chain (không resolve ngay lập tức).
- **Continuous effect** — effect có hiệu lực liên tục miễn lá bài còn trên sân, không lên
  chain, không "activate".
- **Ignition effect** — effect người chơi chủ động kích hoạt trong Main Phase khi có priority
  (thường có cost), lên chain như Spell Speed 2.
- **Quick effect** — effect activate được ở bất kỳ thời điểm nào người chơi có priority, kể
  cả ngoài lượt của mình (Spell Speed 2 trở lên).
- **PendingPrompt** — cơ chế engine dùng để "hỏi" người chơi một quyết định (chọn target,
  chọn tribute, chọn có activate effect đáp trả hay không...) mà không block hàm
  `applyAction`. Engine trả state có `pendingPrompt != null`; client phải gửi action tương
  ứng khớp `promptId` trước khi các action khác được chấp nhận.
- **GameEvent** — 1 sự kiện xảy ra sau khi `applyAction` chạy xong (vd `CardDrawn`,
  `CardSummoned`, `DamageDealt`). FE dùng chuỗi event này để chạy animation — không tự suy
  luận logic.
- **Action** — 1 lệnh người chơi (hoặc AI) gửi vào engine (vd `NormalSummon`,
  `DeclareAttack`, `PassPriority`). Input duy nhất của `applyAction`.
- **DuelMatch** — bản ghi 1 ván đấu trong DB: seed + action log đầy đủ, đủ để replay lại
  toàn bộ ván đấu qua engine (không lưu state snapshot).
- **StateView** — bản rút gọn của `GameState` gửi cho 1 client cụ thể, đã ẩn thông tin
  không được thấy (bài trên tay đối thủ, bài úp...). Khác với `GameState` đầy đủ chỉ tồn
  tại ở server.
