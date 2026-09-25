import { defineConfig } from 'vitest/config';

/** Real-network checks against a running API (see tools/play-duel-ui.ts). Not part of `pnpm test`. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/e2e/**/*.e2e.ts'],
    testTimeout: 600_000,
    fileParallelism: false,
  },
});
