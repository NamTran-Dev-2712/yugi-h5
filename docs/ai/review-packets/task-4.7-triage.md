# Task 4.7 — Phase 0: kết quả (2026-10-08)

**Hỏi chủ dự án: 5 câu (2 hộp thoại) · Mặc định tự dùng: 0 · Ô duyệt trống của sheet: vẫn 1 (G26 f) · Công cụ sửa: 1
(`tools/play-vs-ai.ts`) · Code game sửa ở Phase 0: 0 dòng.**

## 0a. Hướng thiết kế — câu đã hỏi và đáp án

Mọi câu đều có người trả lời (không phải dùng mặc định "(Khuyến nghị)" thay người).

| #   | Câu hỏi (rút gọn)                                                                                                   | Đáp án                              | Hệ quả                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | Lô bài thứ 2 có bao nhiêu lá?                                                                                       | **24 lá** (khuyến nghị)             | 12 quái hiệu ứng + 8 Phép + 4 Bẫy                                                                   |
| 2   | Mức mạnh?                                                                                                           | **Cổ điển, nhẹ** (khuyến nghị)      | Không quái nào của lô trên 2500 ATK; quái Cấp ≤ 4 không quá 1900 (có test)                          |
| 3   | Thêm 2 quái Dung hợp mới (nguyên liệu là quái của lô)?                                                              | **Có, chỉ 2 lá** (khuyến nghị)      | SMP-060, SMP-061 ⇒ tổng 26 lá; `BATCH2_FUSION_EXTRA_DECK` riêng, `FUSION_DEMO_EXTRA_DECK` không đổi |
| 4   | Luật "quái vừa triệu hồi không tấn công ngay lượt đó" (G22)?                                                        | **Giữ nguyên**                      | Không sinh mục `OPEN-ISSUES.md`, không đề xuất task cấu hình                                        |
| 5   | Brief đòi 2 quái "tự bấm kích hoạt trên sân" (trả LP / bỏ bài) — game chưa cho quái trên sân tự kích hoạt. Làm sao? | **Thay bằng lá khác** (khuyến nghị) | Vẫn 12 quái; không sửa lõi; "quái tự kích hoạt" vào danh sách còn thiếu, đề xuất cho task 4.8       |

**Câu 5 là câu phát sinh** (không có trong brief): khi đọc code trước lúc lập kế hoạch tôi thấy

- `ActivateEffect` từ chối mọi quái (`NOT_A_SPELL_TRAP`), không tìm lá ở ô quái, và danh sách "có thể kích hoạt gì" bỏ qua
  quái ⇒ effect `Ignition` / `Quick` đặt trên quái **không bao giờ chạy**;
- hiệu ứng tự nổ của quái (`OnSummon` / `OnFlip` / `OnDestroyed`) chỉ được trả bằng LP (schema chặn `Discard` / `Tribute`
  vì chưa có bước hỏi "bỏ lá nào").

Nên mục "Ignition ≥ 2 quái, một lá tốn `PayLP`, một lá tốn `Discard`" của brief **không làm được bằng dữ liệu**. Đã thay
bằng: 2 quái có hiệu ứng tự nổ trả LP (SMP-049 trả 800, SMP-056 trả 500); `Discard` dùng ở Phép / Bẫy (SMP-117, SMP-211,
SMP-214).

## 0b. Triage `RULES-REVIEW-SHEET.md`

- Trước task: 1 ô duyệt trống (G26 f — nguyên liệu Dung hợp từ Bộ bài, "giữ tạm, chờ tư liệu"). **Giữ nguyên**, không hỏi lại.
- Dòng mới do task 4.7 thêm: xem mục E ở cuối file này (điền ở cuối task, cùng quy trình A / B / C của ADR 064).

## 0c. `play-vs-ai` deck negate chập chờn

Lệnh: `DECK=negate node --experimental-strip-types tools/play-vs-ai.ts`, API thật + Postgres (tôi tự bật Docker Desktop;
API chạy bằng `node dist/main.js`, đã tắt sau khi xong).

| Bản                                                                 | Kết quả 5 lần                                                          |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| HEAD trước khi sửa công cụ (`b550a41` + dữ liệu lá 4.7 chưa commit) | **1 / 5 đạt** — 4 lần thiếu đúng 2 kiểm tra độ phủ (`humanWindows: 0`) |
| Commit trước task 4.5 (`7acddab`, `git worktree`, API cổng 3100)    | **0 / 5 đạt** — cả 5 lần thiếu đúng 2 kiểm tra đó                      |
| HEAD sau khi sửa công cụ                                            | **5 / 5 đạt**, mỗi lần chỉ cần 1 ván (73–109 kiểm tra / lần)           |

**Kết luận:** lỗi **có từ trước task 4.5**, không phải do Fusion hay do lô bài này. Không lần nào rò thông tin, không lần
nào máy tự Set / kích hoạt Phép-Bẫy — chỉ hai kiểm tra "đã gặp cửa sổ phản ứng" và "đã có một lần vô hiệu" bị thiếu.

**Nguyên nhân (đọc `ai/choose-action.ts`):** máy chỉ Triệu hồi Thường khi quái của nó mạnh hơn quái mạnh nhất của người;
không thì nó **Úp** quái (Úp không phải triệu hồi ⇒ không mở cửa sổ cho "Cổng Khước Từ") và không tấn công (⇒ không mở
cửa sổ cho "Rào Chắn Hộ Vệ"). Người chơi trong công cụ lại ra quái + "Quân Kỳ Tập Hợp" (+300 ATK) ngay, nên máy co về thủ
suốt ván ⇒ không cửa sổ nào mở. Đây là hành vi đúng của AI hiện tại, không phải lỗi game.

**Đã sửa — chỉ `tools/play-vs-ai.ts`** (không sửa code game, không nới kiểm tra rò):

1. Ở `DECK=negate`, người chơi của công cụ **giữ quái trên tay và không tấn công cho tới khi thấy một lần vô hiệu** — máy
   khi đó triệu hồi và tấn công trực tiếp, lá vô hiệu đã Úp có cửa sổ.
2. Chơi tối đa `NEGATE_DUELS` ván (mặc định 6) tới khi có cả cửa sổ lẫn một lần vô hiệu; hai kiểm tra độ phủ tính trên
   **tổng** các ván. Mọi kiểm tra khác (rò, máy không tự Set / kích hoạt, `AttackNegated` không mang `definitionId`…) vẫn
   chạy ở **từng** ván.

## C. Còn chờ chủ dự án (không đổi so với trước task)

1. G26 (f) — nguyên liệu từ Bộ bài: cần video bản gốc có nhãn "Bộ bài" (`docs/plan/human-tasks.md`).
2. Mở rộng `CLAUDE.md` #5 cho P10+ (ADR 043) — để tới P10.
