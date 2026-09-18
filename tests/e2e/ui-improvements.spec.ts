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
  await expect(page.locator('.sheet-page').first()).toContainText('测试姓名')
  await expect.poll(() => page.locator('.sheet-scaler').evaluate((el) => Math.abs(el.getBoundingClientRect().height - el.querySelector('.sheet-stack')!.getBoundingClientRect().height))).toBeLessThan(2)
  expect(await page.locator('.resume-preview').evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.resume-side')).toBeHidden()
  await expect(page.locator('.sheet-page').first()).toBeVisible()
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

/* 5:7 的 70×98 PNG，图案沿对角渐变——裁剪平移/缩放后取到的像素会变，
   因此「重开弹窗还原出同样的缩放值」能证明重裁确实恢复了上次构图 */
const AVATAR_PNG = Buffer.from(
  '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',
  'base64',
)

test('简历：区块标题可改、头像可重裁、预览按页分页', async ({ page }) => {
  await page.goto('/#/resume')
  await page.getByRole('button', { name: '一键填入示例资料' }).click()
  await expect(page.locator('[data-testid="resume-sheet"]')).toContainText('王小明')

  // 区块标题：编排态内联改，预览纸面同步
  await page.locator('.pool-arrange').click()
  const skillRow = page.locator('.section-row').filter({ has: page.locator('.title-input') }).nth(1)
  await skillRow.locator('.title-input input').fill('核心技能')
  await skillRow.locator('.title-input input').blur()
  await expect(page.locator('[data-testid="resume-sheet"]')).toContainText('核心技能')
  await page.locator('.pool-arrange').click()

  // 头像：上传 → 缩放 → 确定 → 保存 → 纸面右上角出现
  await page.locator('.avatar-edit').click()
  const dialog = page.locator('.avatar-dialog')
  await dialog.locator('input[type="file"]').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: AVATAR_PNG })
  await expect(dialog.locator('.avatar-img')).toBeVisible()
  await dialog.locator('.avatar-zoom input').fill('2')
  await dialog.getByRole('button', { name: '确定' }).click()
  await page.locator('.basic-save').click()
  await expect(page.locator('.resume-current')).toContainText('已保存到本机')
  // ≤1180px 预览态与编辑态互斥，纸面此时是 display:none
  const compact = page.viewportSize()!.width <= 1180
  if (compact) await page.getByRole('button', { name: '预览', exact: true }).click()
  await expect(page.locator('.sheet-page').first().locator('.r-photo img')).toBeVisible()

  // 重裁：再开弹窗应还原上次构图，而不是回到默认取景
  if (compact) await page.getByRole('button', { name: '编辑', exact: true }).click()
  await page.locator('.avatar-edit').click()
  await expect(dialog.locator('.avatar-zoom input')).toHaveValue('2')
  await dialog.getByRole('button', { name: '取消' }).click()

  // 足量条目 → 预览出现第 2 页，页码标注与页数一致
  await page.evaluate(async () => {
    const modulePath = '/src/modules/resume/store.ts'
    const { useResumeStore } = await import(/* @vite-ignore */ modulePath)
    const store = useResumeStore()
    for (let i = 0; i < 12; i += 1) {
      await store.upsertEntry('projects', {
        id: `bulk-${i}`,
        name: `批量项目 ${i}`,
        role: '独立开发',
        time: '2025.01 – 2025.06',
        stack: 'Vue / TypeScript / Vite',
        bullets: [
          '要点一：把一段足够长的描述放进来，确保条目高度接近真实简历的项目条目。',
          '要点二：再写一句同样长度的描述，让每个项目条目稳定占据三行以上。',
          '要点三：第三句描述，用来把整份简历撑到两页以上以便验证分页。',
        ],
      })
    }
  })
  // 窄屏编辑态下纸面 display:none，量到的高度全是 0；切到预览态必须重新测量并分页
  if (compact) await page.getByRole('button', { name: '预览', exact: true }).click()
  await expect.poll(() => page.locator('.sheet-page').count()).toBeGreaterThan(1)
  const pages = await page.locator('.sheet-page').count()
  await expect(page.locator('.sheet-page-label').first()).toHaveText(`第 1 / ${pages} 页`)
  // 测量层与页码标注都不该出现在纸面上
  await expect(page.locator('.sheet-measure-wrap')).toBeHidden()
})
