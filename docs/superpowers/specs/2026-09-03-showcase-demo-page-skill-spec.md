# 演示页复刻技能（showcase-demo-page）· 概要规格

- 日期：2026-09-03
- 级别：Level 2（边界清晰的单模块多文件；回滚 = 删目录）
- 状态：待批准
- 产出位置：`.claude/skills/showcase-demo-page/`（**项目级**技能，随本仓库走）
- 连带影响：`.claude/` 未被 `.gitignore` 覆盖，技能文件会随仓库推到公开的 Pages 仓库，故技能自身内容按「公开可见」对待（见 §7 第 5 条）

## 1. 目标与范围

把「深度调研一个真实项目 → 产出一页尽可能复刻真实界面的可交互演示页」固化成可重复流程，产出物直接落进「求职工作台」演示站的编译时内容通道。

参考基准：ZCode 官网（<https://zcode.z.ai/cn>）。它是一页完整形态，主视觉是**产品界面的高保真模拟**——真实窗口外壳、真实模块名（任务列表 / 终端 / Git / Goal 面板）、合理的假数据（4 个仓库分组、带相对时间的任务行、`+734 -7` 的差异计数）、可点的分页签与折叠行；下方再接价格、功能分区、下载、页脚。本技能生成的页面按同一思路组织。

### 纳入

1. 调研流水线：有源码走读码取证；无源码走资料 + 截图的访谈式重建。
2. 单页形态规范：顶部条 + 高保真界面复刻 + 功能分区 + 技术栈要点 + 页脚，含保真度分级。
3. 沙箱与落地契约清单，加一个零依赖自检脚本。
4. 落盘 `src/content/demos/<projectId>--<slug>.html`；可切换为「只产出临时文件、不进仓库」。

> **执行期修订（2026-09-03，用户拍板）**：本仓库将作为公开模板开源，任何人的项目信息都不该变成所有使用者的内置内容。故**默认通道反转为 runtime**——技能只产出 HTML 到未跟踪的 `demo-out/`，由使用者自己在页面上「新增项目」填卡片文案并「上传演示页」；`showcase.config.ts` 与 `src/content/demos/` 默认不动，仅仓库主人做内置示例时才走编译时通道。自检脚本按路径自动判定通道，两套体积预算与归属规则随之分叉（runtime 300 KB/1 MB、文件名不参与归属；compile 120 KB/200 KB、文件名即归属）。

### 不纳入

1. 改动演示站运行时代码（`deck.ts` / `DeckOverlay.vue` / `demoStore.ts` 结构不动）。
2. 一次生成多个演示页。首版一页；Deck 纵向多层本就支持，后续追加只是多写一个文件。
3. 演示页与主站亮/暗主题联动（要给 Deck 加 postMessage 通道，属另一次改动）。
4. 真实后端或数据库接入。演示页永远是内存里的虚构数据。

## 2. 术语说明

| 术语 | 含义 |
|---|---|
| sandbox iframe | HTML 的 `<iframe sandbox="...">`：默认剥掉同源身份、表单提交、弹窗等能力，再按白名单逐项放开。本项目只放开 `allow-scripts`（允许跑 JS） |
| opaque origin（不透明源） | 沙箱页拿到的匿名源身份。后果是本地存储类 API 直接不可用 |
| Blob URL | `blob:` 开头的临时地址，把内存里的一段 HTML 当文件喂给 iframe。后果是页面内相对路径（`./x.png`）无处可解 |
| 编译时通道 | 内容以文件形式放进 `src/content/`，构建时打进产物随站点部署；对应的「运行时通道」是部署后在页面上传、存进浏览器数据库 |
| eager glob | Vite 的 `import.meta.glob(..., { eager: true })`：构建期就把匹配文件的内容内联进 JS 产物，不做懒加载 |
| 保真度（fidelity） | 复刻的逼真程度。本规范分 L1 骨架 / L2 流程 / L3 细节三级 |

## 3. 已核对的落地约束

| 约束 | 事实 | 证据 |
|---|---|---|
| 归属靠文件名 | `id` = 文件名去扩展名；`projectId` = `--` 前缀，且必须命中 `SHOWCASE_PROJECTS[].id`，不命中会**静默**归到第一个项目 | `src/modules/library/localContent.ts:56` |
| 标题取 `<title>` | Deck 提示行「交互演示 · {title}」直接显示它，缺失回落成文件名 | `localContent.ts:62` |
| 渲染方式 | Blob URL + `<iframe sandbox="allow-scripts" allowfullscreen>`，未放开 same-origin / forms / popups | `DeckOverlay.vue:214`、`demoStore.ts:22` |
| 体积直接进包 | `import.meta.glob('*.html', { query: '?raw', eager: true })` 原样内联；当前主 chunk 618 KB，现有示例 demo 仅 1.8 KB | `localContent.ts:22`、`dist/assets/index-*.js` |
| 尺寸跨度 | 常态高约 510px → 网页全屏铺满视口 → 屏幕全屏整屏；且要在 390px 宽下可用 | `AGENTS.md` §4、e2e 三视口 |
| 主题不可读 | Deck 只给 iframe 传 `src`/`sandbox`/`title`，没有主题或消息通道 | `DeckOverlay.vue:214` |

### 由此派生的硬规则（同时写进 SKILL.md 与自检脚本）

1. 禁 `localStorage` / `sessionStorage` / `document.cookie`——opaque origin 下抛错或静默失效。
2. 禁 `history.pushState` / `replaceState`——opaque origin 下抛 `SecurityError`。页内跳转只用 hash 锚点或 JS 滚动。
3. 禁真实 `<form>` 提交（无 `allow-forms`）、`window.open` 与 `target="_blank"`（无 `allow-popups`）、顶层跳转。
4. 禁一切外链子资源（CSS/JS/字体/图片/CDN）。浏览器并不拦网络请求，是 `AGENTS.md` 明令自包含；且 Blob URL 下相对路径必失效。
5. 图片只用内联 SVG 或 data URI；字体只用系统栈（外链 webfont 违规，base64 字体太胖）。
6. 不在演示页内自己调 `requestFullscreen`——Deck 已提供网页全屏与屏幕全屏两级。
7. 布局全流式（`clamp()` / `minmax()` / 容器查询）。单档固定宽度会在 390px 与整屏两端同时露怯。
8. UTF-8 无 BOM。

### 体积预算

目标 ≤ 120 KB/页，硬上限 200 KB。超限先压（合并重复 CSS、精简 SVG、砍假数据行数）；仍超限则记为后续项「把 demos 的 glob 改成非 eager 懒加载」，不在本技能内改主站代码。

## 4. 技能结构

```text
showcase-demo-page/
├── SKILL.md                    # 触发描述 + 四阶段流水线 + 硬规则清单（目标 ≤ 200 行）
├── references/
│   ├── research-playbook.md    # 两条调研路线的取证清单 + 复刻规格模板
│   ├── landing-anatomy.md      # 单页形态规范：分区、保真度分级、脚本化交互写法
│   └── sandbox-contract.md     # 沙箱禁用清单、命名契约、体积预算、落盘与自检步骤
├── assets/
│   └── skeleton.html           # 最小骨架：分区结构 + :root 变量 + 零外链，自身过自检
└── scripts/
    ├── check-demo.mjs          # 零依赖 Node 静态自检，退出码驱动
    └── smoke-demo.mjs          # 运行时冒烟：Blob URL + sandbox 真实条件下加载并点一遍
```

职责边界：SKILL.md 只留「怎么走流程 + 什么时候读哪个 reference」；细节全部下沉到 references，避免正文膨胀。三个 reference 各自独立，一次任务通常只需读其中一到两个。

`check-demo.mjs` 的检查项（确定性强、易错，适合固化成脚本而非靠记性）：文件名正则与 `projectId` 是否命中 `showcase.config.ts` 的 id 集合、`<title>` 非空、无外链、无禁用 API、无相对路径资源、字节数对照预算、UTF-8 无 BOM，以及可选的本地禁词表比对（`--words <file>`）。

`smoke-demo.mjs` 是执行期追加的第二个脚本（本 spec 原计划只有一个）：静态正则查不出「沙箱下抛错导致整段脚本中断」和「固定宽度导致横向溢出」这两类问题，它用仓库已有的 `@playwright/test` 按真实条件（Blob URL + `sandbox="allow-scripts"`）加载演示页，点一遍所有可见按钮，收集 JS 异常并在三档视口测横向溢出。

## 5. 运行流水线

### 阶段 A · 取证

输入两种，自动判定：给了源码路径（可在仓库外，如 `D:\A-Project\...`，只读不写）走读码；只给资料/截图走访谈式重建。

读码取证按固定顺序，避免漫游：技术栈（`pom.xml` / `package.json` / README）→ 模块清单（路由表、菜单表、侧栏配置）→ 能力清单（Controller 与接口签名）→ 数据与状态机（实体类、DDL、枚举、状态字段）→ 真实界面细节（前端页面与组件：表格列、表单字段、状态标签文案、按钮措辞）→ 权限配置。

无源码时按 `research-playbook.md` 的问卷取证，并逐屏拆解截图；凡属推断的结论必须在交付说明里标注「推断」，不写成事实。

输出「复刻规格」：模块清单、每模块的界面元素与字段、2–3 个核心流程的状态机、真实文案口径。默认只存在于会话中，不落盘（落盘会把内部信息带进仓库）。

### 阶段 B · 形态定稿

1. 选 1 屏作 hero 复刻对象——优先「列表 + 筛选 + 行操作」的主表页，最能代表一个后台系统。
2. 定 3–5 个功能分区，对应真实模块，每区一句价值陈述 + 1 个可点交互。
3. 定 2–3 个能真的点完的流程，含反例路径（校验失败、权限拒绝、终态不可再操作）。
4. 把分区清单与交互清单交给用户确认，再进入写码。

### 阶段 C · 生成

从 `assets/skeleton.html` 起手，单文件、CSS 变量集中在 `:root`。视觉方向调用 `frontend-design` 技能确定，一个项目一套配色，不复用上一个项目的方向。假数据 10–20 行足够，人名用通用占位，部门与公司用中性名。交互写成纯 JS 内存状态机，动作留痕（呼应真实系统的日志与审计）。

### 阶段 D · 自检与落地

1. `check-demo.mjs <file> --words .claude/privacy-words.local` 与 `smoke-demo.mjs <file>` 两条都要绿（前者管写法违规，后者管运行期真崩）。
2. 产出留在未跟踪的 `demo-out/`，把「＋新增项目 → 上传演示页」的操作步骤与卡片建议文案交给用户，不代改 `showcase.config.ts`。
3. 三档视口目视：Deck 常态 / 网页全屏 / 390px。
4. 仅当要做仓库内置示例：另存 `src/content/demos/<projectId>--<slug>.html`，此时按编译时契约收紧（文件名归属 + 120/200 KB）并跑 `npm run build` 核对包体增量。

## 6. 单页形态规范（细节见 `references/landing-anatomy.md`）

自上而下：

1. **顶部条**：项目名 + 一句话定位 + 「演示数据 · 只读」标记，明示不是真系统。
2. **Hero**：高保真界面复刻，本页的主角。ZCode 的做法可直接对标——真实外壳、真实模块名、合理假数据、可点的分页签/折叠行/表格行。
3. **功能分区**：3–5 块，图文 + 内嵌小交互。
4. **技术栈与实现要点**：与 `showcase.config.ts` 的 `stack` / `demo.points` 对齐。
5. **页脚**：一行「个人作品演示，数据全部虚构」。

保真度分级，避免无边界堆工作量：

- **L1 骨架保真**：布局、导航、模块名、表格列、状态标签文案取真。
- **L2 流程保真**：2–3 个核心流程可点完，含反例路径。
- **L3 细节保真**：空态、加载态、错误文案、快捷键提示。

默认交付 L1 + L2，L3 只挑一处点睛。

## 7. 隐私与合规硬约束

1. 演示页内所有数据虚构。不出现真实人名、真实客户或单位名、内网地址与 IP、账号、密钥、真实截图。
2. 沿用 `showcase.config.ts` 现有口径（「示例公司」「虚构示例」）。除用户明确指示，不写入真实雇主名。
3. 落盘前跑既有隐私 grep。注意上游开源后台脚手架的框架名也在禁词表内——复刻同类后台时不得写出框架身份。
4. 仓库外源码只读，不把源码片段（含注释里的内部信息）原样搬进演示页。
5. 技能自身是公开仓库内容，**禁词清单不得在技能文件里枚举**——那等于把要抹掉的字符串重新发布。技能文档只描述类别（真实姓名、学校、单位、竞赛、客户、上游框架身份等），具体词表放本地未跟踪文件 `.claude/privacy-words.local`（同步加进 `.gitignore`），由 `check-demo.mjs --words` 读取；文件缺失时脚本给警告而非静默放过。
6. 源码里的模块名/包名/仓库名可能本身就带身份信息（如本次试跑项目的模块前缀含学校英文缩写），复刻时一律改写为中性名称，不出现在演示页与文件名中。

## 8. 关键取舍

- **体积 vs 保真**：ZCode 级保真的单文件页容易到 100 KB 级，而 demos 是 eager 内联，直接加到主 chunk。故设 120/200 KB 双线，先压内容，不动主站加载策略。
- **一页 vs 多页**：首版一页完整形态（Deck 一层），符合「先做一页、再慢慢优化」。追加第二页只是多写一个文件，零代码改动。
- **脚本化演出 vs 真实逻辑**：ZCode 的 hero 是脚本化演出。本规范要求核心流程真可点，但不实现真实业务规则（例如不真解析 Excel），用「看得见的校验与状态流转」替代。
- **主题不同步**：演示页自带固定配色，与主站亮/暗切换无关。要同步得给 Deck 加 postMessage，属另一次改动。

## Execution Checkpoints

- [x] Checkpoint 1：技能骨架落地——用 `skill-creator/scripts/init_skill.py` 生成目录与 frontmatter，`quick_validate.py` 退出码 0
- [x] Checkpoint 2：`references/sandbox-contract.md` + `scripts/check-demo.mjs` 完成，用现有 `campus-market--review-flow.html` 作正样本、另造 3 个负样本（外链 / `localStorage` / 超体积）验证退出码分别为 0 与非 0
- [x] Checkpoint 3：`references/landing-anatomy.md` + `assets/skeleton.html` 完成，骨架自身过自检
- [x] Checkpoint 4：`references/research-playbook.md` 完成——两条路线的取证清单与复刻规格模板
- [x] Checkpoint 5：SKILL.md 正文写完（四阶段 + 硬规则 + reference 阅读时机），全文 ≤ 200 行
- [x] Checkpoint 6：端到端试跑 `D:\A-Project\Lab\Java\gbms-ai`（多模块 Java 单体 + AI 模块 + 前端，只读）——产出一页到 `demo-out/`，静态自检 + 冒烟双绿、禁词比对无命中，再用真实 UI 走一遍「新增项目 → 上传演示页 → 进 Deck 渲染」，三档视口目视

## 执行记录（2026-09-03）

试跑产出 `demo-out/cadre-archive-ai-chat.html`，43.2 KB：静态自检 0 阻塞 / 0 提醒 / 6 通过（含 13 条禁词比对），冒烟 21 个可见按钮点 17 个、无 JS 错误、三档视口横向溢出均 0px；临时 e2e 走通「新增项目 → 上传演示页（`<title>` 自动预填标题）→ Deck 落在该项目 → 页内 5 步研判流程 + 政策问答 2 条引用 + 只读拒答」，desktop / tablet / mobile 三 project 全过后删除该临时用例。

执行期三处发现，均已回写进技能：

1. **默认通道反转为 runtime**（用户拍板，见 §1 修订块）——公开模板不该内置某个人的项目内容。
2. **`scrollIntoView` 会把整份文档一起滚走**：演示页初始动画结束后顶部条（含「合成数据 · 只读演示」标记）被滚出视口。静态自检与冒烟都查不出，靠截图逐像素采样发现（印章红像素 0），改成只滚消息容器后复测 632/784 命中。
3. **390px 下 iframe 内的真实点击会被静默吞掉**：演示页在 Deck 里被裁剪，`locator.click()` 不报错但事件没到达，断言表现为「元素不存在」；改 `dispatchEvent('click')` 后三视口全过，已写进 `sandbox-contract.md` §6。

## 验证方式

1. `node scripts/check-demo.mjs`：1 个正样本 + 3 个负样本的退出码符合预期。
2. `quick_validate.py`：技能 frontmatter 与命名规则通过。
3. 端到端一次真实产出：静态自检 + 冒烟双绿、禁词比对无命中、真实 UI 走通「新增项目 → 上传演示页 → Deck 渲染」、390 / 1024 / 1440 三视口目视无横向溢出。

不跑全量 e2e——本技能不改运行时代码，Deck 行为不变；产出物默认不进 `src/content/demos/`，也就不影响构建产物与既有 e2e 断言。
