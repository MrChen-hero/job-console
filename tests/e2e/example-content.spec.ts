import { expect, test } from '@playwright/test'

test('打开及重新打开演示窗口复用已加载数据', async ({ page }) => {
  await page.goto('/#/showcase')
  await expect(page.locator('.demo-row')).toHaveCount(1)
  await expect(page.locator('.el-loading-mask')).toHaveCount(0)
  await page.evaluate(async () => {
    const modulePath = '/src/storage/db.ts'
    const { db } = await import(/* @vite-ignore */ modulePath)
    Object.assign(window, { deckReads: 0 })
    for (const table of [db.runtimeDemos, db.runtimeProjects]) {
      const original = table.toArray.bind(table)
      table.toArray = (...args: unknown[]) => {
        const state = window as unknown as { deckReads: number }
        state.deckReads++
        return original(...args)
      }
    }
  })
  for (let count = 0; count < 2; count++) {
    await page.locator('.demo-row').getByRole('button', { name: '查看', exact: true }).click()
    await expect(page.locator('.deck-overlay iframe')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.deck-overlay')).toHaveCount(0)
  }
  expect(await page.evaluate(() => (window as unknown as { deckReads: number }).deckReads)).toBe(0)
})

for (const editing of [false, true]) {
  test(`项目${editing ? '编辑' : '新增'}：失败保留输入，保存期间禁止重复提交与关闭`, async ({ page }) => {
    await page.goto('/#/showcase')
    if (editing) {
      const card = page.locator('.proj').filter({ hasText: '企业人事管理系统' })
      await card.locator('.proj-edit').focus()
      await card.locator('.proj-edit').press('Enter')
    } else {
      await page.locator('.proj-add').click()
    }
    const dialog = page.getByRole('dialog', { name: editing ? '编辑项目' : '新增项目', exact: true })
    await dialog.locator('#pe-title').fill('保存重试项目')
    await dialog.locator('#pe-summary').fill('保留的项目介绍')
    await page.evaluate(async () => {
      const modulePath = '/src/storage/db.ts'
      const { db } = await import(/* @vite-ignore */ modulePath)
      const original = db.runtimeProjects.put.bind(db.runtimeProjects)
      db.runtimeProjects.put = () => {
        db.runtimeProjects.put = original
        return Promise.reject(new Error('simulated write failure'))
      }
    })
    await dialog.locator('.pe-save').click()
    await expect(dialog.getByRole('alert')).toContainText('输入已保留')
    await expect(dialog.locator('#pe-summary')).toHaveValue('保留的项目介绍')
    await page.evaluate(async () => {
      const modulePath = '/src/storage/db.ts'
      const { db } = await import(/* @vite-ignore */ modulePath)
      const original = db.runtimeProjects.put.bind(db.runtimeProjects)
      db.runtimeProjects.put = (...args: unknown[]) => new Promise((resolve, reject) => {
        Object.assign(window, { finishProjectSave: () => {
          db.runtimeProjects.put = original
          original(...args).then(resolve, reject)
        } })
      })
    })
    await dialog.locator('.pe-save').click()
    await expect(dialog.locator('.pe-save')).toBeDisabled()
    await expect(dialog.getByRole('button', { name: '取消', exact: true })).toBeDisabled()
    await expect(dialog.locator('.proj-form')).toHaveAttribute('inert', '')
    await page.keyboard.press('Escape')
    await expect(dialog).toBeVisible()
    await page.evaluate(() => (window as unknown as { finishProjectSave: () => void }).finishProjectSave())
    await expect(dialog).toBeHidden()
    await page.reload()
    await expect(page.locator('.proj').filter({ hasText: '保存重试项目' })).toHaveCount(1)
  })
}

test('分类编辑和删除失败可重试，改名与图标刷新后保留', async ({ page }) => {
  await page.goto('/#/library')
  await page.getByRole('button', { name: '管理分类', exact: true }).click()
  const manager = page.getByRole('dialog', { name: '管理分类', exact: true })
  await manager.getByRole('button', { name: '新增分类', exact: true }).click()
  const create = page.getByRole('dialog', { name: '新增分类', exact: true })
  await create.locator('#new-category-name').fill('个人分类')
  await create.getByRole('button', { name: '保存', exact: true }).click()
  await expect(create).toBeHidden()
  await manager.getByRole('button', { name: '编辑分类 个人分类', exact: true }).click()
  const editor = page.getByRole('dialog', { name: '编辑分类', exact: true })
  await editor.locator('#new-category-name').fill('个人复盘')
  await editor.getByRole('button', { name: '图标：星标', exact: true }).click()
  await page.evaluate(async () => {
    const modulePath = '/src/storage/db.ts'
    const { db } = await import(/* @vite-ignore */ modulePath)
    const original = db.libraryCategories.put.bind(db.libraryCategories)
    db.libraryCategories.put = () => {
      db.libraryCategories.put = original
      return Promise.reject(new Error('simulated write failure'))
    }
  })
  await editor.getByRole('button', { name: '保存', exact: true }).click()
  await expect(editor.getByRole('alert')).toContainText('输入已保留')
  await expect(editor.locator('#new-category-name')).toHaveValue('个人复盘')
  await expect(editor.getByRole('button', { name: '图标：星标', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(manager).toContainText('个人分类')
  await editor.getByRole('button', { name: '保存', exact: true }).click()
  await expect(editor).toBeHidden()
  await page.reload()
  await expect(page.locator('.cat-row').filter({ hasText: '个人复盘' }).locator('[data-icon="star"]')).toBeVisible()
  await page.getByRole('button', { name: '管理分类', exact: true }).click()
  await page.evaluate(async () => {
    const modulePath = '/src/storage/db.ts'
    const { db } = await import(/* @vite-ignore */ modulePath)
    const original = db.libraryCategories.delete.bind(db.libraryCategories)
    db.libraryCategories.delete = () => {
      db.libraryCategories.delete = original
      return Promise.reject(new Error('simulated delete failure'))
    }
  })
  await manager.getByRole('button', { name: '删除分类 个人复盘', exact: true }).click()
  const confirm = page.locator('.el-message-box').getByRole('button', { name: '删除', exact: true })
  await confirm.click()
  await expect(manager.getByRole('alert')).toContainText('删除分类「个人复盘」失败，请重试')
  await expect(manager.getByRole('button', { name: '删除分类 个人复盘', exact: true })).toBeEnabled()
  await manager.getByRole('button', { name: '删除分类 个人复盘', exact: true }).click()
  await confirm.click()
  await expect(manager.getByRole('alert')).toHaveCount(0)
  await expect(manager).not.toContainText('个人复盘')
})

test('内置演示可编辑、替换、删除；失败保留输入且不产生重复页', async ({ page }) => {
  await page.goto('/#/showcase')
  await expect(page.locator('.demo-row')).toHaveCount(1)
  await page.locator('.demo-row').getByRole('button', { name: '编辑', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '编辑交互演示' })
  await expect(dialog).toContainText('沿用原有 HTML 内容')
  await dialog.locator('#du-title').fill('我的交互页面')
  await dialog.locator('#du-points').fill('我的业务流程')
  await page.evaluate(async () => {
    const modulePath = '/src/storage/db.ts'
    const { db } = await import(/* @vite-ignore */ modulePath)
    const original = db.runtimeDemos.put.bind(db.runtimeDemos)
    db.runtimeDemos.put = () => {
      db.runtimeDemos.put = original
      return Promise.reject(new Error('simulated write failure'))
    }
  })
  await dialog.locator('.du-save').click()
  await expect(dialog.getByRole('alert')).toContainText('输入已保留')
  await dialog.locator('.du-save').click()
  await expect(dialog).toBeHidden()
  await page.reload()
  await expect(page.locator('.demo-row')).toHaveCount(1)
  await expect(page.locator('.demo-row')).toContainText('我的交互页面')
  await page.locator('.demo-row').getByRole('button', { name: '编辑', exact: true }).click()
  await dialog.locator('input[type="file"]').setInputFiles({ name: 'personal.html', mimeType: 'text/html', buffer: Buffer.from('<html><body>个人演示内容</body></html>') })
  await dialog.locator('.du-save').click()
  await expect(dialog).toBeHidden()
  await page.locator('.demo-row').getByRole('button', { name: '查看', exact: true }).click()
  await expect(page.locator('.deck-overlay').frameLocator('iframe').locator('body')).toContainText('个人演示内容')
  await expect(page.locator('.deck-overlay')).toContainText('我的业务流程')
  await page.keyboard.press('Escape')
  await page.locator('.demo-row').getByRole('button', { name: '删除', exact: true }).click()
  await page.locator('.el-message-box').getByRole('button', { name: '删除', exact: true }).click()
  await expect(page.locator('.demo-row')).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.el-loading-mask')).toHaveCount(0)
  await expect(page.locator('.demo-row')).toHaveCount(0)
})

test('示例项目默认要点可改写或清空，没有恢复示例入口', async ({ page }) => {
  await page.goto('/#/showcase')
  const card = page.locator('.proj').filter({ hasText: '企业人事管理系统' })
  await card.locator('.proj-edit').focus()
  await card.locator('.proj-edit').press('Enter')
  const dialog = page.getByRole('dialog', { name: '编辑项目', exact: true })
  await expect(dialog.locator('#pe-default-points')).not.toHaveValue('')
  await dialog.locator('#pe-title').fill('个人项目')
  await dialog.locator('#pe-default-points').fill('个人项目成果')
  await dialog.locator('.pe-save').click()
  const mine = page.locator('.proj').filter({ hasText: '个人项目' })
  await expect(mine).toBeVisible()
  await expect(page.locator('.proj-reset')).toHaveCount(0)
  await mine.click()
  await expect(page.locator('.deck-overlay')).toContainText('个人项目成果')
  await expect(page.locator('.deck-overlay')).not.toContainText('RBAC 模型')
  await page.keyboard.press('Escape')
  await mine.locator('.proj-edit').focus()
  await mine.locator('.proj-edit').press('Enter')
  await dialog.locator('#pe-default-points').fill('')
  await dialog.locator('.pe-save').click()
  await page.reload()
  await mine.click()
  await expect(page.locator('.deck-overlay')).not.toContainText('个人项目成果')
  await expect(page.locator('.deck-overlay')).not.toContainText('RBAC 模型')
})

test('管理分类：数量、重命名、删除与亮暗主题布局', async ({ page }, testInfo) => {
  await page.goto('/#/library')
  await page.getByRole('button', { name: '管理分类', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '管理分类', exact: true })
  await expect(dialog.locator('.category-manage-row')).toHaveCount(4)
  await expect(dialog).toContainText('4 个分类')
  await expect(dialog.locator('.category-manage-row').filter({ hasText: '自我介绍' })).toContainText('2 篇材料')
  await dialog.getByRole('button', { name: '新增分类', exact: true }).click()
  await page.locator('#new-category-name').fill('个人复盘')
  await page.getByRole('button', { name: '图标：复盘', exact: true }).click()
  await page.getByRole('dialog', { name: '新增分类', exact: true }).getByRole('button', { name: '保存', exact: true }).click()
  await dialog.getByRole('button', { name: '编辑分类 个人复盘', exact: true }).click()
  const editor = page.getByRole('dialog', { name: '编辑分类', exact: true })
  await expect(editor.getByRole('button', { name: '图标：复盘', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await editor.locator('#new-category-name').fill('我的面试复盘与改进记录')
  await editor.getByRole('button', { name: '保存', exact: true }).click()
  await expect(editor).toBeHidden()
  await expect(dialog).toContainText('5 个分类')
  await expect(dialog.locator('.category-manage-row').filter({ hasText: '我的面试复盘与改进记录' }).locator('[data-icon="history"]')).toBeVisible()
  expect(await dialog.locator('.category-manage-row').evaluateAll((rows) => rows.every((row) => row.scrollWidth <= row.clientWidth))).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('categories-light.png'), animations: 'disabled' })
  await dialog.getByRole('button', { name: '完成', exact: true }).click()
  await page.getByRole('button', { name: /切换.*暗|深色/ }).click()
  await page.getByRole('button', { name: '管理分类', exact: true }).click()
  await page.screenshot({ path: testInfo.outputPath('categories-dark.png'), animations: 'disabled' })
  await dialog.getByRole('button', { name: '删除分类 我的面试复盘与改进记录', exact: true }).click()
  await page.locator('.el-message-box').getByRole('button', { name: '删除', exact: true }).click()
  await expect(dialog).toContainText('4 个分类')
  await expect(dialog.getByRole('button', { name: /恢复/ })).toHaveCount(0)
})

test('新增分类选择图标：键盘操作、失败重试与刷新持久化', async ({ page }, testInfo) => {
  await page.goto('/#/library')
  await page.getByRole('button', { name: '管理分类', exact: true }).click()
  await page.getByRole('button', { name: '新增分类', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '新增分类', exact: true })
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('请填写分类名称')
  await dialog.locator('#new-category-name').fill('目标岗位')
  const icon = dialog.getByRole('button', { name: '图标：目标', exact: true })
  await icon.focus()
  await icon.press('Space')
  await expect(icon).toHaveAttribute('aria-pressed', 'true')
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('category-icon-picker.png'), animations: 'disabled' })
  await page.evaluate(async () => {
    const modulePath = '/src/storage/db.ts'
    const { db } = await import(/* @vite-ignore */ modulePath)
    const original = db.libraryCategories.put.bind(db.libraryCategories)
    db.libraryCategories.put = () => {
      db.libraryCategories.put = original
      return Promise.reject(new Error('simulated write failure'))
    }
  })
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('输入已保留')
  await expect(icon).toHaveAttribute('aria-pressed', 'true')
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog).toBeHidden()
  await page.reload()
  await expect(page.locator('.cat-row').filter({ hasText: '目标岗位' }).locator('[data-icon="target"]')).toBeVisible()
  await page.getByRole('button', { name: '管理分类', exact: true }).click()
  await expect(page.locator('.category-manage-row').filter({ hasText: '目标岗位' }).locator('[data-icon="target"]')).toBeVisible()
})
