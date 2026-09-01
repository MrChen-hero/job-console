# Cool Slate UI 重构设计

- 日期：2026-09-01
- 状态：已与用户逐节确认，待评审
- 视觉基准：`design-demo/cool-slate-light-demo.html`（亮色为默认主题，暗色取设计图原始配色）
- 设计图来源：`design-demo/design-cool-slate/*.png`（5 张，图像模型生成的示意图，非可实现规范）

## 1. 背景与目标

项目当前设计语言是「清简专业风」：暖石灰中性色（`--bg #f7f7f5`、`--text #1c1917`）+ 靛蓝主色 `#4f46e5`，视觉基准 `design-demo/index.html`。用户希望改为 cool slate（冷灰中性色 + 单一蓝色强调 + 语义状态色）的亮色版本，并补齐设计图中存在、项目尚缺的交互。

目标：

1. 全站视觉切换到 cool slate 亮/暗双主题，观感对齐 `cool-slate-light-demo.html`。
2. 五个模块的视图结构按设计图重排（卡片密度、KPI 走势图、漏斗刻度轴、看板列色条、材料库三栏、简历资料池）。
3. 补六项交互增量：台账表头排序、分页、下拉筛选、KPI 迷你走势图、行内收藏、简历资料池折叠。
4. 修复移动端导航缺陷（当前 ≤860px 侧栏 `display:none`，窄屏无任何导航入口）。
5. 全程不破坏既有测试契约与存储不变量。

非目标：不改功能语义、不动数据模型语义、不换技术栈。

## 2. 范围

### 2.1 纳入

- 令牌层 `src/styles/tokens.css`、全局基线 `src/styles/global.css`、状态徽章表 `src/modules/tracker/badges.css`。
- 新增共享原语目录 `src/shared/ui/`（四个组件）。
- 布局壳 `src/shared/layout/`（三个文件）+ 移动端抽屉。
- 五模块视图与组件的结构重建。
- 交互增量 C1–C6（第 6 节）。
- `Application` 类型新增一个可选字段 `starred`。
- 文档同步：`AGENTS.md`、`tokens.css` 注释、`DESIGN.md` 替换。

### 2.2 不纳入

- 不引入 Tailwind/UnoCSS，不替换 Element Plus。
- 不引入语法高亮库与图表库（Sparkline 手写 SVG）。
- 不改路由结构、不加页面。
- 不动 Dexie schema 版本（当前 v2）与备份 schema 版本（`BACKUP_SCHEMA_VERSION = 2`）。
- 不加命令面板 ⌘K、通知中心、toast 体系——设计图里没有，参考 demo 中也已移除。
- 不改投递阶段词表与看板列语义（`已投递/笔试/一面/二面/HR面/Offer/挂/无消息`，看板 7 列）。

## 3. 分层与批次

### 3.1 分层

自下而上，每层只依赖下层：

| 层 | 位置 | 职责 |
|---|---|---|
| L0 设计令牌 | `src/styles/tokens.css` | cool slate 亮/暗两套 + 语义色别名 + Element Plus 桥接 |
| L1 全局基线 | `src/styles/global.css` | 字重收敛、等宽数字工具类、`:focus-visible`、reduced-motion |
| L2 共享原语 | `src/shared/ui/`（新增） | 仅收「两处以上使用」的表现型组件 |
| L3 布局壳 | `src/shared/layout/` | 侧栏（图标 + 边框化 + 激活左轨 + 移动抽屉）、顶栏、内容区 |
| L4 模块视图 | `src/modules/*/` | 五模块视图与组件结构 + 交互增量 |

L2 准入标准是「两处以上使用」，避免为对齐设计图造一次性抽象。分页条、数据工具栏、折叠面板、快捷磁贴各只一处使用，留在模块内。

### 3.2 批次划分

一批一提交，可独立验收与回滚。

| 批次 | 内容 | 验收要点 |
|---|---|---|
| B0 | 令牌 + 全局基线 + EP 桥接 | 全站变色、结构不动；四件套全绿；亮暗两套 + 390px 无横向溢出 |
| B1 | 共享原语四件 + 布局壳 + 移动抽屉 | `layout.test.ts` 原样通过；新增抽屉开合单测 |
| B2 | 工作台结构重建 + C4 走势图 | `dashboard.test.ts` 原样通过；`stat-*` testid 保留 |
| B3 | 台账结构重建 + C1/C2/C3/C5 | `ApplicationTable.test.ts` 原样通过 + 新增用例；starred 往返；e2e 投递流程 |
| B4 | 看板 + 抽屉 + 弹窗 + 公司库 | `ApplicationBoard`/`CompanyPoolView` 单测；e2e 看板→抽屉推进 |
| B5 | 简历结构重建 + C6 资料池折叠 | `ProfileEditor`/`VersionManager`/`ResumeSheet` 单测；e2e 简历流程；打印样式 |
| B6 | 材料库三栏 + 项目演示 | `LibraryView`/deck 单测；e2e 材料库与演示站 |
| B7 | 收口 + 文档同步 | 四件套 + 三视口核对；`AGENTS.md`/`tokens.css` 注释/`DESIGN.md` |

排序依据：令牌先行，后续每批都在最终配色下开发，避免二次调色；壳层第二，它决定内容区宽度、内边距与卡片间距基线；模块按「改动量 × 测试耦合度」升序，把重写 `ProfileEditor` 这类高耦合项放到后面，此时原语与令牌是否够用已被前几批验证。

模块间不互相 import 组件（`AGENTS.md` 既有约束），因此任一模块批次可单独回滚而不影响其他模块。

## 4. 令牌层与共享原语

### 4.1 令牌不改名，只改值

现有 43 个令牌被引用约 347 次（分布在 22 个 `.vue` 文件；计入 `.css` 共 384 次），其中 `--border` 59、`--muted` 43、`--text2` 37、`--primary` 28。**决定：保留全部现有令牌名，只替换取值，另加新令牌。** 这样 B0 是单文件值级 diff，全部组件一行不动，回滚即 revert 一个文件；若改名，B0 会把全部组件拖进来，批次边界失效。

demo 令牌名 → 项目令牌名对照：

| demo | 项目 | 备注 |
|---|---|---|
| `--surface` | `--card` | |
| `--surface-soft` | `--card2` | |
| `--surface-muted` | `--surface-muted`（新增） | 背景色，**勿与 `--muted` 混用** |
| `--text-2` | `--text2` | |
| `--text-3` | `--muted` | 项目里 `--muted` 是文字色，不是背景 |
| `--border-strong` | `--border2` | |
| `--control` | `--control`（新增） | 表单控件边框 |

### 4.2 亮色取值

```css
--bg: #f2f5f9;  --card: #ffffff;  --card2: #f7f9fc;  --surface-muted: #edf2f8;
--text: #172033;  --text2: #4c5a6e;  --muted: #64748b;
--border: #dbe3ec;  --border2: #c3cfdd;  --control: #828fa0;
--primary: #2f6bff;        /* 色条、激活边框、圆点等非文字元素 */
--primary-strong: #2559dc; /* 填充按钮底色 */
--primary-text: #1d4ed8;   /* 小字、链接、激活导航文字 */
--primary-hover: #1d4ed8;  --primary-soft: #eaf2ff;  --primary-border: #c7dbff;
--info: #1d4ed8;    --info-soft: #eaf2ff;  --info-border: #c7dbff;  --info-vivid: #2f6bff;
--success: #12795f; --success-soft: #e4f5ef; --success-border: #b3e0d1; --success-vivid: #10a37f;
--warn: #96650f;    --warn-soft: #fdf2e0;  --warn-border: #f0d7a8;  --warn-vivid: #e0a10a;
--danger: #b73d4a;  --danger-soft: #fdedef; --danger-border: #f3ccd1; --danger-vivid: #e05260;
--violet: #5b46c0;  --violet-soft: #eeebfd; --violet-border: #d4ccf9; --violet-vivid: #7c5cf0;
--teal / --amber / --rose 及其 -soft：保留令牌名，按冷灰体系重算（现有引用少但不能失效）
--shadow-sm: 0 1px 2px rgba(23,32,51,.05);
--shadow-md: 0 1px 2px rgba(23,32,51,.05), 0 4px 14px rgba(23,32,51,.08);
--shadow-lg: 0 18px 48px rgba(23,32,51,.16);
--r-sm: 6px;  --r-md: 8px;  --r-lg: 10px;        /* 原 8/10/14 */
--sidebar-w: 250px;  --topbar-h: 86px;           /* --sidebar-w 原 236px；--topbar-h 新增 */
--mono: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Noto Sans Mono', monospace;
--fw-normal: 400;  --fw-medium: 500;  --fw-semibold: 600;  --fw-bold: 700;
```

三处对比度修正（按 WCAG 2.x 相对亮度公式实算）：

| 令牌 | 原值 | 新值 | 对比度 | 理由 |
|---|---|---|---|---|
| `--muted` | `#a8a29e` | `#64748b` | 2.52:1 → 4.76:1 | 用于 11–12px 小字 43 处，原值远低于 AA |
| `--primary-strong` / `--primary-text` | 无（统一用 `--primary`） | `#2559dc` / `#1d4ed8` | 白字 6.04:1 / 白底 6.70:1 | 直接用 `#2f6bff` 只有 4.50:1，卡在阈值上 |
| `--control` | 无（控件用 `--border`） | `#828fa0` | 1.26:1 → 3.29:1 | 空输入框的边界是唯一识别标志，WCAG 1.4.11 要求 ≥3:1 |

`--font-display`（衬线）现用于简历纸面 2 处、Deck 2 处、演示站 2 处。cool slate 不用衬线：**保留令牌但收敛到简历 A4 纸面**（打印物用衬线标题合理，且纸面是固定配色面），Deck 与演示站改无衬线 + 收紧字距。

### 4.3 暗色取值

`[data-theme='dark']` 覆盖同名令牌，取设计图原始配色：

```css
--bg: #090c11;  --card: #11161e;  --card2: #141a23;  --surface-muted: #1b222d;
--text: #e8edf4;  --text2: #a6b3c4;  --muted: #8493a6;
--border: #222a36;  --border2: #303a49;  --control: #4a5566;
--primary: #4d84ff;  --primary-strong: #3b74f5;  --primary-text: #8cb0ff;
--primary-soft: rgba(77,132,255,.15);  --primary-border: rgba(77,132,255,.36);
--info: #60a5fa;  --success: #34d399;  --warn: #fbbf24;  --danger: #f87171;  --violet: #a78bfa;
/* 各语义色 -soft = rgba(同色, .13)，-border = rgba(同色, .32)，-vivid = 与基色同值 */
```

暗色下语义色本身已足够明亮，`-vivid` 与基色取同值即可。

### 4.4 Element Plus 桥接

硬约束：桥接块必须位于 `element-plus/theme-chalk/dark/css-vars.css` 之后被引入。`src/main.ts` 现状已满足（EP 两张表在前，`tokens.css` 在后）；`:root` 与 `.dark` 特异度相同，靠源码顺序决出胜负，改动入口时不能破坏此顺序。

桥接从 13 个扩到约 30 个，新增：

```
--el-fill-color / -light / -lighter / -blank
--el-border-color-light / -lighter / -darker
--el-text-color-secondary / -placeholder / -disabled
--el-bg-color-overlay、--el-mask-color
--el-box-shadow-light / -lighter
--el-color-primary-light-3 / -5 / -7 / -8 / -9   ← EP 用它算 hover 与禁用态，不桥接会露出默认蓝
--el-border-radius-small / -round
--el-disabled-bg-color / -text-color / -border-color
```

桥接值全部引用我们的令牌，因此暗色随 `[data-theme='dark']` 自动跟随，**不写两套**。

### 4.5 全局基线 `global.css`

- 字重收敛为 400/500/600/700 四档（对应 `--fw-*`），禁用 650/750 这类非标准值——中文回退到 Microsoft YaHei 只有 regular/bold 两档，细分字重会塌成同一档。
- 新增 `.tnum`（`font-variant-numeric: tabular-nums`）与 `.mono` 工具类；台账日期、批次号、计数、KPI 数字统一使用，消除数字宽度跳动。
- 新增全局 `:focus-visible`（2px `--primary` 描边 + 2px offset）——当前项目没有全局焦点样式，键盘导航看不见落点。
- `prefers-reduced-motion: reduce` 段保留不动。

### 4.6 `badges.css`（位于 `src/modules/tracker/badges.css`，非 `src/styles/`）

类名与 `STAGE_BADGE` 映射**完全不变**，只换取值为冷灰语义色。`.stage-badge` 有 e2e 依赖（抽屉里断言阶段文本）；`badge-*` 六个色调类没有任何测试引用，冻结它们属防御性措施。顺带修一个既存 bug：`src/modules/tracker/badges.css:20` 的 `.badge-violet` 把 `border-color` 错写成 `var(--primary-border)`，应为 `var(--violet-border)`。

`badges.css` 继续作为共享样式表存在，`StatusBadge.vue` 只封装结构（`span.stage-badge > span.dot + 文本`）并 import 同一张表，避免 scoped 样式在三处重复。

### 4.7 共享原语四件

| 组件 | 接口 | 用量 |
|---|---|---|
| `AppIcon.vue` + `icons.ts` | `name`、`size`（默认 18）；约 20 个线性图标 path 常量，`stroke=currentColor` | 全站；替换顶栏 emoji ☀️/🌙、侧栏无图标现状、各处字符箭头 |
| `Sparkline.vue` | `values: number[]`、`height = 40`；area + line 双 path，`vector-effect="non-scaling-stroke"`，`aria-hidden` | 工作台 4 处 |
| `SectionCard.vue` | props `title`、`sub?`；slots `default`、`actions` | 重建后目标用量：工作台 6 处 + 演示站 3 处（当前手写 `.card > .card-hd/.card-bd` 为 4 + 1 处） |
| `StatusBadge.vue` | `stage: Stage`，内部查 `STAGE_BADGE` | 表格 / 看板 / 抽屉 3 处 |

## 5. 布局壳与五模块视图结构

### 5.1 布局壳

**`AppLayout.vue`**：内容区 `max-width` 1280 → 1600（台账 9 列需要宽度）；内边距 4/28/44；新增 `.scrim` 遮罩；断点 860 → 1024。

**断点范围界定**：改为 1024 的只有壳层三个文件（`AppLayout.vue:36`、`AppSidebar.vue:114`、`AppTopbar.vue:75`）。模块内部另有五处 `@media (max-width: 860px)`（`TrackerView.vue:232`、`ProfileEditor.vue:330`、`ShowcaseView.vue:344`、`DeckOverlay.vue:422`、`StorageBanner.vue:47`），**本次一律不动**。理由：侧栏抽屉化后内容区反而变宽（900px 视口下从 650px 增至 900px），模块的桌面布局在 861–1024 这一带更合适，跟着改成 1024 只会让它们提前降级。代价是 861–1024 带宽内"抽屉壳 + 桌面模块"的混合形态需要实测，因此 8.1 的截图核对视口加入 900px；若该带宽下某模块确有破面，按模块单独调整并记入所属批次，不作为全局改动。

**`AppSidebar.vue`**：品牌 mark 由紫色渐变改纯蓝方形；导航从纯文字行改为 `AppIcon` + 边框化行，激活态 = 左 3px 蓝轨 + `--primary-soft` 底 + `--primary-text` 文字（`.nav-item`、`.active` 保留）；底部绿点 + 现有文案「数据仅存本机浏览器」。≤1024 由 `display:none` 改为 `transform` 平移抽屉 + scrim + Esc 关闭 + 路由切换自动收起。

**`AppTopbar.vue`**：高度 60 → `--topbar-h` 86；标题 16px → 21px + 副标题 12.5px；去掉 `backdrop-filter` 与 `color-mix`，改不透明 `var(--bg)`、无底分隔线（对齐设计图）；主题按钮 emoji → `AppIcon` sun/moon（`.theme-toggle` 保留）；左侧新增汉堡 `.menu-btn`（≤1024 显示）。`StorageBanner` 仍在顶栏之上，位置不变。

### 5.2 工作台

| 区块 | 改动 |
|---|---|
| KPI 四张 | 加 `Sparkline` + 增量行（C4）；保留 `stat-total/inflight/interviewing/offers` testid 与 `.stat-num` |
| 漏斗 | 加 0/25/50/75/100% 刻度轴 + 递减蓝色阶 + 右侧计数与百分比；基准从「当前最大值」改为「累计投递数」 |
| 本周待办 | 日期 pill + 文案 + 副行（公司·岗位）+ 右侧阶段徽章；徽章需 store 的 `todos` 带上 `status` |
| 里程碑 | 方块时间轴（已完成填 `--success-vivid`，未完成空心描边）+ 日期 pill；常驻的两个输入与添加按钮收进「＋ 添加里程碑」展开区（`v-show`，见 6.6）；保留 `.ms-add`/`.ms-delete`/`data-field="ms-date|ms-label"` 与 `.ms-actions` 内按钮顺序（完成 / 删除） |
| 快捷操作 | 文字按钮 → 2×3 `AppIcon` 磁贴；保留 `.quick` 与 `go(path)` |
| 栅格 | 12 栅格 `span-3/8/4/6` → 三行固定比例：4 列 / 1.34:1 / 0.62:1 |

### 5.3 投递管理

| 区块 | 改动 |
|---|---|
| 工具栏 | 独立卡片：`mode-seg`（文案「表格/看板/候选池」与 `role="tablist"`/`role="tab"` 保留，e2e 依赖 `getByRole('tab', { name: '看板' })`）+ 搜索（扩展到备注与下一步）+ 状态下拉 + 渠道下拉（C3，替换现有 9 个筒片的 `chip-row`：`全部` + 8 个阶段）+「＋ 新增投递」（文案保留） |
| 台账 | 9 列：公司 / 职位（从「公司 / 岗位」单元格拆开）/ 批次 / 渠道 / 投递日 / 状态 / 下一步 / 面试 / 操作；`min-width: 1080` 横向滚动。C1 排序、C2 分页、C5 收藏见第 6 节；选中行左 3px 蓝轨。**操作列 = 「详情」文字按钮（`.row-open`，文案保留）+ 紧随其后的 ★ 图标按钮**，C5 不新增第 10 列、不放进公司单元格 |
| 看板 | 7 列（含「挂 / 无消息」）列顶 3px 色条（`--*-vivid`）+ 计数 chip；卡片 = 公司 / 岗位 / 标签（渠道 + 批次，色随列）/ 日期 + 圆点；保留 `.board-card`、`.board-col`、`.col-title`、`data-column`（两条拖拽用例依赖）、`draggable`、Enter/Space 与 `aria-label` |
| 抽屉 / 弹窗 / 公司库 | 卡片化 + 令牌化，结构不动；保留 `.app-drawer`、`.stage-badge`、「阶段流转」「推进到」文案 |

### 5.4 简历

`ResumeView` 已是两栏、与设计图同构。工具栏从顶部通栏移到右栏纸面上方；纸面加 `--surface-muted` 台面 + 阴影；A4 缩放逻辑与 `.no-print` 不动；「打印 / 导出 PDF」文案保留（e2e 依赖），不新增"分享"这类项目没有的功能。

`VersionManager`：列表 → 版本 chip 行 + 虚线「＋ 新建」+ 最后更新时间行。改造必须保留 `.vm-card`、`.vm-card-actions`、`.vm-create`、`.vm-delete`、`.section-row`、`.section-entries` 与空态文案「还没有简历版本」（`VersionManager.test.ts` 依赖）。

`ProfileEditor`（C6）：`tab-strip` → 资料池折叠，详见 6.5。

### 5.5 材料库

- 2 栏 → 3 栏（分类 | 文档列表 | 阅读区）置于单张卡片内，竖分隔线；≤1024 竖向堆叠。
- 分类从顶部 `chip-row` 移入左栏：`AppIcon` + 名称 + 计数。**分类按钮的类名必须仍为 `.chip`**——`LibraryView.test.ts` 靠它切换分类，改名会让 B6 的验收门槛落空。
- 文档卡：标题 + 右上「内置/我的文档」标记（`.src-tag` 与文案保留）+ 两行摘要 + 标签 + 日期。
- 阅读区正文补方形蓝色列表符、左边框引用块、代码块容器（边框 + 底色 + 语言标签）。**不引入语法高亮库**，只做容器样式。
- 保留 `[data-testid="doc-body"]`、`.lib-item`、`.doc-body`、`.chip`、`.create-btn`、`.editor-save`、`.edit-btn`、`.reset-btn`、`.src-tag.local`、`input[type=file]`，以及「重置为内置」「删除」文案与本机文档的完整按钮文案 `编辑（保存后覆盖内置）`。

### 5.6 项目演示

`ShowcaseView`：hero + bento → 项目卡片网格（名称 + 徽章 + 描述 + 标签 + 页脚）；去衬线标题；保留 `.deck-open`、「▶ 进入项目演示」、`.upload-open`。

`DeckOverlay`：令牌化 + 去衬线；双轴导航、键盘、iframe sandbox 逻辑一行不动；保留 `[data-testid="deck-overlay"]`、`.dt-title`、`.deck-face.on`、`.df-iframe`。

### 5.7 刻意偏离设计图之处

1. **台账保留「面试」列**（设计图没有）。它是项目已有功能，不因图里缺就删；列数因此为 9，靠横向滚动承载。
2. **材料库阅读区与简历工具栏保留文字按钮**，不改成纯图标。设计图用图标，但 e2e 与单测靠 `getByRole('button', { name })` 定位，且文字按钮对可访问性更好；只对齐样式。
3. **侧栏底部不显示"最后同步时间"**。项目是纯本地 IndexedDB、没有同步概念，显示时间即造假数据；只保留绿点 + 现有文案。
4. **`EntryCard` 保留四个按钮**（上移 / 下移 / 编辑 / 删除）。设计图的资料池条目只有编辑与删除，但排序是简历的真实需求。

## 6. 交互增量的状态与数据设计

### 6.1 状态归属

| 类别 | 位置 | 内容 |
|---|---|---|
| 持久域数据 | store | `starred`（C5） |
| 视图级 UI | `TrackerView` | `mode` / `query` / `stageFilter` / `channelFilter` / `starredOnly` |
| 表现级 UI | 组件内部 | `sortKey` + `sortDir`（C1）、`page`（C2）、`openGroup`（C6） |
| 派生计算 | store getter | `series`（C4）、`funnel` |

排序不进 store：`trackerStore.load()` 每次按 `appliedAt` 倒序重排，那是领域默认序；表头排序是纯展示叠加。

### 6.2 C1 排序 / C2 分页 / C3 筛选

- `ApplicationTable` 现有 props `{ applications, stageFilter, query }` **保持不变**，新增可选 props `channelFilter?: string`、`starredOnly?: boolean`（带默认值），现有单测的全部 mount（5 处）无需改。
- **默认排序 = 保持传入顺序**（`sortKey: null`）。现有单测断言 `.app-row` 第 0 行是 `apps[0]`，默认不排序才成立。点表头进入 `asc`，再点 `desc`，第三次回到 `null`。
- 比较规则：字符串用 `localeCompare('zh')`；`status` 按 `STAGES` 索引而非字典序；`appliedAt`/`batch` 直接字典序（ISO 日期与固定枚举天然有序）。
- 分页 12 条/页；`watch` 到 `stageFilter/channelFilter/query/starredOnly/sortKey` 变化时 `page = 1`。2 行的现有用例落在第 1 页，断言不变。
- C3 只替换产生 `stageFilter` 的控件（筒片 → `ElSelect`），prop 名不变。

### 6.3 C5 行内收藏

```
类型    Application 增 starred?: boolean（可选）
Dexie   不需要版本升级 —— schema 只声明索引（applications: 'id, status, appliedAt, nextActionAt'），
        未索引字段自由持久化
写路径  新增 toggleStar(id) = updateApplication(id, { starred: !app.starred })
        updateApplication 的 patch 类型 Partial<Omit<Application,'id'|'status'|'stageHistory'|
        'interviews'|'createdAt'>> 已允许 starred，开箱可用；
        经 persistApplication → plain() → put → load()，不碰 changeStage，status 不变量不受影响
备份    BACKUP_SCHEMA_VERSION 保持 2。validate 只校验必填键、不拒未知键：
        旧备份（无 starred）导入正常，新备份携带该字段往返
筛选    starredOnly 内存过滤，不建索引
```

### 6.4 C4 走势图与漏斗语义修正

`dashboard` store 新增 `series`：12 个周桶，桶 `i` 的截止日 = 今天 − (11−i)×7 天。对每个截止日 `D`，用 `stageHistory` 回放出该投递在 `D` 时刻的阶段（取 `date <= D` 的最后一条），再用与 `stats` 完全相同的谓词算出四条曲线。复杂度 `投递数 × 12 × 历史长度`，几百条量级无压力。

KPI 增量 = `series[11] − series[7]`（近 4 周），百分比以 `series[7]` 为基数；**基数为 0 时只显示绝对增量，不显示 ∞%**。空数据时四条曲线全 0，`Sparkline` 用 `span || 1` 兜底，输出平直线而非 `NaN` 路径。

漏斗改语义。现在的 `funnel` 是「各阶段当前存量」，条形不单调，且把「无消息」也算作漏斗层，不是漏斗。改为累计到达量：

- `rows` 取 `STAGE_DONE`（已投递 / 笔试 / 一面 / 二面 / HR面 / Offer，6 项）。
- **仅就漏斗而言**，阶段序一律以 `STAGE_DONE` 索引，不得用 `STAGES` 索引。（台账「状态」列排序是另一回事，那里必须用 `STAGES`，因为要给全部 8 个阶段定序，见 6.2。）实现即：

```ts
const reached = (app: Application, layer: number) =>
  app.stageHistory.some((h) => STAGE_DONE.indexOf(h.stage) >= layer)
const count = apps.filter((a) => reached(a, layer)).length
```

  用 `>=` 而非等值，容忍 `changeStage` 允许的跨阶段跳转。`STAGE_DONE` 里没有 `挂`/`无消息`，`indexOf` 返回 `-1`，因此终态记录不会被计入任何层。
- **为什么必须写明**：`STAGES`（`src/storage/types.ts`）的顺序是 `['已投递','笔试','一面','二面','HR面','Offer','挂','无消息']`，`挂` = 6、`无消息` = 7 排在 `Offer` = 5 之后。若误按 `STAGES` 索引，所有挂掉或无消息的投递都会被算成「已到达 Offer」；而这个错误既不破坏单调递减（8.3 的检查项），也不会让现有单测变红，会静默上线。
- `pct = count / 总投递数`，天然单调递减，可承载刻度轴。
- `挂`/`无消息` 不再作为漏斗层，改由既有 `staleCount` 提示行承担。
- 返回结构由 `{ rows, max }` 改为 `{ rows: { stage, count, pct }[], base }`。现有单测只断言 `rows.find(r => r.stage === '已投递').count`，两个新鲜投递在新算法下仍是 2，**该用例不受影响**。
- 8.3 需为此补一条针对性用例：一个推进到「一面」后被 `markDropped` 的投递，在 `Offer` 层的计数必须为 0——这是区分两种索引读法的唯一判别用例。

### 6.5 C6 资料池折叠

`ProfileEditor` 的 `activeTab: string` → `openGroup: string | null`，单开手风琴，默认 `'basic'`（与现在默认 tab 一致，使基本信息用例无需先点组头）。组头复用现有 `TABS` 定义并加条目计数；展开区内容与现在完全一致（基本信息是表单，列表组是 `EntryCard` 列表 + 「＋ 添加条目」），`EntryDialog` 仍是唯一编辑载体，数据流不动。

组头**沿用 `.tab-btn` 类名与相同文案**（教育背景 / 实习经历 / 自我评价 …），`EntryCard` 保持四按钮顺序，这样 `ProfileEditor.test.ts` 可原样通过。

### 6.6 测试影响评估

读过测试文件后的实际结论（比初步估计小）：

- **`ProfileEditor.test.ts` 不需要重写。** 它靠 `.tab-btn` 文案、`.add-entry`、`.entry-save`、`.basic-save`、`.self-save`、`.entry-card .entry-actions button:nth-child(3)` 定位；只要 6.5 的类名与按钮顺序约定成立，原样通过。
- **`ApplicationTable.test.ts` 不需要重写**，只需新增用例。
- **`dashboard.test.ts` 不需要重写**：`stats`、`todos` 断言不变，`funnel` 断言在新算法下同值。
- 唯一需要特别处理的是里程碑表单：常驻的两个输入与添加按钮收进「＋ 添加里程碑」后，若用 `v-if` 卸载，`input[data-field="ms-date"]` 找不到会导致用例失败。**决定用 `v-show` 保留 DOM**，jsdom 下 `setValue` 对隐藏输入依然有效，测试零改动。

## 7. 可访问性与动效

### 7.1 可访问性

对比度已在 4.2 落地。交互语义补充：

| 项 | 要求 |
|---|---|
| 焦点 | 新增全局 `:focus-visible`（2px 主色 + 2px offset）；抽屉打开时焦点移入首个导航项，Esc 关闭并把焦点归还汉堡按钮 |
| 表头排序 | `th` 内放 `<button>`，`th` 上挂 `aria-sort="ascending\|descending\|none"` |
| 分页 | `<button>` + `aria-label`（「第 N 页」「上一页」），当前页 `aria-current="page"` |
| 收藏 | `<button>` + `aria-pressed` |
| 手风琴组头 | `<button>` + `aria-expanded` + `aria-controls` |
| 汉堡 / 主题 | `<button>` + `aria-label`，主题按钮文案随状态变化 |
| 移动抽屉 | **仅抽屉模式（≤1024）** 的关闭态给 `.sidebar` 加 `inert` **且** `aria-hidden`——只加 `aria-hidden` 而内部仍可 Tab 是常见错误，必须成对；≥1025 的常驻侧栏两个属性都不得出现，否则桌面端键盘无法进入导航 |
| 装饰元素 | `Sparkline`、漏斗条形、里程碑方块一律 `aria-hidden`；数值与百分比是可见文本 |
| 既有约束 | 破坏性操作继续走 `ElMessageBox` 确认；错误提示 `role="alert"`；看板卡片 Enter/Space 与 `aria-label` 保留 |

### 7.2 动效

沿用既有 `--ease`，时长统一两档：交互态 0.16s、入场与抽屉 0.22s。

- 允许：卡片 hover 微抬升（≤2px）、焦点描边、抽屉平移、页面入场 fade-up、手风琴 chevron 旋转 + 内容淡入。
- **手风琴不做高度动画**：`grid-template-rows: 0fr → 1fr` 在嵌套表单里容易抖动，收益低于复杂度。
- 禁止：视差、骨架屏动画、拖拽弹性回弹。
- `prefers-reduced-motion: reduce` 的全局降级段保留。

## 8. 验证策略

### 8.1 每批次门槛

| 项 | 内容 |
|---|---|
| 四件套 | `npm run build` / `test:run` / `lint` / `test:e2e`，显式核对退出码 |
| 截图核对 | Playwright 抓 1536 / 1024 / **900** / 390 四视口 × 亮暗两套，与设计图逐页比对（900 用于验证 5.1 界定的「抽屉壳 + 桌面模块」混合带） |
| 全局不变量 | 390px 无横向溢出（已有 e2e）；打印仅输出 A4 纸面；`Application.status === stageHistory` 末项 |
| 回滚粒度 | 一批一提交；B0 是单文件改动，可独立 revert |

### 8.2 契约冻结清单

任何批次不得破坏。清单按模块归组；除末尾标注为「防御性」的四项外，每一项都有现存单测或 e2e 依赖：

```
布局壳    .page-title  .nav-item  .active  .theme-toggle
投递管理  .app-table  .app-row  .stage-badge  .app-drawer
          .board-card  .board-col  .col-title  data-column（两条拖拽用例）
          .pool-card  .pool-convert  .pool-remove  .track-main
          role="tablist" / role="tab"（mode-seg，e2e 用 getByRole('tab', { name: '看板' })）
工作台    .ms-add  .ms-delete  .ms-actions（按钮顺序：完成 / 删除）
简历      .tab-btn  .add-entry  .entry-save  .entry-delete  .entry-dialog
          .entry-card  .entry-actions（按钮顺序：上移 / 下移 / 编辑 / 删除）
          .basic-save  .self-save
          .vm-card  .vm-card-actions  .vm-create  .vm-delete  .section-row  .section-entries
          .sheet  .r-head  .sheet-empty
材料库    .lib-item  .src-tag（含 .src-tag.local）  .doc-body  .chip
          .create-btn  .editor-save  .edit-btn  .reset-btn  input[type=file]
项目演示  .deck-open  .upload-open  .dt-title  .deck-slide.vertical  .deck-face.on  .df-iframe
属性      全部 data-testid（15 处）、data-field（36 处）、data-column
按钮文案  ＋ 新增投递 / 详情 / 保存 / 打印 / 导出 PDF / 一键填入示例资料 / ▶ 进入项目演示 /
          ＋ 添加条目 / 重置为内置 / 删除 / 完成 / 重开 / 添加 /
          表格 / 看板 / 候选池（mode-seg 三个 tab 名）/ 推进到…（抽屉，正则匹配）
          编辑（保存后覆盖内置）—— 本机文档的完整文案，不得截断为「编辑」
其他文案  没有符合条件的投递记录 / 超1月视为挂 / 还没有简历版本 / 候选池为空 / 阶段流转 /
          内置 / 我的文档（.src-tag 两种文案，e2e 依赖）/ 优先级 N（候选池）/
          基本信息（VersionManager 的 .section-row 标题）/ 「甲 · 硕士」式的 · 分隔格式
防御性    .badge-*  .quick  .row-open  .no-print —— 无测试引用，冻结以防回归
```

结构重建与该清单冲突时，**以清单为准**：先保住钩子，再调外观。第 5 节各模块的「保留」列表是该清单的分册视图，两处不一致时同样以本清单为准。

### 8.3 新增测试用例

| 位置 | 用例 |
|---|---|
| `ApplicationTable` | 表头排序三态循环；`status` 排序按 `STAGES` 索引；>12 行分页翻页；★ 按钮 emit |
| tracker store | `toggleStar` 持久化与再次切换；`toggleStar` 不改写 `status` 与 `stageHistory` |
| backup | `starred` 往返（export → validate → import）；旧备份缺该字段可导入 |
| dashboard store | `series` 12 桶长度与空数据全 0；`funnel` 单调递减；**判别用例：推进到「一面」后 `markDropped` 的投递在 `Offer` 层计数为 0**（区分 `STAGE_DONE` 与 `STAGES` 两种索引读法）；增量基数为 0 时不出 ∞% |
| `AppSidebar` | 抽屉：汉堡开、scrim 关、Esc 关、路由切换自动关 |
| `Sparkline` | 常量序列与单点序列不产出 `NaN` 路径 |

## 9. 文档同步（B7）

- `AGENTS.md` §1「视觉基准是 `design-demo/index.html`」→ 改为 `design-demo/cool-slate-light-demo.html`；设计语言名称由「清简专业风」改为「Cool Slate」。`AGENTS.md` 全文没有出现过 860 这个数字，不要去找；真正会过时的是 §5 测试里的一行——「E2E 中窄视口不可达元素（隐藏侧边栏、transform 轨道内卡片、动画中的抽屉按钮）用 hash 直达或 `dispatchEvent`」，侧栏由隐藏改为抽屉后该理由需重写。
- `tests/e2e/job-console.spec.ts` 首个用例的注释写着「窄视口（≤860px 侧边栏隐藏）退化为 hash 直达」，断点改 1024 且窄屏改抽屉后，该注释与降级理由都要更新（用例本身可保留 hash 直达，因为它跨视口都稳定）。
- `tokens.css` 头部注释同步。
- **`DESIGN.md` 整篇替换**。它现在是「Playful Geometric」设计系统提示词（暖奶油底 `#FFFDF5`、紫色 `#8B5CF6`、硬阴影、Memphis 风格），与仓库实际实现的「清简专业风」毫无关系，更与 cool slate 无关；替换为 cool slate 的令牌清单与用法说明（本文件 4.1–4.7 的精简版）。

## 10. 风险与回滚

| 风险 | 缓解 |
|---|---|
| 令牌换值后某处观感崩坏 | B0 单文件改动，revert 即回退；三视口 × 亮暗截图在 B0 就核对一遍 |
| 结构重建破坏 e2e 选择器 | 8.2 契约冻结清单 + 每批次跑 `test:e2e` |
| `starred` 字段与备份兼容 | 已核实 validate 不拒未知键；8.3 补往返用例双向验证 |
| 漏斗语义变更引起理解偏差 | 变更写入文档；`staleCount` 提示行继续承担终态提示 |
| 手风琴改造影响简历编辑流 | 6.5 约定类名与按钮顺序不变，`ProfileEditor.test.ts` 作为回归网 |
| 移动抽屉可访问性做错 | `inert` 与 `aria-hidden` 成对；8.3 补四条抽屉用例 |






