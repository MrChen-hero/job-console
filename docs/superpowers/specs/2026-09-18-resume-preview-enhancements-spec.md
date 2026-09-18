# 简历管理：可编辑区块标题 / 真分页预览 / 头像

> 日期：2026-09-18 · 级别：Level 2（单模块、受控行为变更、可选字段新增）
> 范围：`src/modules/resume/` + `src/storage/types.ts`、`src/storage/backupValidation.ts`、`src/shared/safeUrl.ts`

## 1. 目标与范围

三项独立需求，共用同一份 spec 与同一轮验证：

| 编号 | 需求 | 结论口径 |
|---|---|---|
| F-1 | 除「基本信息」外，区块标题可编辑 | 中文标题 + 英文副标题都可改，按版本存储 |
| F-2 | 右侧预览改为按页预览 | 真分页：测量内容后切分为多张 A4 白纸，纵向堆叠滚动查看 |
| F-3 | 支持上传一寸证件照头像 | 存原图 + 裁剪参数，可随时重裁；落在 A4 纸面基本信息区右上角 |

**不纳入范围**：手动插入分页符、页眉页脚、多栏简历模板、示例资料内置头像、头像滤镜/换底色。

## 2. 现状与约束（已核对源码）

- `ResumeSection { type, title, excludedIds?, order }`（`src/storage/types.ts:120`）——**标题早已是按版本存储的数据**，`ResumeSheet.vue` 也已在渲染 `{{ section.title }}`，F-1 只缺编辑入口与副标题字段。
- `.sheet` 现为单张长纸：`width:210mm; min-height:297mm; padding:18mm 17mm`（`sheet/sheet.css:3`），无任何分页逻辑。打印时 `@page { margin:12mm }` 与纸面 18mm padding 叠加成 30mm，这是「打印超页」的直接原因。
- `backupValidation.ts:8` 注明「不约束未知字段」，`basic` 与 `sections` 都是白名单式可选键校验（`:75` / `:95`）。新增 `BasicInfo.avatar` 与 `ResumeSection.subtitle` **只需各补一个可选键，不升 `BACKUP_SCHEMA_VERSION`**（升了会让用户手里的旧 v4 备份反而导不进来，见 AGENTS.md §存储层）。
- 两个字段都不进 Dexie 索引，**不需要 Dexie schema 升级**（当前 v6 不变）。
- `src/styles/element-plus.ts` 未注册 slider，缩放控件用原生 `<input type="range">`，避免为一个控件引入整套 EP 样式。
- jsdom 无 `ResizeObserver`、无 `document.fonts`（`src/test/setup.ts` 未 stub）。`ResumeSheet.vue` 有单测会跑在 jsdom 下，**新增的测量代码必须对二者做存在性守卫**，否则 `ResumeSheet.test.ts` 直接 ReferenceError。
- jsdom 下所有 `offsetHeight` 恒为 0 —— 分页算法必须是**单趟 for 循环**，高度全 0 时退化为「全部落在第 1 页」，不得写成 while 循环（会死循环）。

## 3. 设计

### F-1 区块标题可编辑

**数据**：`ResumeSection` 增加 `subtitle?: string`。默认英文副标题从 `ResumeSheet.vue` 模板里的硬编码 `<em>EDUCATION</em>` 抽到 `profileSchema.ts` 的 `DEFAULT_SUBTITLE: Record<ResumeSectionType, string>`。纸面取值：`section.subtitle ?? DEFAULT_SUBTITLE[type]`；`subtitle === ''` 表示显式不显示英文，`<em>` 整体不渲染。

**入口**：`ProfileEditor.vue` 的「区块编排」模式内联编辑。每行非固定区块的 `<b>{{ tab.label }}</b>` 替换为两个 `size="small"` 的 `ElInput`：中文标题、英文副标题。英文副标题**预填当前生效值**（已存的 `subtitle`，否则默认值），placeholder 为「留空则不显示」——这样「清空 = 不显示」没有歧义，也不需要额外的开关。`basic` 行保持 `<b>` 只读（需求明确排除）。

**拖拽把手**：`draggable` 从整行移到 grip 图标外层的 `.grip-handle`。整行 `draggable="true"` 会让行内输入框无法拖选文字，这是加输入框后必须一起改的。行本身仍是 drop 目标。

**落库**：与现有排序/勾选一致——即时保存，走 `store.updateSections(version.id, sections)`。触发时机 `@change`（blur 或 Enter），不做逐字符写库。

**标题回流**：`orderedTabs` 现在从静态 `TABS` 取 label，改为 `version.sections` 的 `title` 优先、静态 label 兜底。手风琴组头因此同步显示自定义标题。

**校验与失败**：中文标题 trim 后不得为空，空值即时回填原值并 `ElMessage.error('区块标题不能为空')`；英文副标题允许为空。`updateSections` reject 时从 store 重新同步本地草稿并提示，不留下已改但未落库的输入。

**与离开保护的关系**：即时保存 ⇒ 不进入 `ProfileEditor.dirty`，与现有排序/勾选行为一致，不改动 `dirty`/`save` 语义。

### F-2 真分页预览

**纸面几何**：A4 210×297mm，纸面 padding 18mm/17mm ⇒ 内容盒 176mm × **261mm**。页高不写死像素，运行时用探针元素（`height:261mm`）读 `offsetHeight` 得到，规避 dpi 假设。

**块模型**：`ResumeSheet.vue` 从「一棵模板树」改为「先算块、再分页、后渲染」。新增 `sheet/blocks.ts`：

```ts
export type SheetBlock =
  | { id: string; kind: 'head' }
  | { id: string; kind: 'title'; sectionType: ResumeSectionType; title: string; subtitle: string }
  | { id: string; kind: 'edu'; entry: EducationEntry }
  | { id: string; kind: 'skill'; entry: SkillGroup }
  | { id: string; kind: 'exp'; entry: ExperienceEntry }
  | { id: string; kind: 'proj'; entry: ProjectEntry }
  | { id: string; kind: 'line'; text: string }   // 荣誉 / 自评，一条一块
```

切分粒度：条目级。`.r-item`（实习/项目，含其 bullets）保持原子——从中间截断 bullets 比跳页更难看，且单条目高度远低于一页（261mm ≈ 986px，行高约 20px ⇒ 约 49 行）。技能表由整块 grid 改为**每组一行**（新增 `.r-skill-row`，视觉与现 `.r-skills` 等价），避免技能组多时整块无法切分。

**新组件** `sheet/SheetBlock.vue`：按 `kind` 渲染单块，复用现有 `.r-*` 类名。测量容器与每一页共用它，保证「量的就是画的」。

**测量**：`ResumeSheet.vue` 内渲染一个隐藏测量容器 `.sheet.sheet-measure`（`position:absolute; left:-10000px; visibility:hidden; min-height:0; aria-hidden`），含全部块且每块带 `data-block-id`。高度按**相邻块 offsetTop 差值**计算，最后一块用 `scrollHeight - offsetTop` —— 这样自然包含 margin 与 margin 折叠，比逐块 `offsetHeight + margin` 准确。

重测触发：`profile` / `activeVersion` 变化后 `nextTick`、`ResizeObserver` 观察测量容器（捕获头像 `<img>` 加载完成导致的回流）、`document.fonts.ready`。后两者均加 `typeof X === 'undefined'` 守卫。

**分页算法**（`sheet/paginate.ts`，纯函数，可单测）：

```
paginate(blocks, heights, pageHeight) -> SheetBlock[][]
单趟 for：
  h = heights[b.id] ?? 0
  若 当前页非空 且 used + h > pageHeight        -> 换页
  若 b.kind === 'title' 且 下一块放不下(title+next) -> 换页（避免孤行标题）
  放入当前页，used += h
  若 h > pageHeight 且 当前页只有它 -> 独占一页（允许溢出，见限制）
```

**渲染**：`.sheet-stack` 包多个 `.sheet.sheet-page`，页间 `margin-top:14px`，每页下方一行 `.sheet-page-label.no-print`「第 N 页 / 共 M 页」（在纸面之外，不参与测量）。空数据仍走现有 `.sheet-empty`。

**ResumeView 适配**：`measurePreview()` 的 `sheetWidth` 取第一张 `.sheet` 宽度，`sheetHeight` 改取 `.sheet-stack` 高度；`previewObserver` 观察对象由 `.sheet` 改为 `.sheet-stack`。缩放机制本身不变。

**打印**：改为直接打印分页结果，做到 WYSIWYG。
- `@page { size:A4; margin:0 }`（原 12mm 去掉，页边距完全由纸面 padding 承担）
- `.sheet { width:210mm; height:297mm; padding:18mm 17mm; box-shadow:none; border-radius:0; break-after:page; break-inside:avoid }`，`.sheet:last-of-type { break-after:auto }`
- 删除现有 print 块里 `.sheet { width:auto; min-height:auto; padding:0 }` 这三条覆盖（它们正是超页的成因）
- `.sheet-page-label` 与页间 margin 归入 `no-print`

**已知限制**（写入 `docs/tech-debt.md`）：单块高度超过一页时独占一页并溢出，浏览器打印会自然溢到下一张物理纸；不做块内切分。

### F-3 头像

**存储口径**：存**原图 + 裁剪参数**，不存裁剪成品——单一事实来源，随时可重裁，且不会出现「参数改了成品没跟上」的不一致。

```ts
// BasicInfo 新增两个可选键
avatar?: string                                   // 缩放后的原图 data URL
avatarCrop?: { x: number; y: number; w: number; h: number }  // 归一化裁剪框（原图的 0–1 比例）
```

- `avatar` 在上传时用 canvas 把长边压到 **1400px**、重编码为 `image/jpeg` quality 0.85（约 150–300KB）。原始文件上限 10MB，超限拒绝并提示。1400px 是按「4× 最大缩放下仍有约 250×350 源像素喂给 25×35mm 打印框」倒推的下限。
- `avatarCrop` 的 `w/h` 分别是原图宽/高的比例，计算时强制 `w·imgW : h·imgH = 5 : 7`。缺省（只有 `avatar` 没有 `avatarCrop`）时按居中 cover 实时推导，不写库。

**体积代价（已知并接受）**：资料池按版本独立，新建/复制版本会连原图一并复制（AGENTS.md §存储层）。5 个版本 ≈ 5 份原图 ≈ 1–1.5MB，备份 JSON 因 base64 再涨约 1/3。写入 `docs/tech-debt.md` 备查。

**安全**：`src/shared/safeUrl.ts` 新增 `isImageDataUrl(v): v is string`，要求匹配 `^data:image/(png|jpeg|webp);base64,`。纸面渲染与 `backupValidation` 都走它，导入的备份不可信（AGENTS.md §内容双通道）。非法值视为无头像，不报错阻断整份备份。

**裁剪弹窗** `components/AvatarDialog.vue`（ElDialog）：
- 选图：隐藏的 `<input type="file" accept="image/png,image/jpeg,image/webp">` + 按钮触发；超过 10MB 或解码失败时 `role="alert"` 提示且不关弹窗。
- 取景框：**比例固定 5:7**（一寸证件照 25×35mm 的硬约束，不可变），视口 210×294 CSS px。「调整裁剪框大小」等价于缩放图片，故统一用图片缩放实现。
- 缩放：`1×` = cover（恰好铺满取景框，四边不留白），上限 `4×`。三种入口——原生 `<input type="range">`、取景框上的鼠标滚轮（`wheel` 事件 `passive:false` + `preventDefault`）、键盘 `+` / `-`。
- 平移：指针拖拽；取景框 `tabindex="0"`，方向键每次平移 4px。任何时刻都钳制到四边不留白。
- 重裁：已有头像时打开弹窗直接载入 `avatar` 原图并还原 `avatarCrop`，无需重新选文件；另有「更换图片」与「清除头像」。

**纯函数** `components/avatarCrop.ts`（可单测，无 DOM）：
- `coverScale(imgW, imgH, boxW, boxH): number` —— 铺满取景框所需的最小缩放
- `clampView(imgW, imgH, boxW, boxH, scale, x, y): { scale, x, y }` —— 钳制缩放区间与平移边界
- `toCrop(imgW, imgH, boxW, boxH, scale, x, y): { x, y, w, h }` —— 视口状态 → 归一化裁剪框（保证 5:7）
- `fromCrop(crop, imgW, imgH, boxW, boxH): { scale, x, y }` —— 反向还原，供重裁时恢复现场

**纸面渲染（无需 JS、无需 canvas）**：`.r-head` 尾部加一个 25×35mm 的 `overflow:hidden` 容器，内部 `<img>` 用纯百分比定位：

```
容器：width:25mm; height:35mm; overflow:hidden; position:relative; align-self:flex-start
图片：position:absolute;
      width:  (100 / crop.w)%      left: (-crop.x / crop.w * 100)%
      height: (100 / crop.h)%      top:  (-crop.y / crop.h * 100)%
```

百分比相对容器解析，因此**分辨率无关**：同一套参数在预览缩放态、100% 态与打印态给出一致构图。用 `<img>` 而非 `background-image`，浏览器「打印背景图形」关闭时头像仍会打印。无头像时整个容器不渲染，排版与现状完全一致。`excluded('basic').has('main')` 隐藏整个 head 的既有行为不变。

**接入编辑器**：`ProfileEditor.vue` 基本信息面板顶部加头像块（预览方块 + 「上传 / 重新裁剪 / 清除」）。弹窗确认写 `basicForm.avatar` 与 `basicForm.avatarCrop`，**复用现有脏检查与保存链路**（`dirty` 比对 `JSON.stringify(basicForm)`，保存走「保存基本信息」或离开保护）。

> **必须同步改三处**：`saveBasic()` 与 `save()` 现在都只按 `BASIC_FIELDS` 组装 `record`，而 `avatar` / `avatarCrop` 不是文本输入框、不在该表里，**不显式带上就会在每次保存时把头像丢掉**；`discard()` 的回填同理。另注意 `basicForm` 现声明为 `Record<string, string>`，`avatarCrop` 是对象，需把类型放宽为 `Record<string, unknown>` 或单独用一个 ref 承载并一并计入 `dirty`。

## 4. 数据与兼容

| 变更 | 位置 | 兼容性 |
|---|---|---|
| `BasicInfo.avatar?: string`（缩放后原图 data URL） | `storage/types.ts` | 可选字段，旧数据无此键即无头像 |
| `BasicInfo.avatarCrop?: { x, y, w, h }` | `storage/types.ts` | 可选字段，缺省按居中 cover 实时推导 |
| `ResumeSection.subtitle?: string` | `storage/types.ts` | 可选字段，缺省回落 `DEFAULT_SUBTITLE` |
| 校验补三个可选键 | `backupValidation.ts:75`（`avatar` 走 `isImageDataUrl`、`avatarCrop` 需自定义对象校验：四个 0–1 有限数且 `x+w ≤ 1`、`y+h ≤ 1`）、`:95`（`subtitle` 复用 `strings` 可选位） | **不升 `BACKUP_SCHEMA_VERSION`**，旧 v4 备份照常导入 |
| Dexie schema | 无变更 | 三字段均不进索引，保持 v6 |

## 5. 文件清单

```
新增
  src/modules/resume/sheet/blocks.ts            块模型 + 从 profile/version 构建块序列
  src/modules/resume/sheet/paginate.ts          纯分页算法
  src/modules/resume/sheet/SheetBlock.vue       单块渲染
  src/modules/resume/components/AvatarDialog.vue 头像上传 + 裁剪弹窗（拖拽 / 滚轮 / 滑杆 / 键盘缩放）
  src/modules/resume/components/avatarCrop.ts   裁剪纯函数（coverScale / clampView / toCrop / fromCrop）
  src/modules/resume/sheet/__tests__/paginate.test.ts
  src/modules/resume/components/__tests__/avatarCrop.test.ts
修改
  src/storage/types.ts                          +avatar +avatarCrop +subtitle
  src/storage/backupValidation.ts               三个可选键 + 头像格式与裁剪框范围校验
  src/shared/safeUrl.ts                         +isImageDataUrl
  src/modules/resume/profileSchema.ts           +DEFAULT_SUBTITLE
  src/modules/resume/sheet/ResumeSheet.vue      测量 + 分页 + 多页渲染 + 头像百分比定位
  src/modules/resume/sheet/sheet.css            .r-photo / .r-skill-row / .sheet-measure / .sheet-page
  src/modules/resume/components/ProfileEditor.vue 标题编辑 + 头像入口 + save/discard 带上 avatar/avatarCrop
  src/modules/resume/views/ResumeView.vue       测量目标改 .sheet-stack + 打印 CSS 重写
  src/modules/resume/sheet/__tests__/ResumeSheet.test.ts
  src/modules/resume/components/__tests__/ProfileEditor.test.ts
  tests/e2e/reliability.spec.ts 或 ui-improvements.spec.ts  一条端到端用例
  AGENTS.md / docs/tech-debt.md                 事实同步
```

## 6. Execution Checkpoints

- [x] Checkpoint 1：`ResumeSection.subtitle` + `DEFAULT_SUBTITLE` 落地，「区块编排」内联编辑中英标题并即时落库，手风琴组头与 A4 纸面同步生效，空标题拦截与保存失败回滚可用
- [ ] Checkpoint 2：`blocks.ts` / `paginate.ts` / `SheetBlock.vue` 完成，`ResumeSheet` 改为测量 + 分页 + 多页堆叠渲染，jsdom（高度全 0）下退化为单页且不报错
- [ ] Checkpoint 3：`ResumeView` 缩放与打印 CSS 适配完成，`@page margin:0` + 纸面自带 18mm/17mm，打印页数与预览页数一致
- [ ] Checkpoint 4：`avatarCrop.ts` + `AvatarDialog.vue` 完成（拖拽 / 滚轮 / 滑杆 / 键盘四路缩放平移，已有头像可直接重裁并还原现场），`ProfileEditor` 的 `saveBasic`/`save`/`discard` 显式携带 `avatar` 与 `avatarCrop`，纸面右上角按 25×35mm 百分比定位渲染
- [ ] Checkpoint 5：`types.ts` / `backupValidation.ts` / `safeUrl.ts` 三处兼容改动完成，旧 v4 备份仍可导入，非法头像值或越界裁剪框不阻断导入
- [ ] Checkpoint 6：补齐单测与一条 E2E，三件套（`npm run lint && npm run test:run && npm run build`）全绿且退出码显式核对，AGENTS.md 与 tech-debt.md 同步

## 7. 验证

**单测（新增/更新）**
1. `paginate.test.ts`：正常切分、标题不落单（title + 首条放不下则整体换页）、超高块独占一页、**高度全 0 时全部落第 1 页且函数返回**（jsdom 退化路径）。
2. `avatarCrop.test.ts`：`coverScale` 对横图/竖图/正方形；`clampView` 四边不留白且缩放钳在 1×–4×；`toCrop` 输出恒满足 `w·imgW : h·imgH = 5:7` 且落在 0–1 内；`toCrop` → `fromCrop` 往返一致（重裁能还原现场）。
3. `ResumeSheet.test.ts`：自定义 `title`/`subtitle` 出现在纸面；`subtitle: ''` 时不渲染 `<em>`；有 `avatar` 时渲染头像容器且 `<img>` 的百分比样式按 `avatarCrop` 计算正确、无 `avatarCrop` 时走居中 cover 兜底、无 `avatar` 时不渲染；jsdom 下渲染出且仅出一页。
4. `ProfileEditor.test.ts`：存在 `avatar` + `avatarCrop` 时执行「保存基本信息」，落库后两者仍在（防回归本 spec §3 F-3 标注的丢失点）。

**E2E（一条）**：改区块标题 → 预览纸面同步；上传固定 fixture 图并确认裁剪 → 纸面右上角出现头像，再次打开弹窗能还原上次构图；填入足量条目 → 预览出现第 2 页。

**三件套**：`npm run lint && npm run test:run && npm run build` 全绿并显式核对退出码；`git diff --check` 无输出；新文件 UTF-8 无 BOM。

**人工确认（无法自动化）**：Chrome 打印预览页数与界面页数一致、无空白尾页。这一项在交付说明中标注验证状态。
