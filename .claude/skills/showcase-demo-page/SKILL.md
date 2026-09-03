---
name: showcase-demo-page
description: 深度调研一个真实项目，产出一页单文件自包含、可交互的高保真演示页，落进本仓库演示站的 src/content/demos/。当用户要求「给某个项目做演示页 / demo 页 / 功能介绍页」、「把项目复刻成能点的前端演示」、「往项目演示模块加一个交互 demo」，或直接给出项目源码路径要求生成展示页时使用。输入可以是本地源码目录（含仓库外的路径）、文档或截图。
---

# 项目演示页复刻

把一个真实项目还原成一页能点的演示页：主视觉是产品界面的高保真模拟，下面接功能分区与实现要点。产出是**单文件自包含 HTML**，由演示站 Deck 以 Blob URL + 沙箱 iframe 渲染。

**默认只产出文件、不进仓库**：写到未跟踪的 `demo-out/`，由用户自己在「项目演示」页新增项目卡片并上传演示页（运行时通道，只存在他自己的浏览器里）。本仓库是公开模板，把某个人的项目信息写进 `showcase.config.ts` 或 `src/content/demos/` 会变成所有使用者的内置内容——只有仓库主人要做内置示例时才显式走编译时通道。

首版一个项目只做一页。Deck 的纵向多层已支持同项目多页，需要第二页时再多产出一个文件即可。

## 按阶段读 reference

不要一次全读，四份材料各管一段：

| 阶段 | 读 | 用来 |
|---|---|---|
| A 取证 | `references/research-playbook.md` | 判定读码还是访谈，填满「复刻规格」表 |
| B 形态定稿 | `references/landing-anatomy.md` | 定分区、保真度、可点流程 |
| C 生成 | `assets/skeleton.html` | 起手骨架（已过全部自检），替换成项目自己的内容 |
| D 落地 | `references/sandbox-contract.md` | 沙箱禁令、命名契约、体积预算、自检命令 |

## 阶段 A · 取证

有可读源码目录就读码，只有资料截图就走访谈；两者都有以读码为主。按 `research-playbook.md` 的固定顺序取证，**只取能进演示页的信息**（模块清单、一屏的完整字段、2–3 个状态机、真实文案），填满规格表即停，不去读懂整个系统。

源码目录只读不写，可以在本仓库之外。

## 阶段 B · 形态定稿（必须等用户确认）

用 `landing-anatomy.md` 末尾的模板填三张清单：分区清单、可点流程、隐私改写清单。交用户确认后再动手写码。

这一步省不掉：写完几百行 HTML 再返工，代价远大于一次确认。

## 阶段 C · 生成

1. 复制 `assets/skeleton.html` 起手。骨架已含状态机、操作日志、反例路径、窄屏折叠、`prefers-reduced-motion` 降级，且自检与冒烟全绿。
2. 视觉方向调用 `frontend-design` 技能确定：一个项目一套配色与排版，**不复用上一个项目的方向**。
3. 逐项替换骨架里的占位：`:root` 配色、模块名、表格列、状态文案、按钮措辞、假数据。留一个占位没换就是交付事故。
4. 保真度默认交付 L1（骨架）+ L2（流程），L3（细节）只挑一处点睛。

## 阶段 D · 自检与落地

```bash
node .claude/skills/showcase-demo-page/scripts/check-demo.mjs demo-out/<name>.html --words .claude/privacy-words.local
node .claude/skills/showcase-demo-page/scripts/smoke-demo.mjs demo-out/<name>.html
```

两条都要显式核对退出码。静态自检管「写法违规」，冒烟管「运行期真崩」（沙箱抛错、横向溢出），两者互补，不能只跑一个。

交付时告诉用户怎么装上去：「项目演示 →＋新增项目」填卡片文案 →「上传演示页」选这个文件。上传弹窗用 `<title>` 预填标题、按项目下拉决定归属。**不要**替用户改 `showcase.config.ts`。

只有明确要做仓库内置示例时，才另存到 `src/content/demos/<projectId>--<slug>.html`：此时文件名与体积按编译时契约收紧（自检脚本按路径自动切换），并且要跑 `npm run build` 核对包体增量。

## 不可协商的硬规则

违反任一条，页面会在演示站里直接坏掉或触发隐私红线。完整原因与替代写法见 `sandbox-contract.md`。

1. 单文件自包含：CSS/JS 内联，零外链，零相对路径资源；图标用内联 SVG，字体用系统栈。
2. 禁 `localStorage` / `sessionStorage` / `document.cookie` / `history.pushState`——沙箱下抛错，**整段脚本就此中断**。
3. 禁真实 `<form>` 提交、`window.open`、`target="_blank"`、`fetch` 及一切网络请求。
4. 禁在演示页内调 `requestFullscreen`、禁访问 `parent` / `top`——Deck 管全屏，演示页不与主站通信。
5. 归属：运行时通道由上传弹窗的项目下拉决定，文件名随意；编译时通道靠文件名 `<projectId>--<slug>.html`，前缀不命中 `showcase.config.ts` 的 id 会**静默**落到第一个项目。
6. `<title>` 非空，写成「系统名 · 这一页演的是什么」——上传弹窗用它预填标题，Deck 提示行也显示它。
7. 体积：运行时 ≤ 300 KB（存 IndexedDB，且整段会进备份 JSON）；编译时 ≤ 120 KB、硬上限 200 KB（eager 内联进主 chunk，无懒加载兜底）。
8. 布局全流式，390px 到整屏都不许横向溢出；配色自带固定一套，与主站主题无关。
9. UTF-8 无 BOM。

## 隐私

演示页随仓库部署到公开 Pages，等于对外发布。以下类别一律不出现在页面、文件名与注释里：真实人名 · 学校院系 · 雇主与客户单位 · 竞赛与立项名 · 上游框架身份 · 内网地址与 IP · 账号密钥 · 真实业务数据与截图。

源码的模块名、包名、仓库名本身可能带身份信息（例如前缀含单位英文缩写），一律改写成中性名称。具体禁词表在本机未跟踪文件 `.claude/privacy-words.local`，自检时用 `--words` 传入；**技能文件里不枚举禁词**，那等于把要抹掉的字符串重新发布。

## 常见失败

| 症状 | 原因 | 解法 |
|---|---|---|
| 演示页出现在别的项目卡片下 | **仅编译时通道**：文件名 `--` 前缀不在 `showcase.config.ts` 的 id 集合里，代码静默回落到第一个项目 | 改名，或先在 `SHOWCASE_PROJECTS` 补一条 |
| 页面只剩静态骨架，交互全死 | 脚本里用了被沙箱禁的 API，第一次访问就抛错，后面整段不执行 | 跑 `smoke-demo.mjs` 看报文，按提示换写法 |
| 按钮点了没反应 | 真实 `<form>` 提交或 `target="_blank"` 被沙箱拦 | 改 `<button type="button">` + JS |
| 图标、字体、图片全丢 | 引了外链或相对路径资源，`blob:` 下无处可解 | 内联 SVG + data URI + 系统字体栈 |
| 移动端整页缩成一团或横向滚动 | 缺 viewport meta，或布局用了固定 px | 补 `width=device-width`，宽度改 `clamp()` / `minmax()` |
| `npm run build` 后包体明显变大 | demos 是 eager 内联，文件多大主 chunk 就大多少 | 压 CSS/SVG/假数据到 120 KB 内 |
| 熟悉该系统的人说「不像」 | 列名、状态文案是自己编的近义词 | 回源码抄原文（身份信息除外） |
| 观众以为在操作真系统 | 缺「演示数据 · 只读」标记与页脚虚构声明 | 两处都补上 |
