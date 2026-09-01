# 求职工作台 · Plan 3：进度模块与工作台 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付投递管理（台账表格/看板双视图、投递 CRUD、状态机流转、面试记录 CRUD、候选池 CRUD）与工作台 Bento 仪表盘（统计/漏斗/待办/里程碑 CRUD）。对应设计文档 §12 阶段 4。

**Architecture:** 沿用 Plan 2 模式——Pinia store 封装 Dexie；不变量 `status === stageHistory 末项 stage`（写路径统一走 `changeStage()`）；看板拖拽用原生 HTML5 DnD；详情抽屉用 ElDrawer。数据展示规则：无消息超 1 个月在列表标注「超 1 月视为挂」启发式（不改写 status）。

**Tech Stack:** 同 Plan 1/2。

**Spec:** `docs/superpowers/specs/2026-08-30-vue-job-console-rebuild-design.md` §6/§12 阶段 4

**执行纪律：** 同 Plan 2（每 Task 三件套显式核对退出码 → 提交 → 子代理审查 → 改进 → `docs/superpowers/logs/2026-08-31-plan3-execution-log.md` 落档；README.md 不动；测试 afterEach 等待在途写入落定）。

## 文件结构

```
src/modules/tracker/
  store.ts                        # useTrackerStore：投递 CRUD/状态机/面试记录/候选池/里程碑
  __tests__/store.test.ts
  constants.ts                    # 阶段列定义、badge 色、状态机下一阶段映射
  views/TrackerView.vue           # 视图模式切换（表格/看板/候选池）+ 工具栏 + 组装
  components/
    ApplicationDialog.vue         # 新增/编辑投递表单（公司/岗位必填）
    ApplicationTable.vue          # 台账表格（筛选 chips + 搜索 + 状态 badge + 超期启发式标注）
    ApplicationBoard.vue          # 看板（7 列 + HTML5 拖拽换阶段）
    ApplicationDrawer.vue         # 详情抽屉（kv 信息 + 阶段时间线 + 面试记录 CRUD + 推进/挂）
    InterviewCard.vue             # 面试记录卡（编辑/删除）
    CompanyPoolView.vue           # 候选池 CRUD
  components/__tests__/
    ApplicationTable.test.ts
    ApplicationBoard.test.ts
    ApplicationDrawer.test.ts
    CompanyPoolView.test.ts
src/modules/dashboard/
  store.ts                        # useDashboardStore：派生统计（复用 tracker store 数据）
  __tests__/store.test.ts
  views/DashboardView.vue         # Bento 网格
  components/
    StatCards.vue                 # 统计卡（累计/进行中/面试中/Offer）
    FunnelCard.vue                # 投递漏斗
    TodoCard.vue                  # 本周待办（nextActionAt 排序）
    MilestoneCard.vue             # 里程碑时间线 + 增删
    QuickActions.vue              # 快捷操作（路由跳转）
  components/__tests__/MilestoneCard.test.ts
```

## 关键语义

- 状态机：`已投递→笔试→一面→二面→HR面→Offer`；终态 `挂`/`无消息` 可重开（重开 = 追加 `已投递` history）
- `changeStage(id, stage, date?)`：push history + 同步 status + updatedAt
- `advance(id)`：按 STAGE_DONE 序推进到下一阶段；`markDropped(id)`：置挂
- 启发式：`isStale(app)` = status 为 无消息 且 last history 距今 >30 天 → 表格/卡片标灰提示
- 候选池条目可「转为投递」（预填公司名打开 ApplicationDialog）

### Task 1: tracker store + constants
测试先行：CRUD、changeStage 同步 status/history、advance/markDropped/重开、面试记录增删改、候选池 CRUD、里程碑 CRUD、isStale 启发式。三件套+提交+审查+落档。

### Task 2: 台账表格 + 投递对话框
ApplicationDialog 表单校验（公司/岗位必填、日期默认今天）；ApplicationTable 筛选 chips（全部+8 状态）+ 搜索（公司/岗位）+ 空态。测试：渲染行数、筛选、搜索、超期标注。三件套+提交+审查+落档。

### Task 3: 看板拖拽 + 详情抽屉
ApplicationBoard：7 列（挂/无消息合并列），dragstart/dragover/drop 换阶段（drop 调 changeStage）；ApplicationDrawer：kv、阶段时间线、面试记录列表 + 添加/编辑对话框（round/date/questions 多行/weak/followUp）、推进到下一阶段、标记挂、重开。测试：拖拽 dataTransfer 模拟换阶段、抽屉推进/面试记录 CRUD。三件套+提交+审查+落档。

### Task 4: 候选池
CompanyPoolView：列表 + 新增/编辑对话框（公司必填/city/category/track/priority）+ 删除确认 + 「转投递」按钮（emit 打开预填对话框）。测试：CRUD + 转投递预填。三件套+提交+审查+落档。

### Task 5: 工作台 Bento + 里程碑
DashboardView 组装五卡；FunnelCard 六阶段计数条；TodoCard 取 nextActionAt 有值的按日期排序；MilestoneCard 时间线 + 添加（prompt 日期+文案）/删除；QuickActions 路由跳转（工作台→其他视图由 router 完成）。测试：统计派生、里程碑增删。三件套+提交+审查+落档。

### Task 6: 响应式与浏览器冒烟 + 终审
表格横向滚动、看板横向滚动、Bento 12 列→1180px 折叠、390 冒烟无溢出；子代理终审 + 落档。

## Verification（Plan 3 完成标准）

- [ ] 投递/面试记录/候选池/里程碑全 CRUD 可用且持久化；状态机流转正确且有测试锁定
- [ ] 三件套全绿；1440/1180/390 浏览器冒烟无溢出、交互可用
- [ ] 执行日志完整
