import { expect, test, type Page } from '@playwright/test'

async function seed(page: Page) {
  await page.goto('/#/')
  await expect(page.locator('.todo-list')).toBeVisible()
  await page.evaluate(async () => {
    const modulePath = '/src/modules/tracker/store.ts'
    const { useTrackerStore } = await import(/* @vite-ignore */ modulePath)
    const store = useTrackerStore()
    for (const [nextStep, nextActionAt] of [['准备面试', '2026-09-09'], ['联系招聘方', '2026-09-10'], ['整理材料', undefined]]) {
      await store.addApplication({ company: '测试企业', position: '研发工程师', batch: '正式批', channel: '官网', appliedAt: '2026-09-01', nextStep, nextActionAt })
    }
  })
  await expect(page.locator('.todo')).toHaveCount(3)
}

async function menu(page: Page, label: string, action: string) {
  const button = page.getByRole('button', { name: `操作待办：${label}`, exact: true })
  await button.focus()
  await button.press('Enter')
  await page.getByRole('menuitem', { name: action, exact: true }).click()
}

async function failNextWrite(page: Page) {
  await page.evaluate(async () => {
    const modulePath = '/src/storage/db.ts'
    const { db } = await import(/* @vite-ignore */ modulePath)
    const original = db.applications.put.bind(db.applications)
    db.applications.put = () => {
      db.applications.put = original
      return Promise.reject(new Error('模拟写入失败，请重试'))
    }
  })
}

test('待办完成、撤销、失败重试与刷新持久化', async ({ page }) => {
  await seed(page)
  await failNextWrite(page)
  await menu(page, '准备面试', '完成待办')
  await expect(page.getByRole('alert')).toContainText('模拟写入失败')
  await expect(page.locator('.todo')).toHaveCount(3)
  await menu(page, '准备面试', '完成待办')
  await expect(page.locator('.todo')).toHaveCount(2)
  await expect(page).toHaveURL(/#\/$/)
  await failNextWrite(page)
  await page.locator('.todo-undo').getByRole('button', { name: '撤销' }).click()
  await expect(page.locator('.todo-undo')).toBeVisible()
  await expect(page.locator('.todo')).toHaveCount(2)
  await page.locator('.todo-undo').getByRole('button', { name: '撤销' }).click()
  await expect(page.locator('.todo')).toHaveCount(3)
  await page.reload()
  await expect(page.locator('.todo').first()).toContainText('准备面试')
  await menu(page, '准备面试', '完成待办')
  await expect(page.locator('.todo')).toHaveCount(2)
  await page.reload()
  await expect(page.locator('.todo')).toHaveCount(2)
  await expect(page.locator('.todo-undo')).toHaveCount(0)
})

test('待办编辑、延期、未排期排序与移动端布局', async ({ page }, testInfo) => {
  await seed(page)
  await expect(page.locator('.todo').last().locator('.todo-date')).toHaveText('未排期')
  await menu(page, '准备面试', '延期')
  let dialog = page.getByRole('dialog', { name: '延期待办', exact: true })
  await dialog.locator('#todo-action-date').fill('2026-09-12')
  await dialog.locator('#todo-action-date').press('Enter')
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page.locator('.todo').first()).toContainText('联系招聘方')
  await menu(page, '准备面试', '编辑下一步')
  dialog = page.getByRole('dialog', { name: '编辑下一步', exact: true })
  await dialog.locator('#todo-action-label').fill('准备技术面试和自我介绍')
  await dialog.locator('#todo-action-date').fill('')
  await dialog.locator('#todo-action-date').press('Tab')
  await failNextWrite(page)
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('模拟写入失败')
  await expect(dialog.locator('#todo-action-label')).toHaveValue('准备技术面试和自我介绍')
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog).toBeHidden()
  await page.reload()
  await expect(page.locator('.todo').filter({ hasText: '准备技术面试和自我介绍' }).locator('.todo-date')).toHaveText('未排期')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const rowsFit = await page.locator('.todo-row').evaluateAll((rows) => rows.every((row) => row.scrollWidth <= row.clientWidth))
  expect(rowsFit).toBe(true)
  await expect(page.locator('.dashboard .el-loading-mask')).toBeHidden()
  await page.screenshot({ path: testInfo.outputPath('todos.png'), fullPage: true, animations: 'disabled' })
  await page.locator('.todo').filter({ hasText: '准备技术面试和自我介绍' }).click()
  await expect(page.getByRole('dialog').filter({ has: page.locator('.kv') })).toContainText('准备技术面试和自我介绍')
})

test('结束投递可保留或清除待办，关闭提示取消操作', async ({ page }) => {
  await seed(page)
  await page.locator('.todo').first().click()
  await page.locator('.drop-btn').click()
  const prompt = page.getByRole('dialog', { name: '处理待办', exact: true })
  await prompt.getByRole('button', { name: '保留待办', exact: true }).click()
  await expect(page.locator('.kv .stage-badge')).toHaveText('挂')
  await expect(page.locator('.kv')).toContainText('准备面试')
  await page.locator('.reopen-btn').click()
  await page.locator('.drop-btn').click()
  await page.keyboard.press('Escape')
  await expect(prompt).toBeHidden()
  await expect(page.locator('.kv .stage-badge')).toHaveText('已投递')
  await page.locator('.drop-btn').click()
  await prompt.getByRole('button', { name: '同时清除待办', exact: true }).click()
  await expect(page.locator('.kv .stage-badge')).toHaveText('挂')
  await expect(page.locator('.kv')).not.toContainText('准备面试')
  await page.goto('/#/')
  await expect(page.locator('.todo')).toHaveCount(2)
})

test('看板结束阶段共用待办提示', async ({ page }) => {
  await seed(page)
  await page.goto('/#/tracker?mode=board')
  const card = page.locator('.board-card').first()
  await card.dispatchEvent('dragstart')
  await page.locator('.board-col[data-column="挂 / 无消息"]').dispatchEvent('drop')
  const prompt = page.getByRole('dialog', { name: '处理待办', exact: true })
  await prompt.getByRole('button', { name: '同时清除待办', exact: true }).click()
  await expect(page.locator('.board-col[data-column="挂 / 无消息"] .board-card')).toHaveCount(1)
  await page.goto('/#/')
  await expect(page.locator('.todo')).toHaveCount(2)
})

test('完成撤销入口在十秒后消失', async ({ page }) => {
  await seed(page)
  await page.clock.install()
  await menu(page, '准备面试', '完成待办')
  await expect(page.locator('.todo-undo')).toBeVisible()
  await page.clock.fastForward(10001)
  await expect(page.locator('.todo-undo')).toHaveCount(0)
  await expect(page.locator('.todo')).toHaveCount(2)
})
