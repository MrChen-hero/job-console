#!/usr/bin/env node
/**
 * 演示页运行时冒烟：按演示站真实条件（Blob URL + sandbox="allow-scripts"）加载页面，
 * 点一遍所有按钮，检查有无 JS 错误与横向溢出。静态自检查不出的运行期问题靠这里兜。
 *
 * 用法：node .claude/skills/showcase-demo-page/scripts/smoke-demo.mjs <file.html>
 * 依赖：仓库已有的 @playwright/test。退出码 0 = 通过，1 = 有问题，2 = 用法错误。
 */
import { chromium } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'

const file = process.argv[2]
if (!file || !existsSync(file)) {
  console.error('用法：smoke-demo.mjs <file.html>')
  process.exit(2)
}

// 1000×520 近似 Deck 常态可用区，1440×900 近似网页/屏幕全屏，390×844 是移动端
const VIEWPORTS = [[1000, 520], [1440, 900], [390, 844]]
const MAX_CLICKS = 40

const html = readFileSync(file, 'utf8')
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: VIEWPORTS[0][0], height: VIEWPORTS[0][1] } })
const problems = []
page.on('pageerror', (e) => problems.push(`JS 异常：${e.message}`))
page.on('console', (m) => { if (m.type() === 'error') problems.push(`console.error：${m.text()}`) })

await page.setContent('<!doctype html><body style="margin:0"><iframe id="f" style="width:100%;height:100vh;border:0" sandbox="allow-scripts" allowfullscreen></iframe>')
await page.evaluate((src) => {
  document.getElementById('f').src = URL.createObjectURL(new Blob([src], { type: 'text/html' }))
}, html)

const frame = () => page.frame({ url: /^blob:/ })
// 父页读不到沙箱 iframe 的 contentDocument（不透明源），只能经 Playwright 的 frame API 探活
const body = page.frameLocator('#f').locator('body')
try {
  await body.waitFor({ timeout: 5000 })
  const text = (await body.innerText()).trim()
  console.log(`正文 ${text.length} 字`)
  if (text.length < 20) problems.push(`正文只有 ${text.length} 字：页面几乎没渲染出内容`)
} catch {
  problems.push('5 秒内没能取到演示页 body：脚本可能在初始化时就抛了')
}

const buttons = page.frameLocator('#f').locator('button:visible')
const total = await buttons.count()
console.log(`可见按钮 ${total} 个`)
if (total === 0) problems.push('没有可点的 button：演示页至少要有一个交互')

/* 逐个点一遍。每轮重新计数：筛选类动作会让按钮数量变化，
   直接用固定下标会去等一个不存在的元素（Playwright 默认要等 30 秒）。 */
let clicked = 0
const deadline = Date.now() + 45_000
for (let i = 0; i < MAX_CLICKS && Date.now() < deadline; i += 1) {
  const live = page.frameLocator('#f').locator('button:visible')
  if (i >= await live.count()) break
  const btn = live.nth(i)
  try {
    if (await btn.isDisabled({ timeout: 800 })) continue
    await btn.click({ timeout: 1200 })
    clicked += 1
  } catch {
    // 重渲染导致的失效不算问题，只有 JS 异常才算
  }
}
console.log(`点击 ${clicked} 个按钮`)


/* 三档尺寸下的内部横向溢出 */
for (const [w, h] of VIEWPORTS) {
  await page.setViewportSize({ width: w, height: h })
  await page.waitForTimeout(120)
  const over = await frame()?.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (over === undefined) { problems.push(`视口 ${w}×${h} 取不到演示页文档`); continue }
  console.log(`视口 ${w}×${h} 横向溢出 ${over}px`)
  if (over > 1) problems.push(`视口 ${w}×${h} 横向溢出 ${over}px：布局有固定宽度没改成 clamp/minmax`)
}

await browser.close()
if (problems.length === 0) {
  console.log('\n冒烟通过：无 JS 错误、无横向溢出')
  process.exit(0)
}
console.log(`\n冒烟失败 ${problems.length} 项：`)
for (const p of problems) console.log(`  - ${p}`)
process.exit(1)
