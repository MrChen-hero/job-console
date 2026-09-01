# Cool Slate UI 收尾修复 Spec

- 日期：2026-09-01
- 级别：Level 2（8 项有界修复，跨 5 模块；仅 item 6 需要真实设计）
- 前序：`2026-09-01-cool-slate-ui-refactor-design.md` / `-refactor.md`（Task 0–23 已完成）
- 视觉基准：`design-demo/cool-slate-light-demo.html`（下称 demo）

## 1. 目标与范围

修复 Cool Slate 重构后遗留的 8 项交互与视觉缺陷。全部在既有模块内进行，不改数据模型语义、不动 Dexie schema、不加路由。

**不纳入**：新增「系统设置」页；导入功能（本次只做导出）；语法高亮库；看板「添加卡片」。

## 2. 用户已确认的三项决策

| 项 | 决策 |
|---|---|
| 基本信息固定首位 | 固定，**同步修改** `VersionManager.test.ts:88` 用例为「basic 不可移动、其余可移动」——这是一次有意的契约变更 |
| 区块编排归属 | **整体迁入**资料池，`VersionManager` 移除该区块（含条目排除勾选） |
| 导出数据 | **接真实导出**，调用既有 `exportBackup()` |

## 3. 根因诊断

逐项定位到具体代码位置，而非「照着 demo 调」。

| 项 | 根因 | 位置 |
|---|---|---|
| 1 | `QUICK` 只有 4 项，磁贴呈 2×2 | `DashboardView.vue:72` |
| 2 | `showMsForm` 置 true 后无任何路径复位 | `DashboardView.vue:28,217,225` |
| 3 | `appliedAt`/`nextActionAt` 用 `ElInput` 手输 | `ApplicationDialog.vue:91,148` |
| 4 | `.mode-seg` 是等分描边按钮组，无滑块 | `TrackerView.vue:213-227` |
| 5 | 抽屉未做卡片化分组（527 行，令牌化已做、层次未做） | `ApplicationDrawer.vue` |
| 6 | **七个组头全在 `.tab-strip` 内，展开区是整条 strip 的兄弟节点**，故任选一组内容都落在最下方 | `ProfileEditor.vue:139-244` |
| 7 | 待实测确认（`.cat`/`.lib-item` 默认已透明、`.lib` 已有白底，与 demo 一致） | `LibraryView.vue` |
| 8 | `class="card proj"` 中 `.card` **未定义**——它只存在于 `SectionCard.vue` 的 scoped 样式，scoped 不跨组件生效，故无底色/边框/阴影 | `ShowcaseView.vue:117,245` |

item 8 是孤立缺陷：`.lib`（`LibraryView.vue:260`）与 `.kpi`（`DashboardView.vue:280`）都各自补了底色，只有 `.proj` 漏了。

## 4. 实现方案

### 4.1 工作台（item 1、2）

**快捷磁贴补至六格**：`QUICK` 增 `{ path: '/tracker?mode=board', icon: 'grid', title: '打开看板' }` 与 `{ action: 'export', icon: 'download', title: '导出数据' }`。栅格由 2×2 改 2×3（`repeat(3, minmax(0,1fr))`，≤720px 保持 2 列）。`.quick` 类名与 `go(path)` 保留；导出项走独立 handler，不进 `go()`。

导出实现：`exportBackup(db)` → `JSON.stringify` → `Blob` → `URL.createObjectURL` → `<a download>` 点击 → `revokeObjectURL`。文件名 `jobconsole-backup-YYYY-MM-DD.json`。失败走 `ElMessage.error`。

**里程碑表单收起**：三条退出路径——点击卡片外部、Esc、表单内「取消」按钮。用 `@click` 冒泡到 document 的监听器实现外部点击（挂载于 `onMounted`，`onBeforeUnmount` 解绑），判定条件为 `!formEl.contains(e.target)`。**`v-show` 不改为 `v-if`**（`dashboard.test.ts` 直接 `setValue` 隐藏输入，见前序 spec §6.6）。收起时清空两个输入。

### 4.2 投递管理（item 3、4、5）

**日期选择器**：两处 `ElInput` → `ElDatePicker`（`type="date"`、`value-format="YYYY-MM-DD"`、`clearable`）。`data-field="appliedAt"` / `"nextActionAt"` 必须落在**内层 input** 上，属性名不变。e2e 不填这两个字段（只填 company/position/nextStep），风险低。

**滑块切换**：对齐 demo `.seg`/`.seg-btn`——外层 `--surface-muted` 底 + 3px 内边距 + `--r-md`，激活项 `--card` 白底 + `--shadow-sm` + `--r-sm`。`role="tablist"`/`role="tab"`、三个 tab 文案「表格/看板/候选池」、`.mode-seg`/`.mode-btn` 类名全部保留（e2e 依赖 `getByRole('tab', { name: '看板' })`）。

**抽屉与弹窗 UI**：调用 `frontend-design` 技能做层次优化——分组卡片化、标题层级、日期与计数用 `--mono`、间距对齐 8px 栅格。**结构与事件一行不动**；保留 `.app-drawer`、`.stage-badge`、「阶段流转」、`推进到…`。

### 4.3 简历（item 6，本次唯一需要设计的项）

**手风琴结构修正**：把展开区移入每个组的 `.tab-row` 内部，成为组头的兄弟而非整条 strip 的兄弟。结构变为：

```
.pool
  └ .tab-row (×7)
      ├ button.tab-btn  (chev + 组名 + .pool-n 计数)
      └ .pool-body      (v-if="openGroup === tab.key")
```

`.tab-btn` 类名、七个组文案、`aria-expanded`/`aria-controls`、单开语义、默认 `'basic'` 全部不变，因此 `ProfileEditor.test.ts` 现有 12 条用例原样通过。

**拖拽编排**：新增「区块编排」切换按钮（`.pool-arrange`）。关闭态=当前行为；开启态下每个可拖组头左侧显示 `grip` 图标（`AppIcon name="grip"`，即 `::` 样式），组头 `draggable="true"`，行间 `@dragover.prevent` + `@drop` 换位，落定后调 `store.updateSections(versionId, reordered)` 持久化。

**basic 固定首位**：`basic` 组头不渲染 grip、不设 `draggable`，且 `onDrop` 拒绝 `targetIndex === 0` 的落点。同步改 `VersionManager.test.ts:88` 用例（决策已确认）。

**从 VersionManager 迁出**：移除 `moveSection`、上/下移按钮、`.section-row`、`.section-entries` 与条目排除勾选，迁至资料池组内。`VersionManager.test.ts` 中依赖这三个选择器的 3 条用例随之迁移到 `ProfileEditor.test.ts`。`.vm-card`/`.vm-card-actions`（按钮顺序：重命名/复制）/`.vm-create`/`.vm-delete`/空态文案保留。

拖拽实现复用 `ApplicationBoard.vue:71-87` 的原生 HTML5 DnD 写法，不引第三方库。键盘可达性：保留上/下移按钮作为 DnD 的等价操作，置于组头右侧（仅编排态可见）——纯拖拽对键盘用户不可用。

### 4.4 材料库与演示站（item 7、8）

**item 8**：`.proj` 补齐卡片表面（`--card` 底 + `1px --border` + `--r-lg` + `--shadow-sm`），并加顶部 3px 彩色条区分项目（色相取 `--info-vivid`/`--success-vivid`/`--violet-vivid`/`--warn-vivid` 轮转，与看板列同一套 `-vivid` 语义）。hover 保持现有微抬升。调用 `frontend-design` 定稿。保留 `.deck-open`、「▶ 进入项目演示」、`.upload-open`、`.src-tag`。

**item 7**：先实测定位灰底来源（`.cat-row` 包裹层是相对 demo 多出的结构，为首要嫌疑），再对齐 demo 的「默认透明 / hover `--card2` / 激活 `--primary-soft`」三态。`.chip` 类名必须保留（`LibraryView.test.ts:29` 靠它切换分类）。若截图判读困难，用 `vision-skill` 识别 `.ui-shots/final/light/1536-4-library.png`。

## 5. 契约影响

**有意变更（2 处，均已获用户确认）**：

1. `VersionManager.test.ts:88` —— basic 由「可移动」改为「不可移动」
2. `.section-row` / `.section-entries` —— 从 `VersionManager` 迁至 `ProfileEditor`，选择器仍存在但归属组件改变

**其余一律不破坏**：前序 spec §8.2 全清单（50 选择器 + 15 文案 + 全部 `data-testid`/`data-field`）。冲突时以清单为准。

## 5.1 实施中的偏差（与本 spec 原文不一致，均已验证）

| 项 | spec 原文 | 实际做法 | 原因 |
|---|---|---|---|
| 6a | `.tab-btn` 内含 `.pool-n` 计数 | `.pool-n` 留在按钮**外**，视觉位置不变 | demo 把计数放在按钮内，但 `ProfileEditor.test.ts` 有 5 处 `b.text() === '教育背景'` 全等断言；按 §5「冲突时以清单为准」，测试契约优先 |
| 6a | 单开语义不变 | 追加「再点收起」 | demo 的 `poolOpen === group ? '' : group` 就是可收起；用户 item 6 原话含「展开收起」。`addEducation` 辅助函数随之改为「未展开才点」，断言未动 |
| 6b | 迁移 3 条用例 | 实际只有 2 条依赖 `.section-row`/`.section-entries` | 复核后确认为 2 条 |
| 6b | — | 区块编排入口仅在存在版本时出现 | 无版本时 `updateSections` 无处落盘，按钮会是空操作 |
| 7 | 先实测定位灰底来源 | 根因是**全局缺少 button 重置** | `.cat`/`.lib-item` 是 `<button>` 且正确地未声明 background，透出 UA 的 `ButtonFace` 灰。demo 第 109–110 行有这段重置，重构时漏移植。同时消掉 `.tab-btn`、未激活 `.mode-btn` 上同源的潜在灰底 |
| 3 | `data-field` 直接写在 `ElDatePicker` 上 | 渲染后按 `id` 补写到内层 input | `ElDatePicker` 只转发声明过的 prop，任意属性会被丢弃；实测 `data-field` 在内外层都不存在 |
| 附带 | — | 补 `--r` 令牌别名 | `var(--r)` 在 6 个组件共 8 处被调用但从未定义，全部退化成直角 |

## 6. 执行检查点

- [x] 检查点 1：工作台六格磁贴 + 导出真实落盘 + 里程碑表单三路径可收起（item 1、2）
- [x] 检查点 2：日期选择器 + 滑块切换生效，`data-field` 与 `role="tab"` 未变（item 3、4）
- [x] 检查点 3：抽屉/弹窗经 `frontend-design` 优化，结构与事件零改动（item 5）
- [x] 检查点 4：资料池展开区落在各组内部，`ProfileEditor.test.ts` 原 12 条全绿（item 6a）
- [x] 检查点 5：拖拽编排可用、basic 固定首位、编排从 VersionManager 迁出、迁移后的测试全绿（item 6b）
- [x] 检查点 6：材料库三态对齐 demo、演示站卡片有独立表面与色条（item 7、8）
- [x] 检查点 7：四件套全绿 + 截图核对（`node scripts/ui-shots.mjs followup`）

## 7. 验证

每个检查点跑对应单测；检查点 2、5、7 额外跑 e2e（涉及 `role="tab"`、表单字段、区块编排持久化）。

收尾统一验证：

```bash
npm run lint; npm run test:run; npm run build
NO_PROXY="127.0.0.1,localhost" no_proxy="127.0.0.1,localhost" npm run test:e2e
node scripts/ui-shots.mjs followup
```

e2e 两项环境前提照旧：必须带 `NO_PROXY`；跑前确认 4173 空闲。

顺带清理前序遗留：`ProfileEditor.vue` 45 个 `vue/html-indent` warning（`eslint --fix` 可清），本次改该文件时一并解决。
