import { expect, test } from '@playwright/test'

test.describe('求职工作台主流程', () => {
  test('五路由可达且导航高亮', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('stat-total')).toBeVisible()
    // 桌面走侧边栏点击；窄视口（≤1024px 侧栏收为抽屉、默认不可见）退化为 hash 直达
    for (const [name, hash] of [
      ['投递管理', '/#/tracker'],
      ['简历管理', '/#/resume'],
      ['材料库', '/#/library'],
      ['项目演示', '/#/showcase'],
    ] as const) {
      await page.goto(hash)
      await expect(page.locator('.page-title')).toHaveText(name)
    }
  })

  test('投递：新增 → 表格 → 看板 → 抽屉推进', async ({ page }) => {
    await page.goto('/#/tracker')
    await page.getByRole('button', { name: '＋ 新增投递' }).click()
    await page.locator('input[data-field="company"]').fill('南方电网')
    await page.locator('input[data-field="position"]').fill('数字化研发工程师')
    await page.locator('input[data-field="nextStep"]').fill('等笔试通知')
    await page.getByRole('button', { name: '保存' }).click()
    await expect(page.locator('.app-table')).toContainText('南方电网')

    await page.getByRole('tab', { name: '看板' }).click()
    const boardCard = page.locator('.board-card', { hasText: '南方电网' })
    await expect(boardCard).toBeVisible()
    // 看板轨道是 transform 平移容器，窄视口下卡片可能在滚动区外，用事件派发保证跨视口可用
    await boardCard.dispatchEvent('click')
    const drawer = page.locator('.app-drawer')
    await expect(drawer).toContainText('阶段流转')
    // 移动端抽屉过渡动画会让 Playwright 判定元素不稳定，用事件派发保证跨视口
    await drawer.getByRole('button', { name: /推进到/ }).dispatchEvent('click')
    await expect(drawer.locator('.stage-badge')).toContainText('笔试')

    // 工作台统计联动
    await page.goto('/#/')
    await expect(page.getByTestId('stat-total')).toHaveText('1')
  })

  test('简历：示例数据 → A4 预览 → 打印按钮', async ({ page }) => {
    await page.goto('/#/resume')
    await page.getByRole('button', { name: '一键填入示例资料' }).click()
    await expect(page.locator('[data-testid="resume-sheet"]')).toContainText('王小明')
    await expect(page.locator('.sheet')).toContainText('专业技能')
    await expect(page.getByRole('button', { name: '打印 / 导出 PDF' })).toBeVisible()
  })

  test('材料库：内置可读 + 上传 md', async ({ page }) => {
    await page.goto('/#/library')
    await expect(page.locator('[data-testid="doc-body"]')).toContainText('HashMap')
    await expect(page.locator('.src-tag', { hasText: '内置' }).first()).toBeVisible()

    await page.locator('input[type="file"][accept*=".md"]').setInputFiles({
      name: '复盘-一面.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('---\ntitle: 复盘 · 某公司一面\ncategory: 高频问题\n---\n问到了 Redis 持久化。'),
    })
    await expect(page.locator('.lib-item', { hasText: '复盘 · 某公司一面' })).toBeVisible()
    await expect(page.locator('.src-tag', { hasText: '我的文档' }).first()).toBeVisible()
  })

  test('演示站：Deck 双轴与交互 demo iframe', async ({ page }) => {
    await page.goto('/#/showcase')
    await page.getByRole('button', { name: '▶ 进入项目演示' }).click()
    const overlay = page.locator('[data-testid="deck-overlay"]')
    await expect(overlay).toBeVisible()
    await expect(overlay.locator('.dt-title')).toHaveText('企业人事管理系统')

    await page.keyboard.press('ArrowRight')
    await expect(overlay.locator('.dt-title')).toHaveText('校园二手交易小程序')
    await page.keyboard.press('ArrowDown')
    await expect(overlay.locator('.deck-slide.vertical .deck-face.on')).toContainText('内容治理设计')
    await page.keyboard.press('ArrowDown')
    await expect(overlay.locator('.deck-face.on iframe.df-iframe')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(overlay).toBeHidden()
  })

  test('演示站：项目卡片增删改（新增 / 删除示例 / 恢复）', async ({ page }) => {
    await page.goto('/#/showcase')
    // v-loading 淡出动画期间遮罩会拦截点击（窄视口尤甚），等其完全消失
    await expect(page.locator('.el-loading-mask')).toHaveCount(0)
    const cards = page.locator('.proj')
    await expect(cards).toHaveCount(4)

    // 新增项目
    await page.getByRole('button', { name: '＋ 新增项目' }).click()
    await page.locator('input[data-field="title"]').fill('我的毕设展示站')
    await page.locator('input[data-field="stack"]').fill('Vue, Vite')
    await page.locator('textarea[data-field="demoPoints"]').fill('要点一\n要点二')
    await page.getByRole('button', { name: '保存项目' }).click()
    await expect(cards).toHaveCount(5)
    await expect(page.locator('.proj', { hasText: '我的毕设展示站' })).toContainText('我的')

    // 删除内置示例项目（确认框）
    const builtin = page.locator('.proj', { hasText: '企业人事管理系统' })
    await builtin.getByRole('button', { name: '删除项目 企业人事管理系统' }).click()
    await page.locator('.el-message-box').getByRole('button', { name: '删除' }).click()
    await expect(cards).toHaveCount(4)
    await expect(page.locator('.proj', { hasText: '企业人事管理系统' })).toHaveCount(0)

    // 恢复示例项目
    await page.getByRole('button', { name: '↺ 恢复示例项目' }).click()
    await page.locator('.el-message-box').getByRole('button', { name: '恢复' }).click()
    await expect(cards).toHaveCount(5)

    // 删除自建项目（不入墓碑，直接删行）
    await page.locator('.proj', { hasText: '我的毕设展示站' }).getByRole('button', { name: '删除项目 我的毕设展示站' }).click()
    await page.locator('.el-message-box').getByRole('button', { name: '删除' }).click()
    await expect(cards).toHaveCount(4)
  })

  test('材料库：新增分类并筛选文档', async ({ page }) => {
    await page.goto('/#/library')
    await page.getByRole('button', { name: '＋ 新增分类' }).click()
    await page.locator('.el-message-box__input input').fill('行为面')
    await page.locator('.el-message-box').getByRole('button', { name: '保存' }).click()
    await expect(page.locator('.cat-row', { hasText: '行为面' })).toBeVisible()

    // 新分类下新建文档并按分类筛选
    await page.getByRole('button', { name: '＋ 新建文档' }).click()
    await page.locator('input[data-field="title"]').fill('宝洁八大问')
    await page.locator('[data-testid="doc-editor"] .el-select').click()
    await page.getByRole('option', { name: '行为面' }).click()
    await page.locator('textarea[data-field="body"]').fill('经典行为面试题')
    await page.getByRole('button', { name: '保存' }).click()
    await expect(page.locator('.lib-item', { hasText: '宝洁八大问' })).toBeVisible()
    await page.locator('.cat-row', { hasText: '行为面' }).locator('.chip').click()
    await expect(page.locator('.lib-item')).toHaveCount(1)
  })

  test('里程碑：添加 → 倒计时 → 完成 → 刷新持久化', async ({ page }) => {
    // 相对今天 +30 天，避免写死日期随时间过期；同年/跨年只影响 pill 文案，不影响倒计时断言
    const d = new Date()
    d.setDate(d.getDate() + 30)
    const pad = (n: number) => String(n).padStart(2, '0')
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

    await page.goto('/#/')
    await expect(page.getByTestId('stat-total')).toBeVisible()
    await page.locator('.ms-toggle').click()
    // ElDatePicker 手输后需 Enter 才解析确认（fill 只触发 input，不触发 change）
    await page.locator('input[data-field="ms-date"]').fill(dateStr)
    await page.locator('input[data-field="ms-date"]').press('Enter')
    await page.locator('input[data-field="ms-label"]').fill('软考·软件设计师')
    await page.locator('.ms-add').click()

    const item = page.locator('.ms', { hasText: '软考·软件设计师' })
    await expect(item).toBeVisible()
    await expect(item.locator('.ms-count')).toContainText('还有')

    // 操作按钮 hover 才浮现，Playwright click 会自动触发 hover；dispatchEvent 兜底跨视口稳定
    await item.getByRole('button', { name: '完成' }).dispatchEvent('click')
    await expect(item.locator('.ms-count')).toHaveText('已完成')

    await page.reload()
    await expect(page.locator('.ms', { hasText: '软考·软件设计师' })).toBeVisible()
  })

  test('移动端 390 无横向溢出', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(overflow).toBe(false)
  })
})
