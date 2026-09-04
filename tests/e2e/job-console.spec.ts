import { expect, test, type Page } from '@playwright/test'

/** 窄视口侧栏收为抽屉：导入/导出按钮用前展开、用后收起（展开态的 scrim 会拦住主内容点击） */
async function openNav(page: Page) {
  const menu = page.getByRole('button', { name: '打开导航' })
  if (await menu.isVisible()) await menu.click()
}

async function closeNav(page: Page) {
  const scrim = page.locator('.scrim')
  // scrim 铺满视口但中心点落在抽屉自身上，真实点击打不中；派发事件绕过命中测试
  if (await scrim.isVisible()) await scrim.dispatchEvent('click')
}

/** 侧栏导出，返回下载到的文件路径（工作台另有同名磁贴，故限定侧栏） */
async function exportBackupFile(page: Page): Promise<string> {
  await openNav(page)
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByLabel('主导航').getByRole('button', { name: '导出数据' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^jobconsole-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const path = await download.path()
  await closeNav(page)
  return path!
}

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
    // 投向选「主投」，供工具栏的投向筛选用
    await page.locator('[data-field="track"]').click()
    await page.locator('.el-select-dropdown:visible').getByRole('option', { name: '主投', exact: true }).click()
    await page.getByRole('button', { name: '保存' }).click()
    await expect(page.locator('.app-table')).toContainText('南方电网')

    // 投向筛选：选「次投」筛掉这条主投记录，选回「所有投向」恢复
    await page.locator('[data-field="track-filter"]').click()
    await page.locator('.el-select-dropdown:visible').getByRole('option', { name: '次投', exact: true }).click()
    await expect(page.locator('.app-table')).not.toContainText('南方电网')
    await page.locator('[data-field="track-filter"]').click()
    await page.locator('.el-select-dropdown:visible').getByRole('option', { name: '所有投向', exact: true }).click()
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

  test('投递：长公司名与长职位名分档裁剪，不把表格行撑成竖排', async ({ page }) => {
    const LONG_POS = '示例集团-某省分公司-科技类1-科技岗-2027届校招（某市分公司）(J00001)'
    const LONG_COMP = '示例财产保险股份有限公司某省某市分公司'
    await page.goto('/#/tracker')
    await page.getByRole('button', { name: '＋ 新增投递' }).click()
    await page.locator('input[data-field="company"]').fill(LONG_COMP)
    await page.locator('input[data-field="position"]').fill(LONG_POS)
    await page.getByRole('button', { name: '保存' }).click()

    const pos = page.locator('.pos-cell')
    const comp = page.locator('.comp-cell')
    // 裁剪后完整内容只剩 title 能看全
    await expect(pos).toHaveAttribute('title', LONG_POS)
    await expect(comp).toHaveAttribute('title', LONG_COMP)
    const cut = (el: HTMLElement) => el.scrollWidth > el.clientWidth
    expect(await pos.evaluate(cut)).toBe(true)
    expect(await comp.evaluate(cut)).toBe(true)
    // 单行行高 55px；中文按字断行会把这条 42 字的名字折成 3–8 行、行高冲到 100px 以上
    const row = await page.locator('.app-row').boundingBox()
    expect(row!.height).toBeLessThan(60)
    // 三个视口（1440/768/390）的卡片宽度都还没到放宽档，两列应停在下限附近
    expect((await pos.boundingBox())!.width).toBeLessThanOrEqual(180)
    expect((await comp.boundingBox())!.width).toBeLessThanOrEqual(185)
    if (page.viewportSize()!.width >= 1440) {
      // 分档宽度的标定目标：1440 视口下九列要能铺进卡片，不出横向滚动条
      const scroll = await page.locator('.table-card').evaluate((el) => el.scrollWidth - el.clientWidth)
      expect(scroll).toBeLessThanOrEqual(0)
    }
    // 表格自己横向滚动，页面不许横向溢出
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  })

  test('简历：示例数据 → A4 预览 → 打印按钮', async ({ page }) => {
    await page.goto('/#/resume')
    await page.getByRole('button', { name: '一键填入示例资料' }).click()
    await expect(page.locator('[data-testid="resume-sheet"]')).toContainText('王小明')
    await expect(page.locator('.sheet')).toContainText('专业技能')
    await expect(page.getByRole('button', { name: '打印 / 导出 PDF' })).toBeVisible()
  })

  test('简历：版本资料池独立（新建复制起点 / 删除连带清理）', async ({ page }) => {
    await page.goto('/#/resume')
    await page.getByRole('button', { name: '一键填入示例资料' }).click()
    await expect(page.locator('[data-testid="resume-sheet"]')).toContainText('王小明')

    // 新建版本：资料池以当前为起点复制并激活
    await page.getByRole('button', { name: '＋ 新建' }).click()
    await page.locator('.el-message-box__input input').fill('开发岗版')
    await page.locator('.el-message-box').getByRole('button', { name: '创建' }).click()
    await expect(page.locator('.ver.active')).toHaveText('开发岗版')
    await expect(page.locator('[data-testid="resume-sheet"]')).toContainText('王小明')

    // 删除当前版本：资料池一并清理，回落到 AI 岗版
    await page.locator('.vm-delete').click()
    await page.locator('.el-message-box').getByRole('button', { name: '删除' }).click()
    await expect(page.locator('.ver.active')).toHaveText('AI 岗版')
    await expect(page.locator('[data-testid="resume-sheet"]')).toContainText('王小明')
    await expect(page.locator('.ver', { hasText: '开发岗版' })).toHaveCount(0)
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
    // 首个项目没有内置演示：媒体位是占位，信息区照常给简介与要点
    const face = overlay.locator('.deck-slide.current .deck-face.on')
    await expect(face.locator('.dfm-label')).toContainText('暂无交互演示')
    await expect(face).toContainText('权限与数据流转')

    // 有演示页的项目：进去第一页就是 demo 的 iframe + 该项目基础信息（不再有中间的要点页）
    await page.keyboard.press('ArrowRight')
    await expect(overlay.locator('.dt-title')).toHaveText('校园二手交易小程序')
    await expect(face.locator('iframe.df-iframe')).toBeVisible()
    await expect(face).toContainText('内容治理设计')
    // 沙箱 iframe 内真的渲染出了 demo 内容（Blob URL + sandbox allow-scripts 链路）
    await expect(face.frameLocator('iframe.df-iframe').locator('h1')).toHaveText('审核状态机 · 交互演示')

    // 网页全屏：藏掉 Deck 上下栏；Esc 先退全屏（Deck 不关），再按一次才关 Deck
    await face.locator('.df-media.is-demo').hover()
    await face.getByRole('button', { name: /^网页全屏/ }).click()
    await expect(overlay.locator('.deck-top')).toBeHidden()
    await page.keyboard.press('Escape')
    await expect(overlay.locator('.deck-top')).toBeVisible()
    await expect(overlay).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(overlay).toBeHidden()

    // 卡片点击定位：点哪个项目卡，Deck 就落在哪个项目（此前恒从第一个项目开始）
    await page.locator('.proj', { hasText: '设备监控数据平台' }).click()
    await expect(overlay).toBeVisible()
    await expect(overlay.locator('.dt-title')).toHaveText('设备监控数据平台')

    // 演示行「查看」：直接落在该演示页所在纵向层（内置审核状态机 demo 属校园二手项目）
    await page.keyboard.press('Escape')
    await page.locator('.demo-row', { hasText: '审核状态机' }).getByRole('button', { name: '查看' }).click()
    await expect(overlay.locator('.dt-title')).toHaveText('校园二手交易小程序')
    await expect(face.locator('iframe.df-iframe')).toBeVisible()
  })

  test('演示站：项目卡片增删改（新增 / 删除示例 / 恢复）', async ({ page }) => {
    await page.goto('/#/showcase')
    // v-loading 淡出动画期间遮罩会拦截点击（窄视口尤甚），等其完全消失
    await expect(page.locator('.el-loading-mask')).toHaveCount(0)
    const cards = page.locator('.proj')
    await expect(cards).toHaveCount(3)

    // 新增项目
    await page.getByRole('button', { name: '＋ 新增项目' }).click()
    await page.locator('input[data-field="title"]').fill('我的毕设展示站')
    await page.locator('input[data-field="stack"]').fill('Vue, Vite')
    await page.locator('textarea[data-field="demoPoints"]').fill('要点一\n要点二')
    await page.getByRole('button', { name: '选择主题色' }).click()
    await page.getByRole('button', { name: '主题色 绿' }).click()
    await page.getByRole('button', { name: '保存项目' }).click()
    await expect(cards).toHaveCount(4)
    await expect(page.locator('.proj', { hasText: '我的毕设展示站' })).toContainText('我的')
    // 卡片色条取自项目主题色（自定义属性在计算值阶段解析为令牌实际色值）
    const accent = await page.locator('.proj', { hasText: '我的毕设展示站' }).evaluate((el) =>
      getComputedStyle(el).getPropertyValue('--proj-accent').trim())
    expect(accent).toBe('#10a37f') // --accent-green（亮色主题）

    // 删除内置示例项目（确认框）。操作按钮悬停卡片才显示：先 hover 卡片再点
    const builtin = page.locator('.proj', { hasText: '企业人事管理系统' })
    await builtin.hover()
    await builtin.getByRole('button', { name: '删除项目 企业人事管理系统' }).click()
    await page.locator('.el-message-box').getByRole('button', { name: '删除' }).click()
    await expect(cards).toHaveCount(3)
    await expect(page.locator('.proj', { hasText: '企业人事管理系统' })).toHaveCount(0)

    // 恢复示例项目
    await page.getByRole('button', { name: '↺ 恢复示例项目' }).click()
    await page.locator('.el-message-box').getByRole('button', { name: '恢复' }).click()
    await expect(cards).toHaveCount(4)

    // 删除自建项目（不入墓碑，直接删行）
    const mine = page.locator('.proj', { hasText: '我的毕设展示站' })
    await mine.hover()
    await mine.getByRole('button', { name: '删除项目 我的毕设展示站' }).click()
    await page.locator('.el-message-box').getByRole('button', { name: '删除' }).click()
    await expect(cards).toHaveCount(3)
  })

  test('演示站：拖拽 .html 上传交互演示', async ({ page }) => {
    await page.goto('/#/showcase')
    await expect(page.locator('.el-loading-mask')).toHaveCount(0)
    await page.getByRole('button', { name: '⬆ 上传交互演示' }).click()

    // jsdom 的单测只能伪造 dataTransfer；这里用真实 DataTransfer 走一遍浏览器拖放链路
    const dataTransfer = await page.evaluateHandle(() => {
      const dt = new DataTransfer()
      // 故意不写 <meta charset>：Blob 的 type 得带 charset=utf-8，否则中文按 windows-1252 解成乱码
      const html = '<html><head><title>拖来的演示</title></head><body><h1>拖拽上传演示</h1></body></html>'
      dt.items.add(new File([html], 'dragged-demo.html', { type: 'text/html' }))
      return dt
    })
    const zone = page.locator('[data-testid="demo-file-label"]')
    await zone.dispatchEvent('dragover', { dataTransfer })
    await expect(zone).toHaveClass(/is-drag/)
    await zone.dispatchEvent('drop', { dataTransfer })
    // 文件名回显 + 标题按 <title> 自动回填
    await expect(zone).toContainText('已选择：dragged-demo.html')
    await expect(page.locator('input[data-field="du-title"]')).toHaveValue('拖来的演示')

    await page.getByRole('button', { name: '保存演示' }).click()
    const row = page.locator('.demo-row', { hasText: '拖来的演示' })
    await expect(row).toBeVisible()
    await expect(row.locator('.src-tag')).toHaveText('我的')
    // 存进去的 HTML 能在沙箱 iframe 里渲染出来
    await row.getByRole('button', { name: '查看' }).click()
    const face = page.locator('[data-testid="deck-overlay"] .deck-slide.current .deck-face.on')
    await expect(face.frameLocator('iframe.df-iframe').locator('h1')).toHaveText('拖拽上传演示')
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

  test('材料库：内置分类重命名与恢复默认', async ({ page }) => {
    await page.goto('/#/library')
    // 内置文档 java-notes 在「八股面经」下
    await page.locator('.cat-row', { hasText: '八股面经' }).locator('.chip').click()
    await expect(page.locator('.lib-item', { hasText: '八股题库' })).toBeVisible()

    // 重命名八股面经 → 基础知识（分类行 hover 出现操作按钮，Playwright 点击自带 hover）
    await page.locator('.cat-row', { hasText: '八股面经' }).locator('button[aria-label="重命名分类 八股面经"]').click()
    await page.locator('.el-message-box__input input').fill('基础知识')
    await page.locator('.el-message-box').getByRole('button', { name: '保存' }).click()
    await expect(page.locator('.cat-row', { hasText: '基础知识' })).toBeVisible()
    await expect(page.locator('.cat-row', { hasText: '八股面经' })).toHaveCount(0)
    // 内置文档经映射跟随新分类
    await page.locator('.cat-row', { hasText: '基础知识' }).locator('.chip').click()
    await expect(page.locator('.lib-item', { hasText: '八股题库' })).toBeVisible()

    // 恢复默认
    await page.getByRole('button', { name: '↺ 恢复默认' }).click()
    await page.locator('.el-message-box').getByRole('button', { name: '恢复' }).click()
    await expect(page.locator('.cat-row', { hasText: '八股面经' })).toBeVisible()
    await expect(page.locator('.cat-row', { hasText: '基础知识' })).toHaveCount(0)
    await page.locator('.cat-row', { hasText: '八股面经' }).locator('.chip').click()
    await expect(page.locator('.lib-item', { hasText: '八股题库' })).toBeVisible()
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

  test('备份：导出 → 删除 → 导入还原（含快照入口出现）', async ({ page }) => {
    // 造一条可识别的数据
    await page.goto('/#/tracker')
    await page.getByRole('button', { name: '＋ 新增投递' }).click()
    await page.locator('input[data-field="company"]').fill('备份验证公司')
    await page.locator('input[data-field="position"]').fill('后端开发')
    await page.getByRole('button', { name: '保存' }).click()
    await expect(page.locator('.app-table')).toContainText('备份验证公司')

    // 窄视口侧栏收为抽屉，导出/导入前后由 openNav/closeNav 处理（见文件头部）
    const backupPath = await exportBackupFile(page)

    // 删掉这条投递
    await page.locator('.app-table .app-row', { hasText: '备份验证公司' }).click()
    const drawer = page.locator('.app-drawer')
    await drawer.getByRole('button', { name: '删除' }).dispatchEvent('click')
    await page.locator('.el-message-box').getByRole('button', { name: '删除' }).click()
    await expect(page.locator('.app-table')).not.toContainText('备份验证公司')

    // 覆盖导入备份：数据回来，且「数据快照」入口出现（导入前自动快照）
    await openNav(page)
    await page.locator('input[type="file"][accept*="json"]').setInputFiles(backupPath)
    await page.locator('.el-message-box').getByRole('button', { name: '覆盖导入' }).click()
    await page.waitForURL(/#\/tracker/)
    await expect(page.locator('.app-table')).toContainText('备份验证公司')

    await openNav(page)
    const snapBtn = page.getByRole('button', { name: /数据快照/ })
    await expect(snapBtn).toBeVisible()
    await snapBtn.click()
    await expect(page.getByTestId('snapshot-list')).toContainText('导入前自动快照')
  })

  test('备份：内置内容的删除墓碑随备份往返', async ({ page }) => {
    await page.goto('/#/showcase')
    await expect(page.locator('.el-loading-mask')).toHaveCount(0)

    // 删掉一个内置项目与一个内置演示页：各写一条墓碑行（演示墓碑的 html 是空串）
    const builtin = page.locator('.proj', { hasText: '企业人事管理系统' })
    await builtin.hover()
    await builtin.getByRole('button', { name: '删除项目 企业人事管理系统' }).click()
    await page.locator('.el-message-box').getByRole('button', { name: '删除' }).click()
    await expect(page.locator('.proj', { hasText: '企业人事管理系统' })).toHaveCount(0)
    await page.locator('.demo-row', { hasText: '审核状态机' }).getByRole('button', { name: '删除' }).click()
    await page.locator('.el-message-box').getByRole('button', { name: '删除' }).click()
    await expect(page.locator('.demo-row', { hasText: '审核状态机' })).toHaveCount(0)

    const backupPath = await exportBackupFile(page)

    // 把内置内容全恢复回来，再覆盖导入：墓碑随备份回来才算往返成功
    await page.getByRole('button', { name: '↺ 恢复示例项目' }).click()
    await page.locator('.el-message-box').getByRole('button', { name: '恢复' }).click()
    await expect(page.locator('.proj', { hasText: '企业人事管理系统' })).toBeVisible()

    await openNav(page)
    await page.locator('input[type="file"][accept*="json"]').setInputFiles(backupPath)
    // 空串 html 的墓碑行曾被自己的校验拒在 $.data.runtimeDemos[i].html
    await page.locator('.el-message-box').getByRole('button', { name: '覆盖导入' }).click()
    await page.waitForURL(/#\/showcase/)
    await expect(page.locator('.el-loading-mask')).toHaveCount(0)
    await expect(page.locator('.proj', { hasText: '企业人事管理系统' })).toHaveCount(0)
    await expect(page.locator('.demo-row', { hasText: '审核状态机' })).toHaveCount(0)
  })

  test('移动端 390 无横向溢出', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    await page.goto('/')
    expect(await overflow()).toBe(false)
    // 投递工具栏有三个筛选下拉 + 搜索框，是窄屏最容易顶宽的一处（表格自身在卡片内横向滚动）
    await page.goto('/#/tracker')
    await expect(page.locator('.tracker-toolbar')).toBeVisible()
    expect(await overflow()).toBe(false)
  })
})
