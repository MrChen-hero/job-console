# Cool Slate UI 重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把「求职工作台」的全站 UI 迁移到 Cool Slate 亮/暗双主题，按 `design-demo/cool-slate-light-demo.html` 重建五个模块的视图结构，并补齐六项交互增量与移动端导航。

**Architecture:** 五层自下而上推进——设计令牌 → 全局基线 → 共享原语 → 布局壳 → 模块视图。令牌只改值不改名，使 B0 成为单文件可回滚的值级 diff；上层每批一个提交，模块之间互不 import 组件，任一模块批次可单独回滚。交互增量的状态按「持久域数据入 store / 视图级 UI 入视图 / 表现级 UI 入组件」分层。

**Tech Stack:** Vue 3.5 `<script setup lang="ts">`、TypeScript、Vite 8、vue-router 5（hash）、Pinia 4、Element Plus 2、Dexie 4、vitest + @vue/test-utils、Playwright。

**设计依据:** `docs/superpowers/specs/2026-09-01-cool-slate-ui-refactor-design.md`（已通过两轮子代理评审）。本计划中「见 spec §X」均指该文件。

---

## 执行约定

**每个任务结束前的验证命令**（退出码必须显式核对）：

```bash
npm run lint
npm run test:run
npm run build
NO_PROXY="127.0.0.1,localhost" no_proxy="127.0.0.1,localhost" npm run test:e2e
node scripts/ui-shots.mjs   # 截图核对，4 视口 × 亮暗
```

**e2e 的两个环境前提**（已实测，不遵守会得到大面积假失败）：

1. **必须带 `NO_PROXY`。** 本机 shell 有 `HTTP_PROXY=HTTPS_PROXY=http://127.0.0.1:7890`，Playwright 的 `webServer` 就绪探测会走代理并拿到 502，60 秒后报 `Timed out waiting 60000ms from config.webServer`。加上 `NO_PROXY` 即正常。
2. **跑 e2e 之前不要留着自己起的 4173 服务。** `playwright.config.ts` 的 `reuseExistingServer: true` 会复用它；如果那个进程随后退出（例如带了 `timeout`），会出现「1 passed / 17 failed」这种页面加载不上的假失败。`netstat -ano | grep :4173` 确认空闲后再跑。

**基线已核对（2026-09-01）：** `lint=0`、`test:run=0`（19 文件 / 95 用例）、`build=0`、`test:e2e=0`（18 passed）。`build` 的 chunk >500kB 警告是既有已知取舍，不算失败。

**提交粒度：** 一个任务一个提交，提交信息用 `feat:` / `style:` / `test:` / `refactor:` / `docs:` 前缀 + 中文正文。不使用 `--amend`。

**契约冻结：** spec §8.2 的清单在任何任务中都不得破坏。结构重建与清单冲突时以清单为准：先保住钩子，再调外观。

**技术债规则：** 任务执行中遇到无法在当前任务内一次性解决的问题，**不得静默兜底**。追加到本文件末尾的「技术债登记」表（编号 TD-n），写清触发条件、影响面、临时处置与根因修复方向，然后继续当前任务。Task 24 集中清理。

**TDD 适用范围：** 涉及 store 计算、交互状态、可访问性行为的任务（Task 5、9、11、12、13、14、19）先写失败测试。纯视觉/结构重排的任务没有有意义的先行断言，验证方式是「契约测试保持绿 + 截图核对」，各任务已分别标注。这是对 writing-plans 默认 TDD 要求的有意偏离，理由是工作类型不同。

---

## 文件结构

**新建：**

| 路径 | 职责 |
|---|---|
| `scripts/ui-shots.mjs` | 截图核对脚本：4 视口 × 亮暗 × 5 页面，输出 `.ui-shots/` |
| `src/shared/ui/icons.ts` | 约 20 个线性图标的 SVG path 常量表，唯一图标来源 |
| `src/shared/ui/AppIcon.vue` | 图标渲染组件，`name` + `size`，`stroke=currentColor` |
| `src/shared/ui/Sparkline.vue` | 迷你走势图，area + line 双 path，`aria-hidden` |
| `src/shared/ui/SectionCard.vue` | 卡片骨架，`title`/`sub` + `default`/`actions` 插槽 |
| `src/shared/ui/StatusBadge.vue` | 阶段徽章结构封装，内部查 `STAGE_BADGE` |
| `src/shared/ui/__tests__/AppIcon.test.ts` | 图标名解析与回退 |
| `src/shared/ui/__tests__/Sparkline.test.ts` | 常量/单点序列不产出 NaN |
| `src/shared/ui/__tests__/StatusBadge.test.ts` | 阶段 → 色调类映射 |

**修改：**

| 路径 | 改动 |
|---|---|
| `src/styles/tokens.css` | 亮/暗令牌全量换值 + 新增令牌 + EP 桥接扩到约 30 项 |
| `src/styles/global.css` | 字重令牌、`.tnum`/`.mono`、全局 `:focus-visible` |
| `src/modules/tracker/badges.css` | 取值换冷灰语义色 + 修 `.badge-violet` 边框 bug |
| `src/shared/layout/AppLayout.vue` | 内容区宽度/内边距、`.scrim`、断点 1024 |
| `src/shared/layout/AppSidebar.vue` | 图标化导航 + 激活左轨 + 移动抽屉 + `inert` 配对 |
| `src/shared/layout/AppTopbar.vue` | 高度/标题层级、`AppIcon` 主题按钮、汉堡按钮 |
| `src/shared/layout/__tests__/layout.test.ts` | 追加抽屉四条用例 |
| `src/modules/dashboard/store.ts` | 新增 `series`；`funnel` 改累计到达语义；`todos` 带 `status` |
| `src/modules/dashboard/__tests__/dashboard.test.ts` | 追加 series / funnel 判别用例 |
| `src/modules/dashboard/views/DashboardView.vue` | KPI+走势图、漏斗刻度轴、待办 pill、里程碑方块、快捷磁贴、三行栅格 |
| `src/storage/types.ts` | `Application` 增 `starred?: boolean` |
| `src/modules/tracker/store.ts` | 新增 `toggleStar` |
| `src/modules/tracker/__tests__/store.test.ts` | 追加 starred 用例 |
| `src/storage/__tests__/backup.test.ts` | 追加 starred 往返与旧备份兼容用例 |
| `src/modules/tracker/views/TrackerView.vue` | 工具栏卡片化、筒片→下拉、渠道/收藏筛选透传 |
| `src/modules/tracker/components/ApplicationTable.vue` | 9 列、排序、分页、★、选中态 |
| `src/modules/tracker/components/__tests__/ApplicationTable.test.ts` | 追加排序/分页/★ 用例 |
| `src/modules/tracker/components/ApplicationBoard.vue` | 列顶色条、计数 chip、卡片标签色随列 |
| `src/modules/tracker/components/ApplicationDrawer.vue` | 令牌化 + 卡片化 |
| `src/modules/tracker/components/ApplicationDialog.vue` | 令牌化 |
| `src/modules/tracker/components/CompanyPoolView.vue` | 卡片化 |
| `src/modules/resume/components/VersionManager.vue` | 版本 chip 行 + 虚线新建 |
| `src/modules/resume/components/ProfileEditor.vue` | tab → 资料池折叠 |
| `src/modules/resume/components/EntryCard.vue` | 条目行 = 手柄 + 标题/副标题 + 四个图标按钮 |
| `src/modules/resume/views/ResumeView.vue` | 工具栏移入右栏 + 纸面台面（保留 A4 缩放逻辑） |
| `src/modules/library/views/LibraryView.vue` | 两栏 → 三栏，分类移入左栏（`.chip` 保留） |
| `src/shared/markdown/render.ts` 输出的正文样式 | 方形列表符、引用块、代码块容器（在 LibraryView scoped 内） |
| `src/modules/showcase/views/ShowcaseView.vue` | hero+bento → 项目卡片网格，去衬线 |
| `src/modules/showcase/components/DeckOverlay.vue` | 令牌化 + 去衬线 |
| `AGENTS.md` / `DESIGN.md` / `.gitignore` | 文档同步（Task 23） |

---

## Task 0: 基线固定与截图脚本〔视觉/结构〕

**Files:**
- Create: `scripts/ui-shots.mjs`
- Modify: `.gitignore`

- [ ] **Step 1: 确认基线全绿**

**已完成（2026-09-01）：** `lint=0`、`test:run=0`（19 文件 / 95 用例）、`build=0`、`test:e2e=0`（18 passed）。执行时可直接跳到 Step 2；若中途怀疑基线被污染，用下面命令复核：

```bash
npm run lint; echo "lint=$?"
npm run test:run; echo "test=$?"
npm run build; echo "build=$?"
netstat -ano | grep ":4173.*LISTENING" || echo "4173 空闲"
NO_PROXY="127.0.0.1,localhost" no_proxy="127.0.0.1,localhost" npm run test:e2e; echo "e2e=$?"
```

预期：四个退出码都是 0。若有失败，先记为 TD 并停下报告，不要在红的基线上开工。

- [ ] **Step 2: 写截图脚本**

创建 `scripts/ui-shots.mjs`：用 `import { chromium } from '@playwright/test'`（仓库只装了 `@playwright/test`，不要 `from 'playwright'`）起页面，遍历 4 个视口（1536×1000 / 1024×900 / 900×900 / 390×844）× 2 个主题（`localStorage['jobconsole:theme:v1']` 设 `light`/`dark`）× 5 条 hash 路由（`/#/`、`/#/tracker`、`/#/resume`、`/#/library`、`/#/showcase`），输出到 `.ui-shots/<label>/<theme>-<viewport>-<page>.png`；同时收集 `pageerror` 与 `console.error` 并在末尾打印，非空即退出码 1。label 由命令行参数给出，默认 `current`。

服务端口用 **4174**（`vite preview --port 4174 --strictPort`，脚本自己 spawn 并在结束时 kill），**不要复用 4173**——`playwright.config.ts` 的 `webServer` 占用 4173 且 `reuseExistingServer: true`，两边抢端口时会互相拿到对方的进程。`--strictPort` 必须加：端口被占时 Vite 会静默换端口，而脚本里的 URL 是写死的，会以「页面加载失败」的形式变成一个难查的假故障。

- [ ] **Step 3: 忽略产物**

`.gitignore` 追加 `.ui-shots/`。

- [ ] **Step 4: 把设计基准纳入版本控制**

`design-demo/cool-slate-light-demo.html` 与 `design-demo/design-cool-slate/` 目前都是未跟踪文件，但 Task 4/5/15 要从 HTML 里拷图标 path、`spark()` 与看板列变量写法，Task 23 还要把 `AGENTS.md` 的视觉基准指向该 HTML。不入库就会出现文档引用仓库里不存在的文件。

```bash
git add design-demo/cool-slate-light-demo.html design-demo/design-cool-slate/
git status --short design-demo
```

5 张 PNG 合计约 6.6MB，入库前先跟用户确认是否连图一起提交（HTML 必须入库，PNG 可选）。内容都是虚构示例数据，不触碰 `AGENTS.md` §7 的隐私约束。

- [ ] **Step 5: 产出重构前基线**

```bash
npm run build && node scripts/ui-shots.mjs baseline; echo "shots=$?"
```

预期：退出码 0，`.ui-shots/baseline/` 下 40 张图（4 视口 × 2 主题 × 5 页）。人工翻一遍，确认当前暖石灰配色被完整记录——后续每批次都与它对比。

- [ ] **Step 6: Commit**

```bash
git add scripts/ui-shots.mjs .gitignore design-demo/cool-slate-light-demo.html
git commit -m "test: ui screenshot harness and cool slate visual reference"
```

> 只暂存 HTML。`design-demo/design-cool-slate/` 的 5 张 PNG（实测 6.7MB）按 Step 4 的用户结论单独追加，**不要用 `git add design-demo` 一把捞**——那会绕过 Step 4 的确认。`design-demo/index.html` 是已跟踪文件，不受影响。

---

## Task 1: 令牌亮/暗全量换值〔视觉/结构〕

**Files:**
- Modify: `src/styles/tokens.css`

- [ ] **Step 1: 替换 `:root` 亮色块**

保留全部现有令牌名，只换值，并追加新令牌。完整取值见 spec §4.2，逐字照抄，注意三处对比度修正（`--muted` `#64748b`、新增 `--primary-strong` `#2559dc` 与 `--primary-text` `#1d4ed8`、新增 `--control` `#828fa0`）与新增的五个 `--*-vivid`。

**必须新增的令牌**：`--surface-muted`、`--control`、`--primary-strong`、`--primary-text`、`--violet-border`、`--info-vivid`、`--success-vivid`、`--warn-vivid`、`--danger-vivid`、`--violet-vivid`、`--mono`、`--topbar-h`、`--fw-normal/medium/semibold/bold`。
**必须保留不删的令牌**（现有引用会失效）：`--teal`、`--teal-soft`、`--amber`、`--amber-soft`、`--rose`、`--rose-soft`、`--font-display`、`--ease`、`--card2`、`--border2`。

- [ ] **Step 2: 替换 `[data-theme='dark']` 块**

完整取值见 spec §4.3。暗色下 `-vivid` 与基色同值。

- [ ] **Step 3: 更新文件头注释**

把「清简专业风」与「视觉基准：design-demo/index.html」改为 Cool Slate 与 `design-demo/cool-slate-light-demo.html`。

- [ ] **Step 4: 验证无未定义令牌**

```bash
node -e "const fs=require('fs');const css=fs.readFileSync('src/styles/tokens.css','utf8');const def=new Set([...css.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map(m=>m[1]));const used=new Set();for(const f of require('child_process').execSync('git ls-files src').toString().split('\n').filter(p=>/\.(vue|css)$/.test(p))){for(const m of fs.readFileSync(f,'utf8').matchAll(/var\((--[a-z0-9-]+)/g))used.add(m[1])}const miss=[...used].filter(v=>!def.has(v)&&!v.startsWith('--el-'));console.log(miss.length?'MISSING: '+miss:'all tokens defined')"
```

预期：`all tokens defined`。若有缺失，说明删掉了仍被引用的令牌，补回去。

> 该脚本只在本任务使用。Task 15 会在组件内引入局部变量 `--kc`/`--kc-text`/`--kc-soft`/`--kc-border`（内联在元素 style 上），之后重跑此脚本会把它们报成「缺失」，属误报。

- [ ] **Step 5: 四件套 + 截图**

```bash
npm run lint; npm run test:run; npm run build
node scripts/ui-shots.mjs b0-tokens
```

预期：全绿；截图里五个页面已变冷灰，暗色页面为深蓝黑而非原来的暖黑。此时布局与结构应与 baseline 逐像素同位（只有颜色变化）——若出现位移，说明误改了尺寸令牌。

- [ ] **Step 6: Commit**

```bash
git add src/styles/tokens.css
git commit -m "style: cool slate design tokens for light and dark"
```

---

## Task 2: Element Plus 桥接扩展〔视觉/结构〕

**Files:**
- Modify: `src/styles/tokens.css`（文件末尾的桥接块）

- [ ] **Step 1: 确认引入顺序未被破坏**

```bash
grep -n "element-plus\|tokens.css" src/main.ts
```

预期：`element-plus/dist/index.css` 与 `element-plus/theme-chalk/dark/css-vars.css` 两行都在 `./styles/tokens.css` 之前。`:root` 与 `.dark` 特异度相同，靠源码顺序决胜，顺序反了暗色 EP 组件会失控。若顺序不对，先修 `main.ts`。

- [ ] **Step 2: 扩展桥接块**

在现有 13 项之外补齐 spec §4.4 列出的项：`--el-fill-color` 四档、`--el-border-color-light/-lighter/-darker`、`--el-text-color-secondary/-placeholder/-disabled`、`--el-bg-color-overlay`、`--el-mask-color`、`--el-box-shadow-light/-lighter`、`--el-color-primary-light-3/-5/-7/-8/-9`、`--el-border-radius-small/-round`、`--el-disabled-bg-color/-text-color/-border-color`。全部用 `var(--我们的令牌)` 赋值，**不写死颜色**，这样暗色自动跟随，不需要第二份桥接。

`--el-color-primary-light-*` 的取值梯度：`-3` 用 `--primary`，`-5`/`-7` 用 `--primary-border`，`-8`/`-9` 用 `--primary-soft`（EP 用它们算 hover 与禁用底色，只要色相一致即可，不必精确等分）。

- [ ] **Step 3: 目视核对 EP 组件**

```bash
npm run build && node scripts/ui-shots.mjs b0-ep
```

重点看：台账「详情」按钮、工具栏的 `ElButton`、里程碑输入框、材料库编辑器的 `ElSelect`、弹窗与抽屉。暗色下不应再出现 EP 默认蓝 `#409eff` 或亮色底。

- [ ] **Step 4: 四件套**

```bash
npm run lint; npm run test:run; npm run build; npm run test:e2e
```

预期：全绿。这是 B0 批次末尾，e2e 必跑。

- [ ] **Step 5: Commit**

```bash
git add src/styles/tokens.css src/main.ts
git commit -m "style: extend element plus variable bridge to cool slate tokens"
```

---

## Task 3: 全局基线与徽章取值〔视觉/结构〕

**Files:**
- Modify: `src/styles/global.css`
- Modify: `src/modules/tracker/badges.css`

- [ ] **Step 1: 扩充 `global.css`**

在现有内容后追加：

```css
.tnum { font-variant-numeric: tabular-nums; }
.mono { font-family: var(--mono); font-variant-numeric: tabular-nums; }

:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
```

`prefers-reduced-motion` 段保持不动。字重不在这里做全局覆盖（会影响 EP 组件），只提供 `--fw-*` 令牌供组件引用。

- [ ] **Step 2: 换 `badges.css` 取值并修 bug**

六个色调类改为冷灰语义色；`.badge-violet` 的 `border-color` 从 `var(--primary-border)` 改为 `var(--violet-border)`（既存 bug，见 spec §4.6）。`.stage-badge` 与 `.dot` 的结构样式不动。

- [ ] **Step 3: 确认 `--violet-border` 已定义**

```bash
grep -n "violet-border" src/styles/tokens.css
```

预期：亮色块与暗色块各一处。Task 1 若漏了，现在补。

- [ ] **Step 4: 四件套 + 截图**

```bash
npm run lint; npm run test:run; npm run build
node scripts/ui-shots.mjs b0-done
```

预期：全绿；台账与看板的状态徽章为冷灰语义色，紫色徽章边框不再是蓝的。

- [ ] **Step 5: Commit**

```bash
git add src/styles/global.css src/modules/tracker/badges.css
git commit -m "style: global baseline utilities and cool slate stage badges"
```

---

## Task 4: 图标表与 AppIcon〔TDD〕

**Files:**
- Create: `src/shared/ui/icons.ts`
- Create: `src/shared/ui/AppIcon.vue`
- Test: `src/shared/ui/__tests__/AppIcon.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppIcon from '../AppIcon.vue'
import { ICON_NAMES } from '../icons'

describe('AppIcon', () => {
  it('渲染 svg 且描边取 currentColor', () => {
    const wrapper = mount(AppIcon, { props: { name: 'grid' } })
    const svg = wrapper.find('svg')
    expect(svg.exists()).toBe(true)
    expect(svg.attributes('viewBox')).toBe('0 0 24 24')
    expect(svg.attributes('aria-hidden')).toBe('true')
  })

  it('尺寸可覆盖，默认 18', () => {
    expect(mount(AppIcon, { props: { name: 'grid' } }).find('svg').attributes('width')).toBe('18')
    expect(mount(AppIcon, { props: { name: 'grid', size: 26 } }).find('svg').attributes('width')).toBe('26')
  })

  it('未知图标名不抛错、渲染空 svg', () => {
    const wrapper = mount(AppIcon, { props: { name: 'not-exist' } })
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.find('path,circle,rect').exists()).toBe(false)
  })

  it('导航与交互所需图标齐备', () => {
    for (const n of ['grid', 'case', 'file', 'layers', 'play', 'menu', 'sun', 'moon', 'search',
      'plus', 'star', 'edit', 'trash', 'grip', 'chev', 'left', 'right', 'first', 'last',
      'download', 'printer', 'user', 'help', 'target', 'book', 'mark']) {
      expect(ICON_NAMES).toContain(n)
    }
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npx vitest run src/shared/ui/__tests__/AppIcon.test.ts
```

预期：FAIL，`Cannot find module '../AppIcon.vue'`。

- [ ] **Step 3: 实现**

`icons.ts` 导出 `ICONS: Record<string, string>`（值是 `<path>/<circle>/<rect>` 片段字符串）与 `ICON_NAMES = Object.keys(ICONS)`。图标路径直接从 `design-demo/cool-slate-light-demo.html` 的 `ICONS` 常量表复制（那里已验证过渲染效果），至少包含测试列出的 26 个。

`AppIcon.vue`：props `{ name: string; size?: number }`，模板 `<svg :width="size ?? 18" :height="size ?? 18" viewBox="0 0 24 24" aria-hidden="true" v-html="ICONS[name] ?? ''" />`，样式 `fill:none; stroke:currentColor; stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round`。`v-html` 内容来自本仓库常量、非用户输入，需按 `AGENTS.md` 惯例加 `<!-- eslint-disable-next-line vue/no-v-html -->` 与信任来源注释。

- [ ] **Step 4: 跑测试确认通过**

```bash
npx vitest run src/shared/ui/__tests__/AppIcon.test.ts
```

预期：4 passed。

- [ ] **Step 5: Commit**

```bash
git add src/shared/ui/icons.ts src/shared/ui/AppIcon.vue src/shared/ui/__tests__/AppIcon.test.ts
git commit -m "feat: shared AppIcon primitive with the cool slate icon set"
```

---

## Task 5: Sparkline〔TDD〕

**Files:**
- Create: `src/shared/ui/Sparkline.vue`
- Test: `src/shared/ui/__tests__/Sparkline.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Sparkline from '../Sparkline.vue'

const paths = (values: number[]) =>
  mount(Sparkline, { props: { values } }).findAll('path').map((p) => p.attributes('d') ?? '')

describe('Sparkline', () => {
  it('常量序列不产出 NaN 且落在中线', () => {
    const [area, line] = paths([3, 3, 3, 3])
    expect(area + line).not.toMatch(/NaN/)
    expect(line).toMatch(/^M0 /)
  })

  it('单点序列不产出 NaN', () => {
    expect(paths([5]).join('')).not.toMatch(/NaN/)
  })

  it('空序列渲染但不产出路径点', () => {
    const wrapper = mount(Sparkline, { props: { values: [] } })
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.findAll('path').every((p) => !(p.attributes('d') ?? '').includes('NaN'))).toBe(true)
  })

  it('递增序列的末点高于首点（y 值更小）', () => {
    const line = paths([1, 2, 3, 4])[1]!
    const ys = [...line.matchAll(/[ML](\d+(?:\.\d+)?) (\d+(?:\.\d+)?)/g)].map((m) => Number(m[2]))
    expect(ys.at(-1)!).toBeLessThan(ys[0]!)
  })

  it('对屏幕阅读器隐藏', () => {
    expect(mount(Sparkline, { props: { values: [1, 2] } }).find('svg').attributes('aria-hidden')).toBe('true')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npx vitest run src/shared/ui/__tests__/Sparkline.test.ts
```

预期：FAIL，模块不存在。

- [ ] **Step 3: 实现**

props `{ values: number[]; height?: number }`。归一化到 `viewBox="0 0 100 32"`，`preserveAspectRatio="none"`，line path 加 `vector-effect="non-scaling-stroke"` 避免横向拉伸导致描边变形。除零兜底：`const span = max - min || 1`；单点时 `values.length - 1` 为 0，横坐标直接取 0。area path 在 line 之后闭合到底边。算法可照抄 `design-demo/cool-slate-light-demo.html` 的 `spark()` 函数。

- [ ] **Step 4: 跑测试确认通过**

```bash
npx vitest run src/shared/ui/__tests__/Sparkline.test.ts
```

预期：5 passed。

- [ ] **Step 5: Commit**

```bash
git add src/shared/ui/Sparkline.vue src/shared/ui/__tests__/Sparkline.test.ts
git commit -m "feat: shared Sparkline primitive with degenerate-series guards"
```

---

## Task 6: SectionCard 与 StatusBadge〔TDD〕

**Files:**
- Create: `src/shared/ui/SectionCard.vue`
- Create: `src/shared/ui/StatusBadge.vue`
- Test: `src/shared/ui/__tests__/StatusBadge.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StatusBadge from '../StatusBadge.vue'
import { STAGE_BADGE } from '../../../modules/tracker/constants'
import { STAGES } from '../../../storage/types'

describe('StatusBadge', () => {
  it('每个阶段都映射到既有色调类', () => {
    for (const stage of STAGES) {
      const wrapper = mount(StatusBadge, { props: { stage } })
      const badge = wrapper.find('.stage-badge')
      expect(badge.exists()).toBe(true)
      expect(badge.classes()).toContain(STAGE_BADGE[stage])
      expect(badge.text()).toContain(stage)
      expect(badge.find('.dot').exists()).toBe(true)
    }
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npx vitest run src/shared/ui/__tests__/StatusBadge.test.ts
```

预期：FAIL，模块不存在。

- [ ] **Step 3: 实现**

`StatusBadge.vue`：props `{ stage: Stage }`，模板 `<span class="stage-badge" :class="STAGE_BADGE[stage]"><span class="dot" />{{ stage }}</span>`，`import '../../modules/tracker/badges.css'`——**不要**把样式复制成 scoped，三处共用同一张表是 spec §4.6 的决定。

`SectionCard.vue`：props `{ title: string; sub?: string }`，结构 `.card > .card-head(.card-title + .card-sub + slot[actions]) + slot[default]`，样式取 `--card`/`--border`/`--r-lg`/`--shadow-sm`。**注意**：`DashboardView` 与 `ShowcaseView` 现有的 `.card-hd`/`.card-bd` 类名没有测试依赖（spec §8.2 未列），可以改名为 `.card-head`；但 `.card` 本身被多处 scoped 样式引用，保持。

- [ ] **Step 4: 跑测试确认通过**

```bash
npx vitest run src/shared/ui/__tests__/StatusBadge.test.ts
npm run test:run
```

预期：新用例 8 个阶段全过；全量单测仍全绿。

- [ ] **Step 5: Commit**

```bash
git add src/shared/ui/SectionCard.vue src/shared/ui/StatusBadge.vue src/shared/ui/__tests__/StatusBadge.test.ts
git commit -m "feat: shared SectionCard and StatusBadge primitives"
```

---

## Task 7: 侧栏图标化与移动抽屉〔TDD〕

**Files:**
- Modify: `src/shared/layout/AppSidebar.vue`
- Modify: `src/shared/layout/AppLayout.vue`
- Modify: `src/shared/layout/AppTopbar.vue`（**只加汉堡按钮与 `toggle` 事件**；顶栏其余视觉重建在 Task 8）
- Test: `src/shared/layout/__tests__/layout.test.ts`

> 汉堡按钮必须在本任务内建好——下面 5 条用例全靠 `.menu-btn` 触发抽屉，拆到 Task 8 会让本任务的「8 passed」无法达成。

- [ ] **Step 1: 写失败测试（追加到现有 describe）**

```ts
  it('汉堡按钮打开抽屉并显示遮罩', async () => {
    const wrapper = mount(AppLayout, { global: { plugins: [router] } })
    await router.isReady()
    expect(wrapper.find('.sidebar').classes()).not.toContain('open')
    await wrapper.find('.menu-btn').trigger('click')
    expect(wrapper.find('.sidebar').classes()).toContain('open')
    expect(wrapper.find('.scrim').exists()).toBe(true)
  })

  it('点击遮罩关闭抽屉', async () => {
    const wrapper = mount(AppLayout, { global: { plugins: [router] } })
    await router.isReady()
    await wrapper.find('.menu-btn').trigger('click')
    await wrapper.find('.scrim').trigger('click')
    expect(wrapper.find('.sidebar').classes()).not.toContain('open')
  })

  it('Esc 关闭抽屉', async () => {
    const wrapper = mount(AppLayout, { attachTo: document.body, global: { plugins: [router] } })
    await router.isReady()
    await wrapper.find('.menu-btn').trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.sidebar').classes()).not.toContain('open')
    wrapper.unmount()
  })

  it('路由切换自动收起抽屉', async () => {
    const wrapper = mount(AppLayout, { global: { plugins: [router] } })
    await router.isReady()
    await wrapper.find('.menu-btn').trigger('click')
    await router.push('/tracker')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.sidebar').classes()).not.toContain('open')
  })

  it('抽屉关闭时侧栏对键盘与读屏隐藏，打开时恢复', async () => {
    const wrapper = mount(AppLayout, { global: { plugins: [router] } })
    await router.isReady()
    const sidebar = wrapper.find('.sidebar')
    expect(sidebar.attributes('aria-hidden')).toBe('true')
    expect(sidebar.attributes('inert')).toBeDefined()
    await wrapper.find('.menu-btn').trigger('click')
    expect(wrapper.find('.sidebar').attributes('aria-hidden')).toBeUndefined()
    expect(wrapper.find('.sidebar').attributes('inert')).toBeUndefined()
  })
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npx vitest run src/shared/layout/__tests__/layout.test.ts
```

预期：原 3 个通过、新增 5 个失败（找不到 `.menu-btn`）。

- [ ] **Step 3: 实现抽屉状态与汉堡按钮**

抽屉开合状态放 `AppLayout.vue`（它同时持有侧栏、顶栏与遮罩），用 props/emit 下发：`AppSidebar` 收 `open: boolean`，`AppTopbar` 发 `toggle`。

`AppTopbar.vue` 左侧插入：

```vue
<button class="icon-btn menu-btn" aria-label="打开导航" @click="emit('toggle')">
  <AppIcon name="menu" />
</button>
```

样式写 `.icon-btn.menu-btn { display: none }`，`≤1024` 媒体查询里 `.icon-btn.menu-btn { display: grid }`。**必须带 `.icon-btn` 前缀提升特异度**——写成裸 `.menu-btn { display: none }` 会被后面的 `.icon-btn { display: grid }` 以相同特异度 + 靠后位置覆盖，桌面端会漏出汉堡（参考 demo 里踩过这个坑）。

**`inert` + `aria-hidden` 必须与「是否处于抽屉模式」联动，不能只看 `open`**（spec §7.1）：用 `matchMedia('(max-width: 1024px)')` 的响应式包装决定 `isDrawer`；**jsdom 29 没有 `window.matchMedia` 且 `src/test/setup.ts` 未 polyfill**，因此必须写成「`matchMedia` 不可用时降级为 `true`」——这正是上面第 5 条用例能在 jsdom 下断言到 `inert` 的前提。桌面模式下两个属性都不得出现，否则键盘进不了导航。

- [ ] **Step 4: 实现视觉重建**

`AppSidebar`：品牌 mark 去掉 `linear-gradient(135deg, var(--primary), #7c3aed)` 改纯 `var(--primary)`；导航项加 `AppIcon`（`grid`/`case`/`file`/`layers`/`play`，顺序对齐 `NAV_ITEMS`）、1px 边框、`--r` 圆角，`.active` 用 `--primary-soft` 底 + `--primary-text` 文字 + `::before` 左 3px `--primary` 轨；底部绿点用 `--success-vivid` + 文案「数据仅存本机浏览器」不变。`.nav-item`/`.active` 类名保留。

`AppLayout`：`max-width` 1280 → 1600，`padding` 改 `4px 28px 44px`，断点 860 → 1024，新增 `.scrim`（`position:fixed; inset:0; z-index:35; background:rgba(23,32,51,.3)`）。

- [ ] **Step 5: 跑测试确认通过**

```bash
npx vitest run src/shared/layout/__tests__/layout.test.ts
```

预期：8 passed（原 3 + 新 5）。

- [ ] **Step 6: Commit**

```bash
git add src/shared/layout/AppSidebar.vue src/shared/layout/AppLayout.vue src/shared/layout/AppTopbar.vue src/shared/layout/__tests__/layout.test.ts
git commit -m "feat: cool slate sidebar with mobile drawer and inert pairing"
```

---

## Task 8: 顶栏视觉重建〔视觉/结构〕

**Files:**
- Modify: `src/shared/layout/AppTopbar.vue`（汉堡按钮已在 Task 7 建好，本任务只做其余视觉）

- [ ] **Step 1: 重建顶栏**

- 高度 60 → `var(--topbar-h)`（86px），去掉 `backdrop-filter` 与 `color-mix(in srgb, var(--bg) 82%, transparent)`，背景改不透明 `var(--bg)`，**去掉 `border-bottom`**（对齐设计图）。
- 标题 16px → 21px/`--fw-bold`，副标题 12.5px/`--muted`。**`.page-title` 与 `.page-crumb` 类名必须保留**——`layout.test.ts` 断言 `.page-title` 文本，e2e 用 `.page-title` 校验五条路由的标题。
- 主题按钮：`{{ theme.dark ? '🌙' : '☀️' }}` 改为 `<AppIcon :name="theme.dark ? 'moon' : 'sun'" />`，`aria-label` 随状态变为「切换浅色主题」/「切换深色主题」，**`.theme-toggle` 与 `.icon-btn` 类名保留**（`layout.test.ts` 依赖 `.theme-toggle`）。
- `AppTopbar.vue:75` 现有的 `@media (max-width: 860px)`（顶栏左右内边距 28px → 16px）**断点改为 1024**。spec §5.1 把它列进「改为 1024 的壳层三个文件」，Task 7 只动了 `AppSidebar`/`AppLayout`，这一处在本任务补上；否则 861–1024 带宽内抽屉已生效而顶栏还是桌面内边距。

- [ ] **Step 2: 单测 + 截图**

```bash
npx vitest run src/shared/layout/__tests__/layout.test.ts
npm run build && node scripts/ui-shots.mjs b1-shell
```

预期：8 passed。截图确认：1536/1024 视口无汉堡按钮，900/390 有；主题按钮是线性图标不是 emoji；侧栏导航有图标与激活左轨。

- [ ] **Step 3: 四件套（B1 批次末尾）**

```bash
npm run lint; npm run test:run; npm run build; npm run test:e2e
```

预期：全绿。e2e 的 tablet 项目是 768 宽，落在抽屉模式，`getByRole('tab')` 与 hash 直达都不受影响。

- [ ] **Step 4: Commit**

```bash
git add src/shared/layout/AppTopbar.vue
git commit -m "feat: icon-based topbar with mobile menu trigger"
```

---

## Task 9: 工作台 store —— 走势图与漏斗语义〔TDD〕

**Files:**
- Modify: `src/modules/dashboard/store.ts`
- Test: `src/modules/dashboard/__tests__/dashboard.test.ts`

- [ ] **Step 1: 写失败测试（追加到 `dashboard store` describe）**

```ts
  it('漏斗按 STAGE_DONE 索引：挂掉的投递不计入其后各层', async () => {
    const tracker = useTrackerStore()
    const dashboard = useDashboardStore()
    await dashboard.load()
    const app = await tracker.addApplication({ company: 'A', position: 'B', batch: '正式批', channel: '官网', appliedAt: '2026-08-01' })
    await tracker.changeStage(app.id, '笔试')
    await tracker.changeStage(app.id, '一面')
    await tracker.markDropped(app.id)
    const at = (stage: string) => dashboard.funnel.rows.find((r) => r.stage === stage)!.count
    expect(at('已投递')).toBe(1)
    expect(at('一面')).toBe(1)
    expect(at('二面')).toBe(0)
    expect(at('Offer')).toBe(0)   // 按 STAGES 索引会错成 1
  })

  it('漏斗单调递减且百分比以总投递为基数', async () => {
    const tracker = useTrackerStore()
    const dashboard = useDashboardStore()
    await dashboard.load()
    for (const c of ['A', 'B', 'C', 'D']) {
      await tracker.addApplication({ company: c, position: 'P', batch: '正式批', channel: '官网', appliedAt: '2026-08-01' })
    }
    await tracker.changeStage(tracker.applications[0]!.id, '笔试')
    const counts = dashboard.funnel.rows.map((r) => r.count)
    expect(counts).toEqual([...counts].sort((a, b) => b - a))
    expect(dashboard.funnel.base).toBe(4)
    expect(dashboard.funnel.rows[0]!.pct).toBeCloseTo(1)
  })

  it('走势图 12 桶；空数据全 0 且不含 NaN', async () => {
    const dashboard = useDashboardStore()
    await dashboard.load()
    for (const key of ['total', 'inFlight', 'interviewing', 'offers'] as const) {
      expect(dashboard.series[key]).toHaveLength(12)
      expect(dashboard.series[key].every((n) => n === 0)).toBe(true)
      expect(dashboard.series[key].some((n) => Number.isNaN(n))).toBe(false)
    }
  })

  it('走势图按 stageHistory 日期回放：末桶反映当前状态', async () => {
    const tracker = useTrackerStore()
    const dashboard = useDashboardStore()
    await dashboard.load()
    const app = await tracker.addApplication({ company: 'A', position: 'B', batch: '正式批', channel: '官网', appliedAt: new Date().toISOString().slice(0, 10) })
    await tracker.changeStage(app.id, 'Offer')
    expect(dashboard.series.total.at(-1)).toBe(1)
    expect(dashboard.series.offers.at(-1)).toBe(1)
    expect(dashboard.series.total[0]).toBe(0)   // 11 周前还没投
  })

  it('待办带上阶段，供徽章渲染', async () => {
    const tracker = useTrackerStore()
    const dashboard = useDashboardStore()
    await dashboard.load()
    const app = await tracker.addApplication({ company: 'A', position: 'B', batch: '正式批', channel: '官网', appliedAt: '2026-08-01', nextStep: '等通知', nextActionAt: '2026-09-05' })
    await tracker.changeStage(app.id, '笔试')
    expect(dashboard.todos[0]!.status).toBe('笔试')
  })
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npx vitest run src/modules/dashboard/__tests__/dashboard.test.ts
```

预期：原有用例通过，5 个新用例失败（`funnel.base`/`series` 未定义）。

- [ ] **Step 3: 实现**

```ts
/** 某投递在 date 时刻的阶段：取 stageHistory 中 date <= 该日的最后一条 */
function stageAt(app: Application, date: string): Stage | null {
  let result: Stage | null = null
  for (const h of app.stageHistory) {
    if (h.date <= date) result = h.stage
  }
  return result
}
```

- `funnel`：`rows` 取 `STAGE_DONE`；某层计数 = `apps.filter(a => a.stageHistory.some(h => STAGE_DONE.indexOf(h.stage) >= layer)).length`。**索引必须用 `STAGE_DONE`（6 项，`挂`/`无消息` 返回 -1 被排除），绝不能用 `STAGES`**——`STAGES` 里 `挂`=6、`无消息`=7 排在 `Offer`=5 之后，会把挂掉的投递算成到达 Offer，且不破坏单调性、不触发旧用例（spec §6.4）。返回 `{ rows: { stage, count, pct }[], base, max }`，`base = apps.length`，`pct = base ? count / base : 0`。**`max` 字段本任务必须保留**，且取值写成 `Math.max(1, base)` 而非 `base`——空库时 `base = 0`，模板里 `count / max` 会算出 `0/0 = NaN`，`width: NaN%` 被浏览器丢弃，本任务提交点的空态截图会出现漏斗条异常；`Math.max(1, …)` 与旧行为完全一致且零成本。`DashboardView.vue` 的模板还在读 `dashboard.funnel.max` 算条形宽度，`tsconfig.app.json` 把模板纳入 `vue-tsc -b`，本任务若删掉它，Step 4 的 `npm run build` 会直接报错（而单测反而会绿，因为宽度只是变成 `NaN%` 不抛异常）。`max` 由 Task 10 在改完模板后删除。
- `series`：12 个桶，桶 `i` 截止日 = 今天 − (11−i)×7 天（`toISOString().slice(0,10)`）。每桶用 `stageAt` 回放后套用与 `stats` 相同的谓词。`total` = `appliedAt <= D` 的条数。
- `todos`：`map` 里加 `status: a.status`。

- [ ] **Step 4: 跑测试确认通过**

```bash
npx vitest run src/modules/dashboard/__tests__/dashboard.test.ts
npm run build
```

预期：全部 passed（含原有 5 个）；`build` 退出码 0（`funnel.max` 仍在，模板不会报错）。

- [ ] **Step 5: Commit**

```bash
git add src/modules/dashboard/store.ts src/modules/dashboard/__tests__/dashboard.test.ts
git commit -m "feat: cumulative funnel and 12-week series in dashboard store"
```

---

## Task 10: 工作台视图重建〔视觉/结构〕

**Files:**
- Modify: `src/modules/dashboard/views/DashboardView.vue`
- Modify: `src/modules/dashboard/store.ts`（删除 Task 9 留下的 `max` 兼容字段）

- [ ] **Step 1: 栅格换成三行固定比例**

12 栅格 `span-3/8/4/6` → 三行固定比例：`.kpi-row`（4 等列）、`.row-a`（`minmax(0,1.34fr) minmax(300px,1fr)`）、`.row-b`（`minmax(0,.62fr) minmax(0,1fr)`），行间距 14px。`≤1360` 时 KPI 变 2 列、后两行变单列；`≤720` KPI 单列、磁贴保持 2 列。

- [ ] **Step 2: KPI 卡加走势图**

四张卡结构：标签（12.5px `--text2`）→ 数值（34px `--fw-bold` + `.tnum`）→ 增量行（`▲`/`▼` + `--success`/`--danger`，`--mono`）→ `<Sparkline :values="dashboard.series.total" />`。增量取 `series[11] - series[7]`，百分比以 `series[7]` 为基数，**基数为 0 时只显示绝对增量，不显示百分比**（spec §6.4）。
四卡统一为同一结构，**去掉第一张卡现有的 `.stat.accent` 渐变底**（`linear-gradient(135deg, var(--primary), #6d28d9)` 与 `color:#fff`），它是硬编码紫色、与冷灰体系冲突。`.span-3` 等栅格类随栅格改造一并移除。
**必须保留** `data-testid="stat-total|stat-inflight|stat-interviewing|stat-offers"` 与 `.stat-num` 类名。

- [ ] **Step 3: 漏斗加刻度轴**

行结构 `74px | 1fr | 42px | 54px`：名称 / 条形轨道 / 计数 / 百分比。轨道 `height:22px`，用 `background-image: linear-gradient(to right, var(--border) 1px, transparent 1px); background-size: 25% 100%` 画 0/25/50/75 网格线，右边缘用 `border-right` 补 100% 线。条形色阶 `#2f6bff → #4f80ff → #6c95ff → #8aabff → #a8c0ff → #c5d6ff` 六档（暗色下同样成立，设计图即如此）。轴标签行复用同一栅格，中列 `flex + space-between` 放 `0% 25% 50% 75% 100%`。

条形宽度改用 `row.pct`（`width: (row.pct * 100).toFixed(1) + '%'`），**改完模板后回到 `src/modules/dashboard/store.ts` 删掉 Task 9 留下的兼容字段 `max`**，并再跑一次 `npm run build` 确认没有别处引用它。

- [ ] **Step 4: 待办与里程碑**

待办行：日期 pill（`--mono`，边框 + `--card2` 底）+ 文案 + 副行（公司·岗位）+ 右侧 `<StatusBadge :stage="todo.status" />`。
里程碑：竖线 + 方块标记（`11px`，`border-radius:2px`；已完成填 `--success-vivid`，未完成 `--border2` 描边空心）+ 日期 pill + 文案（已完成用 `--muted`）。
**新增表单收进「＋ 添加里程碑」按钮，用 `v-show` 不用 `v-if`**——`dashboard.test.ts` 直接 `find('input[data-field="ms-date"]').setValue()` 而不点按钮，`v-if` 会让它找不到元素（spec §6.6）。`.ms-add`/`.ms-delete`/`.ms-actions` 内按钮顺序（完成 / 删除）全部保留。

- [ ] **Step 5: 快捷磁贴**

`.quick` 文字按钮 → 图标磁贴：`AppIcon`（26px）+ 标签，边框 + hover 变 `--primary-soft`。`.quick` 类名与 `go(path)` 逻辑保留。

**磁贴数量按现有 `QUICK` 常量走 —— 它只有 4 项，因此是 2×2，不是设计图的 2×3。** 不要为了凑满六格新造快捷入口：那是设计图有而项目没有的功能，与本计划在 Task 15 Step 4 立的规则一致。若确实想加，先跟用户确认加哪两项，再单独记为增量。

- [ ] **Step 6: 验证**

```bash
npx vitest run src/modules/dashboard/__tests__/dashboard.test.ts
npm run lint; npm run test:run; npm run build; npm run test:e2e
node scripts/ui-shots.mjs b2-dashboard
```

预期：全绿（含 e2e 的 `stat-total` 断言）。截图与设计图 `task-mthe956ggzl40.png` 逐块比对。

- [ ] **Step 7: Commit**

```bash
git add src/modules/dashboard/views/DashboardView.vue src/modules/dashboard/store.ts
git commit -m "feat: rebuild dashboard with sparklines, funnel axis and action tiles"
```

---

## Task 11: 台账表头排序〔TDD〕

**Files:**
- Modify: `src/modules/tracker/components/ApplicationTable.vue`
- Test: `src/modules/tracker/components/__tests__/ApplicationTable.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
  it('默认不排序，保持传入顺序', () => {
    const apps = [makeApp({ company: '乙公司' }), makeApp({ company: '甲公司' })]
    const wrapper = mount(ApplicationTable, { props: { applications: apps, stageFilter: '全部', query: '' } })
    expect(wrapper.findAll('.app-row')[0]!.text()).toContain('乙公司')
  })

  it('点表头三态循环：升序 → 降序 → 恢复原序', async () => {
    const apps = [makeApp({ company: '乙公司' }), makeApp({ company: '甲公司' })]
    const wrapper = mount(ApplicationTable, { props: { applications: apps, stageFilter: '全部', query: '' } })
    const th = wrapper.findAll('th').find((t) => t.text().includes('公司'))!
    await th.find('button').trigger('click')
    expect(wrapper.findAll('.app-row')[0]!.text()).toContain('甲公司')
    expect(th.attributes('aria-sort')).toBe('ascending')
    await th.find('button').trigger('click')
    expect(wrapper.findAll('.app-row')[0]!.text()).toContain('乙公司')
    expect(th.attributes('aria-sort')).toBe('descending')
    await th.find('button').trigger('click')
    expect(th.attributes('aria-sort')).toBe('none')
  })

  it('状态列按 STAGES 顺序排序而非字典序', async () => {
    const apps = [makeApp({ company: 'X', status: 'Offer' }), makeApp({ company: 'Y', status: '已投递' })]
    const wrapper = mount(ApplicationTable, { props: { applications: apps, stageFilter: '全部', query: '' } })
    const th = wrapper.findAll('th').find((t) => t.text().includes('状态'))!
    await th.find('button').trigger('click')
    expect(wrapper.findAll('.app-row')[0]!.text()).toContain('Y')   // 已投递(0) 在 Offer(5) 之前
  })
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npx vitest run src/modules/tracker/components/__tests__/ApplicationTable.test.ts
```

预期：原 3 个通过，新 3 个失败。

- [ ] **Step 3: 实现**

组件内 `const sortKey = ref<string | null>(null)`、`const sortDir = ref<1 | -1>(1)`。点击同一列：`null → asc → desc → null`。比较器：字符串 `localeCompare(b, 'zh')`；`status` 用 `STAGES.indexOf`；`appliedAt`/`batch` 直接 `<`。`sortKey === null` 时**返回过滤结果的原顺序**（这条是承重点：现有用例断言第 0 行是 `apps[0]`）。可排序列在 `th` 内放 `<button>`，`th` 上挂 `aria-sort`；箭头图标用 `AppIcon`。

- [ ] **Step 4: 跑测试确认通过**

```bash
npx vitest run src/modules/tracker/components/__tests__/ApplicationTable.test.ts
```

预期：6 passed。

- [ ] **Step 5: Commit**

```bash
git add src/modules/tracker/components/ApplicationTable.vue src/modules/tracker/components/__tests__/ApplicationTable.test.ts
git commit -m "feat: sortable columns in the application table"
```

---

## Task 12: 台账分页〔TDD〕

**Files:**
- Modify: `src/modules/tracker/components/ApplicationTable.vue`
- Test: `src/modules/tracker/components/__tests__/ApplicationTable.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
  it('每页 12 条，翻页显示其余记录', async () => {
    const apps = Array.from({ length: 14 }, (_, i) => makeApp({ company: `公司${String(i).padStart(2, '0')}` }))
    const wrapper = mount(ApplicationTable, { props: { applications: apps, stageFilter: '全部', query: '' } })
    expect(wrapper.findAll('.app-row')).toHaveLength(12)
    const pager = wrapper.find('.pager')
    expect(pager.exists()).toBe(true)
    await pager.findAll('button').find((b) => b.text() === '2')!.trigger('click')
    expect(wrapper.findAll('.app-row')).toHaveLength(2)
    expect(wrapper.find('.pg.on').text()).toBe('2')
  })

  it('12 条及以内不显示分页条', () => {
    const apps = Array.from({ length: 12 }, () => makeApp())
    const wrapper = mount(ApplicationTable, { props: { applications: apps, stageFilter: '全部', query: '' } })
    expect(wrapper.find('.pager').exists()).toBe(false)
  })

  it('筛选变化时回到第 1 页', async () => {
    // 20 条：14 条已投递 + 6 条无消息。筛成「已投递」后仍有 14 条（>12），分页条依然存在
    const apps = [
      ...Array.from({ length: 14 }, (_, i) => makeApp({ company: `甲${String(i).padStart(2, '0')}`, status: '已投递' })),
      ...Array.from({ length: 6 }, (_, i) => makeApp({ company: `乙${String(i).padStart(2, '0')}`, status: '无消息' })),
    ]
    const wrapper = mount(ApplicationTable, { props: { applications: apps, stageFilter: '全部', query: '' } })
    await wrapper.find('.pager').findAll('button').find((b) => b.text() === '2')!.trigger('click')
    expect(wrapper.find('.pg.on').text()).toBe('2')
    await wrapper.setProps({ stageFilter: '已投递' })
    expect(wrapper.find('.pg.on').text()).toBe('1')
    expect(wrapper.findAll('.app-row')).toHaveLength(12)
  })
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npx vitest run src/modules/tracker/components/__tests__/ApplicationTable.test.ts
```

预期：新 3 个失败。

- [ ] **Step 3: 实现**

`const page = ref(1)`，`PER = 12`。`watch([() => props.stageFilter, () => props.query, sortKey, sortDir], () => { page.value = 1 })`——**此处只监听本任务已存在的 props**；`channelFilter`/`starredOnly` 要到 Task 14 才加，现在写进 `watch` 会因属性不存在导致 `npm run build` 类型报错，由 Task 14 负责把它们补进这个 `watch`。总页数 ≤1 时不渲染 `.pager`。分页条：首页 / 上一页 / 页码 / 下一页 / 末页，按钮类 `.pg`，当前页 `.pg.on` + `aria-current="page"`，禁用态 `disabled`，图标用 `AppIcon first/left/right/last`，箭头按钮带 `aria-label`。表尾左侧显示 `已筛选 / 总数`。

**页码按钮内只能有页码数字**，不要塞图标或额外空白——用例用 `findAll('button').find(b => b.text() === '2')` 定位，多一个 `svg` 或空格就会失配。

- [ ] **Step 4: 跑测试确认通过**

```bash
npx vitest run src/modules/tracker/components/__tests__/ApplicationTable.test.ts
```

预期：9 passed。

- [ ] **Step 5: Commit**

```bash
git add src/modules/tracker/components/ApplicationTable.vue src/modules/tracker/components/__tests__/ApplicationTable.test.ts
git commit -m "feat: paginate the application table at 12 rows per page"
```

---

## Task 13: 收藏字段与存储往返〔TDD〕

**Files:**
- Modify: `src/storage/types.ts`
- Modify: `src/modules/tracker/store.ts`
- Test: `src/modules/tracker/__tests__/store.test.ts`
- Test: `src/storage/__tests__/backup.test.ts`

- [ ] **Step 1: 写失败测试（tracker store）**

```ts
  it('toggleStar 落库且可再次切换', async () => {
    const store = useTrackerStore()
    await store.load()
    const app = await store.addApplication({ company: 'A', position: 'B', batch: '正式批', channel: '官网', appliedAt: '2026-08-01' })
    expect(app.starred).toBeUndefined()
    await store.toggleStar(app.id)
    expect(store.find(app.id)!.starred).toBe(true)
    await store.load()
    expect(store.find(app.id)!.starred).toBe(true)   // 确认是落库不是内存
    await store.toggleStar(app.id)
    expect(store.find(app.id)!.starred).toBe(false)
  })

  it('toggleStar 不改写 status 与 stageHistory', async () => {
    const store = useTrackerStore()
    await store.load()
    const app = await store.addApplication({ company: 'A', position: 'B', batch: '正式批', channel: '官网', appliedAt: '2026-08-01' })
    await store.changeStage(app.id, '笔试')
    const before = store.find(app.id)!
    const historyLength = before.stageHistory.length
    await store.toggleStar(app.id)
    const after = store.find(app.id)!
    expect(after.status).toBe('笔试')
    expect(after.stageHistory).toHaveLength(historyLength)
    expect(after.status).toBe(after.stageHistory.at(-1)!.stage)   // 不变量
  })
```

- [ ] **Step 2: 写失败测试（backup 往返）**

```ts
  it('starred 字段在导出与导入之间往返', async () => {
    // 建一条 starred 投递 → exportBackup → validateBackup 通过 → 清库 → importBackup → 字段仍在
  })

  it('旧备份缺 starred 字段仍可导入', async () => {
    // 手工构造 schemaVersion 2 的 payload，applications[0] 不含 starred，validate 应 ok、import 应成功
  })
```

按 `src/storage/__tests__/backup.test.ts` 的**实际写法**补全，注意它与其他测试文件不同：

- **没有 `beforeEach`**，每个用例自己 `const db = createDb(\`test-${newId()}\`)`，并在 `try { … } finally { await db.delete() }` 里收尾。
- 投递数据来自 `./fixtures` 导出的 `makeApp`，不是文件内自定义的工厂。
- `validateBackup` 除表结构外还校验 `exportedAt`，手工构造的旧备份 payload **必须带上 `schemaVersion` 与 `exportedAt`**，否则会因缺字段而失败，掩盖真正想验证的「未知/缺失可选字段不影响导入」。

动手前先通读该文件一遍，照它的模式写。

- [ ] **Step 3: 跑测试确认失败**

```bash
npx vitest run src/modules/tracker/__tests__/store.test.ts src/storage/__tests__/backup.test.ts
```

预期：4 个新用例失败（`toggleStar` 不存在）。

- [ ] **Step 4: 实现**

`types.ts`：`Application` 接口加 `/** 行内收藏标记；未索引字段，无需 Dexie 版本升级 */ starred?: boolean`。

`store.ts`：

```ts
    /** 收藏切换：走 updateApplication，不经 changeStage，status 不变量不受影响 */
    async toggleStar(id: string) {
      const app = this.find(id)
      if (!app) return
      await this.updateApplication(id, { starred: !app.starred })
    },
```

**不要**改 Dexie 的 `version()` 声明（schema 字符串只声明索引，未索引字段自由持久化），**不要**动 `BACKUP_SCHEMA_VERSION`（validate 只校验必填键、不拒未知键）。

- [ ] **Step 5: 跑测试确认通过**

```bash
npx vitest run src/modules/tracker/__tests__/store.test.ts src/storage/__tests__/backup.test.ts
npm run test:run
```

预期：新用例全过，全量单测全绿。

- [ ] **Step 6: Commit**

```bash
git add src/storage/types.ts src/modules/tracker/store.ts src/modules/tracker/__tests__/store.test.ts src/storage/__tests__/backup.test.ts
git commit -m "feat: starred flag on applications with backup round-trip coverage"
```

---

## Task 14: 台账视图重建与工具栏筛选〔TDD + 视觉〕

**Files:**
- Modify: `src/modules/tracker/components/ApplicationTable.vue`
- Modify: `src/modules/tracker/views/TrackerView.vue`
- Test: `src/modules/tracker/components/__tests__/ApplicationTable.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
  it('★ 按钮发出 toggle-star 事件且不冒泡为打开详情', async () => {
    const apps = [makeApp()]
    const wrapper = mount(ApplicationTable, { props: { applications: apps, stageFilter: '全部', query: '' } })
    await wrapper.find('.star-btn').trigger('click')
    expect(wrapper.emitted('toggle-star')![0]).toEqual([apps[0]!.id])
    expect(wrapper.emitted('open')).toBeUndefined()
  })

  it('已收藏行的 ★ 按钮为按下态', () => {
    const wrapper = mount(ApplicationTable, { props: { applications: [makeApp({ starred: true })], stageFilter: '全部', query: '' } })
    expect(wrapper.find('.star-btn').attributes('aria-pressed')).toBe('true')
  })

  it('渠道筛选与只看收藏可叠加', () => {
    const apps = [makeApp({ company: 'A', channel: '内推', starred: true }), makeApp({ company: 'B', channel: '官网', starred: true }), makeApp({ company: 'C', channel: '内推' })]
    const byChannel = mount(ApplicationTable, { props: { applications: apps, stageFilter: '全部', query: '', channelFilter: '内推' } })
    expect(byChannel.findAll('.app-row')).toHaveLength(2)
    const both = mount(ApplicationTable, { props: { applications: apps, stageFilter: '全部', query: '', channelFilter: '内推', starredOnly: true } })
    expect(both.findAll('.app-row')).toHaveLength(1)
  })

  it('搜索覆盖备注与下一步', () => {
    const apps = [makeApp({ company: 'A', nextStep: '等笔试通知' }), makeApp({ company: 'B', notes: '内推人老王' })]
    expect(mount(ApplicationTable, { props: { applications: apps, stageFilter: '全部', query: '笔试通知' } }).findAll('.app-row')).toHaveLength(1)
    expect(mount(ApplicationTable, { props: { applications: apps, stageFilter: '全部', query: '老王' } }).findAll('.app-row')).toHaveLength(1)
  })
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npx vitest run src/modules/tracker/components/__tests__/ApplicationTable.test.ts
```

预期：新 4 个失败。

- [ ] **Step 3: 实现表格**

新增可选 props `channelFilter?: string`、`starredOnly?: boolean`（**带默认值，保证现有 5 处 mount 不改**），并把这两项补进 Task 12 建立的 `watch` 源列表（筛选变化回第 1 页）。过滤链：`stageFilter → channelFilter → starredOnly → query`（query 匹配 `company/position/nextStep/notes`）。

列改为 9 列：公司 / 职位（从 `.co-cell` 拆成两列）/ 批次 / 渠道 / 投递日 / 状态 / 下一步 / 面试 / 操作，`min-width: 1080px` 横向滚动。状态列改用 `<StatusBadge>`。**操作列 = 「详情」文字按钮（`.row-open`，文案不变）+ 紧随其后的 `.star-btn` 图标按钮**，不新增第 10 列（spec §5.3）。`.star-btn` 上 `@click.stop`、`aria-pressed`、`aria-label="收藏"`。选中行（`.app-row.on`）左侧 3px `--primary` 内阴影。
**保留**：`.app-table`、`.app-row`、`.stage-badge`、`.row-open`、`data-testid="app-table"`、空态文案「没有符合条件的投递记录」、`超1月视为挂` 提示。

- [ ] **Step 4: 实现工具栏**

`TrackerView.vue`：工具栏包进 `.card`；`.chip-row`（9 个筒片）→ 两个 `ElSelect`（全部状态 / 所有渠道）+ 一个「只看收藏」切换按钮；搜索框 `placeholder` 改「搜索公司 / 职位 / 备注」。新增 `channelFilter`、`starredOnly` 两个 ref 并透传给表格，监听表格的 `toggle-star` 调 `store.toggleStar`。
**保留**：`mode-seg` 的 `role="tablist"`/`role="tab"` 与三个 tab 文案「表格 / 看板 / 候选池」、`＋ 新增投递` 文案、`data-field="search"`。

- [ ] **Step 5: 验证**

```bash
npx vitest run src/modules/tracker/components/__tests__/ApplicationTable.test.ts
npm run lint; npm run test:run; npm run build; npm run test:e2e
node scripts/ui-shots.mjs b3-tracker
```

预期：13 passed；e2e「新增 → 表格 → 看板 → 抽屉推进」流程绿。截图与 `task-mthebxu2hq2ky.png` 比对。

- [ ] **Step 6: Commit**

```bash
git add src/modules/tracker/components/ApplicationTable.vue src/modules/tracker/views/TrackerView.vue src/modules/tracker/components/__tests__/ApplicationTable.test.ts
git commit -m "feat: rebuild application ledger with dropdown filters and inline star"
```

---

## Task 15: 看板列色条与卡片重建〔视觉/结构〕

**Files:**
- Modify: `src/modules/tracker/components/ApplicationBoard.vue`

- [ ] **Step 1: 列头与色条**

七列（`BOARD_COLUMNS`，含「挂 / 无消息」）各自顶部 3px 色条：已投递 `--info-vivid`、笔试 `--violet-vivid`、一面/二面/HR面 `--warn-vivid`、Offer `--success-vivid`、挂 / 无消息 `--danger-vivid`。用列上的内联 CSS 变量 `--kc`/`--kc-text`/`--kc-soft`/`--kc-border` 下发，卡片内标签与圆点引用它们（做法见 `design-demo/cool-slate-light-demo.html` 的 `renderBoard`）。列头计数改为 `.col-count` chip（`--mono`，两位补零）。

- [ ] **Step 2: 卡片重建**

`.board-card` 内容：公司（13px `--fw-bold`）/ 岗位（12px `--text2`）/ 标签行（渠道 + 批次，色随列）/ 页脚（投递日 `--mono` + `.kdot` 圆点）。原来直接放 `.stage-badge` 的位置改为页脚圆点——同列卡片状态相同，徽章是冗余信息；但**`.stage-badge` 必须仍出现在抽屉里**（e2e 断言 `drawer.locator('.stage-badge')`），抽屉不动即可。

- [ ] **Step 3: 保留契约**

`.board-card`、`.board-col`、`.col-title`、`data-column`、`draggable`、`@dragstart`/`@drop`、`Enter`/`Space` 键盘处理、`aria-label` 全部保留——`ApplicationBoard.test.ts` 的两条拖拽用例与 e2e 的 `dispatchEvent('click')` 都依赖它们。

- [ ] **Step 4: 验证**

```bash
npx vitest run src/modules/tracker/components/__tests__/ApplicationBoard.test.ts
npm run test:run; npm run test:e2e
node scripts/ui-shots.mjs b4-board
```

预期：全绿。截图与 `task-mthedqi5i3eiu.png` 比对：列顶色条、计数 chip、标签色随列、虚线添加位（本项目无「添加卡片」功能，**不要新造**——设计图有但项目没有，属功能增量，不在范围内）。

- [ ] **Step 5: Commit**

```bash
git add src/modules/tracker/components/ApplicationBoard.vue
git commit -m "style: stage-colored kanban columns and restructured cards"
```

---

## Task 16: 抽屉、弹窗与公司库令牌化〔视觉/结构〕

**Files:**
- Modify: `src/modules/tracker/components/ApplicationDrawer.vue`
- Modify: `src/modules/tracker/components/ApplicationDialog.vue`
- Modify: `src/modules/tracker/components/CompanyPoolView.vue`

- [ ] **Step 1: 三个组件对齐令牌**

只调样式：卡片化分组（`--card`/`--border`/`--r-lg`）、标题层级、`--mono` 用于日期与计数、图标按钮改 `AppIcon`、间距对齐 8px 栅格。**结构与事件一律不动。**

- [ ] **Step 2: 保留契约**

`.app-drawer`、`.stage-badge`、「阶段流转」、`推进到…`、`.pool-card`、`.pool-convert`、`.pool-remove`、`.track-main`、`优先级 N`、空态「候选池为空」。

- [ ] **Step 3: 验证（B4 批次末尾）**

```bash
npx vitest run src/modules/tracker/components/__tests__/CompanyPoolView.test.ts
npm run lint; npm run test:run; npm run build; npm run test:e2e
node scripts/ui-shots.mjs b4-done
```

预期：全绿。e2e 抽屉推进用例必须通过（它断言 `.stage-badge` 文本变「笔试」）。

- [ ] **Step 4: Commit**

```bash
git add src/modules/tracker/components/ApplicationDrawer.vue src/modules/tracker/components/ApplicationDialog.vue src/modules/tracker/components/CompanyPoolView.vue
git commit -m "style: tokenize application drawer, dialog and company pool"
```

---

## Task 17: 先落用户未提交的 A4 缩放改动〔前置〕

**Files:**
- Modify: 无（只提交既有工作区改动）

> **注意：** 工作区里 `src/modules/resume/views/ResumeView.vue` 有一处**用户未提交的改动**——用 `ResizeObserver` + `.sheet-scaler` 实现 A4 等比缩放预览、`initStore()` 替代 `onMounted`、打印时解除缩放。B5 会改同一个文件，必须先把这份工作独立成一个提交，避免混进重构 diff，也避免被覆盖。

- [ ] **Step 1: 复核改动内容**

```bash
git diff -- src/modules/resume/views/ResumeView.vue
```

预期看到六处改动，全部属于同一件事（A4 等比缩放预览），没有夹带无关内容：

1. `initStore()` + `void initStore()` 取代 `onMounted`；
2. 新增 `previewEl` ref、`sheetScale`、`ResizeObserver`、`A4_WIDTH_PX = 794`、`onBeforeUnmount` 清理；
3. 模板里 `.resume-preview` 内套 `.sheet-scaler > div` 两层缩放容器；
4. `.resume-layout` 的第一列 `minmax(320px,480px)` → `minmax(0,480px)`，`.resume-side` 补显式 `grid-template-columns: minmax(0,1fr)`（消除隐式 auto 列被 nowrap 标题撑破的重叠问题）；
5. 1180px 断点里删掉原来的 `overflow-x:auto` 横滚兜底（缩放后不再需要）；
6. `@media print` 里补 `.sheet-scaler` 解除缩放。

> 1180px 断点本身是**原有**的，不是这次新增；改的是断点内部的兜底方式。

- [ ] **Step 2: 征得用户确认后提交**

这是别人的未提交工作，**必须先问过用户**再提交。得到确认后：

```bash
git add src/modules/resume/views/ResumeView.vue
git commit -m "feat: proportional A4 preview scaling with ResizeObserver"
```

若用户不同意提交，则跳过本任务，B5 期间保持该文件的工作区改动，并把「A4 缩放改动未纳入版本控制」记为 TD。

- [ ] **Step 3: 记录新增契约**

`.sheet-scaler`、`.sheet-scaler > div`、`previewEl` ref 与 1180px 断点即日起纳入保护范围（spec §8.2 未列，因为它是本次会话新增的工作区改动）。B5 改 `ResumeView.vue` 时不得破坏 A4 缩放与打印解除缩放。

---

## Task 18: 简历版本 chip 化〔视觉/结构〕

**Files:**
- Modify: `src/modules/resume/components/VersionManager.vue`

- [ ] **Step 1: 重建**

列表 → 版本 chip 行（`--mono`，激活态 `--primary-soft` 底 + `--primary` 边 + `--primary-text` 字）+ 虚线「＋ 新建」chip + 下方「最后更新 …」行（`--mono`，`--muted`）。

- [ ] **Step 2: 保留契约**

`.vm-card`、`.vm-card-actions`、`.vm-create`、`.vm-delete`、`.section-row`、`.section-entries`、空态「还没有简历版本」、`「甲 · 硕士」` 式的 `·` 分隔格式——`VersionManager.test.ts` 全部依赖。**`.vm-card-actions` 内的按钮顺序也是契约**：第 1 个是「重命名」、第 2 个是「复制」，用例按下标取。**先读一遍该测试文件再动手**，它是本任务唯一的回归网。

- [ ] **Step 3: 验证**

```bash
npx vitest run src/modules/resume/components/__tests__/VersionManager.test.ts
```

预期：全绿。若某条用例因结构变化失败，优先改实现回到契约，而不是改测试。

- [ ] **Step 4: Commit**

```bash
git add src/modules/resume/components/VersionManager.vue
git commit -m "style: version chips in the resume version manager"
```

---

## Task 19: 资料池折叠〔TDD〕

**Files:**
- Modify: `src/modules/resume/components/ProfileEditor.vue`
- Modify: `src/modules/resume/components/EntryCard.vue`
- Test: `src/modules/resume/components/__tests__/ProfileEditor.test.ts`

- [ ] **Step 1: 写失败测试（追加）**

```ts
  it('组头是手风琴按钮，带 aria-expanded 与 aria-controls', async () => {
    const { wrapper } = await setup()
    const head = wrapper.findAll('.tab-btn').find((b) => b.text().includes('教育背景'))!
    expect(head.attributes('aria-expanded')).toBe('false')
    expect(head.attributes('aria-controls')).toBeTruthy()
    await head.trigger('click')
    expect(head.attributes('aria-expanded')).toBe('true')
  })

  it('单开：展开新组时前一组收起', async () => {
    const { wrapper } = await setup()
    const edu = wrapper.findAll('.tab-btn').find((b) => b.text().includes('教育背景'))!
    await edu.trigger('click')
    const exp = wrapper.findAll('.tab-btn').find((b) => b.text().includes('实习经历'))!
    await exp.trigger('click')
    expect(edu.attributes('aria-expanded')).toBe('false')
    expect(exp.attributes('aria-expanded')).toBe('true')
  })

  it('默认展开基本信息', async () => {
    const { wrapper } = await setup()
    expect(wrapper.find('input[data-field="name"]').exists()).toBe(true)
  })
```

**辅助函数叫 `setup()` 且返回 `{ store, wrapper }`**（`ProfileEditor.test.ts` 顶部），不是 `mountEditor()`——写错了既不编译也拿不到 wrapper。动手前先看一眼它的签名。

- [ ] **Step 2: 跑测试确认失败**

```bash
npx vitest run src/modules/resume/components/__tests__/ProfileEditor.test.ts
```

预期：原有 9 个通过、新增 3 个失败。**原有用例必须保持通过**——它们靠 `.tab-btn` 文案、`.add-entry`、`.entry-save`、`.basic-save`、`.self-save`、`.entry-delete`、`.entry-dialog`、`.entry-card .entry-actions button:nth-child(3)` 定位（spec §6.6）。

- [ ] **Step 3: 实现**

`activeTab: Ref<string>` → `openGroup: Ref<string | null>`，默认 `'basic'`。`.tab-strip` 横向 tab 条 → 纵向组列表：每组一行 `<button class="tab-btn" :aria-expanded :aria-controls>`（chevron + 组名 + 计数 chip），展开区 `v-if` 只渲染当前组（与原来 tab 行为一致，因此原用例仍成立）。**类名 `.tab-btn` 与组文案一字不改。**

`EntryCard.vue`：外观改成资料池条目行（`AppIcon grip` 手柄 + 标题/副标题 + 四个图标按钮），**四个按钮的顺序必须保持 上移 / 下移 / 编辑 / 删除**——`button:nth-child(3)` 取编辑、`findAll('button')[1]` 取下移，顺序一变两条用例同时红。`.entry-card`、`.entry-actions`、`.entry-delete` 保留。

- [ ] **Step 4: 跑测试确认通过**

```bash
npx vitest run src/modules/resume/components/__tests__/ProfileEditor.test.ts
```

预期：12 passed。

- [ ] **Step 5: Commit**

```bash
git add src/modules/resume/components/ProfileEditor.vue src/modules/resume/components/EntryCard.vue src/modules/resume/components/__tests__/ProfileEditor.test.ts
git commit -m "feat: accordion resource pool in the profile editor"
```

---

## Task 20: 简历页工具栏与纸面台面〔视觉/结构〕

**Files:**
- Modify: `src/modules/resume/views/ResumeView.vue`

- [ ] **Step 1: 工具栏移入右栏**

顶部通栏 `.resume-toolbar` → 移到右栏纸面上方（主按钮「打印 / 导出 PDF」+ `AppIcon printer`）。**文案「打印 / 导出 PDF」一字不改**（e2e 依赖 `getByRole('button', { name: '打印 / 导出 PDF' })`）。空态的「一键填入示例资料」「从空白开始」也不改。

- [ ] **Step 2: 纸面台面**

`.resume-preview` 外层加 `--surface-muted` 台面 + `--border` + `--r-lg` + 内边距 24px，纸面本身保持白底 + `--shadow-md`。**A4 缩放逻辑（`previewEl`/`sheetScale`/`ResizeObserver`/`.sheet-scaler`）与 `@media print` 块整段不动**，只在外面套台面容器；改完必须实测打印预览仍只输出纸面。

- [ ] **Step 3: 验证**

```bash
npx vitest run src/modules/resume/sheet/__tests__/ResumeSheet.test.ts
npm run lint; npm run test:run; npm run build; npm run test:e2e
node scripts/ui-shots.mjs b5-resume
```

预期：全绿；e2e 简历流程（示例数据 → `[data-testid="resume-sheet"]` 含「王小明」→ `.sheet` 含「专业技能」→ 打印按钮可见）通过。截图与 `task-mthegssij7hmy.png` 比对。另需手动在浏览器 `Ctrl+P` 核对一次打印预览。

- [ ] **Step 4: Commit**

```bash
git add src/modules/resume/views/ResumeView.vue
git commit -m "style: resume paper stage with right-column toolbar"
```

---

## Task 21: 材料库三栏与正文渲染〔视觉/结构〕

**Files:**
- Modify: `src/modules/library/views/LibraryView.vue`

- [ ] **Step 1: 两栏改三栏**

`.lib-layout` 从 `300px minmax(0,1fr)` 改为 `208px 358px minmax(0,1fr)`，整体收进单张 `.card`，栏间用 `border-right` 分隔。分类从顶部 `.lib-toolbar > .chip-row` 移入左栏（`AppIcon` + 名称 + 计数），左栏顶部加 `CATEGORY` 小标签。上传/新建按钮留在右侧或左栏底部。

**`.chip` 类名必须保留**——`LibraryView.test.ts` 靠 `.chip` 切换分类，改名会让这一批的验收落空（spec §5.5）。

- [ ] **Step 2: 文档卡与阅读区**

`.lib-item`：标题 + 右上 `.src-tag`（文案「内置」/「我的文档」不变）+ 两行摘要（`-webkit-line-clamp:2`）+ 标签 + 日期（`--mono`）。选中态左 3px `--primary` 轨。
阅读区：头部标题 + 操作按钮组；`.doc-body` 内的 markdown 输出补样式——`ul > li` 用方形蓝色 `::before`（6px `--primary`）、`blockquote` 左 3px 边框 + `--primary-soft` 底、`pre > code` 加 `--border` 边框 + `--card2` 底 + `--mono`。**不引入语法高亮库**（spec §2.2）。

- [ ] **Step 3: 保留契约**

`.lib-item`、`.src-tag`（含 `.src-tag.local`）、`.doc-body`、`[data-testid="doc-body"]`、`.chip`、`.create-btn`、`.editor-save`、`.edit-btn`、`.reset-btn`、`input[type=file]`、`.lib-empty`、文案「重置为内置」「删除」与本机文档的完整文案 `编辑（保存后覆盖内置）`（**不得截断为「编辑」**）。

- [ ] **Step 4: 响应式**

`≤1024` 三栏改竖向堆叠：分类横向滚动条、文档列表横向滚动、阅读区占满。390px 下必须无横向溢出（e2e 有断言）。

- [ ] **Step 5: 验证**

```bash
npx vitest run src/modules/library/__tests__/LibraryView.test.ts
npm run lint; npm run test:run; npm run build; npm run test:e2e
node scripts/ui-shots.mjs b6-library
```

预期：全绿；e2e 材料库用例（内置可读 + 上传 md + `.src-tag` 两种文案）通过。截图与 `task-mthejvcykr7dx.png` 比对。

- [ ] **Step 6: Commit**

```bash
git add src/modules/library/views/LibraryView.vue
git commit -m "feat: three-pane library layout with typographic content styles"
```

---

## Task 22: 演示站卡片网格与 Deck 令牌化〔视觉/结构〕

**Files:**
- Modify: `src/modules/showcase/views/ShowcaseView.vue`
- Modify: `src/modules/showcase/components/DeckOverlay.vue`

- [ ] **Step 1: 演示站**

hero + bento → 项目卡片网格（3 列，`≤1360` 2 列，`≤720` 1 列）：名称 + 徽章 + 描述 + 标签行 + 页脚（更新时间 `--mono`）。`font-family: var(--font-display)` 两处改无衬线 + `letter-spacing: -.02em`。

- [ ] **Step 2: Deck**

只做令牌化与去衬线（两处 `--font-display` 改无衬线）。**双轴导航、键盘处理、`iframe sandbox`、Blob URL 生命周期一律不动。**

- [ ] **Step 3: 保留契约**

`.deck-open` 与文案「▶ 进入项目演示」、`.upload-open`、`[data-testid="deck-overlay"]`、`.dt-title`、`.deck-slide.vertical`、`.deck-face.on`、`.df-iframe`、`.src-tag`。

- [ ] **Step 4: 验证（B6 批次末尾）**

```bash
npx vitest run src/modules/showcase/__tests__/deck.test.ts src/modules/showcase/__tests__/demoStore.test.ts
npm run lint; npm run test:run; npm run build; npm run test:e2e
node scripts/ui-shots.mjs b6-done
```

预期：全绿；e2e 演示站用例（Deck 双轴 + `ArrowRight`/`ArrowDown` + iframe + `Escape`）通过。

- [ ] **Step 5: Commit**

```bash
git add src/modules/showcase/views/ShowcaseView.vue src/modules/showcase/components/DeckOverlay.vue
git commit -m "style: project card grid and tokenized deck overlay"
```

---

## Task 23: 全量验证与文档同步〔收口〕

**Files:**
- Modify: `AGENTS.md`
- Modify: `DESIGN.md`（整篇替换）
- Modify: `src/styles/tokens.css`（注释，若 Task 1 未改完）

- [ ] **Step 1: 四视口 × 亮暗全量核对**

```bash
npm run build && node scripts/ui-shots.mjs final
```

逐页与 `design-demo/design-cool-slate/*.png` 及 `cool-slate-light-demo.html` 比对，重点看 900px 这一档——它是「抽屉壳 + 桌面模块」的混合带（spec §5.1）。发现的问题按严重度分流：能当场修的修，不能的记 TD。

- [ ] **Step 2: 四件套 + 溢出检查**

```bash
npm run lint; echo "lint=$?"
npm run test:run; echo "test=$?"
npm run build; echo "build=$?"
npm run test:e2e; echo "e2e=$?"
git diff --check
```

预期：四个 0，`git diff --check` 无输出。

- [ ] **Step 3: 同步 `AGENTS.md`**

- §1「设计语言『清简专业风』… 视觉基准是 `design-demo/index.html`」→ Cool Slate + `design-demo/cool-slate-light-demo.html`。
- §5 那句「E2E 中窄视口不可达元素（**隐藏侧边栏**、transform 轨道内卡片、动画中的抽屉按钮）用 hash 直达」——侧栏已改抽屉，理由需重写。
- §3 目录表补 `src/shared/ui/`（共享 UI 原语）一行。
- **`AGENTS.md` 全文没有出现过 860，不要去找**（spec §9）。

- [ ] **Step 4: 替换 `DESIGN.md`**

整篇替换为 Cool Slate 说明：设计哲学一段、令牌清单（亮/暗）、语义色与 `-vivid` 的分工、字重与等宽数字规则、可访问性下限（正文 ≥4.5:1、控件边框 ≥3:1）、动效两档时长、共享原语用法。**不保留** Playful Geometric 的任何内容（用户已确认替换）。

- [ ] **Step 5: 更新 e2e 注释**

`tests/e2e/job-console.spec.ts:7` 的「窄视口（≤860px 侧边栏隐藏）退化为 hash 直达」改为反映抽屉与 1024 断点的新事实。

- [ ] **Step 6: Commit**

```bash
git add AGENTS.md DESIGN.md tests/e2e/job-console.spec.ts src/styles/tokens.css
git commit -m "docs: sync agents guide and rewrite design system doc for cool slate"
```

---

## Task 24: 技术债清理〔收口〕

- [ ] **Step 1: 通读技术债登记表**

读下方「技术债登记」全部条目，按「影响面 × 修复成本」排序。

- [ ] **Step 2: 逐条修复**

每条一个提交，提交信息前缀 `fix:`（缺陷）或 `refactor:`（结构问题）。修完把该行状态改为 `已修复 <commit>`。

- [ ] **Step 3: 确认无遗留兜底**

```bash
grep -rn "TODO\|FIXME\|HACK\|暂时\|临时" src --include=*.vue --include=*.ts | grep -v "__tests__"
```

预期：无本次重构引入的新条目。

- [ ] **Step 4: 最终四件套**

```bash
npm run lint; npm run test:run; npm run build; npm run test:e2e
```

预期：四个 0。

- [ ] **Step 5: Commit**

按本轮实际修复的条目**逐个列出具体文件路径**，例如：

```bash
git status --short                      # 先核对暂存内容
git add docs/superpowers/plans/2026-09-01-cool-slate-ui-refactor.md
git add <TD-1 涉及的具体文件> <TD-2 涉及的具体文件> …
git commit -m "docs: close out cool slate refactor technical debt"
```

> **不要用 `git add -A`，也不要用 `git add src/modules` 这类宽路径。** 若 Task 17 因用户未同意而保留了 `ResumeView.vue` 的工作区改动，它就在 `src/modules/` 下，宽路径会把它裹进本提交——这正是 round 1 指出的风险，缩小目录范围并没有消除它。

---

## 技术债登记

执行期间发现、无法在当前任务内一次性解决的问题记在这里。**不得留静默兜底。**

| 编号 | 发现于 | 问题 | 触发条件与影响面 | 临时处置 | 根因修复方向 | 状态 |
|---|---|---|---|---|---|---|
| — | — | （执行时追加） | — | — | — | — |









