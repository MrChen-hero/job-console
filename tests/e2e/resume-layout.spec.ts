import { expect, test, type Page } from '@playwright/test'
import sharp from 'sharp'

async function fillResume(page: Page, long: boolean) {
  await page.goto('/#/resume')
  await page.getByRole('button', { name: '一键填入示例资料' }).click()
  await expect(page.locator('[data-testid="resume-sheet"]')).toContainText('快速学习与团队推进')
  if (long) {
    await page.evaluate(async () => {
      const path = '/src/modules/resume/store.ts'
      const { useResumeStore } = await import(/* @vite-ignore */ path)
      const store = useResumeStore()
      for (let i = 0; i < 12; i++) {
        await store.upsertEntry('projects', {
          id: `print-${i}`, name: `打印验收项目 ${i}`, role: '独立开发', time: '2025.01 – 2025.06',
          stack: 'Vue / TypeScript',
          bullets: ['完成需求分析与功能实现，持续改进可维护性。'.repeat(3), '补充回归验证，确保所有内容完整输出。'.repeat(3)],
        })
      }
    })
  }
  await page.evaluate(() => document.fonts.ready)
}

async function settleLayout(page: Page) {
  // 必须跨过 ResizeObserver 通知与 Vue 更新，否则只能验证打印切换的瞬间。
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  }))
}

async function distribution(page: Page) {
  return page.locator('.sheet-page').evaluateAll((pages) => pages.map((p) => p.textContent))
}

test('简历打印：多页内容在稳定打印状态、PDF 和返回预览后保持一致', async ({ page }, testInfo) => {
  await fillResume(page, true)
  const compact = page.viewportSize()!.width <= 1180
  if (compact) await page.getByRole('button', { name: '预览', exact: true }).click()
  await expect.poll(() => page.locator('.sheet-page').count()).toBeGreaterThan(1)
  await settleLayout(page)
  const screen = await distribution(page)

  await page.emulateMedia({ media: 'print' })
  await settleLayout(page)
  expect(await distribution(page)).toEqual(screen)
  const pdf = await page.pdf({ preferCSSPageSize: true })
  expect(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)?.length).toBe(screen.length)
  await testInfo.attach('resume-print.pdf', { body: pdf, contentType: 'application/pdf' })

  await page.emulateMedia({ media: 'screen' })
  await settleLayout(page)
  expect(await distribution(page)).toEqual(screen)
})

test('简历打印：编辑态直接打印与保存后打印均提前完成分页', async ({ page }) => {
  await fillResume(page, true)
  await settleLayout(page)
  const screen = await distribution(page)
  expect(screen.length).toBeGreaterThan(1)
  await page.evaluate(() => {
    window.print = () => {
      document.body.dataset.printed = JSON.stringify([...document.querySelectorAll('.sheet-page')].map((p) => p.textContent))
    }
  })
  await page.locator('input[data-field="name"]').fill('保存后打印验收')
  await page.locator('.print-btn').click()
  await page.getByRole('button', { name: '保存后打印', exact: true }).click()
  await expect.poll(() => page.locator('body').getAttribute('data-printed')).toContain('保存后打印验收')
  const before = await distribution(page)
  expect(JSON.parse((await page.locator('body').getAttribute('data-printed'))!)).toEqual(before)
  await page.emulateMedia({ media: 'print' })
  await settleLayout(page)
  expect(await distribution(page)).toEqual(before)
})

async function photoFixture() {
  return sharp({ create: { width: 1800, height: 2520, channels: 3, background: '#8ca9bf' } }).png().toBuffer()
}

async function dropFile(page: Page, bytes: number[], name: string, type: string) {
  await page.locator('.avatar-upload').evaluate((el, file) => {
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(new File([new Uint8Array(file.bytes)], file.name, { type: file.type }))
    el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }))
  }, { bytes, name, type })
}

test('简历头像：拖放上传、缩放平移还原、完整示例含头像一页打印', async ({ page }, testInfo) => {
  await fillResume(page, false)
  await expect(page.locator('input[data-field="school"]')).toHaveValue('华东理工大学 · 软件工程')
  await page.locator('.avatar-edit').click()
  const dialog = page.locator('.avatar-dialog')
  await expect(dialog).toBeVisible()
  await dropFile(page, [...await photoFixture()], 'portrait.png', 'image/png')
  await expect(dialog.locator('.avatar-confirm')).toBeEnabled()
  expect(await dialog.locator('.avatar-img').evaluate((el) => (el as HTMLImageElement).naturalHeight)).toBe(1400)
  await dialog.locator('.avatar-zoom input').fill('2')
  await dialog.locator('.avatar-stage').focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowDown')
  const composition = await dialog.locator('.avatar-img').getAttribute('style')
  await dialog.locator('.avatar-confirm').click()
  await page.locator('.basic-save').click()
  await expect(page.locator('.resume-current')).toContainText('已保存到本机')
  await page.locator('.avatar-edit').click()
  await expect(dialog.locator('.avatar-zoom input')).toHaveValue('2')
  await expect(dialog.locator('.avatar-img')).toHaveAttribute('style', composition!)
  await dialog.getByRole('button', { name: '取消', exact: true }).click()
  if (page.viewportSize()!.width <= 1180) await page.getByRole('button', { name: '预览', exact: true }).click()
  await settleLayout(page)
  await expect(page.locator('.sheet-page')).toHaveCount(1)
  const screen = await distribution(page)
  await page.emulateMedia({ media: 'print' })
  await settleLayout(page)
  expect(await distribution(page)).toEqual(screen)
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: false })
  expect(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)?.length).toBe(1)
  await testInfo.attach('one-page-with-avatar.pdf', { body: pdf, contentType: 'application/pdf' })
})

test('简历头像：点击上传、错误保留原图与取消异步上传', async ({ page }) => {
  await fillResume(page, false)
  await page.locator('.avatar-edit').click()
  const dialog = page.locator('.avatar-dialog')
  const chooserPromise = page.waitForEvent('filechooser')
  await dialog.locator('.avatar-upload').click()
  await (await chooserPromise).setFiles({ name: 'photo.png', mimeType: 'image/png', buffer: await photoFixture() })
  await expect(dialog.locator('.avatar-confirm')).toBeEnabled()
  const src = await dialog.locator('.avatar-img').getAttribute('src')
  await dropFile(page, [1, 2], 'invalid.txt', 'text/plain')
  await expect(dialog.locator('[role="alert"]')).toContainText('格式')
  await expect(dialog.locator('.avatar-img')).toHaveAttribute('src', src!)
  await dialog.locator('input[type="file"]').setInputFiles({ name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('not an image') })
  await expect(dialog.locator('[role="alert"]')).toContainText('读取失败')
  await expect(dialog.locator('.avatar-img')).toHaveAttribute('src', src!)
  await dialog.locator('input[type="file"]').setInputFiles({ name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) })
  await expect(dialog.locator('[role="alert"]')).toContainText('超过 10MB')
  await dialog.getByRole('button', { name: '取消', exact: true }).click()
  await page.locator('.avatar-edit').click()
  await page.evaluate(() => {
    const read = FileReader.prototype.readAsDataURL
    FileReader.prototype.readAsDataURL = function (blob) {
      FileReader.prototype.readAsDataURL = read
      setTimeout(() => read.call(this, blob), 250)
    }
  })
  await dialog.locator('input[type="file"]').setInputFiles({ name: 'late.png', mimeType: 'image/png', buffer: await photoFixture() })
  await expect(dialog.locator('.avatar-confirm')).toBeDisabled()
  await dialog.getByRole('button', { name: '取消', exact: true }).click()
  await page.locator('.avatar-edit').click()
  // 等待故意延迟的文件读取完成，确认旧回调不会污染重新打开的空弹窗。
  await page.waitForTimeout(400)
  await expect(dialog.locator('.avatar-img')).toHaveCount(0)
  await expect(dialog.locator('.avatar-confirm')).toBeDisabled()
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
})
