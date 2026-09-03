#!/usr/bin/env node
/**
 * 演示页落地自检。退出码：0 = 可落盘，1 = 有阻塞项，2 = 用法错误。
 *
 * 用法：
 *   node .claude/skills/showcase-demo-page/scripts/check-demo.mjs <file.html>
 *        [--words <禁词表>] [--config <showcase.config.ts>] [--channel runtime|compile]
 *
 * 两个通道的契约不同，默认按路径自动判定（在 src/content/demos/ 下即编译时）：
 *   runtime  页面上传入 IndexedDB —— 归属与标题由上传弹窗决定，文件名不参与
 *   compile  进 src/content/demos/ —— 文件名即归属契约，且原样内联进 JS 产物
 *
 * 检查的都是「肉眼难发现、但一定会在演示站里坏掉或违规」的项：
 * 沙箱禁用 API、外链与相对路径、命名归属契约、体积预算、编码、禁词。
 */
import { readFileSync, existsSync } from 'node:fs'
import { basename, resolve } from 'node:path'

const DEFAULT_CONFIG = 'src/config/showcase.config.ts'
// 编译时体积直接加到主 chunk；运行时只影响 IndexedDB 与备份 JSON，可放宽
const BUDGET = {
  compile: { warn: 120 * 1024, fail: 200 * 1024, why: 'demos 是 eager 内联，直接加到主 chunk' },
  runtime: { warn: 300 * 1024, fail: 1024 * 1024, why: '运行时演示页存 IndexedDB，且整段会进备份 JSON' },
}

const errors = []
const warns = []
const ok = []
const err = (m) => errors.push(m)
const warn = (m) => warns.push(m)

/* ---------- 参数 ---------- */
const argv = process.argv.slice(2)
const flags = { words: null, config: DEFAULT_CONFIG, channel: null }
const positional = []
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === '--words') flags.words = argv[++i]
  else if (argv[i] === '--config') flags.config = argv[++i]
  else if (argv[i] === '--channel') flags.channel = argv[++i]
  else positional.push(argv[i])
}
const target = positional[0]
if (!target) {
  console.error('用法：check-demo.mjs <file.html> [--words <禁词表>] [--config <ts>] [--channel runtime|compile]')
  process.exit(2)
}
if (!existsSync(target)) {
  console.error(`文件不存在：${target}`)
  process.exit(2)
}
if (flags.channel && !BUDGET[flags.channel]) {
  console.error(`--channel 只能是 runtime 或 compile，收到 ${flags.channel}`)
  process.exit(2)
}
const channel = flags.channel ?? (/(?:^|\/)src\/content\/demos\//.test(target.replace(/\\/g, '/')) ? 'compile' : 'runtime')
ok.push(channel === 'compile' ? '通道 compile（进 src/content/demos/ 随构建发布）' : '通道 runtime（页面上传入 IndexedDB）')

/* ---------- 编码与体积 ---------- */
const raw = readFileSync(target)
if (raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) err('文件带 UTF-8 BOM，必须去掉')
let html = ''
try {
  html = new TextDecoder('utf-8', { fatal: true }).decode(raw)
  ok.push('编码 UTF-8 无 BOM')
} catch {
  err('文件不是合法 UTF-8（很可能被写成了 GBK/ANSI），必须转码')
  html = raw.toString('latin1')
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`
const budget = BUDGET[channel]
if (raw.length > budget.fail) err(`体积 ${kb(raw.length)} 超硬上限 ${kb(budget.fail)}：${budget.why}`)
else if (raw.length > budget.warn) warn(`体积 ${kb(raw.length)} 超目标线 ${kb(budget.warn)}：${budget.why}`)
else ok.push(`体积 ${kb(raw.length)}`)

/* ---------- 命名与归属契约：只有编译时通道靠文件名决定归属 ---------- */
const name = basename(target)
if (channel === 'runtime') {
  ok.push('归属由上传弹窗的项目下拉决定，文件名不参与')
} else {
  const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*--[a-z0-9]+(?:-[a-z0-9]+)*\.html$/
  if (!NAME_RE.test(name)) {
    err(`文件名 ${name} 不合契约：必须是 <projectId>--<slug>.html，全小写连字符`)
  } else {
    const projectId = name.slice(0, name.indexOf('--'))
    const configPath = resolve(flags.config)
    if (!existsSync(configPath)) {
      warn(`找不到 ${flags.config}，无法核对 projectId «${projectId}» 是否存在`)
    } else {
      const ids = [...readFileSync(configPath, 'utf8').matchAll(/\bid:\s*'([^']+)'/g)].map((m) => m[1])
      if (ids.includes(projectId)) ok.push(`归属项目 «${projectId}»`)
      else err(`projectId «${projectId}» 不在 showcase.config.ts（${ids.join(' / ')}）——不命中会静默归到第一个项目`)
    }
  }
}

/* ---------- <title> ---------- */
const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1]?.trim()
if (!title) err('缺少非空 <title>：上传弹窗用它预填演示标题，Deck 提示行「交互演示 · {标题}」也取它')
else ok.push(`标题 «${title}»`)
if (!/<html[^>]*\slang=/i.test(html)) warn('<html> 缺 lang 属性（建议 lang="zh-CN"）')
if (!/<meta[^>]+name=["']viewport["']/i.test(html)) {
  warn('缺 viewport meta：窄视口若出现整页缩放或横向滚动，先补 width=device-width')
}

/* ---------- 沙箱禁用 API ---------- */
const FORBIDDEN = [
  [/\blocalStorage\b/, 'localStorage 在不透明源下抛 SecurityError', 'err'],
  [/\bsessionStorage\b/, 'sessionStorage 同样不可用', 'err'],
  [/document\.cookie/, '不透明源下 cookie 读写无效', 'err'],
  [/history\.(?:pushState|replaceState)/, 'pushState/replaceState 抛 SecurityError，页内跳转改用 hash 锚点或 JS 滚动', 'err'],
  [/window\.open\s*\(/, '无 allow-popups，window.open 被拦', 'err'],
  [/target\s*=\s*["']_blank/i, '无 allow-popups，_blank 链接打不开', 'err'],
  [/\brequestFullscreen\b/, 'Deck 已提供网页/屏幕两级全屏，演示页不要自己申请', 'err'],
  [/\b(?:fetch|XMLHttpRequest|EventSource|WebSocket)\s*\(/, '演示页必须自包含，不发网络请求', 'err'],
  [/<form(?![^>]*onsubmit)/i, '<form> 无 allow-forms，提交会被静默拦；改用 button + JS，或加 onsubmit="return false"', 'err'],
  [/\bnavigator\.clipboard\b/, '沙箱下剪贴板 API 常被拒，改成页内「已复制」提示', 'warn'],
  [/\b(?:alert|confirm|prompt)\s*\(/, '原生弹窗在 iframe 里体验差，改页内提示', 'warn'],
  [/window\.(?:top|parent)|(?<![\w.])parent\./, '跨源访问父页面会抛错，演示页不要碰 parent/top', 'err'],
]
for (const [re, why, level] of FORBIDDEN) {
  if (!re.test(html)) continue
  const line = html.slice(0, html.search(re)).split('\n').length
  ;(level === 'err' ? err : warn)(`第 ${line} 行 ${re.source} → ${why}`)
}

/* ---------- 外链与相对路径：Blob URL 下相对路径必失效，外链违反自包含 ---------- */
let linkCount = 0
for (const m of html.matchAll(/(?:src|href)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
  const value = (m[1] ?? m[2] ?? '').trim()
  if (!value) continue
  linkCount += 1
  const line = html.slice(0, m.index).split('\n').length
  if (/^#/.test(value) || /^data:/i.test(value) || /^javascript:/i.test(value)) continue
  if (/^(?:https?:)?\/\//i.test(value)) {
    err(`第 ${line} 行外链 ${value.slice(0, 60)} → 必须内联（内联 SVG / data URI / 系统字体栈）`)
  } else if (/^(?:mailto|tel):/i.test(value)) {
    warn(`第 ${line} 行 ${value.slice(0, 40)}：沙箱禁顶层跳转，点了没反应`)
  } else {
    err(`第 ${line} 行相对路径 ${value.slice(0, 60)} → Blob URL 下无处可解，必须内联`)
  }
}
for (const m of html.matchAll(/(?:@import\s+(?:url\()?|url\(\s*)["']?(https?:\/\/[^"')\s]+)/gi)) {
  err(`CSS 外链 ${m[1].slice(0, 60)} → 必须内联`)
}
if (linkCount > 0 && errors.length === 0) ok.push(`${linkCount} 处 src/href 全部自包含`)

/* ---------- 禁词比对 ---------- */
if (!flags.words) {
  warn('未做禁词比对：加 --words <本地词表> 才会检查真实姓名/学校/单位/客户/上游框架身份等泄露')
} else if (!existsSync(flags.words)) {
  warn(`禁词表 ${flags.words} 不存在，跳过比对（该文件应保持未跟踪）`)
} else {
  const words = readFileSync(flags.words, 'utf8')
    .split(/\r?\n/)
    .map((w) => w.trim())
    .filter((w) => w && !w.startsWith('#'))
  const lower = html.toLowerCase()
  const hits = words.filter((w) => lower.includes(w.toLowerCase()))
  // 只报命中数量与位置，不回显词本身，避免把禁词写进日志/PR
  if (hits.length > 0) err(`禁词命中 ${hits.length} 处（词表第 ${hits.map((w) => words.indexOf(w) + 1).join('、')} 条），必须改写`)
  else ok.push(`禁词比对通过（${words.length} 条）`)
}

/* ---------- 输出 ---------- */
for (const m of ok) console.log(`[OK]   ${m}`)
for (const m of warns) console.log(`[WARN] ${m}`)
for (const m of errors) console.log(`[ERR]  ${m}`)
console.log(`\n${basename(target)}：${errors.length} 阻塞 / ${warns.length} 提醒 / ${ok.length} 通过`)
process.exit(errors.length > 0 ? 1 : 0)
