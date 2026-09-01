# AGENTS.md

本文件面向维护本仓库的 AI 编码代理，也可作为开发者架构指南。修改代码前先确认当前实现与本文件一致；冲突时以可验证的源码、测试和用户最新要求为准，并同步修正文档。

## 1. 项目基线

- 技术栈：Vue 3.5（`<script setup lang="ts">`）、TypeScript、Vite 8（rolldown）、vue-router 5（hash 模式）、Pinia 4、Element Plus 2、Dexie 4（IndexedDB）、vitest + @vue/test-utils、Playwright。
- 形态：纯前端个人信息管理系统「求职工作台」，无后端无账号；数据存浏览器 IndexedDB，可部署 GitHub Pages。
- 五模块：工作台（dashboard）、投递管理（tracker）、简历管理（resume）、材料库（library）、项目演示（showcase）。
- 设计语言「Cool Slate」：CSS 变量令牌（`src/styles/tokens.css`，亮/暗双主题）+ Element Plus 主题桥接；视觉基准是 `design-demo/cool-slate-light-demo.html`。

## 2. 开始工作前

1. 读与任务相关的 store、组件与测试，不凭文档猜代码。
2. `git status --short`；用户未提交的修改必须保留（尤其 README.md）。
3. 架构级变更先出计划；文案/样式小修可直接做。
4. 新文本文件一律 UTF-8 无 BOM。

常用命令：`npm run lint`、`npm run test:run`、`npm run test:e2e`、`npm run build`、`git diff --check`。提交前三件套（build/test/lint）必须全绿并显式核对退出码。

## 3. 目录职责

| 目录 | 职责 | 不应承担的职责 |
|---|---|---|
| `src/storage/` | Dexie schema（当前 v2）、全部实体类型、备份导出/校验/导入、快照轮转 | 任何 UI 或业务语义 |
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
- 写库前必须用 `plain()`（JSON 克隆）去除 Pinia 响应式 Proxy（结构化克隆不兼容）。
- `Application.status` 不变量：恒等于 `stageHistory` 末项 stage；唯一写路径 `trackerStore.changeStage`，其他 action（advance/markDropped/reopen）都经它。
- 备份 `BACKUP_SCHEMA_VERSION = 3`，数据含九表（含 runtimeDemos / libraryCategories / runtimeProjects）；改 schema 必须同步 backup 校验与版本号。
- 测试中操作 Dexie 单例的用例，`beforeEach` 用 `db.delete()` + `db.open()` 重建；组件测试若有「发后即忘」写入，`afterEach` 等待落定（约 25ms），否则 unhandled rejection 会让 test:run 退出码非 0。

### 模块边界
- 模块间不 import 彼此的内部组件；跨模块数据经 store（如 dashboard 读 tracker store）。
- 运行时数据永不写入 `src/content/` 或 `src/config/`；内置内容永不写库。

### 内容双通道（材料库/演示）
- 编译时：`src/content/library/*.md`（frontmatter: title/category/tags）、`src/content/demos/<projectId>--<name>.html`（前缀决定归属项目）；由 `import.meta.glob(..., { query: '?raw', eager: true })` 收集。
- 运行时：上传/编辑入 IndexedDB（libraryDocs 带 `source: 'runtime'`、runtimeDemos 表）；同 id runtime 覆盖内置展示并可重置。
- 材料库分类：内置 4 类（LIBRARY_CATEGORIES）固定不可删改，自定义分类存 libraryCategories 表（name 即主键），改名会迁移文档的 category。
- 演示站项目：runtimeProjects 表，同 id 行覆盖内置项目（hidden:true 为删除墓碑），自建项目直接删行；合并视图在 showcase 模块 projectStore。
- 交互 demo 用 Blob URL + `<iframe sandbox="allow-scripts">` 渲染，禁止外链依赖。

### UI
- 样式走令牌（var(--xxx)），禁硬编码颜色；亮暗主题双适配。
- 可交互元素用原生 button/a 或补全 role/tabindex/键盘（Enter/Space）；删除等破坏性操作必须 ElMessageBox 确认；错误提示 role="alert"。
- jsdom 局限：ElDialog/ElDrawer 过渡无法测试——表单逻辑抽 composable 单测，弹层交互留给 Playwright E2E（`src/test/setup.ts` 已 stub 这两个组件）。
- 动效克制：入场 fade-up、hover 微抬升；`prefers-reduced-motion: reduce` 必须降级。

### 隐私
- 简历、投递、面试记录等用户数据永不入库（仓库）；`design-demo/`、种子类文件如含真实个人信息需 gitignore。

## 5. 测试

- 单测与源码就近 `src/**/*.test.ts`；E2E 在 `tests/e2e/job-console.spec.ts`（desktop/tablet/mobile 三视口）。
- 异步断言涉 Dexie 写链时用 `vi.waitFor`（宏任务，flushPromises 不够）。
- 同毫秒 updatedAt 排序不稳定：测试定位用业务字段（公司名等）不用数组下标。
- E2E 中窄视口（≤1024px 侧边栏收为抽屉、transform 轨道内卡片）不可直达元素：侧栏项用 hash 直达路由（抽屉默认收起），transform 内交互用 `dispatchEvent` 派发。

## 6. 完成标准

- 三件套 `npm run lint && npm run test:run && npm run build` 全绿且退出码显式核对；`git diff --check` 无输出；新文件 UTF-8 无 BOM。
- 变更符合上述边界；模块行为变化有对应测试（单测或 E2E）。
- README、AGENTS 与代码事实一致；未验证事项在交付说明中明确标注。
