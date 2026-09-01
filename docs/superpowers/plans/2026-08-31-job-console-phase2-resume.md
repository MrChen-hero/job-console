# 求职工作台 · Plan 2：简历模块 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付简历模块：资料池七类条目的完整增删改查、简历版本编排（选择/排序/排除）、Editorial 风 A4 预览与浏览器打印导出。对应设计文档 §12 阶段 3。

**Architecture:** Pinia store 封装 Dexie 读写（profile 单例行 + versions 表）；组件分四层——视图组装（ResumeView）、资料池编辑器（ProfileEditor）、版本管理（VersionManager）、A4 渲染（ResumeSheet）。样式全部走设计令牌，打印用 `@media print` 隔离。

**Tech Stack:** Vue 3 + Element Plus（表单/对话框/Tabs）+ Pinia + Dexie；vitest + @vue/test-utils + fake-indexeddb。

**Spec:** `docs/superpowers/specs/2026-08-30-vue-job-console-rebuild-design.md` §6/§8/§12 阶段 3

---

## 执行纪律（承 Plan 1）

- 每 Task 完成后：`npm run build && npm run test:run && npm run lint` 三件套全绿 → 提交 → 派发子代理审查 → 改进 → 追加执行日志（`docs/superpowers/logs/2026-08-31-phase1-execution-log.md` 改为系列日志，本计划用 `2026-08-31-plan2-execution-log.md`）。
- README.md 用户未提交修改全程不动；提交前 `git status` 核对。
- 新文件 UTF-8 无 BOM。

## 文件结构

```
src/modules/resume/
  store.ts                          # useResumeStore：profile 读写 + 版本 CRUD + 条目 CRUD
  __tests__/store.test.ts
  views/ResumeView.vue              # 视图组装（替换占位）
  components/
    ProfileEditor.vue               # 资料池编辑器（七类条目 CRUD）
    EntryCard.vue                   # 单条目卡片（编辑/删除/上移/下移）
    EntryDialog.vue                 # 条目编辑对话框（按类别渲染字段）
    VersionManager.vue              # 版本列表 + 新建/重命名/复制/删除 + 区块编排
  components/__tests__/
    ProfileEditor.test.ts
    VersionManager.test.ts
  sheet/
    ResumeSheet.vue                 # A4 Editorial 渲染（消费 version.sections）
    sheet.css                       # A4 纸面样式（从 design-demo 移植）+ 打印隔离
  __tests__/ResumeSheet.test.ts
src/modules/resume/profileSchema.ts  # 各类条目的字段定义（驱动 EntryDialog 表单与校验）
```

## 数据流

```
ResumeView
 ├─ VersionManager ──→ store.versions / activeVersionId（编排：sections.order、excludedIds）
 ├─ ProfileEditor ───→ store.profile（七类条目 CRUD，EntryDialog 编辑）
 └─ ResumeSheet ─────→ 只读消费 activeVersion + profile（排序 → 过滤 excludedIds → 渲染）
```

不变量：`status === stageHistory.last`（tracker 模块）；本模块不变量为 **profile 行 id 恒为 'main'**，保存走整体 put。

---

### Task 1: resume store（CRUD 核心）

**Files:** `src/modules/resume/store.ts`、`src/modules/resume/__tests__/store.test.ts`

- [ ] 写失败测试（fake-indexeddb）：load 空库 → profile 为 null；ensureProfile 惰性创建；upsertEntry 增改七类条目；removeEntry；createVersion/duplicateVersion（深拷贝 sections、新 id）/renameVersion/deleteVersion；setActive 持久化到 localStorage（key `jobconsole:active-version:v1`）
- [ ] 实现 store：`load()` 读 profile 单例 + versions（updatedAt 降序）+ activeVersionId；profile 不存在时保持 null 由 UI 引导创建
- [ ] 三件套验证 + 提交 + 子代理审查 + 落档

### Task 2: profileSchema 与资料池编辑器

**Files:** `src/modules/resume/profileSchema.ts`、`ProfileEditor.vue`、`EntryCard.vue`、`EntryDialog.vue`、`ProfileEditor.test.ts`

- [ ] profileSchema：每类的字段定义（label/type/required），驱动 ElForm 动态渲染：basic（姓名必填+可选字段）、education/skills/experiences/projects/awards（各字段如 Task 计划附录）、selfEvaluation（字符串列表）
- [ ] ProfileEditor：ElTabs 七类；每类列表 EntryCard（标题/删除确认 ElMessageBox/上移下移调序）；「添加」打开 EntryDialog（ElDialog + 动态表单 + required 校验）；保存调 store.upsertEntry
- [ ] 组件测试：添加条目写入 store、删除生效、排序交换生效
- [ ] 三件套 + 提交 + 审查 + 落档

### Task 3: 版本管理器

**Files:** `VersionManager.vue`、`VersionManager.test.ts`

- [ ] 版本列表（名称/targetRole/更新时间/激活态 radio）；新建（ElMessageBox.prompt 输入名称）；重命名/复制/删除（ElMessageBox.confirm，删除活跃版本后激活切到最新剩余版本）
- [ ] 区块编排：七类 section 的 order 上移/下移 + excludedIds 勾选（说明文案「勾选=在简历中隐藏」）
- [ ] 组件测试：新建/删除/复制/激活切换/区块排序与排除生效
- [ ] 三件套 + 提交 + 审查 + 落档

### Task 4: A4 预览与打印

**Files:** `ResumeSheet.vue`、`sheet.css`、`ResumeSheet.test.ts`、`ResumeView.vue` 组装

- [ ] ResumeSheet：消费 activeVersion.sections（order 升序）+ profile，渲染 Editorial 风 A4（样式从 design-demo `.sheet` 区移植到 sheet.css，非 scoped）；excludedIds 过滤；空 profile 时渲染引导（「先完善资料池」+ 一键创建示例数据按钮——内置与你真实简历一致的示例 JSON 常量 `exampleProfile.ts`，创建动作写 store）
- [ ] 打印：ResumeView 挂 `print` 按钮 → `window.print()`；`@media print` 隐藏侧边栏/顶栏/编辑区，仅显 sheet；`@page A4`
- [ ] 组件测试：渲染排序符合 sections.order、排除项不渲染、示例数据创建成功
- [ ] 三件套 + 提交 + 审查 + 落档

### Task 5: 响应式与收尾

- [ ] ResumeView 双栏（编辑 320px + 预览自适应）→ ≤1180px 单栏堆叠；触控可用（Element 默认）
- [ ] 三件套 + 浏览器 1440/768/390 三档截图冒烟 + 提交 + 终审 + 落档

## Verification（Plan 2 完成标准）

- [ ] 七类条目增删改查可用且持久化；版本 CRUD + 区块编排可用；A4 预览与打印正确
- [ ] 三件套全绿；三档响应式冒烟通过
- [ ] 执行日志完整（每任务审查结论与改进）
