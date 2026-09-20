---
description: Tự review diff hiện tại theo checklist kiến trúc của dự án
---

Xem `git diff` (staged + unstaged) và review theo checklist sau — báo cáo vi phạm cụ thể
(file:line), không chỉ nói chung chung:

**Dependency rule** (xem bảng trong `CLAUDE.md` root)

- [ ] `packages/game-engine` không import `phaser`/`@nestjs/*`/`socket.io`/Node API.
- [ ] `apps/web` không import rule logic từ `packages/game-engine` (chỉ type/utility rõ ràng
      nếu có).
- [ ] `packages/shared` không import từ `apps/*` hay `packages/game-engine`.

**Engine purity** (nếu diff đụng `packages/game-engine`)

- [ ] Không có `Math.random()`/`Date.now()` — mọi randomness qua `ctx`/`state.rng`.
- [ ] State update bằng spread/object mới, không mutate trực tiếp field của `state` cũ.
- [ ] Action/Event mới có test tương ứng (case hợp lệ + invalid).

**Data-driven effect** (nếu diff đụng card/effect)

- [ ] Effect mới mô tả qua `EffectDefinition`/`scriptId`, không hardcode if/else trong core
      engine cho 1 lá cụ thể.
- [ ] Không dùng tên/art bài chính thức của Konami.

**Server-authoritative** (nếu diff đụng `apps/api` hoặc `apps/web`)

- [ ] Mọi action ảnh hưởng game state đi qua server + engine, client không tự đổi state.
- [ ] StateView gửi cho client đã ẩn thông tin đối thủ đúng (không leak hand/face-down).

**Chung**

- [ ] Không có `any` (trừ khi có lý do rõ ràng + comment giải thích).
- [ ] Không thêm dependency lớn ngoài kế hoạch mà chưa hỏi user.
- [ ] Diff không lan ra ngoài phạm vi task (không refactor "tiện tay").
- [ ] `docs/ai/PROGRESS.md` đã cập nhật nếu task coi như xong.

Kết luận: liệt kê vi phạm tìm được (nếu có), mức độ nghiêm trọng, và đề xuất fix. Nếu sạch,
nói rõ "không tìm thấy vi phạm" thay vì im lặng.
