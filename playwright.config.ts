import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  webServer: {
    // --strictPort: 端口被占时直接失败，不要静默漂移到 4174 —— baseURL 固定指 4173，
    // 漂移只会表现成一堆看不懂的连接失败。
    command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    // 不复用已存在的 server：复用会让上一轮被中断后残留的孤儿 dev server 一直被喂养，
    // vite 的 HMR 内存按更新次数累积且不释放，跨 run 累积最终耗尽整机提交内存。
    // 每轮自起自收，孤儿会以端口冲突的形式立刻暴露。
    reuseExistingServer: false,
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
    },
    {
      name: 'tablet-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 1024 },
      },
    },
  ],
})
