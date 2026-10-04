# Review Packet — Task 4.5b: Dung hợp (Fusion) lên màn hình + dọn nợ duyệt

**Đã làm gì:** Từ task này bạn **chơi được Dung hợp thật** trên màn hình: có Extra Deck, kích hoạt lá Phép "Lò Hợp Thể",
được hỏi "Chọn mục tiêu dung hợp" rồi "Chọn N nguyên liệu dung hợp" (có nhãn "Bài trên tay" / "Trên sân" dưới mỗi lá), quái
Dung hợp lên sân, nguyên liệu vào mộ, hiệu ứng "khi triệu hồi" của quái Dung hợp chạy sau đó. Đối thủ **không biết gì** về
Extra Deck của bạn ngoài số lá. Trước khi code, tôi dọn nợ duyệt của `RULES-REVIEW-SHEET.md` (Phase 0): từ 10 ô trống còn 1.

**Engine không đổi dòng nào** (0 file dưới `packages/game-engine`, 30 golden giữ nguyên từng byte).

## 0. Kết quả Phase 0 (dọn nợ duyệt)

| Nhóm                                 | Số dòng | Ghi chú                                                                                    |
| ------------------------------------ | ------- | ------------------------------------------------------------------------------------------ |
| A — AI duyệt thay (thuần luật chuẩn) | 2       | 1 dòng cũ (Extra Deck lúc bắt đầu ván) + 1 dòng mới (kiểm tra Extra Deck khi tạo ván)      |
| B — đã chốt trong brief              | 10      | 5 dòng Fusion của 4.5 + 5 dòng mới của 4.5b                                                |
| C — hỏi bạn qua hộp thoại (7 câu)    | 5       | 4 dòng bạn duyệt, 1 dòng bạn chọn "giữ tạm"                                                |
| **Còn mở**                           | **1**   | Nguyên liệu Dung hợp lấy từ **Bộ bài** (G26 f) — chờ tư liệu, đã ghi `OPEN-ISSUES.md` (P6) |

Đáp án của bạn: (1) quái vừa triệu hồi **không được tấn công trong lượt đó — chốt** (G22 từ "đoán" thành "đã quyết"); (2) hiệu
ứng "khi triệu hồi" xếp trước hiệu ứng "khi bị phá" sinh ra trong lúc đáp trả; (3) không hỏi đối thủ lần hai; (4) nguyên liệu
bị phá để đáp trả ⇒ lá Phép mất, không có gì xảy ra; (5) hiệu ứng "khi bị phá" chờ dung hợp xong; (6) nguồn Bộ bài: giữ tạm;
(7) chi tiết thao tác màn chọn Dung hợp: chấp nhận. **Không đáp án nào đòi sửa luật** ⇒ không sinh task engine.
Chi tiết từng dòng + bằng chứng: `docs/ai/review-packets/task-4.5b-triage.md`.

**Một chỗ cần bạn để ý:** dòng "Extra Deck lúc bắt đầu ván…" có nhãn "`[RULE]`; cỡ 20 `[REF thấp]`". Tôi vẫn duyệt thay vì con
số 20 đã được chính bạn tick ở dòng "Cấu hình luật mặc định". Nếu bạn muốn chặt hơn, xoá ký hiệu ở dòng đó.

## 1. Cách tự test tay (không cần đọc code)

1. Bật Docker Desktop, rồi ở thư mục dự án: `docker compose up -d` và `pnpm dev`.
2. Mở `http://localhost:5173/dev/sandbox.html`. Ở ô chọn mẫu, chọn **`fusion-success-real`** rồi bấm **Nạp**.
3. Nhìn ô **Extra** bên phải hàng quái của bạn: số **3**. Ô Extra của đối thủ: **0** (máy không có Extra Deck).
4. Kéo lá **"Lò Hợp Thể"** (lá xanh, ngoài cùng bên trái trên tay) thả vào một ô Phép/Bẫy của bạn → chọn **"Kích hoạt"**.
5. Hiện khung **"Chọn mục tiêu dung hợp"** với 2 lá. Nút **"Chọn"** còn mờ. Chạm một lá → nút sáng. Chạm lá kia → lựa chọn
   đổi sang lá đó. Bấm **"Chọn"**.
6. Hiện khung **"Chọn 2 nguyên liệu dung hợp"**, dưới mỗi lá có chữ **"Bài trên tay"** hoặc **"Trên sân"**. Chọn 1 lá: nút
   **"Đồng ý"** vẫn mờ. Chọn đủ 2: nút sáng. Bấm **"Đồng ý"**.
7. Xem animation (viền tím ở nơi nguyên liệu rời đi, vòng xoáy tím ở ô quái), rồi kiểm: quái Dung hợp nằm ở ô quái đầu
   tiên; ô **Mộ** của bạn = 3 (2 nguyên liệu + lá Phép); ô **Extra** = 2; nếu chọn "Pháp Sư Màn Tro" thì đối thủ còn
   **7500 LP** (hiệu ứng "khi triệu hồi" của nó).
8. Bấm **Đóng ván**, nạp **`fusion-material-destroyed-real`**: kích hoạt lá Phép như bước 4 → máy lật Bẫy phá quái trên sân
   của bạn → **không** có khung chọn nào, không dung hợp, lá Phép vào mộ.
9. Nạp **`fusion-negated-real`**: máy đã kích hoạt lá dung hợp của nó, lá úp của bạn sáng viền. Chạm lá úp đó → lá của máy
   bị gạch chéo, máy không dung hợp được, ô Extra của máy vẫn là **1**, bạn mất 1000 LP (cost của Bẫy).
10. (Tuỳ chọn) Không cần server: `http://localhost:5173/?fixture=fusion-material&lang=en` để xem bản tiếng Anh.

## 2. Trước / sau

| Việc                                 | Trước 4.5b               | Từ 4.5b                                                                                              |
| ------------------------------------ | ------------------------ | ---------------------------------------------------------------------------------------------------- |
| Tạo ván có Extra Deck                | không được               | gửi kèm `extraDeck` khi tạo ván; Extra Deck sai (lá không phải quái Dung hợp, quá 20 lá…) bị từ chối |
| Bạn thấy Extra Deck của mình         | chỉ thấy số lá           | thấy từng lá (khi được hỏi chọn); đối thủ vẫn **chỉ thấy số lá**                                     |
| Kích hoạt lá Phép dung hợp trên UI   | không bao giờ được       | được, khi đủ nguyên liệu                                                                             |
| Hai bước chọn                        | chỉ có trong engine      | hai khung chọn trên màn hình, đúng chữ của bản gốc ("Chọn" / "Đồng ý", nhãn nguồn)                   |
| Đối thủ trong lúc bạn đang chọn      | —                        | chỉ biết "đang có câu hỏi", không biết quái nào / nguyên liệu nào                                    |
| Nhật ký + animation                  | 2 sự kiện Dung hợp bị bỏ | ghi từng nguyên liệu (từ tay / từ sân) + lần Triệu hồi Dung hợp; animation 1,3–1,5 s (hình tạm)      |
| Đấu với máy                          | —                        | máy **không có** Extra Deck, không Dung hợp (chờ P8)                                                 |
| Lá mới                               | —                        | **SMP-047 "Pháp Sư Màn Tro"** — quái Dung hợp có hiệu ứng "khi triệu hồi: 500 sát thương"            |
| Ván không có Extra Deck (mọi ván cũ) | —                        | **không đổi gì**                                                                                     |

## 3. Ảnh thật (`docs/ai/review-packets/task-4.5b-screens/`, 18 ảnh — tôi đã mở xem từng ảnh)

Chụp bằng `tools/ui-fusion-shots.ts` (API thật + trang Sandbox thật + Edge, chuột thật), trừ ảnh 17–18.

| Ảnh   | Nội dung                                                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------- |
| 01    | Bàn trước khi dùng: lá Phép dung hợp trên tay, ô Extra của mình = 3, của máy = 0                                          |
| 02–03 | Kéo lá Phép: các ô Phép/Bẫy sáng lên; thả ra có menu "Kích hoạt" / "Úp"                                                   |
| 04–05 | Khung "Chọn mục tiêu dung hợp": 2 quái; nút "Chọn" mờ → sáng sau khi chọn                                                 |
| 06–08 | Khung "Chọn 2 nguyên liệu dung hợp" có nhãn "Bài trên tay" / "Trên sân"; chọn 1 lá nút vẫn mờ; đủ 2 lá nút "Đồng ý" sáng  |
| 09    | Bước nguyên liệu (dòng chú thích "…trên tay làm nguyên liệu dung hợp"). Viền tím đã mờ gần hết lúc khung này được chụp    |
| 10    | Vòng xoáy tím + lá hiện ra ở ô quái đầu tiên, chú thích "P0 Triệu hồi Dung hợp Pháp Sư Màn Tro vào ô 0"                   |
| 11    | Sau dung hợp: quái Dung hợp trên sân, Mộ 3, Extra 2, đối thủ 7500 LP, nhật ký đủ các dòng (có hiệu ứng của quái Dung hợp) |
| 12–13 | `fusion-material-destroyed-real`: trước, và sau khi máy phá nguyên liệu để đáp trả (không dung hợp, lá Phép vào mộ)       |
| 14–16 | `fusion-negated-real`: lá dung hợp của máy trên chuỗi + lá úp của mình sáng viền (Extra của máy chỉ là số 1); bị vô hiệu  |
| 17–18 | Tiếng Anh: "Choose the Fusion target" / "Choose 2 fusion materials", "In hand" / "On the field", "Choose" / "OK"          |

**Nói thẳng về ảnh:** 17–18 là **fixture DEV** trên trang game (dữ liệu dựng sẵn, không qua server) vì trang Sandbox chỉ có
tiếng Việt. Trong lúc animation chạy, bàn vẫn là hình cũ (ảnh 09–10 còn thấy nguyên liệu trên tay / sân) — đó là thiết kế
từ task 2.9, bàn chỉ đổi khi animation xong. Khung chọn che một phần hàng quái của đối thủ.

## 4. Số liệu thật

| Hạng mục                                | Kết quả                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test đỏ trước (phần bảo mật, api)       | **13 đỏ / 20** (`task-4.5b-red.txt`) — viết trước khi sửa code api; 7 test xanh sẵn vì kiểm điều không đổi (đối thủ không thấy gì)                                                                                                                                                                                                                                                                                                                                                                                                             |
| Test sau khi xong                       | shared **230** (+13) · engine **1097** (=) · api **532** (+56) · web **734** (+59)                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Lint / typecheck / build                | `pnpm lint` 4/4, `pnpm typecheck` 6/6, `pnpm build` 4/4 đạt. `pnpm test`: mọi test đạt; gói api thoát mã 1 vì thông báo `Timeout calling "onTaskUpdate"` của vitest (lỗi đã biết khi chạy song song, 532/532 vẫn đạt)                                                                                                                                                                                                                                                                                                                          |
| Engine / golden                         | `git diff ae3b1bb -- packages/game-engine`: **0 dòng**; golden cũ đổi **0 / 30**, không thêm golden                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Mutation (`tools/mutants-4.5b.mjs`)     | Lần chạy đầy đủ **52 / 53**; 1 mutant sống ("chạm lá thật trên bàn cũng chọn được") ⇒ thêm 1 test web ⇒ chạy lại mutant đó: bị bắt ⇒ **53 / 53**. 13 mutant bảo mật (đủ 5 loại bắt buộc), đều bị bắt bởi **test**                                                                                                                                                                                                                                                                                                                              |
| Fuzz chống rò (bộ mặc định trong suite) | variant Fusion: 6 seed hai-ghế + 3 seed đấu-với-máy × 120 bước: 10 lần dung hợp, 9 nguyên liệu từ sân, 11 + 11 prompt, 22 lần đối thủ nhìn prompt (payload luôn `null`), 6 trigger của quái Dung hợp, 3 lần bị vô hiệu; 0 vi phạm                                                                                                                                                                                                                                                                                                              |
| Fuzz chống rò dài                       | 120 seed × 300 bước (+60 đấu-với-máy, +60 deck Field, +30 deck quái lật, +60 Negate, +30 Negate đấu-với-máy, **+60 Fusion hai-ghế, +30 Fusion đấu-với-máy**): **454 / 454** test đạt, 0 vi phạm, 118.953 bước; variant Fusion: 265 lần dung hợp, 306 nguyên liệu từ sân + 238 từ tay, 270 + 268 prompt, 538 lần đối thủ nhìn prompt (payload luôn `null`), 130 trigger của quái Dung hợp, 54 lần bị vô hiệu, 57 lần dung hợp ở ván đấu-với-máy (`task-4.5b-leak-fuzz-long.txt`; lần chạy cũng in `onTaskUpdate` và thoát mã 1 dù mọi test đạt) |
| Fuzz engine dài                         | 400 + 100 + 100 + 200 seed × 400 bước: **826 / 826**, 0 vi phạm, số liệu độ phủ **giống hệt** task 4.5 (engine không đổi) — `task-4.5b-fuzz-long.txt`                                                                                                                                                                                                                                                                                                                                                                                          |
| Mô phỏng 100 ván deck Fusion            | 100 ván × 3 kiểu (`AI_SIM_GAMES` 34 + 34 + 32), **300 / 300 ván kết thúc, 0 ván kẹt, 0 action bị từ chối**: (1) máy đấu máy, không Extra Deck — lá dung hợp không bao giờ được liệt kê cho máy; (2) "người giả lập" có Extra Deck đấu máy — **87 lần dung hợp**, máy không bị hỏi prompt nào; (3) ghế máy có Extra Deck và được kích hoạt hộ (trường hợp Sandbox) — 127 lần kích hoạt, máy trả lời **254** prompt Fusion (`task-4.5b-ai-sim.txt`)                                                                                              |
| Smoke HTTP thật                         | `smoke-http` **38 / 38** (15 kiểm tra Fusion: tạo ván có Extra Deck → kích hoạt → 2 prompt → quái lên sân) — `task-4.5b-smoke.md`; `smoke-sandbox` **98 / 98** — `task-4.5b-smoke-sandbox.md`                                                                                                                                                                                                                                                                                                                                                  |
| `play-vs-ai` (ván thật với máy)         | mặc định 54 / 54 · effect 95 / 95 · **fusion 59 / 59** (1 lần dung hợp ngay ván đầu) · negate: xem "nói thẳng" — `task-4.5b-play-vs-ai.txt`                                                                                                                                                                                                                                                                                                                                                                                                    |

## 5. Lệch kế hoạch / nói thẳng

- **Thêm một lá mới (SMP-047).** Brief không liệt kê lá mới, nhưng đòi thấy "hiệu ứng khi triệu hồi của quái Dung hợp" trên
  màn hình; hai quái Dung hợp của 4.5 không có hiệu ứng. Tên tự đặt ("Pháp Sư Màn Tro"), thêm ở cuối danh sách lá.
- **Duel Sandbox cho phép khai Extra Deck cho ghế máy** (ván thật thì không). Lý do: máy chưa biết dùng Bẫy Phản công, nên
  cảnh "Dung hợp bị vô hiệu" phải dựng ngược: máy kích hoạt lá dung hợp (bằng `script`), **bạn** vô hiệu. Đã có test: nếu bạn
  cho qua, máy tự trả lời hai câu hỏi và dung hợp, không kẹt.
- **Một ngoại lệ ở web:** trước giờ màn hình chỉ gửi đúng những hành động server liệt kê sẵn. Câu trả lời "chọn nguyên liệu"
  nay được ghép từ danh sách ứng viên server gửi trong câu hỏi (vì server chỉ liệt kê tối đa 200 tổ hợp). Màn hình vẫn không
  tự xét luật: chọn sai thì server từ chối và bạn chọn lại.
- **Test web viết sau code**, không phải đỏ trước (`fusion-prompt.test.ts`, `interaction.fusion.test.ts` và các bảng event).
  Đỏ trước chỉ có phần bảo mật ở api. Spec scenario, e2e, mô phỏng AI, variant fuzz cũng viết sau.
- **Fuzz chống rò hai-ghế không dùng nguyên deck demo:** cùng các lá đó nhưng nhiều bản hơn (deck thật chỉ dung hợp 1–2 lần
  mỗi seed). Phần đấu-với-máy dùng đúng `FUSION_DEMO_DECK`.
- **`play-vs-ai` deck negate chập chờn:** 4 lần chạy thì **3** lần thiếu hai kiểm tra "độ phủ" (ván kết thúc ở lượt 11 mà máy
  không đánh vào lá úp nào). Không kiểm tra chức năng / rò nào hỏng. Đường code của deck đó không đổi ở task này; tôi **chưa
  kiểm** tỉ lệ này ở commit trước task, nên không khẳng định được nó có từ trước. Chưa sửa (ngoài phạm vi).
- **Ảnh 09** bắt được đúng bước "nguyên liệu" nhưng viền tím đã mờ; ảnh tiếng Anh là fixture (mục 3).
- **Tôi đã tự bật Docker Desktop** (đang tắt) để chạy smoke / chụp ảnh; API chạy bằng bản build ở cổng 3000 và dev server web
  ở 5173 — cả hai **đã tắt**; Docker còn chạy.
- Một bài học quy trình: script sửa docs có tiếng Việt chạy qua stdin của python bị lỗi mã hoá ⇒ đã quay về cách viết file
  `.mjs` rồi `node` (đúng LESSONS).

## 6. Câu hỏi mở / việc cần bạn

- Duyệt các dòng nháp: `parity-board.md` dòng Fusion (🟨), 7 dòng mới ở `RULES-REVIEW-SHEET.md` (đã có ký hiệu, bạn có thể bác).
- **Nguồn "Bộ bài"** (G26 f): cần video bản gốc có nhãn "Bộ bài" ở màn chọn nguyên liệu.
- Art / clip Dung hợp để thay hình tạm (G27): đã ghi `docs/plan/human-tasks.md`.
- Có muốn một task UI nhỏ: trình xem Extra Deck, và chữ to hơn trong khung chọn?

## 7. File đổi (tóm tắt)

- **Shared:** `cards/sample-cards.ts` (+SMP-047), `deck/fusion-demo-deck.ts` (mới), `duel/state-view.ts`,
  `duel/event-view.ts`, `scenario/scenario-schema.ts`, `index.ts`, 3 scenario JSON; test tương ứng.
- **Api:** `duels.dto.ts`, `duels.controller.ts`, `duel-manager.ts`, `state-view.ts`, `event-view.ts`, `visibility.ts`,
  `testing/leak-check.ts`, `dev-sandbox/scenario-to-state.ts`, `ai/simulate.ts` (test-support); spec: `fusion-wire.spec.ts`
  (thay `fusion-containment.spec.ts`), `duel-manager.scenario-fusion.spec.ts`, `ai/simulate.fusion-deck.spec.ts`,
  `event-view.spec.ts`, `event-visibility.fuzz.spec.ts`, `duels.e2e.spec.ts`, `scenario-to-state.spec.ts`.
- **Web:** `duel/fusion-prompt.ts` (mới), `interaction.ts`, `presenter.ts`, `layout.ts`, `duel-controller.ts`,
  `animation-queue.ts`, `log-entries.ts`, `strings.ts`, `theme.ts`, `fixtures.ts`, `fixture-names.ts`,
  `debug/describe-event.ts`, `debug/describe-ai-action.ts`, `scenes/duel-scene.ts`, `i18n/locales/{vi,en}.json`; test.
- **Tools:** `smoke-http.ts`, `smoke-sandbox.ts`, `play-vs-ai.ts`, `lib/http.ts`, `ui-fusion-shots.ts` (mới),
  `mutants-4.5b.mjs` (mới).
- **Docs:** ADR 069, `DECISIONS.md`, `INDEX.md`, `LESSONS.md`, `PROGRESS.md`, `progress/p4.md`, `OPEN-ISSUES.md`,
  `protocol.md`, `event-visibility.md`, `fidelity-spec.md` (G22, G25, G26, G27 mới), `rules-coverage.md`,
  `RULES-REVIEW-SHEET.md`, `parity-board.md`, `MASTER-PLAN.md`, `human-tasks.md`, `CLAUDE.md` của api và web,
  `task-4.5b-triage.md`.
