# Cool Slate 设计系统

> 本文档描述「求职工作台」的视觉设计系统。视觉基准：`design-demo/cool-slate-light-demo.html`。
> 令牌唯一来源：`src/styles/tokens.css`。组件样式一律引用令牌（`var(--xxx)`），禁止硬编码颜色。

## 设计哲学

**Cool Slate** 是一套冷静、高效的工具型视觉语言：冷灰蓝底色 + 单一主色（蓝）+ 语义色阶（信息/成功/警告/危险/紫），靠层次分明的留白与克制的描边而非装饰建立秩序感。核心取舍：

- **信息密度优先**：工具界面要一屏看清状态，卡片间距 14px、内边距 17–19px，不追求大留白。
- **单主色策略**：交互与激活态只用蓝色系；语义色只表达状态（成功/警告/危险），不参与装饰。
- **`-vivid` 与基色的分工**：基色（如 `--success`）用于文字（保证对比度），`-vivid`（如 `--success-vivid`）用于非文字元素——色条、圆点、方块标记等小面积视觉锚点。
- **等宽数字**：日期、计数、百分比、KPI 数值统一 `.tnum` / `.mono`（`--mono` 字体栈），消除数字跳动。

## 令牌清单

### 亮色（`:root`）

| 类别 | 令牌与取值 |
|---|---|
| 表面 | `--bg: #f2f5f9` · `--card: #ffffff` · `--card2: #f7f9fc` · `--surface-muted: #edf2f8` |
| 文字 | `--text: #172033` · `--text2: #4c5a6e` · `--muted: #64748b` |
| 边框 | `--border: #dbe3ec` · `--border2: #c3cfdd` · `--control: #828fa0`（表单控件专用） |
| 主色 | `--primary: #2f6bff`（非文字元素）· `--primary-strong: #2559dc`（填充按钮）· `--primary-text: #1d4ed8`（小字/链接）· `--primary-soft: #eaf2ff` · `--primary-border: #c7dbff` |
| 语义 | info `#1d4ed8` / vivid `#2f6bff` · success `#12795f` / `#10a37f` · warn `#96650f` / `#e0a10a` · danger `#b73d4a` / `#e05260` · violet `#5b46c0` / `#7c5cf0`（各带 `-soft` / `-border`） |
| 项目主题色 | `--accent-red/orange/yellow/green/teal/blue/violet/black/gray`（9 色板 + 各 `-soft`；showcase 卡片色条 / Deck eyebrow / 色板选择器专用，仅装饰不表语义） |
| 阴影 | `--shadow-sm/md/lg`（rgba(23,32,51) 低透明度冷色阴影） |
| 圆角 | `--r-sm: 6px` · `--r-md: 8px` · `--r-lg: 10px` |
| 结构 | `--sidebar-w: 250px` · `--topbar-h: 86px` |
| 字体 | `--mono`（等宽数字与代码）· `--fw-normal/medium/semibold/bold: 400/500/600/700` |

### 暗色（`[data-theme='dark']`）

覆盖同名令牌：`--bg: #090c11` 深蓝黑、卡片 `#11161e/#141a23`、文字 `#e8edf4/#a6b3c4/#8493a6`、主色 `#4d84ff`（文字用 `--primary-text: #8cb0ff`）。语义色取明亮档（success `#34d399`、warn `#fbbf24`、danger `#f87171`、violet `#a78bfa`）；`-soft = rgba(同色,.13)`、`-border = rgba(同色,.32)`、`-vivid` 与基色同值。项目主题色板取明亮档（如 green `#34d399`、blue `#4d84ff`）；「黑」在暗色下映射为亮中性 `#cbd5e1`（纯黑在深底不可见）。

### Element Plus 桥接

`tokens.css` 末尾将约 30 项 `--el-*` 变量桥接到本系统令牌（如 `--el-border-color: var(--control)`、`--el-fill-color: var(--surface-muted)`、`--el-color-primary-light-3/5/7/8/9` 按色相一致性映射到 primary / primary-border / primary-soft）。全部用 `var()` 赋值，暗色自动跟随，无需第二份桥接。**引入顺序约束**：`main.ts` 中 EP 的两个 CSS 必须在 `tokens.css` 之前（同特异度靠源码顺序决胜）。

## 命名对照（设计稿 → 本仓库）

| 设计稿 | 仓库令牌 | 备注 |
|---|---|---|
| `--surface` | `--card` | |
| `--surface-soft` | `--card2` | |
| `--surface-muted` | `--surface-muted` | 背景色，勿与文字色 `--muted` 混用 |
| `--text-2` | `--text2` | |
| `--text-3` | `--muted` | 仓库里 `--muted` 是文字色 |
| `--border-strong` | `--border2` | |
| `--control` | `--control` | 空输入框边界的唯一识别标志 |

## 字重与等宽数字

- 字重只用四档令牌：`--fw-normal/medium/semibold/bold`，不写裸数字。字重不做全局覆盖（会影响 EP 组件），由组件按需引用。
- `.tnum`（tabular-nums）与 `.mono`（`--mono` + tabular-nums）是 `global.css` 提供的全局工具类，用于所有数字密集场景：台账日期、看板计数 chip、KPI 数值与增量、分页页码、漏斗计数/百分比、版本 chip。
- `.form-alert` 同为 `global.css` 的全局工具类：弹窗表单的校验错误外观（danger 描边 + `-soft` 底 + 圆形「!」标记）。各弹窗自己的 `.xx-error` 类名保留用于定位与间距，外观一律由这个类给。

## 可访问性下限

- **正文与图标文字对比度 ≥ 4.5:1**（WCAG AA）：`--muted` 取 `#64748b`（4.76:1）而非更浅的灰；填充按钮底色 `--primary-strong` 对白字 6.04:1。
- **控件边框 ≥ 3:1**（WCAG 1.4.11 非文字对比）：表单控件边框用 `--control`（3.29:1）而非 `--border`。
- 全局 `:focus-visible`（2px 主色 + 2px offset）；移动抽屉关闭态对侧栏同时加 `inert` 与 `aria-hidden`（成对出现，桌面常驻态两者都不得出现）。
- 交互语义：表头排序 `aria-sort`、分页 `aria-current="page"`、收藏 `aria-pressed`、手风琴 `aria-expanded` + `aria-controls`、主题/汉堡按钮 `aria-label`。
- 装饰元素（Sparkline、漏斗条、里程碑方块）一律 `aria-hidden`，数值本身是可见文本。

## 动效

沿用 `--ease`，时长两档：**交互态 0.16s、入场与抽屉 0.22s**。

- 允许：卡片 hover 微抬升（≤2px）、焦点描边、抽屉平移、页面入场 fade-up、手风琴 chevron 旋转。
- 禁止：视差、骨架屏动画、拖拽弹性回弹、手风琴高度动画。
- `prefers-reduced-motion: reduce` 全局降级（`global.css`）。

## 共享原语（`src/shared/ui/`）

| 组件 | 用途 | 备注 |
|---|---|---|
| `AppIcon.vue` + `icons.ts` | 线性图标（约 26 个，`{tag, attrs}` 结构渲染，`stroke=currentColor`） | 唯一图标来源，不引入图标库 |
| `Sparkline.vue` | KPI 卡迷你走势图（area + line，`preserveAspectRatio="none"` + `non-scaling-stroke`） | 退化序列（常量/单点/空）有守卫；`aria-hidden` |
| `SectionCard.vue` | 卡片骨架（`title`/`sub` props + `actions`/默认插槽） | `.card` 基类被多处 scoped 引用，保持类名 |
| `StatusBadge.vue` | 阶段徽章（在 tracker 模块，内部查 `STAGE_BADGE` + `badges.css`） | 三处用量全在 tracker，且依赖模块内常量，故不进 shared |

## 断点

| 断点 | 行为 |
|---|---|
| ≤1360 | KPI 2 列、dashboard 后两行与演示站卡片网格降列 |
| ≤1024 | 侧栏收为抽屉（汉堡按钮出现）、多栏布局开始堆叠 |
| ≤1180 | 简历页单列（A4 缩放接管预览宽度） |
| ≤720 | KPI 单列、演示站卡片单列（磁贴保持 2 列） |

## 打印

简历页 `@media print` 仅输出 A4 纸面：侧栏/顶栏/编辑栏/工具栏隐藏，`.sheet-scaler` 解缩放；EP 消息条与遮罩由 `global.css` 的打印规则隐藏。`--font-display`（衬线）收敛到简历 A4 纸面使用，其余界面一律无衬线。
