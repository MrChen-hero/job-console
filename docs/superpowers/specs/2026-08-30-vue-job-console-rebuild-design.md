# Vue 求职工作台重构 · 收敛设计文档

> 日期：2026-08-30 ｜ 状态：已收敛（设计语言经 `design-demo/index.html` 交互演示验证）
> 交接视觉基准：`design-demo/index.html`（单文件原型，五大模块全部可交互）

## 1. 背景与目标

将现有 React 纯静态作品集（Playful Geometric 主题、双轴 Deck）完全重构为面向求职者的**个人信息管理系统「求职工作台」**。作品集演示降级为系统中的一个功能模块。

三大功能区：

1. **求职进度管理**——投递台账（公司 × 岗位 × 阶段流转）、岗位候选池、面试记录、进度仪表盘；
2. **简历管理**——个人资料池、多版本简历（AI 岗 / 开发岗）、A4 预览与打印导出 PDF；
3. **项目演示站**——迁移现有 4 个项目与双轴 Deck 交互，视觉按新设计规范重做。

## 2. 已确认决策（用户拍板，不再重议）

| 决策点 | 结论 |
|---|---|
| 存储形态 | 纯前端本地存储（IndexedDB），做好 JSON 导入/导出 |
| 管理页 UI | Element Plus + 定制主题（映射自设计令牌）；演示站用自定义设计 |
| 作品集迁移 | 4 个项目内容 + 双轴 Deck 交互迁移，视觉重做 |
| 仓库 | 当前 Demo 仓库原地重构，git 历史保留 |
| 设计语言 | 「清简专业风」混合方案（见 §3），已出可交互演示 |

## 3. 设计语言「清简专业风」

来源与取舍（已向用户展示并认可）：

- **shadcn / tweakcn 基底**：CSS 变量令牌、石灰中性底 + 靛蓝主色、1px 边框、10px 圆角、柔和低阴影、亮/暗双主题；
- **Semi Design**：Design Token 规范思想、中后台信息密度与表格节奏；
- **StyleKit**：仪表盘用便当盒网格（Bento）；简历与演示站用编辑杂志风（Editorial）衬线排版；
- **MotionSites**：克制动效——入场 fade-up 级联、hover 微抬升、页面切换平滑过渡，尊重 `prefers-reduced-motion`。

核心令牌以 `design-demo/index.html` 的 `:root` 区为蓝本（亮/暗两套、语义色、圆角、阴影、缓动曲线），正式版沉淀为 `src/styles/tokens.css` 并映射到 Element Plus 主题变量（`--el-color-primary` 等）。设计规范文档在实施阶段重写为新的 `DESIGN.md`。

## 4. 技术栈

- Vue 3.5+（`<script setup lang="ts">` + Composition API）、TypeScript、Vite 8（保留）
- vue-router 4、Pinia 3、Element Plus 2、Dexie（IndexedDB 封装）
- vitest + @vue/test-utils、Playwright（沿用现有工程化）
- 动效：Vue 内置 `<Transition>` + CSS 过渡；不引入 Motion 运行时

## 5. 信息架构与模块职责

侧边导航五个视图（与演示一致）：

| 模块 | 职责 | 关键交互 |
|---|---|---|
| `modules/dashboard` 工作台 | Bento 网格：统计卡、投递漏斗、本周待办（`nextActionAt`）、里程碑时间线 | 快捷操作入口 |
| `modules/tracker` 投递管理 | 投递台账表格/看板双视图、状态筛选、详情抽屉（阶段流转 + 面试记录）、新增投递 | 看板拖拽换阶段；状态机流转 |
| `modules/resume` 简历管理 | 资料池编辑、简历版本编排（版本 = 资料池条目的选择与排序）、A4 预览 | 浏览器打印导出 PDF（`@page A4`） |
| `modules/library` 材料库 | 自我介绍/高频问题/项目深挖/八股的分类与 markdown 阅读 | 分类检索 |
| `modules/showcase` 项目演示 | 公开门户首页 + 双轴 Deck（横向项目 × 纵向演示页） | 键盘/拖拽/导航点；`Esc` 关闭 |

共享层：`shared/`（通用组件与 composables）、`storage/`（持久化）、`config/`（演示站内容配置）、`app/`（入口、路由、Pinia、布局壳）。

## 6. 数据模型

以用户真实资料为基准（投递台账、秋招模板、两版简历、通用材料）：

```ts
Profile         // 资料池（单一主数据）：basic、education[]、skills[]、experiences[]、projects[]、awards[]、selfEvaluation
ResumeVersion   // { id, name, targetRole, sections: [{ type, itemId, title, bullets, order }] }
Application     // { id, company, position, batch(提前批|正式批|补录|实习), channel, appliedAt, location,
                //   url?, status, stageHistory[], nextStep?, nextActionAt?, notes?, track?, interviews[] }
InterviewRecord // { round, date, format, questions[], weak?, followUp? }
CompanyPool     // { id, company, city, category, track(主投|保底|机会型), priority, jdBrief? }   ← 岗位候选池
LibraryDoc      // { id, category(自我介绍|高频问题|项目深挖|八股), title, body(markdown), tags[], updatedAt }
Milestone       // { date, label, done? }
```

状态机（对应投递台账列定义）：
`已投递 → 笔试 → 一面 → 二面 → HR面 → Offer`，终态 `挂`（附原因）、`无消息`；终态可重开。
- `status` 即当前阶段，恒等于 `stageHistory` 最后一条的 stage（单一事实源，UI 从 history 推导时间线）
- 「无消息超 1 个月视为挂」是**展示/筛选启发式**（列表与仪表盘标注），不做自动状态改写
- `Milestone` 为手动维护（仪表盘编辑），不从投递记录推导

## 7. 存储与备份

- Dexie 单库多表，schema 版本化（版本号写入导出文件 `schemaVersion`）
- **导出**：全量 JSON 下载；**导入**：文件选择 + schema 校验 + 合并/覆盖二选一；合并按 `id` 冲突时整条以导入方为准（不做字段级合并）
- 自动本地快照（保留最近 5 份），防误操作
- **隐私边界**：简历/台账数据只存在于浏览器 IndexedDB，绝不写入仓库；演示站配置只含项目内容（本就公开）
- 首次运行提供种子导入：从用户真实 md 台账生成 `seed.json`，放 gitignore 的本地路径，手动导入
- IndexedDB 不可用时降级为内存模式并在 UI 明确提示（无约束兜底禁止，提示必须可见）

## 8. 目录结构

```
src/
  app/            # 入口、router、pinia、布局壳（侧边导航 + 顶栏）
  storage/        # Dexie 表定义、schema 版本、导入导出、快照
  modules/
    dashboard/    # 工作台
    tracker/      # 投递台账、看板、面试记录、候选池
    resume/       # 资料池、简历版本、A4 预览与打印
    library/      # 材料库
    showcase/     # 演示站：门户 + 双轴 Deck
  shared/         # 通用组件、composables（StatusTag、EmptyState、useTheme…）
  config/         # showcase.config.ts（4 个项目 + 幻灯片内容）
  styles/         # tokens.css、全局基线、Element Plus 主题映射
tests/            # 单测 + e2e
design-demo/      # 设计原型（保留作视觉基准，不进构建）
```

旧 React `src/` 整体删除（git 历史保留）；清理前必须先核对 `git status`，保留用户未提交的工作区修改（如 README.md 的在改内容）。`AGENTS.md`、`README.md` 重写；根 `DESIGN.md` 由新规范替代（旧规范归档至 `docs/`）；保留 `public/media/` 与 `.github/workflows`（更新 Node 版本与命令）。

## 9. 演示站迁移策略

- 保留语义：主页介绍 + 双轴 Deck（横向项目切换 + 纵向演示页）、键盘（←/→/↓/↑/Esc）、拖拽（横滑意图判定：|dx| > |dy|×1.25，阈值 56px）、导航点、边界 clamp
- Vue 实现：`useDeckController()` composable 承接原 React 控制器逻辑；`DeckOverlay` + 幻灯片组件；换页用 transform 过渡
- 删除多主题/外观切换注册表（新规范单设计）；`resolvePublicAsset` 逻辑保留（GitHub Pages 子路径兼容）
- 演示站个人信息（姓名、学校、联系方式）从 Profile 读取，简历模块改动自动同步；IndexedDB 为空（未导入种子）时回退到 `showcase.config.ts` 内的公开默认值
- 拖拽判定沿用原型参数：位移阈值 56px + 横滑意图（|dx| > |dy|×1.25）；原 React 控制器的速度兜底（540px/s）不再迁移，快速轻扫依赖位移阈值

## 10. 错误处理与降级

- 导入文件 schema 不合法：逐条列出 `path: message`，拒绝导入，不静默丢弃
- 配置错误（演示站 `showcase.config.ts`）：启动校验，dev 抛错、prod 渲染错误页（沿用现有模式）
- Deck 打开时切换主题（亮/暗）不关闭 Deck、不重置页码
- `prefers-reduced-motion: reduce` 优先于页面动效；所有动效可降级
- 焦点管理：弹窗/抽屉打开移焦、关闭还原，`Esc` 关最上层

## 11. 测试策略

- 单测：状态机流转、导入/导出往返、快照回收、简历版本编排、资料池 CRUD
- 组件测试：看板拖拽换阶段、详情抽屉、A4 渲染、材料库检索
- E2E：五模块主流程 + Deck 双轴翻页 + 导入导出闭环 + 减少动效
- 视觉/响应式：桌面 1440 / 平板 768 / 移动 390 三档

## 12. 实施阶段

| 阶段 | 内容 | 退出标准 |
|---|---|---|
| 1 设计与骨架 | 新 DESIGN.md、清旧代码、Vue+Router+Pinia+EP+Dexie 骨架、令牌与布局壳 | build 通过、路由可达 |
| 2 存储层 | Dexie 表、导入/导出/快照 | 存储单测通过 |
| 3 简历模块 | 资料池、版本编排、A4 预览打印 | 表单与打印样式验证 |
| 4 进度模块 | 台账、看板、状态机、面试记录、候选池、工作台 | 状态机单测通过 |
| 5 材料库 | markdown 管理与检索 | 组件单测通过 |
| 6 演示站 | 配置迁移 + Deck 重做 | e2e 翻页/键盘/拖拽/降级通过 |
| 7 收尾 | 种子数据、CI 更新、AGENTS/README 重写 | lint+test+build+e2e 全绿 |

每阶段收尾运行 `npm run lint && npm run test:run && npm run build`；最终 `git diff --check` + UTF-8 无 BOM 检查。

## 13. 风险与边界

- 证照/附件 Blob 存储不在本期范围，资料以结构化字段为主
- 打印导出依赖浏览器「另存为 PDF」，不引入 PDF 生成库
- 仓库若公开，种子文件与任何简历内容不入库
- `design-demo/` 保留为视觉基准，不参与构建与部署

## Verification

- 阶段退出标准见 §12；整体完成标准：五模块与演示一致可用、隐私数据不出本机、全量验证绿
- 视觉验收以 `design-demo/index.html` 为基准对照

## 14. 附录：内容双通道设计（2026-08-31 增补，源自用户目标与博客调研）

用户目标扩展：材料库与项目演示均需**编译时 + 运行时双通道**增删：

- **参考项目调研结论**（mrchen-hero.github.io，Astro 6 纯静态博客）：内容为约定目录 + glob 扫描 + schema 校验 + 构建时 JSON 清单端点（`/api/allPostMeta.json`）+ 运行时 fetch 消费；**无运行时上传能力**，运行时通道需本项目自行设计。
- **编译时通道**：
  - 材料库：`src/content/library/*.md`（frontmatter: title/category/tags），Vite `import.meta.glob` + gray-matter 构建时解析为只读清单；
  - 演示页：`public/demos/*.html`（交互式 HTML 整页），构建时扫描目录生成清单（参考博客 gallery-utils 的目录扫描模式）。
- **运行时通道**：页面上传/编辑 → IndexedDB（`libraryDocs` 表新增 `source: 'local'|'runtime'` 区分；演示页运行时记录存新表 `runtimeDemos`，内容为 HTML 文本）。
- **合并展示**：清单 = 编译时清单（只读，标记 local）∪ 运行时记录（可增删改，标记 runtime）；同 id 时 runtime 覆盖展示并可「重置为编译时版本」。
- **演示页渲染**：运行时 HTML 用 Blob URL + `<iframe sandbox>` 承载；编译时 demo 直接 iframe 指向 `BASE_URL + demos/<file>`。
