import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// Standalone Vitest config (kept separate from vite.config.ts so the
// firebase service-worker plugin doesn't run during tests). Reuses the
// same `@/` alias as the app.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.ts'],
    clearMocks: true,
    restoreMocks: true,
  },
})
