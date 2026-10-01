> **ADR 010** · 2026-09-19 · Task: P0 · Lớp: Web
> **Trạng thái:** Hiệu lực. Mục lục: `docs/ai/DECISIONS.md`.

## 2026-09-19 — Zustand dùng qua `zustand/vanilla`, không phải React hook

`apps/web` không dùng React (Phaser scenes render trực tiếp), nên import gốc `zustand`
(trỏ tới `zustand/react`) lỗi "Cannot find package 'react'". Dùng `createStore` từ
`zustand/vanilla`, truy cập qua `.getState()`/`.setState()`/`.subscribe()`.
**Hệ quả**: không dùng được `useStore()` hook pattern — mọi Phaser Scene đọc state qua
`viewStore.getState()` trực tiếp (đã áp dụng trong `boot-scene.ts`/`menu-scene.ts`).
