# Task 2.11 — Smoke Duel Sandbox (HTTP thật)

Sinh bởi `tools/smoke-sandbox.ts` lúc 2026-10-01T17:14:32.789Z (API: http://localhost:3000).

| Kiểm tra                                         | Kết quả | Chi tiết                                                                                                                                    |
| ------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| tribute-summon: nạp → 201                        | ✅      | status 201                                                                                                                                  |
| tribute-summon: phase/lượt đúng scenario         | ✅      |                                                                                                                                             |
| tribute-summon: có legalActions                  | ✅      | 46 action                                                                                                                                   |
| tribute-summon: tay đối thủ ẩn                   | ✅      |                                                                                                                                             |
| tribute-summon: chơi 4 action từ legalActions    | ✅      |                                                                                                                                             |
| tribute-summon: action sai luật → 409            | ✅      | status 409                                                                                                                                  |
| attack-defense: nạp → 201                        | ✅      | status 201                                                                                                                                  |
| attack-defense: phase/lượt đúng scenario         | ✅      |                                                                                                                                             |
| attack-defense: có legalActions                  | ✅      | 8 action                                                                                                                                    |
| attack-defense: tay đối thủ ẩn                   | ✅      |                                                                                                                                             |
| attack-defense: chơi 4 action từ legalActions    | ✅      |                                                                                                                                             |
| attack-defense: action sai luật → 409            | ✅      | status 409                                                                                                                                  |
| chain-basic: nạp → 201                           | ✅      | status 201                                                                                                                                  |
| chain-basic: phase/lượt đúng scenario            | ✅      |                                                                                                                                             |
| chain-basic: có legalActions                     | ✅      | 24 action                                                                                                                                   |
| chain-basic: tay đối thủ ẩn                      | ✅      |                                                                                                                                             |
| chain-basic: chơi 4 action từ legalActions       | ✅      |                                                                                                                                             |
| chain-basic: action sai luật → 409               | ✅      | status 409                                                                                                                                  |
| field-real: nạp → 201                            | ✅      | status 201                                                                                                                                  |
| field-real: phase/lượt đúng scenario             | ✅      |                                                                                                                                             |
| field-real: có legalActions                      | ✅      | 14 action                                                                                                                                   |
| field-real: tay đối thủ ẩn                       | ✅      |                                                                                                                                             |
| field-real: chơi 4 action từ legalActions        | ✅      |                                                                                                                                             |
| field-real: action sai luật → 409                | ✅      | status 409                                                                                                                                  |
| field-set-real: nạp → 201                        | ✅      | status 201                                                                                                                                  |
| field-set-real: phase/lượt đúng scenario         | ✅      |                                                                                                                                             |
| field-set-real: có legalActions                  | ✅      | 12 action                                                                                                                                   |
| field-set-real: tay đối thủ ẩn                   | ✅      |                                                                                                                                             |
| field-set-real: chơi 4 action từ legalActions    | ✅      |                                                                                                                                             |
| field-set-real: action sai luật → 409            | ✅      | status 409                                                                                                                                  |
| continuous-real-2: nạp → 201                     | ✅      | status 201                                                                                                                                  |
| continuous-real-2: phase/lượt đúng scenario      | ✅      |                                                                                                                                             |
| continuous-real-2: có legalActions               | ✅      | 15 action                                                                                                                                   |
| continuous-real-2: tay đối thủ ẩn                | ✅      |                                                                                                                                             |
| continuous-real-2: chơi 4 action từ legalActions | ✅      |                                                                                                                                             |
| continuous-real-2: action sai luật → 409         | ✅      | status 409                                                                                                                                  |
| normal-set-real: nạp → 201                       | ✅      | status 201                                                                                                                                  |
| normal-set-real: phase/lượt đúng scenario        | ✅      |                                                                                                                                             |
| normal-set-real: có legalActions                 | ✅      | 17 action                                                                                                                                   |
| normal-set-real: tay đối thủ ẩn                  | ✅      |                                                                                                                                             |
| normal-set-real: chơi 4 action từ legalActions   | ✅      |                                                                                                                                             |
| normal-set-real: action sai luật → 409           | ✅      | status 409                                                                                                                                  |
| không token → 401                                | ✅      | status 401                                                                                                                                  |
| id lá lạ → 400 INVALID_SCENARIO                  | ✅      | {"statusCode":400,"code":"INVALID_SCENARIO","message":"player 0 hand: unknown card \"NOPE-1\""}                                             |
| scenario méo → 400 VALIDATION_FAILED             | ✅      | status 400                                                                                                                                  |
| script bị engine từ chối → 409                   | ✅      | {"statusCode":409,"code":"ACTION_REJECTED","message":"Script step 1 (EndPhase) was refused: EndPhase rejected: only the turn player may end |

Tất cả kiểm tra đạt.
