import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      // Phaser game (index.html) + the throwaway debug page (debug.html, dev tool: delete src/debug + this line to remove).
      input: {
        main: resolve(__dirname, 'index.html'),
        debug: resolve(__dirname, 'debug.html'),
      },
    },
  },
});
