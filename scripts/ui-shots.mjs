/**
 * UI 截图核对脚本（Cool Slate 重构用）
 *
 * 用法：node scripts/ui-shots.mjs [label]
 *   label 缺省为 current，产物落在 .ui-shots/<label>/
 *
 * 覆盖 4 视口 × 2 主题 × 5 页面 = 40 张。收集 console.error 与 pageerror，
 * 非空则退出码 1。运行前需先 npm run build（脚本用 vite preview 服务 dist）。
 *
 * 端口固定 4174 + --strictPort：4173 归 playwright.config.ts 的 webServer，
 * 且它 reuseExistingServer:true，两边共用会互相拿到对方的进程。
 */
import { chromium } from '@playwright/test'
import { spawn, execSync } from 'node:child_process'
import { mkdir, access } from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import process from 'node:process'

const LABEL = process.argv[2] ?? 'current'
const PORT = 4174
const BASE = `http://127.0.0.1:${PORT}`
const OUT = path.join('.ui-shots', LABEL)
const THEME_KEY = 'jobconsole:theme:v1'

const VIEWPORTS = [
  ['1536', 1536, 1000],
  ['1024', 1024, 900],
  ['0900', 900, 900],
  ['0390', 390, 844],
]
const PAGES = [
  ['1-dashboard', '/#/'],
  ['2-tracker', '/#/tracker'],
  ['3-resume', '/#/resume'],
  ['4-library', '/#/library'],
  ['5-showcase', '/#/showcase'],
]

function ping(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume()
      resolve(res.statusCode !== undefined)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(1500, () => {
      req.destroy()
      resolve(false)
    })
  })
}

async function waitForServer(timeoutMs = 40000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await ping(BASE + '/')) return true
    await new Promise((r) => setTimeout(r, 400))
  }
  return false
}

function killTree(child) {
  if (!child || child.exitCode !== null) return
  if (process.platform === 'win32') {
    try {
      execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore' })
    } catch {
      /* 进程可能已退出 */
    }
  } else {
    child.kill('SIGTERM')
  }
}

async function main() {
  try {
    await access('dist/index.html')
  } catch {
    console.error('dist/index.html 不存在，先跑 npm run build')
    process.exitCode = 1
    return
  }
  if (await ping(BASE + '/')) {
    console.error(`${BASE} 已被占用，请先停掉该进程（本脚本要求独占 4174）`)
    process.exitCode = 1
    return
  }

  // 直接用 node 跑 vite 的 JS 入口：Windows 上 spawn 一个 .cmd 需要 shell:true，
  // 而 Node 22 对 shell 下的 .cmd 有额外限制（spawn EINVAL），绕开更省事。
  // --host 127.0.0.1 必须显式给：默认只绑 localhost，本机解析到 ::1，
  // 用 127.0.0.1 探测会 ECONNREFUSED
  const server = spawn(
    process.execPath,
    [
      'node_modules/vite/bin/vite.js', 'preview',
      '--host', '127.0.0.1', '--port', String(PORT), '--strictPort',
    ],
    { stdio: 'ignore' },
  )
  const problems = []

  try {
    if (!await waitForServer()) {
      console.error('vite preview 未能在 40s 内就绪')
      process.exitCode = 1
      return
    }

    // --no-proxy-server：本机 HTTP_PROXY 指向 127.0.0.1:7890，Chromium 默认会
    // 沿用系统代理，访问 127.0.0.1:4174 会得到 ERR_PROXY_CONNECTION_FAILED
    const browser = await chromium.launch({ args: ['--no-proxy-server'] })
    try {
      for (const theme of ['light', 'dark']) {
        for (const [vpLabel, width, height] of VIEWPORTS) {
          const context = await browser.newContext({ viewport: { width, height } })
          // 用 content 字符串而非回调：回调体在浏览器里执行，写成函数会让 eslint
          // 在 Node 配置下把 localStorage 判成 no-undef
          await context.addInitScript({
            content: `localStorage.setItem(${JSON.stringify(THEME_KEY)}, ${JSON.stringify(theme)})`,
          })
          const page = await context.newPage()
          page.on('console', (m) => {
            if (m.type() === 'error') problems.push(`[console] ${theme}/${vpLabel}: ${m.text()}`)
          })
          page.on('pageerror', (e) => problems.push(`[pageerror] ${theme}/${vpLabel}: ${e.message}`))

          for (const [name, hash] of PAGES) {
            await page.goto(BASE + hash, { waitUntil: 'networkidle' })
            await page.waitForTimeout(250)
            const dir = path.join(OUT, theme)
            await mkdir(dir, { recursive: true })
            await page.screenshot({ path: path.join(dir, `${vpLabel}-${name}.png`), fullPage: true })
          }
          await context.close()
        }
      }
    } finally {
      await browser.close()
    }
  } finally {
    killTree(server)
  }

  console.log(`截图完成：${OUT}（4 视口 × 2 主题 × 5 页 = 40 张）`)
  if (problems.length > 0) {
    console.error(`发现 ${problems.length} 条运行时错误：`)
    problems.forEach((p) => console.error('- ' + p))
    process.exitCode = 1
  } else {
    console.log('无 console.error 与 pageerror')
  }
}

await main().catch((error) => {
  console.error('截图脚本异常：' + (error?.message ?? error))
  process.exitCode = 1
})
