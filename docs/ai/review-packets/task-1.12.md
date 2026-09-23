### Review Packet — Task 1.12: Golden replay + Fuzz harness (test tooling, không có luật mới)

**Đã làm gì:** (1) 5 kịch bản golden replay chạy qua engine thật và so với baseline JSON đã commit (`src/__golden__/`);
(2) fuzz harness có seed: sinh action theo phase/state (≈85% hợp lệ có chủ đích + ≈15% rác), kiểm invariant sau MỖI action.
Không sửa logic action nào.

**Cách xem:** `pnpm --filter @yugi/game-engine test` → 362 test xanh (337 cũ + 25 mới, không sửa test cũ); `lint`/`typecheck` xanh.
Chạy dài: `FUZZ_SEEDS=1000 FUZZ_STEPS=1000 pnpm --filter @yugi/game-engine test fuzz` (1009 test xanh).

**Golden case (5):** `direct-attack-lp-zero` (Summon → direct attack → `DuelEnded LP_ZERO` → reject `DUEL_ENDED`); `tribute-position-flip-attack`
(Tribute Summon, attack vừa Summon bị reject, Flip-on-Attack, ChangePosition sau attack bị reject); `surrender-mid-duel`;
`deck-out`; `hand-limit-discard` (prompt → sai promptId reject → `ResolvePendingPrompt`). Mỗi file lưu events từng bước + mã lỗi
khi reject + final state; một hàm `replay` và một assertion dùng chung.

**Invariant fuzz kiểm tra:** version +1 mỗi action được nhận; LP số nguyên ≥ 0; LP = 0 ⇒ duel đã kết thúc; bảo toàn lá bài
(tập instanceId mọi zone không đổi: không mất/nhân bản); mọi lá nằm đúng zone của chủ (`ownerIndex`); quái trên sân có position,
lá ngoài sân không có; board luôn 5+5 ô; `turnCount` không giảm; `winnerIndex` không đổi sau khi duel kết thúc; action sau khi duel
kết thúc luôn bị reject; state là JSON thuần (không undefined trong mảng, NaN, class...); chỉ `EngineError` được throw (throw khác = lỗi);
state đầu vào bị deep-freeze nên handler mutate sẽ nổ. Test "không rỗng": 3 engine bị phá có chủ đích (mất lá, nhân lá, LP âm, version sai,
throw lạ, mutate input) đều bị harness bắt.

**Kết quả fuzz:** 10 seed × 300 (suite thường) và 1000 seed × 1000 action: 0 vi phạm, **không phát hiện bug ở 1.1–1.11**. Độ phủ 10 seed
mặc định ≈ 42 duel, 32 kết thúc; ~1600 action nhận (EndPhase/Draw/Summon/Set/Attack/ChangePosition/Surrender/ResolvePendingPrompt).

**Lưu ý / hạn chế:** fuzz chưa sinh Spell/Trap/effect (chưa có) — bổ sung khi P3 có. Golden phụ thuộc thứ tự shuffle seeded (id `p0-39`...):
đổi thuật toán shuffle sẽ làm golden đỏ (chủ đích). `deck-out` case dùng deck 5 lá (dưới mức deck hợp lệ 40, chỉ để test engine).

**Task tiếp theo:** review P1 (hết task luật), rồi P2.
