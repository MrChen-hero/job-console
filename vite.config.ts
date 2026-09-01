import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // No client-side base path juggling: relative output supports both user-site
  // and project-repo GitHub Pages URLs.
  base: './',
  plugins: [vue()],
  // Element Plus 全量注册（个人工作台可接受），主 chunk 约 700kB gzip ~220kB；
  // Vite 8 (rolldown) 无 chunkSizeWarningLimit，构建告警无害，后续按需引入时回收本注释。
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    css: true,
  },
})
