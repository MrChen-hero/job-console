# 技术债与未决事项

一处索引，动到相关位置前先看这里。每条写清现状、为什么留着、怎么收口。

| 编号 | 事项 | 状态 |
|---|---|---|
| D-1 | 演示页复刻技能与产物只留本机 | 已定（长期本机） |
| D-2 | `scripts/ui-shots.mjs` 无人引用 | 已收口（取消跟踪） |
| D-3 | `design-demo/design-cool-slate/*.png` 未被任何页面引用 | 已收口（取消跟踪） |
| D-4 | `docs/superpowers/logs/` 是否长期保留 | 已收口（取消跟踪） |
| D-5 | 内置演示页走 eager glob，体积进入脚本产物 | 待做（触发条件明确） |
| D-6 | 演示页无法跟随主站亮/暗主题 | 已知限制 |

**关于「取消跟踪」的共同说明**：D-1/D-2/D-3/D-4 的文件都已随仓库推送到远端，取消跟踪只让后续克隆的工作区不再包含它们，**历史里仍在**。D-2/D-3/D-4 是设计截图与执行日志，本身可公开；D-1 的情况见该条末尾。

## D-1 演示页复刻技能与产物只留本机（已定）

**现状**：2026-09-03 起 `.claude/`（含 `skills/showcase-demo-page/`：调研真实项目 → 产出单文件自包含的高保真交互演示页）、`demo-out/`（生成的演示页）与该技能的 spec 一并取消跟踪并加入 `.gitignore`，文件全部保留在本机工作区，技能功能不受影响。

**决定（2026-09-03）**：长期只留本机，等后续优化成熟再议是否发布。`.gitignore` 里那三行即终态；本条不再作为待决项，但保留在此备查。

**为什么**：本仓库按公开模板发布，技能内容与其调研的私有项目细节不适合随仓库公开；技能自身是可用状态——静态自检与沙箱冒烟双绿，端到端试跑（生成 → 页面上传 → Deck 渲染）三视口通过。后续若要发布，需先逐文件确认技能文档不含私有项目信息；若要把产出的演示页收编为内置示例，还要先在 `src/config/showcase.config.ts` 的 `SHOWCASE_PROJECTS` 补一条 id，且体积计入主 chunk（见 D-5）。

**注意（2026-09-03 已成事实）**：加入技能的 4 个提交与移除它的 1 个提交（`7ce14bb`…`12b008f`）已随 push 进入公开远端的历史。tip 不再跟踪这些文件，但历史里能取出全部 8 个技能文件与那份 spec——其中 spec 的 Checkpoint 6 有一行写着被调研项目的本机路径。8 个技能文件本身经扫描无私有项目线索，`demo-out/` 的产物从未被跟踪、不在远端。事后若要让远端不再出现，只能改写历史 + force-push，且 GitHub 侧的缓存与 fork 不保证跟着消失。

## D-2 `scripts/ui-shots.mjs` 无人引用（已收口）

Cool Slate 重构期的一次性 UI 截图核对脚本（`node scripts/ui-shots.mjs [label]`，产物落 `.ui-shots/<label>/`）。没有对应的 npm script，README 与 AGENTS 都没提，同目录另两个脚本（`check-theme-css.mjs` / `generate-project-assets.mjs`）此前已作为上一代项目遗留取消跟踪。

**决定（2026-09-03）**：与另两个一致取消跟踪，文件留本机备用。`scripts/` 目录自此不含任何被跟踪文件；需要重跑 UI 截图时直接 `node scripts/ui-shots.mjs [label]`。

## D-3 `design-demo/design-cool-slate/*.png` 未被任何页面引用（已收口）

5 张约 6.6MB，文件名是设计工具生成的 `task-<随机串>.png`。核查过引用：`design-demo/cool-slate-light-demo.html` 里只有一句文字提到「design-cool-slate/\*.png 复刻」，**没有任何 `<img src>` 真正加载**；其余引用只出现在 Cool Slate 重构的 plan/spec 里，作为设计阶段参考。

**决定（2026-09-03）**：整个 `design-demo/design-cool-slate/` 取消跟踪，文件留本机。`design-demo/` 下现在只跟踪 `cool-slate-light-demo.html`（AGENTS.md 认定的视觉基准）。收益是仓库整洁——clone 体积不变，blob 仍在历史里。

## D-4 `docs/superpowers/logs/` 是否长期保留（已收口）

5 个执行日志（2026-08-31，phase1 与 plan2–5）。plans/ 记决策、specs/ 记设计，logs 更像过程流水；上一代项目的 `2026-07-*` plans/specs 已按遗留处理进了 `.gitignore`。

**决定（2026-09-03）**：整个 `docs/superpowers/logs/` 取消跟踪，文件留本机。`docs/superpowers/` 下自此只跟踪 plans/（决策）与 specs/（设计）两类，取舍标准统一。

## D-5 内置演示页走 eager glob，体积进入脚本产物（待做）

`src/modules/library/localContent.ts` 用 `import.meta.glob('../../content/demos/*.html', { query: '?raw', eager: true })` 收录内置演示页，HTML 原样内联进 JS 产物，尚未按页加载。现有示例 demo 仅 1.8 KB，所以还没到痛点。2026-09-08 已缓存内置材料与演示的解析结果；这减少重复解析，不减少内置内容的下载体积。

**触发条件**：内置演示页累计超过约 200 KB 时，把这个 glob 改成非 eager 并在 `demoStore` 里按需加载。改动会牵动 `localDemos()` 的同步返回签名（现在是同步数组），需要同步改 `demoStore.merged` 与 `deck.ts` 的取数时机——不是一行改动，别在赶别的活时顺手做。

## D-6 演示页无法跟随主站亮/暗主题（已知限制）

演示页以 Blob URL + `<iframe sandbox="allow-scripts">` 渲染，处于不透明源；`DeckOverlay.vue` 只给 iframe 传 `src` / `sandbox` / `title`，没有主题或消息通道。所以每个演示页自带一套固定配色，主站切换亮/暗时它不跟随。

要同步得给 Deck 加 postMessage 通道并约定协议，属独立一次改动。现状可接受：演示页本就是「复刻某个真实系统的界面」，配色跟随源系统比跟随主站更合理。

## 已收口

- **2026-09-08** Element Plus 改为显式组件导入、仅注册加载指令，实际使用的样式集中在 `src/styles/element-plus.ts`；入口直接引用/预加载的 JS 从 1,148,391 字节降到 362,124 字节，CSS 从 376,030 字节降到 137,836 字节（不含路由后续请求，不能直接换算为加载速度）。演示窗口复用父页面已加载的数据，内置材料与演示解析结果按模块生命周期缓存。

- **2026-09-03** 清掉四个可再生目录，工作区（除 `node_modules`）从约 59MB 降到 8.6MB：`.ui-shots/` 48MB（Cool Slate 重构期 13 批 UI 截图，需要时用 D-2 的脚本重跑）、`dist/`（`npm run build` 重建）、`playwright-report/` 与 `test-results/`（`npm run test:e2e` 重建）。命令：`rm -r .ui-shots dist playwright-report test-results`。
- **2026-09-03** `npm run lint` 从 31 个 error 修回 0：`.claude/` 下的技能脚本按 Node 环境写（`process` / `console` / `TextDecoder`），撞上本仓库面向浏览器的 globals 配置。`eslint.config.js` 的 `ignores` 补上 `.claude` 与 `demo-out`——与 `design-demo` 同理，本机工具及其产物不进 lint 范围。教训：往仓库里加任何目录（哪怕不进 git）都要回跑一次 lint，`eslint .` 不看 `.gitignore`。
- **2026-09-03** 移除 `package.json` 里的 `generate:assets`——它指向 `scripts/generate-project-assets.mjs`，而该文件早已取消跟踪，新克隆的仓库跑这条命令必然 `Cannot find module`。
- **2026-09-03** README 与 AGENTS 补上指向 `DESIGN.md` 与本文件的链接（此前三份根级文档互不引用，DESIGN.md 等于隐藏文件）。
