/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // SQLite WASM tự nạp file sqlite3.wasm qua import.meta.url,
  // không cho Vite pre-bundle để giữ đúng đường dẫn.
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
  // Electron sẽ nạp file build qua file:// nên dùng đường dẫn tương đối.
  base: './',
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
