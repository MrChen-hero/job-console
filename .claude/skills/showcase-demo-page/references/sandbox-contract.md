# 沙箱与落地契约

落盘前必读。这里的每条都来自演示站现有实现，违反其一 = 页面在演示站里直接坏掉，或触发隐私红线。

- [1. 渲染链路](#1-渲染链路)
- [2. 命名与归属](#2-命名与归属)
- [3. 禁用 API 与替代写法](#3-禁用-api-与替代写法)
- [4. 自包含](#4-自包含)
- [5. 体积预算](#5-体积预算)
- [6. 尺寸与自适应](#6-尺寸与自适应)
- [7. 隐私类别](#7-隐私类别)
- [8. 落盘步骤](#8-落盘步骤)

## 1. 渲染链路

演示页不是普通页面，它被这样喂进主站：

```
src/content/demos/*.html
  → import.meta.glob({ query: '?raw', eager: true })   # localContent.ts:22
  → demoUrl(html) = URL.createObjectURL(Blob)          # demoStore.ts:22
  → <iframe src="blob:..." sandbox="allow-scripts" allowfullscreen>   # DeckOverlay.vue:214
```

三个后果，全部不可绕过：

1. **只放开 `allow-scripts`**。没有 `allow-same-origin`，页面处在不透明源（opaque origin，匿名源身份）里，本地存储类 API 全废；没有 `allow-forms`，表单提交被静默拦；没有 `allow-popups`，`window.open` 与 `_blank` 打不开。
2. **地址是 `blob:`**，页面里任何相对路径（`./x.png`、`/x.css`、`img/x.svg`）都无处可解。
3. **`eager: true` 内联进 JS 产物**，文件多大，主 chunk 就大多少，没有懒加载兜底。

## 2. 命名与归属

先分清两个通道，契约不一样：

| 通道 | 怎么进站 | 归属怎么定 | 影响面 |
|---|---|---|---|
| **runtime（默认）** | 用户在「项目演示」页「上传演示页」 | 上传弹窗的项目下拉，**文件名不参与** | 只存自己浏览器的 IndexedDB，随备份 JSON 走 |
| **compile（仅内置示例）** | 文件放进 `src/content/demos/` | 文件名 `--` 前缀 | 进 git、进构建产物、成为所有使用者的内置内容 |

本仓库是公开模板：**默认走 runtime**，产出物落未跟踪的 `demo-out/`，不改 `showcase.config.ts`。上传弹窗（`DemoUploadDialog.vue:26`）用 `<title>` 预填标题，用户可改；`projectId` 取自下拉框，默认第一个可见项目。

编译时通道的文件名就是元数据，没有 frontmatter 这一层：

| 派生项 | 规则 | 出处 |
|---|---|---|
| `id` | 文件名去掉 `.html` | `localContent.ts:28` |
| `projectId` | `--` 之前的前缀 | `localContent.ts:56` |
| 标题 | `<title>` 内容，缺失回落成 `id` | `localContent.ts:62` |

命名格式 `<projectId>--<slug>.html`，全小写连字符。**最容易踩的坑**：`projectId` 不在 `src/config/showcase.config.ts` 的 id 集合里时，代码不报错，**静默**把这个 demo 归到第一个项目上——表现是「演示页出现在了别人家」。自检脚本按路径自动判定通道，编译时才拦这一项。

标题会出现在 Deck 的提示行「交互演示 · {标题}」，同一项目有多页时还带「（1 / N）」。写成「系统名 · 这一页演的是什么」，别写成英文 slug。

## 3. 禁用 API 与替代写法

| 禁 | 为什么 | 改成 |
|---|---|---|
| `localStorage` / `sessionStorage` | 实测抛 `Failed to read the 'localStorage' property from 'Window': The document is sandboxed and lacks the 'allow-same-origin' flag.`，且**整段 `<script>` 就此中断**——表现是页面只剩静态骨架，JS 渲染的部分全空 | 内存变量持有演示状态；刷新即回初值，这对演示是优点 |
| `document.cookie` | 读写无效 | 同上 |
| `history.pushState` / `replaceState` | 抛 `SecurityError` | 页内跳转用 `#锚点` 或 `scrollIntoView()` |
| `<form action>` 真实提交 | 无 `allow-forms`，点了没反应 | `<button type="button">` + JS，或 `onsubmit="return false"` |
| `window.open` / `target="_blank"` | 无 `allow-popups` | 页内展开面板；确实要给外链就写成不可点的样式化文本 |
| `fetch` / `XHR` / `WebSocket` | 违反自包含，离线必崩 | 假数据写死在 JS 里，用 `setTimeout` 模拟延迟 |
| `requestFullscreen` | Deck 已提供网页全屏与屏幕全屏两级 | 什么都不做，让 Deck 管 |
| `parent` / `top` | 跨源访问抛错 | 演示页与主站不通信 |
| `navigator.clipboard` | 沙箱下常被拒 | 点击后就地显示「已复制」的假反馈 |

`alert` / `confirm` / `prompt` 技术上能用，但在 iframe 里体验割裂，改页内提示条。

## 4. 自包含

一个文件，零外部请求。浏览器其实不拦沙箱页发网络请求，是 `AGENTS.md` 明令禁止：站点要能离线打开、不给第三方发请求、内网演示不掉链子。

- **CSS / JS**：全部内联在 `<style>` 与 `<script>` 里。
- **字体**：只用系统栈。外链 webfont 违规，base64 字体动辄几百 KB，撞体积线。中文正文推荐
  `font-family: system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`；
  数字与代码用 `ui-monospace, "Cascadia Code", Consolas, monospace`，并给数字加 `font-variant-numeric: tabular-nums`，表格才不跳。
- **图标**：内联 `<svg>`。别引图标库，别用 emoji 撑门面（跨平台字形差异太大，只在标记位偶尔用）。
- **图片**：能用 CSS/SVG 画就画（头像用首字母色块，图表用 SVG 折线/柱形）。真要位图才上 data URI，且计入体积。

## 5. 体积预算

| 通道 | 目标 | 硬上限 | 为什么 |
|---|---|---|---|
| runtime | 300 KB | 1 MB | 存 IndexedDB，整段字符串还会进导出的备份 JSON |
| compile | 120 KB | 200 KB | `eager: true` 原样内联进主 chunk，没有懒加载兜底 |

参照物：现有内置示例 demo 1.8 KB，主 chunk 618 KB。

超线的压法，按收益排序：合并重复 CSS（用 `:root` 变量 + 工具类，别每块重写一遍）→ 精简 SVG（去掉设计工具留下的 `<defs>`、注释、多余小数位）→ 砍假数据行数（10–20 行足够演示分页与筛选）→ 删掉没被任何交互引用的装饰性区块。

编译时压不下来就停手，把「demos 的 glob 改成非 eager 懒加载」记成后续项交给用户决定，不要自行改主站加载策略。

## 6. 尺寸与自适应

同一份 HTML 要在三种尺寸下都成立：

| 场景 | 可用尺寸 |
|---|---|
| Deck 常态 | 宽随卡片、高约 510px（桌面 1440×900 实测） |
| 网页全屏 | 铺满视口，Deck 上下栏与信息区隐藏 |
| 屏幕全屏 | 整块屏幕（iframe 自身 `requestFullscreen`） |
| 移动端 | 390px 宽 |

做法：容器宽度用 `clamp()` / `minmax()`，固定 px 只用于小组件（图标、徽标、行高），不用于布局骨架；主区高度用 `min-height` 而非 `height`；390px 下侧栏折叠为顶部横向滚动的分页签。**不允许出现横向溢出**（e2e 会在 390px 断言主站 `scrollWidth <= clientWidth`；演示页内部的溢出靠自己目视三档）。

配色自带一套固定值，与主站亮/暗主题无关——Deck 没给 iframe 任何主题通道（只传 `src`/`sandbox`/`title`）。想跟随主题需要给 Deck 加 postMessage，属另一次改动。

**要写 e2e 点演示页内部时**：390px 下演示页被 Deck 裁剪，`locator.click()` 可能落在 iframe 可见区之外被静默吞掉（表现是断言「元素不存在」而点击本身不报错），改用 `dispatchEvent('click')` 绕过命中测试——与 `AGENTS.md` §5 记的 transform 轨道同类坑，桌面与平板不受影响。

## 7. 隐私类别

演示页会随仓库部署到公开 Pages，等于对外发布。以下类别一律不出现在演示页、文件名、注释里：

真实人名 · 学校与院系 · 雇主与客户单位 · 竞赛与项目立项名 · 上游框架身份（二次开发自哪个开源后台）· 内网地址与 IP · 账号、密钥、连接串 · 真实业务数据与真实截图。

源码里的模块名、包名、仓库名本身可能就带身份信息（例如模块前缀含学校英文缩写），复刻时一律改写成中性名称。

本文件与技能其余文件同样是公开内容，**不在此枚举具体禁词**。具体词表放本机未跟踪文件 `.claude/privacy-words.local`（已在 `.gitignore` 里），自检时用 `--words` 传入。

## 8. 落盘步骤

默认（runtime 通道）：产出到 `demo-out/`，跑两个脚本，然后把上传方式交代给用户。

```bash
# 1. 静态自检（按路径自动判定通道；红了就改到绿，退出码 0 才算过）
node .claude/skills/showcase-demo-page/scripts/check-demo.mjs \
  demo-out/<name>.html --words .claude/privacy-words.local

# 2. 运行时冒烟：按真实条件（Blob URL + sandbox）加载，点一遍所有按钮，查 JS 错误与横向溢出
node .claude/skills/showcase-demo-page/scripts/smoke-demo.mjs demo-out/<name>.html
```

两个脚本互补：静态自检抓的是「写法违规」（外链、禁用 API、命名、体积），冒烟抓的是「运行期真崩」（沙箱抛错导致整段脚本中断、固定宽度导致横向溢出）。静态检查放过的东西冒烟能抓到，反之也成立，两个都要跑。

**第三道：截图逐像素采样**。两个脚本都不看「长得对不对」——自选了配色、变量没生效、页面自己滚走导致顶部条不可见，全都能过。用 Playwright 截图后按坐标取色，与源项目的色号逐个对照：

```js
// 采样示例：侧栏背景应等于源项目 $menuBg，选中项应等于 $menuHover
const im = ... // 读 PNG，取 (100,100) 与选中行区域的众数色
```

实测这一步抓到过两类问题：`scrollIntoView` 把整份文档滚走（顶部「只读演示」标记消失，但脚本全绿）、复刻时用了自选配色而非源项目色号。

交付话术：让用户进「项目演示 →＋新增项目」填自己的卡片文案（标题 / 定位 / 简介 / 技术栈 / 要点），再点「上传演示页」选 `demo-out/` 里这个文件、在下拉里选刚建的项目。**不要**替用户改 `src/config/showcase.config.ts`——那是公开模板的内置内容，不该塞进某一个人的项目。

仅当明确要做仓库内置示例时才走 compile 通道：另存到 `src/content/demos/<projectId>--<slug>.html`（文件名前缀必须先在 `SHOWCASE_PROJECTS` 里有对应 id），再跑一次自检（此时按编译时预算收紧）与 `npm run build` 核对包体增量。

不管走哪个通道，最后都要目视三档：Deck 常态、网页全屏、390px。
