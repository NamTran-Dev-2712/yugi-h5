# Testing Strategy

Vitest toàn workspace. Engine test-first (CLAUDE.md). Mỗi task kết thúc bằng lint + typecheck + test của package liên quan.

| Tầng                 | Nội dung                                                                                                                                                                                                       | Phase |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Unit rule tests      | Mỗi tình huống luật: hợp lệ + không hợp lệ (vd tribute sai số lượng, attack ở phase sai, Set trap rồi activate ngay)                                                                                           | P1+   |
| Golden replay        | Fixture `{seed, rulesetConfig, deckLists, actionLog, expectedFinalState, expectedEvents}` JSON; test chạy lại và so sánh; đổi rule cố ý → cập nhật golden có review                                            | P1+   |
| Property/fuzz        | Sinh action hợp lệ ngẫu nhiên có seed, chạy N ván: không throw; bất biến: tổng số card không đổi, LP ≥ 0 khi chưa thua, không card ở 2 zone, zone ≤ giới hạn, `version` tăng đơn điệu, replay cho cùng kết quả | P1+   |
| Card tests           | Auto cho Tier A; file test riêng Tier B/C (xem `card-and-effect-plan.md`); `cards:validate`                                                                                                                    | P3+   |
| StateView/anti-cheat | Không lộ hand/deck/face-down của đối thủ trong view và events                                                                                                                                                  | P2    |
| API integration      | Vitest + DB test: tạo duel → draw → summon → attack → end; auth; deck CRUD                                                                                                                                     | P2/P7 |
| Realtime             | 2 client giả lập: đồng bộ version, reconnect, resync                                                                                                                                                           | P9    |
| AI vs AI             | 100 ván seed cố định không crash/kẹt prompt                                                                                                                                                                    | P8    |
| FE unit              | Store, i18n, queue logic (không phụ thuộc Phaser canvas)                                                                                                                                                       | P2+   |
| Asset validate       | `assets:validate` chạy trong CI (nếu asset pack có mặt)                                                                                                                                                        | P5    |

## Quy ước

- Test đặt cạnh source `*.test.ts`. Golden fixtures: `packages/game-engine/test/golden/*.json`.
- Không test bằng `Math.random`/thời gian thật; dùng seed.
- Bug sửa xong phải có test tái hiện.

## Checklist QA thủ công (cho bạn) — dùng trong Review Packet

Chạy sau mỗi phase có UI. Đánh dấu ✅/❌ + ghi chú.

| #   | Kiểm tra                                                                         |
| --- | -------------------------------------------------------------------------------- |
| 1   | Kéo bài từ tay xuống zone: có highlight zone hợp lệ? thả sai có snap về? có lag? |
| 2   | Summon quái level 5+: prompt tribute rõ ràng? huỷ được?                          |
| 3   | Attack: chọn attacker/target dễ? kết quả damage khớp kỳ vọng?                    |
| 4   | Số click/thao tác cho Summon, Attack, End Turn so với reference (ghi số)         |
| 5   | Timing animation: quá nhanh/chậm? skip hoạt động? (ghi tên animation + cảm nhận) |
| 6   | So layout với screenshot `[REF]`: lệch ở đâu?                                    |
| 7   | Touch (nếu có thiết bị): kéo thả mượt? hit-area đủ lớn?                          |
| 8   | Reload giữa ván: khôi phục đúng trạng thái?                                      |
| 9   | Đổi ngôn ngữ VI/EN: chữ không tràn/mất dấu?                                      |
| 10  | Log panel khớp những gì xảy ra?                                                  |
