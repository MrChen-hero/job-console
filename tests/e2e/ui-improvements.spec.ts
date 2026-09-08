import { expect, test, type Page } from '@playwright/test'

async function navigate(page: Page, name: string) {
  const menu = page.getByRole('button', { name: '打开导航', exact: true })
  if (await menu.isVisible()) await menu.click()
  await page.locator('.nav-item').filter({ hasText: name }).click()
}

async function seedApplications(page: Page, count: number) {
  await page.evaluate(async (count) => {
    const modulePath = '/src/modules/tracker/store.ts'
    const { useTrackerStore } = await import(/* @vite-ignore */ modulePath)
    const store = useTrackerStore()
    for (let i = 0; i < count; i++) {
      const date = new Date()
      date.setDate(date.getDate() + i - 1)
      const nextActionAt = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      await store.addApplication({ company: `测试企业${i}`, position: '研发工程师', appliedAt: '2026-09-01', batch: '正式批', channel: '官网', track: i % 2 ? '主投' : '次投', nextStep: `准备事项${i}`, nextActionAt })
    }
  }, count)
}

test('工作台：日期色块、全部待办滚动与手机首屏任务', async ({ page }) => {
  await page.goto('/#/tracker')
  await seedApplications(page, 7)
  await page.goto('/#/')
  await expect(page.locator('.todo')).toHaveCount(7)
  await expect(page.locator('.todo-group-title')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /查看全部|^收起$/ })).toHaveCount(0)
  const dates = page.locator('.todo-date')
  await expect(dates.nth(0)).toHaveAttribute('title', /^已逾期 · /)
  await expect(dates.nth(1)).toHaveAttribute('title', /^今天 · /)
  await expect(dates.nth(2)).toHaveAttribute('title', /^后续 · /)
  const colors = await dates.evaluateAll((elements) => elements.slice(0, 3).map((el) => getComputedStyle(el).backgroundColor))
  expect(new Set(colors).size).toBe(3)
  const list = page.getByRole('region', { name: '待办清单，按日期从早到晚排列' })
  expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true)
  if (await page.evaluate(() => matchMedia('(hover: hover)').matches)) {
    await page.mouse.move(0, 0)
    const hiddenColor = await list.evaluate((el) => getComputedStyle(el).scrollbarColor)
    await list.hover()
    expect(await list.evaluate((el) => getComputedStyle(el).scrollbarColor)).not.toBe(hiddenColor)
    await page.mouse.move(0, 0)
    await expect.poll(() => list.evaluate((el) => getComputedStyle(el).scrollbarColor)).toBe(hiddenColor)
    await list.focus()
    await page.keyboard.press('End')
    await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
  }
  await expect(page.locator('.kpi-delta').last()).toHaveText('暂无变化')
  if (page.viewportSize()!.width <= 720) {
    expect((await page.locator('.todo-card').boundingBox())!.y).toBeLessThan(450)
    const cards = await page.locator('.kpi').all()
    expect(Math.abs((await cards[0]!.boundingBox())!.y - (await cards[1]!.boundingBox())!.y)).toBeLessThan(1)
  }
  await page.locator('.todo').last().click()
  await expect(page.locator('.app-drawer')).toBeVisible()
  await expect(page.locator('.app-drawer')).toContainText('测试企业6')
})

test('投递：筛选清空、末页删除与手机详情收藏', async ({ page }) => {
  await page.goto('/#/tracker')
  await seedApplications(page, 13)
  const mobile = page.viewportSize()!.width <= 720
  if (mobile) await page.locator('.filter-toggle').click()
  await page.getByRole('button', { name: '只看收藏', exact: true }).click()
  await expect(page.locator('.table-empty')).toBeVisible()
  await page.getByRole('button', { name: '清空筛选' }).click()
  if (mobile) await page.locator('.filter-toggle').click()
  await page.getByRole('button', { name: '末页', exact: true }).click()
  if (mobile) {
    await page.locator('.mobile-app .star-btn').click()
    await expect(page.locator('.app-drawer')).toBeHidden()
    await expect(page.locator('.mobile-app .star-btn')).toHaveAttribute('aria-pressed', 'true')
    await page.locator('.mobile-app-open').click()
  } else await page.locator('.row-open').click()
  await page.locator('.app-drawer .remove-btn').click()
  await page.locator('.el-message-box').getByRole('button', { name: '删除', exact: true }).click()
  await expect(page.locator(mobile ? '.mobile-app' : '.app-row')).toHaveCount(12)
  await expect(page.locator('.pager')).toBeHidden()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
})

test('材料库：搜索、分类同步及未保存修改的三条退出路径', async ({ page }) => {
  await page.goto('/#/library')
  await page.getByRole('button', { name: '自我介绍', exact: true }).click()
  await expect(page.locator('.reader-title')).toContainText('自我介绍')
  await page.getByRole('button', { name: '全部', exact: true }).click()
  await page.getByRole('textbox', { name: '搜索材料' }).fill('HashMap')
  await expect(page.locator('.lib-item')).toHaveCount(1)
  await expect(page.locator('.reader-title')).toContainText('Java')
  await page.getByRole('textbox', { name: '搜索材料' }).fill('')
  const createBox = (await page.locator('.create-btn').boundingBox())!
  expect(createBox.x + createBox.width).toBeLessThanOrEqual(page.viewportSize()!.width)
  await page.locator('.edit-btn').click()
  await page.locator('#de-title').fill('未保存标题')
  await navigate(page, '工作台')
  await page.getByRole('button', { name: '继续编辑', exact: true }).click()
  await expect(page).toHaveURL(/library/)
  await expect(page.locator('#de-title')).toHaveValue('未保存标题')
  // 返回后收起为导航而保留的抽屉，再取消编辑。
  const scrim = page.locator('.scrim')
  if (await scrim.isVisible()) await page.getByRole('button', { name: '关闭导航' }).click()
  await page.locator('.editor-actions').getByRole('button', { name: '取消', exact: true }).click()
  await page.getByRole('button', { name: '放弃修改', exact: true }).click()
  await expect(page.locator('.reader-title')).not.toHaveText('未保存标题')
  await page.locator('.edit-btn').click()
  await page.locator('#de-title').fill('已保存标题')
  await navigate(page, '工作台')
  await page.getByRole('button', { name: '保存并继续', exact: true }).click()
  await expect(page).toHaveURL(/#\/$/)
  await navigate(page, '材料库')
  await page.getByRole('textbox', { name: '搜索材料' }).fill('已保存标题')
  await expect(page.locator('.lib-item')).toHaveCount(1)
  await expect(page.locator('.reader-title')).toHaveText('已保存标题')
  await page.getByRole('button', { name: '管理分类' }).click()
  await expect(page.getByRole('button', { name: '删除分类 全部', exact: true })).toHaveCount(0)
})

test('简历：编辑预览切换保留输入、缩放尺寸和打印布局', async ({ page }) => {
  await page.goto('/#/resume')
  await page.getByRole('button', { name: '一键填入示例资料' }).click()
  await page.locator('input[data-field="name"]').fill('测试姓名')
  await expect(page.locator('.resume-current')).toContainText('有未保存修改')
  const compact = page.viewportSize()!.width <= 1180
  if (compact) {
    await page.getByRole('button', { name: '预览', exact: true }).click()
    await expect(page.locator('.resume-side')).toBeHidden()
    await page.getByRole('button', { name: '编辑', exact: true }).click()
    await expect(page.locator('input[data-field="name"]')).toHaveValue('测试姓名')
  }
  await page.locator('.basic-save').click()
  await expect(page.locator('.resume-current')).toContainText('已保存到本机')
  if (compact) await page.getByRole('button', { name: '预览', exact: true }).click()
  await expect(page.locator('.sheet')).toContainText('测试姓名')
  await expect.poll(() => page.locator('.sheet-scaler').evaluate((el) => Math.abs(el.getBoundingClientRect().height - el.querySelector('.sheet')!.getBoundingClientRect().height))).toBeLessThan(2)
  expect(await page.locator('.resume-preview').evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.resume-side')).toBeHidden()
  await expect(page.locator('.sheet')).toBeVisible()
  expect(await page.locator('.sheet-scaler > div').evaluate((el) => getComputedStyle(el).transform)).toBe('none')
})

test('项目演示：数量提示与编辑按钮键盘独立触发', async ({ page }) => {
  await page.goto('/#/showcase')
  await expect(page.locator('.proj').filter({ hasText: '校园二手交易小程序' })).toContainText('1 个交互演示')
  await page.locator('.proj-edit').first().focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.el-dialog')).toBeVisible()
  await expect(page.locator('.deck-overlay')).toBeHidden()
  await page.keyboard.press('Escape')
  await page.locator('.proj').first().focus()
  await page.keyboard.press('Space')
  await expect(page.locator('.deck-overlay')).toBeVisible()
})

test('导入：取消不写入、合并保留本机记录、覆盖须确认', async ({ page }) => {
  await page.goto('/#/tracker')
  await seedApplications(page, 1)
  const data = { profile: [], resumeVersions: [], applications: [], companyPool: [], libraryDocs: [], milestones: [], runtimeDemos: [], libraryCategories: [], runtimeProjects: [], deletedDocs: [] }
  const upload = async () => {
    const menu = page.getByRole('button', { name: '打开导航', exact: true })
    if (await menu.isVisible()) await menu.click()
    await page.locator('input[type="file"][accept*=".json"]').setInputFiles({ name: 'empty-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ schemaVersion: 4, exportedAt: new Date().toISOString(), data })) })
    await expect(page.locator('.import-summary')).toBeVisible()
  }
  await upload()
  await expect(page.getByRole('radio', { name: /^合并导入/ })).toBeChecked()
  await page.getByRole('button', { name: '取消', exact: true }).click()
  await expect(page.locator('.app-table')).toContainText('测试企业0')
  await upload()
  await page.getByRole('button', { name: '确认合并导入' }).click()
  await expect(page.locator('.import-summary')).toBeHidden()
  await page.waitForEvent('load')
  await expect(page.locator('.app-table')).toContainText('测试企业0')
  await upload()
  await page.getByRole('radio', { name: /^覆盖导入/ }).check()
  await expect(page.getByRole('button', { name: '确认覆盖导入' })).toBeDisabled()
  await page.getByRole('checkbox', { name: '我确认用备份替换现有数据' }).check()
  await page.getByRole('button', { name: '确认覆盖导入' }).click()
  await expect(page.locator('.import-summary')).toBeHidden()
  await page.waitForEvent('load')
  await expect(page.locator('.table-empty')).toBeVisible()
})

test('手机导航：焦点限制和关闭恢复', async ({ page }) => {
  test.skip(page.viewportSize()!.width > 1024, 'Only drawer navigation needs a focus trap')
  await page.goto('/')
  const menu = page.getByRole('button', { name: '打开导航', exact: true })
  await menu.click()
  await expect(page.locator('.nav-item').first()).toBeFocused()
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('.sidebar')))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(menu).toBeFocused()
  await expect(menu).toHaveAttribute('aria-expanded', 'false')
})
