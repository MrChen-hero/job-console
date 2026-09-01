
## Plan 3 Task 1: tracker store ✅

- 提交：dbd8897 → 精炼提交
- 验证：54 用例全绿、三件套退出码 0
- 审查结论：**通过**
- 审查建议落实：convertToApplication 必填 position（补不存在 poolId 抛错测试）；reopen 分支合并 + history 长度断言；尾逗号清理
- 待办：组件测试（Task 2~4）需按 VersionManager 模式补 afterEach 落定等待

## Plan 3 Task 2: 台账表格 + 投递对话框 ✅（含评审精炼）

- 提交：e255af8（表格/对话框/视图组装）→ 874c623（评审精炼）
- 验证：59 用例全绿、三件套退出码 0
- 审查结论：**通过**
- 架构决策（已与评审确认）：ElDialog 在 jsdom 下 prop 驱动开箱不可靠（VTU transition-stub 吞显影），表单逻辑抽为 useApplicationForm composable 单测；@open 回显在真实浏览器有效（核对 EP 源码：watcher + nextTick，不依赖过渡）；对话框交互留待 Plan 5 E2E
- 审查建议落实：NewApplicationInput 补 nextStep/nextActionAt；onDialogSave try/catch + ElMessage.error；搜索加分隔符防跨字段误匹配（过程小事故：分隔符写成真实 NUL 字节破坏解析，已改为 JS 转义并修复）
- 遗留：表格行键盘可达性在 Task 3 抽屉中加行内详情按钮处理

## Plan 3 Task 3: 看板拖拽 + 详情抽屉 ✅（含评审精炼）

- 提交：a9f6a92（看板 + 抽屉 + 表格详情按钮 + 4 用例）→ 86d3a80（评审精炼）
- 验证：63 用例全绿、三件套退出码 0
- 审查结论：**通过**
- 测试策略：抽屉的 ElDrawer/ElMessageBox 受 jsdom 过渡 stub 限制，交互走 Plan 5 E2E；store 层已在 Task 1 覆盖；看板拖拽用 dataTransfer stub + vi.waitFor 全测
- 审查建议落实：dragId 模块级变量改组件内 ref（消除多实例污染）；卡片补 Space 键激活；抽屉在投递被外部删除时自动关闭
- 记录：拖拽换阶段的键盘等价路径 = 抽屉「推进/标记挂/重新投递」，Plan 5 E2E 确认

## Plan 3 Task 4: 候选池 ✅（含评审精炼）

- 提交：853deb3（候选池 CRUD + 转投递 + 4 用例）→ 5b4acb8（评审精炼）
- 验证：67 用例全绿、三件套退出码 0
- 审查结论：首轮**需改进**（缺测试策略注释、open-create emit 死接线）→ 补齐后达标
- 审查建议落实：补 jsdom/E2E 策略注释；删除 open-create 死接线；priority 数字校验（Number.isFinite）；hint 说明池条目保留语义；store.convertToApplication 标注为 store 级 API

## Plan 3 Task 5+6: 工作台 Bento + 冒烟终验 ✅

- 提交：仪表盘（store + 五卡 + 里程碑 CRUD + 72 用例）
- 验证：72 用例全绿、三件套退出码 0
- 浏览器实测（1440/390）：仪表盘 Bento 渲染正常；真实用户流走通——新增投递（表单校验+保存）→ 表格出现记录 → 看板卡片就位 → 抽屉打开（kv/时间线/面试记录空态/操作按钮）→ 推进到笔试（卡片实时移列、时间线两条）→ 工作台联动
- 过程修复：dashboard store 导入路径；测试同毫秒排序不稳定（按公司定位）与 Dexie 宏任务时序（vi.waitFor）

## Plan 3 终审 ✅（通过）

- 终审确认：提交链完整、三件套全绿、状态机单测锁定、硬约束满足
- 已记录偏差：DashboardView 五卡与 InterviewCard 内联（计划为独立组件文件，功能等价）；ApplicationDrawer.test.ts 移交 Plan 5 E2E（jsdom 限制）
- 终审后清理：eslint --fix 清 65 条风格 warning（lint 0 error 0 warning）
- 遗留移交 Plan 4/5：抽屉/对话框真实交互 E2E、1180px 断点实测（CSS 已实现）
