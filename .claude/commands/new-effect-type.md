---
description: Thêm 1 loại effect/operation/condition/cost mới vào effect engine
argument-hint: [tên operation/condition/cost và mô tả hành vi]
---

Thêm effect building block mới: $ARGUMENTS

1. Đọc `docs/design/effect-dsl.md` + ADR chủ đề Effect DSL (tra `docs/ai/INDEX.md`) — xác nhận
   operation/condition/cost tương tự chưa tồn tại trong `packages/game-engine/src/effects/`.
2. Xác định đây là trigger, condition, cost, target hay operation mới; thêm `kind` + params vào schema ở
   `packages/shared/src/effects/effect-definition.ts` (Zod) + metadata ở `effects/registry.ts`, rồi build lại shared.
3. Viết test trước. Implement handler pure:
   - operation: 1 file `effects/operations/<kind>.ts`, đăng ký ở `operations/index.ts`
     (`OPERATION_REGISTRY`; test `registry-sync.test.ts` đối chiếu với shared). Operation chỉ chạy lúc chain
     resolve, không tự bump `version`;
   - condition / cost / target: `effects/{conditions,costs,targets}.ts`;
   - trigger: suy từ EVENT ở `effects/triggers.ts` (`collectTriggers`), không cắm code vào chỗ phát event.
     Randomness (nếu có) đi qua `state.rng`, không `Math.random()`.
4. Không if/else theo `definitionId`; không thêm field top-level vào `GameState` (đặt trên `CardInstance`,
   `ChainWindow` hoặc payload prompt).
5. Test Vitest: case bình thường + case biên (target không hợp lệ, cost không đủ trả, target biến mất lúc
   resolve…); fixture ở `testing/effect-fixtures.ts`; thêm lá test vào `FUZZ_DEFS` và kiểm độ phủ fuzz.
6. Event mới ⇒ làm theo bước Wire của `/new-action` (shared `EventView`, `toEventView`, bảng
   `event-visibility.md`, các switch vét cạn ở web).
7. Cập nhật `docs/design/effect-dsl.md` nếu schema/catalog thay đổi; `RULES-REVIEW-SHEET.md` nếu là luật mới.
8. Cân nhắc: building block chỉ dùng cho đúng 1 lá và không tổng quát hoá được ⇒ dùng `scriptId`
   (`effects/effect-scripts/`) thay vì thêm vào DSL chung.
9. Chạy `pnpm --filter @yugi/game-engine lint`, `typecheck`, `test` (+ `@yugi/shared`).
