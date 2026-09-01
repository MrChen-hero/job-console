# Plan 4 执行日志（材料库双通道与演示站）

> 计划：docs/superpowers/plans/2026-08-31-job-console-phase4-library-showcase.md

## Task 1: frontmatter + marked + schema v2 ✅（一轮修复后通过）

- 提交：7a6521e → 修复提交（frontmatter 末行 bug + marked 依赖入库）
- 验证：78 用例全绿、三件套退出码 0
- 审查结论：首轮**需改进**（闭合线为末行时 body 回退整篇的解析 bug；marked 依赖未随提交入库导致提交点不自包含）→ 均已修复
- 安全评估（已记录）：markdown 渲染信任本机数据来源，XSS 残余风险自担；若未来引入协作/外部来源必须加 DOMPurify；demo 走 iframe sandbox 隔离
- 遗留移交 Plan 5：backup 导出/导入需纳入 runtimeDemos（BACKUP_SCHEMA_VERSION 升 2）；可选补 v1→v2 升级测试

## Task 2: 编译时清单 + 内置内容 + 材料库 store ✅

- 提交：6db5fed（5 篇内置 md + 内置交互 demo + showcase 配置 + 编译时清单 + 合并 store + 5 用例）→ 93d486a（overridden 语义修正）
- 验证：83 用例全绿、三件套退出码 0
- 审查结论：**通过**
- 审查建议落实：MergedDoc.overridden 恒 false 的语义缺陷修正（覆盖条目携带 overridden:true + 测试断言）
- 遗留移交：Vue warn 噪音（ElDialog/v-loading 未注册）在 Plan 4 收尾统一清理；内置文档如需展示更新时间需补 frontmatter updated 字段

## Task 3: LibraryView UI ✅（一轮修复后通过）

- 提交：784e0d9 → ed51008（评审修复）
- 验证：88 用例全绿、三件套退出码 0、lint 0 error 0 warning
- 审查结论：首轮**需改进**（删除/重置缺确认——计划明确要求；新增文件打破 lint 零警告基线）→ 均修复
- 审查建议落实：删除/重置 ElMessageBox 确认；保存后按标题选中新文档；showPreview 独立 ref；onFileChange try/finally；文案改「编辑（保存后覆盖内置）」消歧；v-html 加 eslint-disable + 信任来源注释
- 过程小事故：python 正则替换把控制字符写入 .vue 文件（vue/no-parsing-error 暴露），已重写干净段落

## Task 4+5: 演示站 Deck 与 demo 上传 + 冒烟 ✅

- 提交：7c46e31（deck 逻辑/demoStore/配置 + 7 用例）→ 5175a25（DeckOverlay/上传面板/门户视图）→ demo 前缀修复 + vIdx 层级修复
- 验证：95 用例全绿、三件套退出码 0
- 浏览器实测：门户 hero + 项目卡渲染；Deck 横向切项目、纵向进要点页、再纵进内置交互 demo（iframe sandbox 完整渲染含可点按钮）；Esc/导航点/提示齐全
- 浏览器实测发现并修复：a) 内置 demo 文件名缺 projectId 前缀导致挂错项目（改名 campus-market--review-flow.html）；b) 纵向页 clamp 上界差一（主面+pages 共 N+1 层）；c) 多页 viewport calc 高度方案布局失准 → 改为绝对堆叠 + 激活面显影（transition 保留、reduced-motion 降级）
- 运行时上传 .html 的浏览器端实测受 IAB 文件选择限制未执行；该链路逻辑（file.text→addDemo→merged→demoUrl→iframe）各环节均有单测覆盖，E2E 归入 Plan 5

## Plan 4 终审 ✅（通过）

- 终审确认：提交链完整、三件套全绿、双通道与 Deck 验收达成、硬约束满足
- 终审后清理：eslint --fix 清 106 条格式 warning
- 遗留移交 Plan 5（全部已在 Plan 5 计划范围内）：runtimeDemos 纳入备份（BACKUP_SCHEMA_VERSION 升 2）；上传 .html 全链路 E2E；Vue warn 噪音（ElDialog/v-loading stub）；demoUrl blob 释放策略
