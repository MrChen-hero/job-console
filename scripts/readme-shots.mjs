import { chromium, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const baseURL = process.env.README_SHOTS_URL ?? 'http://127.0.0.1:5173'
const outputDir = new URL('../docs/screenshots/', import.meta.url)
await mkdir(outputDir, { recursive: true })
const browser = await chromium.launch()
try {
  // A fresh isolated context never reads or clears the user's browser profile.
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1,
    locale: 'zh-CN', timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  page.setDefaultTimeout(15000)
  await page.clock.setFixedTime(new Date('2026-09-27T10:00:00+08:00'))

  async function navigate(hash, title, ready) {
    await page.goto(baseURL + '/#' + hash)
    await expect(page.locator('.page-title')).toHaveText(title)
    await expect(page.locator(ready).first()).toBeVisible()
    await expect(page.locator('.el-loading-mask')).toHaveCount(0)
  }

  async function saveShot(name) {
    await page.locator('.el-message').evaluateAll((elements) => elements.forEach((element) => element.remove()))
    await page.evaluate(() => globalThis.document?.fonts?.ready)
    const buffer = await page.screenshot({ type: 'png', animations: 'disabled' })
    await sharp(buffer).webp({ quality: 85 }).toFile(fileURLToPath(new URL(name, outputDir)))
  }

  await navigate('/tracker', '投递管理', '.app-table')
  for (const company of ['示例科技', '星河软件（虚构）', '青禾数字（虚构）']) {
    await page.getByRole('button', { name: '＋ 新增投递' }).click()
    await page.locator('input[data-field="company"]').fill(company)
    await page.locator('input[data-field="position"]').fill('前端工程师')
    await page.locator('input[data-field="nextStep"]').fill('准备技术面试')
    await page.locator('input[data-field="nextActionAt"]').fill('2026-09-28')
    await page.locator('input[data-field="nextActionAt"]').press('Tab')
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await expect(page.locator('.app-table')).toContainText(company)
    await expect(page.getByRole('dialog')).toHaveCount(0)
  }
  await saveShot('tracker.webp')
  await navigate('/', '工作台', '[data-testid="stat-total"]')
  await expect(page.getByTestId('stat-total')).toHaveText('3')
  await saveShot('dashboard.webp')
  await navigate('/resume', '简历管理', '.page-title')
  await page.getByRole('button', { name: '一键填入示例资料' }).click()
  await expect(page.locator('[data-testid="resume-sheet"]')).toContainText('王小明')
  await saveShot('resume.webp')
  await navigate('/library', '材料库', '[data-testid="doc-body"]')
  await saveShot('library.webp')
  await navigate('/showcase', '项目演示', '.proj')
  await saveShot('showcase.webp')
  await page.setViewportSize({ width: 390, height: 844 })
  await navigate('/', '工作台', '[data-testid="stat-total"]')
  await saveShot('mobile-dashboard.webp')
  console.log('README screenshots written to docs/screenshots/')
} finally {
  await browser.close()
}
