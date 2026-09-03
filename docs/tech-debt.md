# 技术债与未决事项

一处索引，动到相关位置前先看这里。每条写清现状、为什么留着、怎么收口。

| 编号 | 事项 | 状态 |
|---|---|---|
| D-1 | 演示页复刻技能与产物已取消跟踪 | 待决定 |
| D-2 | `scripts/ui-shots.mjs` 无人引用 | 待决定 |
| D-3 | `design-demo/design-cool-slate/*.png` 未被任何页面引用 | 待决定 |
| D-4 | `docs/superpowers/logs/` 是否长期保留 | 待决定 |
| D-5 | 内置演示页走 eager glob，体积直接进主 chunk | 待做（触发条件明确） |
| D-6 | 演示页无法跟随主站亮/暗主题 | 已知限制 |

## D-1 演示页复刻技能与产物已取消跟踪（待决定）

**现状**：2026-09-03 起 `.claude/`（含 `skills/showcase-demo-page/`：调研真实项目 → 产出单文件自包含的高保真交互演示页）、`demo-out/`（生成的演示页）与该技能的 spec 一并取消跟踪并加入 `.gitignore`，文件全部保留在本机工作区，技能功能不受影响。

**为什么留着**：本仓库按公开模板发布，技能内容与其调研的私有项目细节暂不适合随仓库公开；但技能自身是可用状态——静态自检与沙箱冒烟双绿，端到端试跑（生成 → 页面上传 → Deck 渲染）三视口通过。

**待决定**：

1. 长期只留本机——那么 `.gitignore` 里那三行就是终态，本条可关。
2. 清洗后随仓库发布——需先逐文件确认技能文档不含私有项目信息（技能自身有「不在文件里枚举禁词」的规则，禁词表放本机未跟踪文件）。
3. 把产出的演示页收编为内置示例——走编译时通道要先在 `src/config/showcase.config.ts` 的 `SHOWCASE_PROJECTS` 补一条 id，且文件体积会计入主 chunk（见 D-5）。

**注意**：加入技能的 4 个提交与移除它的 1 个提交都还在本地历史中且未推送。一旦 push，这些文件会随历史进入远端——要做到远端完全不出现，得改写本地历史，属破坏性操作。

## D-2 `scripts/ui-shots.mjs` 无人引用（待决定）

Cool Slate 重构期的一次性 UI 截图核对脚本（`node scripts/ui-shots.mjs [label]`，产物落 `.ui-shots/<label>/`）。它被 git 跟踪，但没有对应的 npm script，README 与 AGENTS 都没提，同目录另两个脚本（`check-theme-css.mjs` / `generate-project-assets.mjs`）已作为上一代项目遗留取消跟踪。

**收口两条路**：补一条 `"ui:shots"` npm script + 在 AGENTS「常用命令」里加一行；或与另两个一致取消跟踪。别停在现在这个「跟踪但无人知道」的中间态。

## D-3 `design-demo/design-cool-slate/*.png` 未被任何页面引用（待决定）

5 张约 6.6MB，文件名是设计工具生成的 `task-<随机串>.png`。核查过引用：`design-demo/cool-slate-light-demo.html` 里只有一句文字提到「design-cool-slate/\*.png 复刻」，**没有任何 `<img src>` 真正加载**；其余引用只出现在 Cool Slate 重构的 plan/spec 里，作为设计阶段参考。

**注意**：删掉只让工作区变干净，clone 体积不变——blob 仍在历史里。所以这条的收益是整洁而非体积，别为了「瘦仓库」去改写历史。

## D-4 `docs/superpowers/logs/` 是否长期保留（待决定）

5 个执行日志（2026-08-31，phase1 与 plan2–5）。plans/ 记决策、specs/ 记设计，logs 更像过程流水；上一代项目的 `2026-07-*` plans/specs 已按遗留处理进了 `.gitignore`。要么明确留作项目档案，要么同样处理，别让三个目录的取舍标准各不相同。

## D-5 内置演示页走 eager glob，体积直接进主 chunk（待做）

`src/modules/library/localContent.ts` 用 `import.meta.glob('../../content/demos/*.html', { query: '?raw', eager: true })` 收录内置演示页，HTML 原样内联进 JS 产物——文件多大主 chunk 就大多少，没有懒加载兜底。当前主 chunk 约 618 KB，现有示例 demo 仅 1.8 KB，所以还没到痛点。

**触发条件**：内置演示页累计超过约 200 KB 时，把这个 glob 改成非 eager 并在 `demoStore` 里按需加载。改动会牵动 `localDemos()` 的同步返回签名（现在是同步数组），需要同步改 `demoStore.merged` 与 `deck.ts` 的取数时机——不是一行改动，别在赶别的活时顺手做。

## D-6 演示页无法跟随主站亮/暗主题（已知限制）

演示页以 Blob URL + `<iframe sandbox="allow-scripts">` 渲染，处于不透明源；`DeckOverlay.vue` 只给 iframe 传 `src` / `sandbox` / `title`，没有主题或消息通道。所以每个演示页自带一套固定配色，主站切换亮/暗时它不跟随。

要同步得给 Deck 加 postMessage 通道并约定协议，属独立一次改动。现状可接受：演示页本就是「复刻某个真实系统的界面」，配色跟随源系统比跟随主站更合理。

## 已收口

- **2026-09-03** 清掉四个可再生目录，工作区（除 `node_modules`）从约 59MB 降到 8.6MB：`.ui-shots/` 48MB（Cool Slate 重构期 13 批 UI 截图，需要时用 D-2 的脚本重跑）、`dist/`（`npm run build` 重建）、`playwright-report/` 与 `test-results/`（`npm run test:e2e` 重建）。命令：`rm -r .ui-shots dist playwright-report test-results`。
- **2026-09-03** `npm run lint` 从 31 个 error 修回 0：`.claude/` 下的技能脚本按 Node 环境写（`process` / `console` / `TextDecoder`），撞上本仓库面向浏览器的 globals 配置。`eslint.config.js` 的 `ignores` 补上 `.claude` 与 `demo-out`——与 `design-demo` 同理，本机工具及其产物不进 lint 范围。教训：往仓库里加任何目录（哪怕不进 git）都要回跑一次 lint，`eslint .` 不看 `.gitignore`。
- **2026-09-03** 移除 `package.json` 里的 `generate:assets`——它指向 `scripts/generate-project-assets.mjs`，而该文件早已取消跟踪，新克隆的仓库跑这条命令必然 `Cannot find module`。
- **2026-09-03** README 与 AGENTS 补上指向 `DESIGN.md` 与本文件的链接（此前三份根级文档互不引用，DESIGN.md 等于隐藏文件）。
