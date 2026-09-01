# 求职工作台 · Plan 4：材料库双通道与演示站 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 材料库支持「编译时内置 md + 运行时上传/编辑 md」双通道；演示站迁移双轴 Deck（4 项目 × 纵向演示页）并支持上传交互式 HTML 演示页（编译时 `src/content/demos/*.html` + 运行时上传存 IndexedDB，iframe 沙箱渲染）。对应设计文档 §12 阶段 5 + §14 双通道附录。

**Architecture:** frontmatter 自研轻解析（title/category/tags，无新依赖）；编译时清单用 `import.meta.glob(..., { query: '?raw' })`；运行时数据入库（libraryDocs 增 source 字段、新增 runtimeDemos 表 → Dexie schema v2）；合并展示规则 = 本地清单（被 runtime 同 id 覆盖时标注「已修改」，可重置）∪ runtime 记录。Demo 渲染统一走 Blob URL + `<iframe sandbox="allow-scripts">`。

**执行纪律：** 同 Plan 2/3（三件套显式退出码 → 提交 → 子代理审查 → 改进 → `docs/superpowers/logs/2026-08-31-plan4-execution-log.md` 落档）。

## 文件结构

```
src/shared/markdown/frontmatter.ts        # 轻量 frontmatter 解析（title/category/tags + 容错）
src/shared/markdown/__tests__/frontmatter.test.ts
src/shared/markdown/render.ts             # marked 封装（dep: marked）
src/content/library/*.md                  # 内置材料（自我介绍两版/高频问题/项目深挖/八股 节选）
src/content/demos/                        # 内置交互式 HTML 演示（1 个示例页）
src/config/showcase.config.ts             # 4 个项目 + 幻灯片/演示页内容（迁自 design-demo）
src/modules/library/
  localContent.ts                         # 编译时清单：glob md/demos → LocalDoc[]/LocalDemo[]
  store.ts                                # useLibraryStore：runtime CRUD + 合并/覆盖/重置 + 上传
  __tests__/localContent.test.ts + store.test.ts
  views/LibraryView.vue                   # 分类 + 列表 + md 阅读 + 上传/新建/编辑/删除
  components/DocEditor.vue                # md 编辑器（标题/分类/标签 + 正文 textarea + 预览）
src/modules/showcase/
  demoStore.ts                            # useDemoStore：runtimeDemos CRUD + 合并清单 + Blob URL
  __tests__/demoStore.test.ts + deck.test.ts
  deck.ts                                 # 双轴导航纯逻辑（边界/换页/纵页），可单测
  views/ShowcaseView.vue                  # 门户 hero + 项目卡
  components/DeckOverlay.vue              # 双轴 Deck（键盘/拖拽/导航点/纵向演示页/iframe demo）
  components/DemoUploadDialog.vue         # 上传 .html（文件读取）→ 选项目 → 入库
db（storage/db.ts）                        # schema v2：libraryDocs 加 source；runtimeDemos 表
storage/types.ts                           # LibraryDoc.source?；RuntimeDemo 类型
```

## 双通道合并规则

- 材料库清单 = 本地 md（source 'local'，标注「内置」）∪ runtime docs（source 'runtime'）；同 id 时 runtime 覆盖展示并标「已修改」，提供「重置为内置」= 删除该 runtime 覆盖
- 演示清单 = 本地 demos（标注「内置」）∪ runtimeDemos（可删）；按 project 关联到 Deck 纵向页

### Task 1: 基建——frontmatter 解析 + marked + schema v2 + 类型
测试先行。三件套+提交+审查+落档。

### Task 2: 编译时清单 + 内置内容 + 材料库 store（合并/覆盖/重置/上传解析）
内置 5 篇 md（迁移 design-demo 材料数据）+ 1 个内置 demo html。store 测试：合并覆盖重置、上传 md 解析入库。三件套+提交+审查+落档。

### Task 3: LibraryView UI
分类页签、列表（source 标记）、阅读视图（marked 渲染）、上传按钮（input[type=file] accept=.md）、新建/编辑（DocEditor：元信息 + 正文 + 预览切换）、删除确认、重置内置。测试：上传解析入列表、runtime 编辑、重置。三件套+提交+审查+落档。

### Task 4: 演示站——Deck 与 demo 上传
showcase.config 迁移；deck.ts 纯逻辑（横向 index clamp、纵向页计数=1+该项目 demo 数）+ 测试；DeckOverlay（键盘 ←→↑↓/Esc、拖拽、导航点、纵向演示页渲染 config 要点 + iframe Blob URL sandbox）；DemoUploadDialog（file input 读文本 → 标题/项目 → 入库）；ShowcaseView hero + 项目卡。测试：deck 逻辑、demoStore 合并与 Blob URL 生成。三件套+提交+审查+落档。

### Task 5: 响应式 + 浏览器冒烟 + 终审
1440/1180/390 冒烟；上传 md/上传 html/Deck 双轴全链路实测；子代理终审 + 落档。

## Verification（Plan 4 完成标准）

- [ ] 材料库：内置可读、上传/新建/编辑/删除 runtime、覆盖重置可用
- [ ] 演示站：双轴 Deck（键盘/拖拽/导航点）可用；上传 HTML demo 以 iframe 沙箱渲染为纵向页
- [ ] 三件套全绿；冒烟无溢出；日志完整
