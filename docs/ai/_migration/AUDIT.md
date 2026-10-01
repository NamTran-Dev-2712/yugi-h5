# Documentation Migration Audit — 2026-10-01

Gốc so sánh: commit `566d9f5`. Kiểm chứng: `node docs/ai/_migration/verify.mjs` (12 kiểm tra, tất cả PASS; đã thử phá
3 chỗ — 1 chữ trong thân ADR, 1 dòng nhật ký, 1 đường dẫn trong INDEX — script báo FAIL đúng 3 kiểm tra tương ứng).

## Files Before (tự nạp mỗi session)

| File                               | Ký tự       |
| ---------------------------------- | ----------- |
| `CLAUDE.md`                        | 7.589       |
| `docs/ai/PROGRESS.md` (`@import`)  | 44.407      |
| `docs/ai/DECISIONS.md` (`@import`) | 132.441     |
| **Tổng**                           | **184.437** |

(210.802 byte UTF-8.) Không đổi và không tính ở đây: 4 `CLAUDE.md` package (nạp khi mở file trong package), `MEMORY.md`.

## Files After

| File                                   | Tự nạp | Ký tự              | Vai trò                                              |
| -------------------------------------- | ------ | ------------------ | ---------------------------------------------------- |
| `CLAUDE.md`                            | có     | 8.361              | luật chung + 3 import + luật tra cứu                 |
| `docs/ai/PROGRESS.md`                  | có     | 6.633              | chỉ trạng thái hiện tại                              |
| `docs/ai/INDEX.md`                     | có     | 5.548              | chủ đề → contract + ADR                              |
| `docs/ai/LESSONS.md`                   | có     | 4.181              | bẫy/quy ước xuyên package, mỗi dòng trỏ ADR          |
| **Tổng tự nạp**                        |        | **24.723**         | **−86,6 %**, dưới ngưỡng 40.000                      |
| `docs/ai/DECISIONS.md`                 | không  | mục lục            | bảng 62 ADR: #, ngày, task, tiêu đề, lớp, trạng thái |
| `docs/ai/decisions/NNN-*.md` × 62      | không  | 132.441 + metadata | mỗi ADR một file, thân nguyên văn                    |
| `docs/ai/progress/{p0…p4,planning}.md` | không  | 42.965             | nhật ký task nguyên văn                              |
| `docs/ai/OPEN-ISSUES.md`               | không  | —                  | mâu thuẫn docs ↔ code chờ duyệt                      |

Tổng kiến thức trên đĩa: 184.437 → 246.437 ký tự (tăng do metadata, mục lục, INDEX, LESSONS) — không giảm.

## Information Preserved (nguyên văn, kiểm bằng máy)

- **62/62 ADR**: bỏ khối metadata rồi nối 62 file theo thứ tự = `DECISIONS.md` gốc, **giống từng byte** (kiểm tra 1b).
  Gồm cả mục con "(tiếp) — Hiệu chỉnh `DURATION_MS`" đi cùng ADR 041.
- **PROGRESS.md gốc**: mọi dòng không rỗng (trừ 5 dòng nêu ở "Rewritten") có mặt nguyên văn, đúng 1 lần (kiểm tra 2).
- **Root `CLAUDE.md`**: mọi dòng luật còn nguyên, trừ 11 dòng sửa có chủ đích (kiểm tra 3, liệt kê dưới).

## Information Moved

| Từ                                                                              | Tới                                      |
| ------------------------------------------------------------------------------- | ---------------------------------------- |
| `DECISIONS.md` — 62 mục `## <ngày> — …`                                         | `docs/ai/decisions/001…062-*.md`         |
| `PROGRESS.md` dòng 7–24 (M0), 86–87 (cổng DB, build `tsc`)                      | `docs/ai/progress/p0.md`                 |
| dòng 28–29, 35–46, 49, 83, 109 (task 1.x, ánh xạ số task P1)                    | `docs/ai/progress/p1.md`                 |
| dòng 50–61, 63 (task 2.x)                                                       | `docs/ai/progress/p2.md`                 |
| dòng 64–65, 67–75 (task 3.x)                                                    | `docs/ai/progress/p3.md`                 |
| dòng 76–81 (task 4.x + "task tiếp theo")                                        | `docs/ai/progress/p4.md`                 |
| dòng 30, 34, 48, 62, 66, 84, 85, 88 (ingest video, C11, scope, giá trị đã chốt) | `docs/ai/progress/planning.md`           |
| dòng 82 (backlog), 90–107 (checklist phase), 111                                | ở lại `docs/ai/PROGRESS.md` (nguyên văn) |

## Information Archived

Không có thư mục archive riêng. Nhật ký theo phase (`progress/`) đóng vai lịch sử; ADR không ADR nào bị xếp "lỗi thời"
toàn bộ — thay vào đó 33/62 file mang trạng thái "Hiệu lực — một phần đã thay" kèm ghi chú trỏ tới ADR thay nó.

## Information Merged

Không gộp mục nào. (Kế hoạch ban đầu định gộp mục backlog trùng (2)/(7), (3)/(8); đã đổi: giữ nguyên văn + 1 dòng ghi chú.)

## Information Rewritten (không còn nguyên văn — nội dung được nêu lại)

| Dòng gốc                                                                   | Nay ở đâu                                                                |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| PROGRESS 1 (`# Progress`), 3 ("Cập nhật file này ở cuối MỌI task")         | Tiêu đề + đoạn mở đầu mới của `PROGRESS.md` (quy tắc cập nhật 2 nơi)     |
| PROGRESS 5 (`## Phase hiện tại: P3 … → tiếp theo 4.3`)                     | Mục "Đang ở đâu": đổi P3 → **P4** (sửa có bằng chứng); các ý còn lại giữ |
| PROGRESS 26, 32 (tiêu đề "Đang làm / Bị chặn", "Bàn giao cho session mới") | Thay bằng tiêu đề file nhật ký                                           |
| CLAUDE 5, 7–9 (đoạn mở đầu bị formatter làm vỡ)                            | Cùng chữ, nối lại thành một đoạn                                         |
| CLAUDE 12 (`@docs/ai/DECISIONS.md`)                                        | Thay bằng `@docs/ai/INDEX.md`, `@docs/ai/LESSONS.md` + đoạn giải thích   |
| CLAUDE 65, 70–72 (bước 1 và 5 của quy trình)                               | Cùng nghĩa + đường dẫn mới (`progress/`, `decisions/`, INDEX, LESSONS)   |
| CLAUDE 75–76 (mục 6b và 7 dính một dòng)                                   | Tách thành "(6b)" dưới bước 6 và bước 7; chữ giữ nguyên                  |

## Information Removed

Không có nhóm thông tin nào bị xoá. Hai thứ **không còn được tự nạp** (vẫn trên đĩa, có đường dẫn từ INDEX): toàn văn
62 ADR và nhật ký chi tiết từng task.

## Information Added (mới, do AI viết — cần duyệt)

- Khối metadata đầu mỗi file ADR (số, task, lớp, trạng thái, "Ghi chú đọc kèm"): 45 file có ghi chú; quan hệ "thay một
  phần" lấy từ lời của ADR sau, 2 dòng là suy luận (xem `OPEN-ISSUES.md` mục C).
- `INDEX.md` (ánh xạ chủ đề → ADR do AI phân loại), `LESSONS.md` (rút từ ADR, mỗi dòng có số ADR nguồn),
  `PROGRESS.md` các mục "Chờ chủ dự án" và "Giới hạn / quan sát chưa sửa" (tổng hợp từ nhật ký + ADR).

## Potential Information Loss

- **Rủi ro hành vi, không phải mất dữ liệu**: trước đây mọi ADR luôn nằm trong context; nay AI phải chủ động đọc. Giảm
  thiểu: luật tra cứu trong root `CLAUDE.md` + `/task-start`, bảng INDEX, LESSONS tự nạp, 1 dòng trỏ ở 4 `CLAUDE.md` package.
- LESSONS/INDEX là bản rút gọn: nếu thiếu một bài học, nó vẫn ở ADR nhưng không còn "tự nhắc". Cần chủ dự án xem
  `LESSONS.md` có sót điều nào hay bị nhắc lại nhiều lần trong thực tế.
- Thứ tự thời gian xen kẽ giữa task và planning trong PROGRESS gốc (vd "Ingest video #3/#4" nằm giữa 3.2 và 3.2b) nay
  tách sang `planning.md`; ngày tháng vẫn ghi trong từng mục.

## Unresolved Conflicts

`docs/ai/OPEN-ISSUES.md`: 11 mục tài liệu lệch code (A1–A11), 3 nhóm câu lỗi thời trong văn bản nguyên văn (B), 2 quan
hệ suy luận (C). Không mục nào được tự sửa ngoài 3 mục ở phần D.

## Broken References

Không có (kiểm tra 4a/4b/4c/5): mọi đường dẫn trong các file tự nạp, mục lục và metadata ADR tồn tại; mọi tham chiếu
"ADR <số task>" / "ADR <ngày>" trong toàn repo (kể cả comment code) khớp một dòng mục lục. `docs/ai/DECISIONS.md` và
`docs/ai/PROGRESS.md` giữ nguyên đường dẫn nên hook `remind-progress.js`, slash command và review packet cũ vẫn đúng.

## File khác đã sửa

`.claude/commands/{task-start,task-done,next-task,review-packet,write-prompt,review,new-card}.md`, `README.md` (2 chỗ),
`docs/ai/ROADMAP.md` (1 dòng), 4 `CLAUDE.md` package (+1 dòng trỏ mỗi file). Không file mã nguồn nào đổi.

## Recommended Human Review

1. Đọc `CLAUDE.md` (diff nhỏ), `PROGRESS.md`, `INDEX.md`, `LESSONS.md` — đây là toàn bộ thứ AI thấy mặc định.
2. Lướt cột Trạng thái của `DECISIONS.md` và vài khối "Ghi chú đọc kèm" (vd ADR 032, 047, 049).
3. Quyết các mục trong `OPEN-ISSUES.md`.
4. Sau khi duyệt: commit, rồi xoá `docs/ai/_migration/`.
