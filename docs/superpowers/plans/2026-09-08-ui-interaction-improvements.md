# UI Interaction Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 完成用户已批准的六项交互改进，保留 Cool Slate 设计与已有待办直达功能。

**Architecture:** 继续使用模块 store 管理数据，各页面负责筛选与展示状态。沿用现有备份导入函数和 schema，不改变存储格式或导入规则。手机布局通过 CSS 与明确的展示状态实现；相关缺陷随各项修复，现有未提交修改保留，不自动提交。

**Tech Stack:** Vue 3 / TypeScript / Pinia / Element Plus / Dexie / Vitest / Playwright，Windows PowerShell，UTF-8 无 BOM。

---

用户已批准执行审查建议 1–6。以下六项按模块独立实施，共用最后的验证步骤。

### 1. 工作台任务优先

**Files:** `src/modules/dashboard/views/DashboardView.vue`、`src/modules/dashboard/__tests__/dashboard.test.ts`。

- [x] 手机统计两列紧凑排列；待办位于漏斗之前，桌面保持双栏。
- [x] 待办按本地日期分为已逾期、今天、后续，默认前 5 条，展开全部；跨年显示年份；保留每条详情链接。零变化显示“暂无变化”，涨跌说明相对四周前。
- [x] 验证日期分组、展开、空状态、手机首屏待办位置与原有链接跳转。

### 2. 手机投递列表与筛选

**Files:** `src/modules/tracker/components/ApplicationTable.vue`、`src/modules/tracker/views/TrackerView.vue`、`src/modules/tracker/components/__tests__/ApplicationTable.test.ts`。

- [x] 在现有 filtered/sorted/paged 派生数据基础上增加手机卡片，展示公司、职位、状态、下一步及日期；详情与收藏分开操作，桌面仍为表格。
- [x] 手机筛选折叠，显示启用数量，支持清空；搜索与新增保持可见。分页用 `watch(pageCount, count => page.value = Math.min(page.value, Math.max(1, count)))` 收敛。
- [x] 测试末页删除后回退、手机详情/收藏/筛选和桌面排序。

### 3. 材料库检索与编辑保护

**Files:** `src/modules/library/views/LibraryView.vue`、`src/modules/library/components/DocEditor.vue`、`src/shared/markdown/preview.ts`（新增）、`src/shared/markdown/preview.test.ts`（新增）。

- [x] 搜索标题/正文/标签，列表摘要从 Markdown 提取纯文本；工具栏固定入口，分类横滚仅显示选择，分类管理在独立弹窗，聚合“全部”不参与编辑/删除。
- [x] 搜索/分类改变时使 activeId 指向当前可见文档或空值，编辑中切换需先处理草稿。
- [x] DocEditor 暴露 dirty 与异步 save 方法；取消/离开模块/更换编辑对象时提供保存、放弃、继续编辑；刷新提供浏览器默认未保存提示。保存失败保留草稿并显示错误。
- [x] 测试摘要、搜索/分类同步、保存/放弃/继续编辑与失败保留。

### 4. 简历编辑与预览

**Files:** `src/modules/resume/views/ResumeView.vue`、`src/modules/resume/components/ProfileEditor.vue`。

- [x] ≤1180px 以编辑/预览切换展示；版本名、保存状态、导出入口放在顶部工具栏，桌面仍为双栏。输入基本资料时标记待保存，保存失败有反馈，预览基于已保存版本。
- [x] ResizeObserver 测量纸面原始高度和容器内容宽度，设置包裹宽高为原尺寸乘缩放系数，扣除内边距；打印规则解除缩放与高度约束。
- [x] 验证手机编辑切换不丢输入、预览无横向溢出/大段空白、桌面双栏、打印媒体布局。

### 5. 数据导入选择与摘要

**Files:** `src/shared/layout/AppSidebar.vue`、`src/shared/ImportDialog.vue`（新增）、`src/shared/layout/AppLayout.vue`、`src/shared/layout/AppTopbar.vue`。

- [x] 校验文件后只读导出现有数据用于数量摘要，显示当前/备份分项数量，明确合并冲突以备份为准。
- [x] 独立弹窗选择合并（默认）或覆盖，保留真正取消按钮；覆盖另需显式确认，执行时防重复并禁关闭，失败保留待导入文件。调用既有 importBackup，仍保留覆盖前自动快照。
- [x] 手机导航打开时转移焦点并限制 Tab，关闭时恢复；弹窗挂到侧栏外避免被 inert 影响。
- [x] 浏览器验证取消无写入、合并保留未冲突数据、覆盖与快照、失败不误报完成、键盘导航。

### 6. 演示项目表达与键盘

**Files:** `src/modules/showcase/views/ShowcaseView.vue`。

- [x] 页面改用“选择项目查看演示，支持上传网页或添加链接”等操作文案，移除实现细节与不符实现的个人信息说明。
- [x] 每张项目卡显示关联演示数量或暂无演示，按钮命名涵盖上传与链接。
- [x] 卡片仅处理自身的 Enter/Space，内部编辑/删除按钮独立触发；复用现有演示逻辑。

### 7. 验证与文档

- [x] 更新 `tests/e2e/job-console.spec.ts` 原有受影响选择器，并增加 `tests/e2e/ui-improvements.spec.ts` 聚焦用户流程，使用独立浏览器与虚构数据。
- [x] 执行 `npm run lint`、`npm run test:run`、`npm run build`，退出码均为 0；执行 `npm run test:e2e` 三视口，必要时沙箱外重跑以正常回收浏览器进程。
- [x] 检查明暗主题、窄屏布局和打印媒体；同步 `DESIGN.md` / `AGENTS.md` / `README.md` 与最终事实，执行 `git diff --check`、UTF-8 无 BOM 检查。
- [x] 汇报六项结果和验证范围，不发布、不提交用户未要求的变更。

## 验证结果

- 六项实施完成，已有待办详情链接保留。
- `npm run lint`：退出码 0。
- `npm run test:run`：29 个文件、225 项通过，退出码 0。
- `npm run build`：退出码 0；仍有既有主包超过 500 kB 的体积提示。
- `npm run test:e2e -- --workers=3`：71 项通过，1 项桌面抽屉测试按条件跳过，退出码 0。
- 五模块在 1440px / 390px、明暗主题下核对截图，页面横向溢出均为 0；三视口交互与打印媒体规则通过。未测试实体打印机、真实触屏设备与屏幕阅读器。
- 用户要求直接执行，未进行计划审查；未提交或发布。

## 后续调整（2026-09-08）

- 用户追加要求后，待办取消分组标题及前 5 条折叠，改用日期块颜色区分已逾期、今天、后续；默认全部展示，列表最高 360px，滚动条悬停或键盘焦点进入时显示。
- 演示页手机端操作按钮独立一行，等宽排列，点击区域高 44px，长标题自动换行。
- 最新 lint、225 项单测、build 与差异检查通过；待办浏览器回归在桌面、平板和手机三个视口通过，覆盖颜色、滚动条显隐、滚动与详情跳转。
- 用户随后明确要求提交并推送远端，本次按该授权交付上述变更。
