import { expect, test, type Page } from '@playwright/test'

async function navigate(page: Page, name: string) {
  const menu = page.getByRole('button', { name: '打开导航', exact: true })
  if (await menu.isVisible()) await menu.click()
  await page.locator('.nav-item').filter({ hasText: name }).click()
}

async function seedResume(page: Page) {
  await page.goto('/#/resume')
  await expect(page.getByRole('button', { name: '从空白开始' })).toBeVisible()
  await page.evaluate(async () => {
    const modulePath = '/src/modules/resume/store.ts'
    const { useResumeStore } = await import(/* @vite-ignore */ modulePath)
    const store = useResumeStore()
    await store.ensureProfile('已保存姓名')
  })
  await expect(page.locator('input[data-field="name"]')).toHaveValue('已保存姓名')
}

async function failNextWrite(page: Page, table: 'profile' | 'applications') {
  await page.evaluate(async (table) => {
    const modulePath = '/src/storage/db.ts'
    const { db } = await import(/* @vite-ignore */ modulePath)
    const original = db[table].put.bind(db[table])
    db[table].put = (...args: unknown[]) => {
      db[table].put = original
      return Promise.reject(new Error(`simulated ${table} write failure: ${args.length}`))
    }
  }, table)
}

test('简历：版本切换、离开、刷新保护与打印选择', async ({ page }) => {
  await seedResume(page)
  await page.evaluate(async () => {
    const modulePath = '/src/modules/resume/store.ts'
    const { useResumeStore } = await import(/* @vite-ignore */ modulePath)
    await useResumeStore().createVersion('第二版本', '')
    window.print = () => { document.documentElement.dataset.printed = document.querySelector('.sheet')?.textContent ?? '' }
  })
  const name = page.locator('input[data-field="name"]')
  await name.fill('待保存姓名')
  expect(await page.evaluate(() => !window.dispatchEvent(new Event('beforeunload', { cancelable: true })))).toBe(true)
  await page.getByRole('button', { name: '默认版本', exact: true }).click()
  let dialog = page.getByRole('dialog', { name: '保存简历修改？' })
  await dialog.getByRole('button', { name: '继续编辑' }).click()
  await expect(name).toHaveValue('待保存姓名')
  await expect(page.locator('.resume-current')).toContainText('第二版本')
  await page.getByRole('button', { name: '默认版本', exact: true }).click()
  await dialog.getByRole('button', { name: '保存并继续' }).click()
  await expect(page.locator('.resume-current')).toContainText('默认版本')
  await expect(name).toHaveValue('已保存姓名')
  await page.getByRole('button', { name: '第二版本', exact: true }).click()
  await expect(name).toHaveValue('待保存姓名')

  await name.fill('打印草稿')
  await page.locator('.print-btn').click()
  dialog = page.getByRole('dialog', { name: '打印前有未保存修改' })
  await dialog.getByRole('button', { name: '打印已保存内容' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-printed', /待保存姓名/)
  await expect(name).toHaveValue('打印草稿')
  await page.locator('.print-btn').click()
  await dialog.getByRole('button', { name: '保存后打印' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-printed', /打印草稿/)
  await expect(page.locator('.resume-current')).toContainText('已保存到本机')

  await name.fill('放弃的草稿')
  await navigate(page, '材料库')
  await page.getByRole('dialog', { name: '保存简历修改？' }).getByRole('button', { name: '放弃修改' }).click()
  await expect(page).toHaveURL(/library/)
  await navigate(page, '简历管理')
  await expect(name).toHaveValue('打印草稿')
})

test('简历：基本信息和条目保存失败保留输入，可直接重试', async ({ page }) => {
  await seedResume(page)
  const name = page.locator('input[data-field="name"]')
  await name.fill('新姓名')
  await failNextWrite(page, 'profile')
  await page.locator('.basic-save').click()
  await expect(page.locator('.resume-current')).toContainText('保存失败')
  await expect(name).toHaveValue('新姓名')
  await expect(page.locator('.sheet')).toContainText('已保存姓名')
  await page.locator('.basic-save').click()
  await expect(page.locator('.resume-current')).toContainText('已保存到本机')
  await expect(page.locator('.sheet')).toContainText('新姓名')

  await page.getByRole('button', { name: /教育背景/ }).click()
  await page.locator('.add-entry').click()
  const dialog = page.getByRole('dialog', { name: '添加 · 教育背景' })
  await dialog.locator('#dlg-school').fill('示例大学')
  await dialog.locator('#dlg-degree').fill('本科')
  await dialog.locator('#dlg-time').fill('2020—2024')
  expect(await page.evaluate(() => !window.dispatchEvent(new Event('beforeunload', { cancelable: true })))).toBe(true)
  await failNextWrite(page, 'profile')
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('输入已保留')
  await expect(dialog.locator('#dlg-school')).toHaveValue('示例大学')
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page.locator('.entry-card')).toContainText('示例大学')
})

test('投递：新增保存和阶段推进失败后可重试', async ({ page }) => {
  await page.goto('/#/tracker')
  await page.getByRole('button', { name: /新增投递/ }).click()
  const dialog = page.getByRole('dialog', { name: '新增投递' })
  await dialog.locator('#af-company').fill('重试示例公司')
  await dialog.locator('#af-position').fill('开发工程师')
  await failNextWrite(page, 'applications')
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('输入已保留')
  await expect(dialog.locator('#af-company')).toHaveValue('重试示例公司')
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog).toBeHidden()
  if (page.viewportSize()!.width <= 720) await page.locator('.mobile-app-open').click()
  else await page.locator('.app-table .app-row').click()
  const drawer = page.locator('.app-drawer')
  await failNextWrite(page, 'applications')
  await drawer.locator('.advance-btn').click()
  await expect(drawer.getByRole('alert')).toContainText('操作失败')
  await expect(drawer.locator('.tl-item')).toHaveCount(1)
  await drawer.locator('.advance-btn').click()
  await expect(drawer.locator('.tl-item')).toHaveCount(2)
})

test('材料：预览清理 HTML 事件属性并保留正常排版', async ({ page }) => {
  await page.goto('/#/library')
  await page.evaluate(async () => {
    const modulePath = '/src/modules/library/store.ts'
    const { useLibraryStore } = await import(/* @vite-ignore */ modulePath)
    await useLibraryStore().upsertDoc({ category: '高频问题', title: '内容清理验证', body: '# 正常标题\n\n<strong>重点</strong><img src="data:image/png;base64,AA==" onerror="document.documentElement.dataset.injected=1"><a href="javascript:void(0)">危险链接</a>', tags: [] })
  })
  await page.getByRole('textbox', { name: '搜索材料' }).fill('内容清理验证')
  await page.locator('.lib-item').click()
  const body = page.getByTestId('doc-body')
  await expect(body.locator('h1')).toHaveText('正常标题')
  await expect(body.locator('strong')).toHaveText('重点')
  await expect(body.locator('[onerror], a[href^="javascript:"]')).toHaveCount(0)
  await expect(page.locator('html')).not.toHaveAttribute('data-injected')
})

test('演示：本站链接限制权限，旧危险链接拒绝展示，要点清理事件属性', async ({ page }) => {
  await page.goto('/#/showcase')
  await expect(page.locator('.el-loading-mask')).toHaveCount(0)
  await page.evaluate(async () => {
    const demoPath = '/src/modules/showcase/demoStore.ts'
    const projectPath = '/src/modules/showcase/projectStore.ts'
    const { useDemoStore } = await import(/* @vite-ignore */ demoPath)
    const { useProjectStore } = await import(/* @vite-ignore */ projectPath)
    const projectId = useProjectStore().visible[0].id
    await useDemoStore().addDemo({ projectId, title: '本站链接验证', html: '', url: `${location.origin}/favicon.png`, points: ['<b onclick="void(0)">安全要点</b>'] })
    // 模拟旧版本已存入的非法 URL；展示入口必须独立拒绝。
    await useDemoStore().addDemo({ projectId, title: '旧链接验证', html: '', url: 'javascript:void(0)' })
  })
  await page.locator('.demo-row', { hasText: '本站链接验证' }).getByRole('button', { name: '查看' }).click()
  const face = page.locator('.deck-slide.current .deck-face.on')
  await expect(face.locator('iframe')).toHaveAttribute('sandbox', 'allow-scripts')
  await expect(face.locator('.df-points b')).toHaveText('安全要点')
  await expect(face.locator('[onclick]')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.locator('.demo-row', { hasText: '旧链接验证' }).getByRole('button', { name: '查看' }).click()
  await expect(face.getByRole('alert')).toContainText('演示链接无效')
  await expect(face.locator('iframe, .df-open-tab')).toHaveCount(0)
})

test('加载失败后展示错误，重试可以恢复工作台和简历', async ({ page }) => {
  await page.goto('/#/library')
  await page.evaluate(async () => {
    for (const [modulePath, storeName] of [['/src/modules/tracker/store.ts', 'useTrackerStore'], ['/src/modules/resume/store.ts', 'useResumeStore']]) {
      const mod = await import(/* @vite-ignore */ modulePath!)
      const store = mod[storeName!]()
      const original = store.load.bind(store)
      store.load = async () => { store.load = original; throw new Error('simulated read failure') }
    }
  })
  await navigate(page, '工作台')
  await expect(page.locator('.dashboard').getByRole('alert')).toContainText('加载失败')
  await page.getByRole('button', { name: '重新加载' }).click()
  await expect(page.locator('.dashboard').getByRole('alert')).toHaveCount(0)
  await navigate(page, '简历管理')
  await expect(page.locator('.resume-view').getByRole('alert')).toContainText('加载失败')
  await page.getByRole('button', { name: '重新加载' }).click()
  await expect(page.getByRole('button', { name: '从空白开始' })).toBeVisible()
})
