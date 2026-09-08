# AGENTS.md

本文件面向维护本仓库的 AI 编码代理，也可作为开发者架构指南。修改代码前先确认当前实现与本文件一致；冲突时以可验证的源码、测试和用户最新要求为准，并同步修正文档。

## 1. 项目基线

- 技术栈：Vue 3.5（`<script setup lang="ts">`）、TypeScript、Vite 8（rolldown）、vue-router 5（hash 模式）、Pinia 4、Element Plus 2、Dexie 4（IndexedDB）、vitest + @vue/test-utils、Playwright。
- 形态：纯前端个人信息管理系统「求职工作台」，无后端无账号；数据存浏览器 IndexedDB，可部署 GitHub Pages。
- 五模块：工作台（dashboard）、投递管理（tracker）、简历管理（resume）、材料库（library）、项目演示（showcase）。
- 设计语言「Cool Slate」：CSS 变量令牌（`src/styles/tokens.css`，亮/暗双主题）+ Element Plus 主题桥接；视觉基准是 `design-demo/cool-slate-light-demo.html`，设计系统说明见 [DESIGN.md](DESIGN.md)。
- 未决事项与待清理项记在 [docs/tech-debt.md](docs/tech-debt.md)，动到相关位置前先看一眼。

## 2. 开始工作前

1. 读与任务相关的 store、组件与测试，不凭文档猜代码。
2. `git status --short`；用户未提交的修改必须保留（尤其 README.md）。
3. 架构级变更先出计划；文案/样式小修可直接做。
4. 新文本文件一律 UTF-8 无 BOM。

常用命令：`npm run lint`、`npm run test:run`、`npm run test:e2e`、`npm run build`、`git diff --check`。提交前三件套（build/test/lint）必须全绿并显式核对退出码。

## 3. 目录职责

| 目录 | 职责 | 不应承担的职责 |
|---|---|---|
| `src/storage/` | Dexie schema（当前 v6）、全部实体类型、备份导出/校验/导入、快照轮转 | 任何 UI 或业务语义 |
| `src/shared/` | 布局壳（侧边栏/顶栏/抽屉）、共享 UI 原语（`src/shared/ui/`：AppIcon/Sparkline/SectionCard）、StorageBanner、markdown 工具（frontmatter/render） | 业务状态 |
| `src/app/` | 路由、导航常量、主题 store、入口装配 | 模块业务逻辑 |
| `src/modules/<name>/` | 各模块 store（Pinia 封装 Dexie）+ 视图 + 组件 + 就近测试 | 跨模块读取他模块 store 内部 |
| `src/content/` | 编译时内置内容：library/*.md、demos/*.html | 运行时可变数据（入 IndexedDB） |
| `src/config/` | showcase.config.ts（演示项目内容） | 存用户数据 |
| `src/styles/` | 设计令牌与全局基线 | 组件样式（组件自带 scoped） |
| `design-demo/` | 设计原型（视觉基准），不参与构建 | — |

## 4. 强制约定

### 存储层
- Dexie 访问只发生在各模块 store；组件不直接 import `db`。
- 简历资料池按版本独立（v4 起 Profile.id = versionId）：新建版本复制当前资料池为起点，复制版本连资料池一并复制，删除版本连带删资料池；state.profile 恒为当前激活版本的资料池。
- 写库前必须用 `plain()`（JSON 克隆）去除 Pinia 响应式 Proxy（结构化克隆不兼容）。
- 投递与简历编辑先改副本，写入成功后更新 state；失败不污染已保存状态。简历版本创建/复制/删除的版本表与资料池写入必须在同一事务中完成。
- `Application.status` 不变量：恒等于 `stageHistory` 末项 stage；唯一写路径 `trackerStore.changeStage`，其他 action（advance/markDropped/reopen）都经它。
- 备份 `BACKUP_SCHEMA_VERSION = 4`，数据含十表（含 runtimeDemos / libraryCategories / runtimeProjects / deletedDocs）；改 schema 必须同步 backup 校验、`snapshots.ts` 的 `normalizeData` 与版本号。runtimeDemos 的 html 只验类型不验非空（内置演示的 hidden 墓碑行 html 恒为空串，链接式演示的内容在 url），非墓碑行改为要求「html 与 url 至少有一个」；`url`/`points` 是可选字段，给了才验类型——都不为此升版本号，升了会让用户手里的旧 v4 备份导不进来。
- 编译期枚举（`LIBRARY_CATEGORIES` 分类名、`TRACKS` 投向名）改名必须两处都做：Dexie 升级迁移（改本机库存量，v5 迁分类、v6 迁投向）+ 导入归一（`backup.ts` 的 `withMigratedTracks` 一类改写，管旧备份与旧快照）。只做前者，导入一份旧备份就又把旧值灌回来，而旧值在下拉里选不到。
- 快照：覆盖导入与回退前自动 `createSnapshot`（保留 5 份，`restoreSnapshot` 走 importBackup overwrite，故回退本身也可回退）；旧快照缺新增表由 `normalizeData` 补空数组。
- `validateBackup` 与 `backupValidation.ts` 检查结构、嵌套条目、重复标识、业务日期、状态历史与资料池所属版本；`importBackup` 自身也在任何写入/快照前校验，不能只依赖上传界面。允许空简历版本、旧投向/主题色和已删除项目遗留的演示引用，避免拒绝正常历史数据。
- 导出下载统一走 `src/shared/downloadJson.ts`（Blob URL 延后 revoke，避免下载被提前中断）。
- 测试中操作 Dexie 单例的用例，`beforeEach` 用 `db.delete()` + `db.open()` 重建；组件测试若有「发后即忘」写入，`afterEach` 等待落定（约 25ms），否则 unhandled rejection 会让 test:run 退出码非 0。

### 模块边界
- 模块间不 import 彼此的内部组件；跨模块数据经 store（如 dashboard 读 tracker store）。
- 运行时数据永不写入 `src/content/` 或 `src/config/`；内置内容永不写库。

### 内容双通道（材料库/演示）
- 编译时：`src/content/library/*.md`（frontmatter: title/category/tags）、`src/content/demos/<projectId>--<name>.html`（前缀决定归属项目）；由 `import.meta.glob(..., { query: '?raw', eager: true })` 收集。
- `localDocs()` / `localDemos()` 在模块生命周期内缓存首次解析结果，调用方只读使用，运行时修改仍经 store 的覆盖行。演示窗口复用 ShowcaseView 已加载的 store，打开窗口不再重复读库；页面加载和保存后的刷新路径保留。
- 运行时：上传/编辑入 IndexedDB（libraryDocs 带 `source: 'runtime'`、runtimeDemos 表）；同 id runtime 覆盖内置展示。删除内置文档走 deletedDocs 墓碑表（内置 md 源文件删不掉），删除内置演示页走 runtimeDemos 的 hidden 墓碑行（html 置空，删行即恢复），均无「重置为内置」功能。内置演示首次编辑写 runtimeDemos 同 id 覆盖行，合并时仅显示一份；删除编辑过的内置演示仍写 hidden 标记，避免原内容重新出现。
- 材料库分类：全部可增删改。自定义分类是 libraryCategories 表的普通行（name 即主键，改名换主键并迁移文档）；内置 4 类的改名/删除是同表的覆盖行（`builtin: true`，`renamedTo`/`hidden`），内置 md 的 frontmatter 是编译期产物改不动——文档归类在 store 读取时经映射生效，不提供恢复默认分类入口。删除任何分类都要求分类下无文档。
- 新增与编辑分类共用 CategoryEditorDialog，可选择现有 AppIcon 图标，保存在 libraryCategories.icon（可选字段），改名保留（含内置分类改回原名）；分类列表与管理弹窗使用同一图标。旧数据无 icon 时显示默认图标，备份/快照原样保留该字段；不增加索引，不升级备份版本。分类保存失败保留输入，删除失败在管理弹窗内提示。
- 演示站项目：runtimeProjects 表，同 id 行覆盖内置项目（hidden:true 为删除墓碑），自建项目直接删行；合并视图在 showcase 模块 projectStore。项目的 `demo: {title, points}` 只作**封面回落**（演示页没自带要点时才用），项目表单可编辑或清空默认要点，保存时要点标题随项目名称更新；旧调用不传 defaultPoints 时保留原值。项目无恢复示例入口，来源标签不限制操作。
- 交互演示两种来源（RuntimeDemo 二选一，`url` 有值即链接式）：**上传式** html 走 Blob URL + `<iframe sandbox="allow-scripts">`（Blob 继承本站源，绝不能给 allow-same-origin）；**链接式** url 直接进 iframe src，sandbox 放开 `allow-same-origin allow-forms allow-popups`（外部源的同源特权只作用于它自己），并额外给一个「新标签打开」入口兜对方站点的 X-Frame-Options。只收 http/https，伪协议在 `DemoUploadDialog` 就拒掉。
- 演示要点归**每个演示页**自己（`RuntimeDemo.points`，在「上传交互演示」弹窗里按页填），Deck 侧栏优先取它，为空才回落到项目的 `demo.points`；内置演示（LocalDemo）没有 points，恒走回落。
- 材料正文、编辑预览与演示要点分别经 `renderMarkdown` / `sanitizeHtml`（DOMPurify）清理后再 `v-html`。不能假设上传/导入内容可信；交互 HTML 原文仅在沙箱 iframe 中执行。演示链接的表单、导入、展示共用 `isHttpUrl`；同站链接不放开 `allow-same-origin`，避免与 `allow-scripts` 组合取得主站权限。
- Deck 纵向层由 `deck.ts` 的 `deckLayers` 决定：**一个演示页一层，每层 = 媒体位（该 demo 的 iframe）+ 项目基础信息**（eyebrow/标题/简介/技术栈/要点，≥1025px 时要点走右列），所以点进项目的第一页就是第一个演示页；项目无演示页时只出一层 `cover`（媒体位为占位提示）。要点不单独成页（要点小标题取该演示页标题，回落时取 `demo.title`）。非当前项目只渲染一层 cover——同时挂 N 个 sandbox iframe 会让 N 份 demo 一起跑。
- 演示区两级放大：网页全屏是纯 CSS（`.deck-overlay.page-fs` 藏上下栏与信息区，媒体位铺满视口，Esc 优先退全屏而非关 Deck，期间禁翻页），屏幕全屏对 iframe 调 `requestFullscreen`（退出交给浏览器）。**别用 `position: fixed` 做网页全屏**：`.deck-track` 有 transform，fixed 会以轨道而非视口为包含块；Teleport 又会让 iframe 重挂丢状态。

### UI
- Element Plus 组件在使用处显式导入，入口只注册 ElLoading；实际使用的组件样式集中在 `src/styles/element-plus.ts`，使用官方 style/css 入口带入内部依赖，再加载暗色变量和本项目令牌。新增组件时同步补充样式，禁止恢复全量注册/全量样式。
- 工作台待办按日期升序全部展示，以日期块颜色区分已逾期、今天与后续，不显示分组标题；列表最高 360px，溢出滚动，悬停或键盘焦点进入时显示滚动条。条目通过 `/tracker?applicationId=...` 进入投递详情，数据加载后打开抽屉。
- 有下一步但无日期的待办以「未排期」置底。`TodoList` 的完成/编辑经 tracker store 落库；完成只清除 nextStep/nextActionAt，不改阶段，10 秒撤销仅存当前组件内存，离开或刷新即失效，不覆盖新动作。日期色与里程碑倒计时共用 `useLocalDate`，本地午夜、focus 与 visibilitychange 时刷新。
- 详情和看板的结束阶段操作共用 `useStageChange`：确认清除待办、取消按钮保留待办、关闭提示取消阶段变更；清除与阶段更新在同一次写入中完成。Offer 保留待办，不弹提示。
- 投递表格与手机卡片复用 filtered/sorted/paged 数据，≤720px 显示卡片；筛选可折叠，数据数量下降时校正当前页码。
- 材料库搜索与分类共同约束选中文档，分类管理为独立弹窗；DocEditor 与项目 ProjectEditor 通过异步 persist 回调确认保存成功，失败保留输入。项目保存期间禁止重复提交与关闭弹窗。离开保护弹窗必须 append-to-body，避免手机导航打开时被主内容 inert 屏蔽。
- 简历 ≤1180px 切换编辑/预览，以 CSS 隐藏保留输入；缩放同时设置占位宽高，观察器下一帧更新，打印解除缩放与占位限制。
- 简历通过 ProfileEditor 暴露 dirty/saving/save/discard，版本管理经 beforeChange 回调执行离开保护；保护弹窗 append-to-body，刷新用 beforeunload。打印已保存内容保留草稿，保存后打印先等待保存与视图更新。投递和简历条目表单使用异步 persist 回调，成功后才关闭，失败保留输入。
- 导入弹窗先展示本机/备份数量，默认合并，覆盖需勾选确认；备份使用 shallowRef 保留普通对象，禁止将响应式 Proxy 交给 IndexedDB。复用既有 importBackup 与覆盖前自动快照。
- 样式走令牌（var(--xxx)），禁硬编码颜色；亮暗主题双适配。
- 可交互元素用原生 button/a 或补全 role/tabindex/键盘（Enter/Space）；删除等破坏性操作必须 ElMessageBox 确认；错误提示 role="alert"。
- jsdom 局限：ElDialog/ElDrawer 过渡无法测试——表单逻辑抽 composable 单测，弹层交互留给 Playwright E2E（`src/test/setup.ts` 已 stub 这两个组件）。
- 动效克制：入场 fade-up、hover 微抬升；`prefers-reduced-motion: reduce` 必须降级。

### 隐私
- 简历、投递、面试记录等用户数据永不入库（仓库）；`design-demo/`、种子类文件如含真实个人信息需 gitignore。

## 5. 测试

- 单测与源码就近 `src/**/*.test.ts`；E2E 在 `tests/e2e/`，包括基础流程、交互改进及 `reliability.spec.ts` 的保存失败/编辑保护/内容清理验证（desktop/tablet/mobile 三视口）。
- 异步断言涉 Dexie 写链时用 `vi.waitFor`（宏任务，flushPromises 不够）。
- 同毫秒 updatedAt 排序不稳定：测试定位用业务字段（公司名等）不用数组下标。
- E2E 中窄视口（≤1024px 侧边栏收为抽屉、transform 轨道内卡片）不可直达元素：侧栏项用 hash 直达路由（抽屉默认收起），transform 内交互用 `dispatchEvent` 派发。

## 6. 完成标准

- 三件套 `npm run lint && npm run test:run && npm run build` 全绿且退出码显式核对；`git diff --check` 无输出；新文件 UTF-8 无 BOM。
- 变更符合上述边界；模块行为变化有对应测试（单测或 E2E）。
- README、AGENTS 与代码事实一致；未验证事项在交付说明中明确标注。
