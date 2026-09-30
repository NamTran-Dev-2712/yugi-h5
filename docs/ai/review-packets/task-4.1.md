### Review Packet — Task 4.1: Card batch 1 (20 quái vanilla + 10 Phép/Bẫy cơ bản)

**Đã làm gì (1-3 dòng):** Mở P4. Thêm 20 quái thường (không hiệu ứng) phủ Cấp 1–8, đủ 6 thuộc tính, 17 tộc, và 10
Phép/Bẫy có hiệu ứng, chỉ dùng loại hiệu ứng mà engine đã có (không sửa luật). Thêm deck demo `BATCH1_DEMO_DECK`. Trước
đó sửa `.gitignore` để `tools/lib/http.ts` vào được git (4 script tools trước đây gãy trên máy sạch).

| Lá                                | Hiệu ứng                                                       |
| --------------------------------- | -------------------------------------------------------------- |
| SMP-105 Gió Quét Mái Vòm (Phép)   | Phá 1 Phép/Bẫy đối thủ                                         |
| SMP-106 Cái Giá Của Lưỡi Kiếm     | Trả 1000 LP → phá 1 quái đối thủ (kể cả úp)                    |
| SMP-107 Hiệu Triệu Cứu Viện       | Chỉ khi sân mình không quái và đối thủ có quái: rút 2          |
| SMP-108 Hạ Gục Khổng Lồ           | Phá 1 quái **ngửa** Cấp 5+ của đối thủ                         |
| SMP-109 Hiến Tế Sấm Sét           | Hiến tế 1 quái của mình → 1000 sát thương                      |
| SMP-110 Trao Đổi Sinh Lực (Nhanh) | Bỏ 1 lá **quái** trên tay → 600 sát thương, rồi hồi 600        |
| SMP-204 Bẫy Thu Phí (Bẫy)         | Trả 500 LP → phá 1 Phép/Bẫy đối thủ                            |
| SMP-205 Hơi Thở Thứ Hai (Bẫy)     | Hồi 1000 rồi rút 1                                             |
| SMP-206 Pháo Sáng Chiến Trận      | Chỉ trong Battle Phase: 1000 sát thương (dùng khi bị tấn công) |
| SMP-207 Kho Dự Trữ Cuối (Bẫy)     | Chỉ khi tay ≤ 2 lá: rút 2                                      |

Quái vanilla: SMP-024…043 (bảng chỉ số ở snapshot `packages/game-engine/src/cards/sample/__snapshots__/vanilla.test.ts.snap`).

**Cách xem:**

1. `docker compose up -d`, `pnpm dev`. Đấu với AI bằng deck demo: `DECK=batch1 node --experimental-strip-types tools/play-vs-ai.ts`
   (tự chơi), hoặc gửi `"deck"` = `BATCH1_DEMO_DECK` trong `POST /duels/solo` (trang debug / Phaser dùng deck mặc định).
2. Kết quả chạy thật của AI: `task-4.1-play-vs-ai-batch1.txt` (61/61, 2 chain link thật), `task-4.1-smoke.md` (23/23),
   `task-4.1-smoke-sandbox.md` (đạt), `task-4.1-play-vs-ai-{default,effect}.txt` (71/71, 67/67).
3. Không đổi UI nên không có ảnh chụp mới.

**5 điều cần kiểm tra:**

1. Tên VI/EN và chỉ số 20 quái có hợp ý không (đều placeholder tự đặt)? Cấp 1–4 ≤ 1900 ATK, Cấp 7–8 ≥ 2300.
2. 10 hiệu ứng có đủ đa dạng cho batch 1 không, có lá nào quá mạnh/yếu (vd SMP-109 hiến tế lấy 1000, SMP-106 1000 LP phá 1 quái)?
3. SMP-108 chỉ nhắm quái **ngửa** (vì có điều kiện Cấp, lá úp không lộ Cấp) — chấp nhận?
4. SMP-206 chỉ kích hoạt được trong Battle Phase: khi đối thủ triệu hồi ở Main Phase sẽ không có cửa sổ phản ứng cho nó — đúng ý?
5. Đồng ý dời "Negate summon" (có trong kế hoạch batch 1) sang 4.4 vì cần loại hiệu ứng mới `Negate`?

**So với reference:**

- Không có `[REF]` về lá thật của Yugi H5: tên/chỉ số/hiệu ứng đều placeholder, không tên Konami.
- Luật dùng: tribute theo Cấp `[RULE]`, Bẫy phải Set và không dùng trong lượt Set (C11 `[DECISION]`/`[RULE]`), PayLP cần LP
  > số trả `[ASSUMED]` (ADR 3.2), cửa sổ phản ứng (G14).
- Lệch kế hoạch (bạn đã chốt): không làm CSV `cards:build/validate`; Negate summon dời.

**Kiểm chứng kỹ thuật:** test đỏ trước (`task-4.1-red.txt`: engine 41 fail, shared 4 fail + deck chưa có); shared 142,
engine 766 (+119), api 320, web 534; lint/typecheck/build xanh; mutation dữ liệu lá 31/31 (`task-4.1-mutants.txt`,
`tools/mutants-4.1.mjs`); fuzz leak dài 200 seed × 400 bước có lá mới: 201/201 (`task-4.1-fuzz-long.txt`; vitest thoát mã 1 vì
RPC timeout đã biết, ghi ADR). `.gitignore`: bản xuất sạch từ index chạy được cả 4 script (chỉ lỗi mạng khi không có API).
Một lần `pnpm test` toàn workspace api thoát mã 1 dù 320/320 pass (không giữ được dòng lỗi); chạy lại xanh.
Mã engine/API/web: 0 dòng đổi (chỉ thêm dữ liệu, test, tool).

**Cần bạn cung cấp:** không bắt buộc. Trả lời 5 câu trên; nếu muốn đổi tên/chỉ số lá thì ghi thẳng vào review.

**Task tiếp theo:** 4.2 — Special Summon + Flip effect + Equip Spell (Engine).
