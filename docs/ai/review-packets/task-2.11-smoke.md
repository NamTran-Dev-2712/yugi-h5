# Task 2.11 — Smoke Duel Sandbox (HTTP thật)

Sinh bởi `tools/smoke-sandbox.ts` lúc 2026-09-25T05:45:59.552Z (API: http://localhost:3000).

| Kiểm tra                                      | Kết quả | Chi tiết                                                                                                                                    |
| --------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| tribute-summon: nạp → 201                     | ✅      | status 201                                                                                                                                  |
| tribute-summon: phase/lượt đúng scenario      | ✅      |                                                                                                                                             |
| tribute-summon: có legalActions               | ✅      | 46 action                                                                                                                                   |
| tribute-summon: tay đối thủ ẩn                | ✅      |                                                                                                                                             |
| tribute-summon: chơi 4 action từ legalActions | ✅      |                                                                                                                                             |
| tribute-summon: action sai luật → 409         | ✅      | status 409                                                                                                                                  |
| attack-defense: nạp → 201                     | ✅      | status 201                                                                                                                                  |
| attack-defense: phase/lượt đúng scenario      | ✅      |                                                                                                                                             |
| attack-defense: có legalActions               | ✅      | 8 action                                                                                                                                    |
| attack-defense: tay đối thủ ẩn                | ✅      |                                                                                                                                             |
| attack-defense: chơi 4 action từ legalActions | ✅      |                                                                                                                                             |
| attack-defense: action sai luật → 409         | ✅      | status 409                                                                                                                                  |
| chain-basic: nạp → 201                        | ✅      | status 201                                                                                                                                  |
| chain-basic: phase/lượt đúng scenario         | ✅      |                                                                                                                                             |
| chain-basic: có legalActions                  | ✅      | 19 action                                                                                                                                   |
| chain-basic: tay đối thủ ẩn                   | ✅      |                                                                                                                                             |
| chain-basic: chơi 4 action từ legalActions    | ✅      |                                                                                                                                             |
| chain-basic: action sai luật → 409            | ✅      | status 409                                                                                                                                  |
| không token → 401                             | ✅      | status 401                                                                                                                                  |
| id lá lạ → 400 INVALID_SCENARIO               | ✅      | {"statusCode":400,"code":"INVALID_SCENARIO","message":"player 0 hand: unknown card \"NOPE-1\""}                                             |
| scenario méo → 400 VALIDATION_FAILED          | ✅      | status 400                                                                                                                                  |
| script bị engine từ chối → 409                | ✅      | {"statusCode":409,"code":"ACTION_REJECTED","message":"Script step 1 (EndPhase) was refused: EndPhase rejected: only the turn player may end |

Tất cả kiểm tra đạt.
