# 开源发布收尾：多平台部署与 README 重构

> 日期：2026-09-27 · 级别：Level 2  
> 范围：部署配置、开源发布元数据、README 重构、无真实个人数据的页面截图

## 1. 目标与范围

本轮把「求职工作台」从仅适配 GitHub Pages 的前端仓库，收尾为可被其他开发者直接部署、理解和复用的开源小项目。

| 编号 | 目标 | 验收口径 |
|---|---|---|
| F-1 | 支持 Vercel 一键部署 | 仓库连接后自动执行构建，并从 `dist/` 提供静态站点 |
| F-2 | 支持 Cloudflare Pages 一键部署 | 可通过 Cloudflare Git 集成或 Wrangler 部署，构建命令与输出目录明确 |
| F-3 | 补充一个通用静态平台配置 | 选择 Netlify，提供同等构建和发布约定 |
| F-4 | 优化 README | 直白说明项目定位、隐私边界、快速开始、部署方式、页面能力和截图 |
| F-5 | 补齐开源收尾项 | 明确许可证、项目元数据和 CI 验证边界，不改变业务数据模型 |

**不纳入范围**：新增后端、账号体系、云端同步、跨设备数据服务、数据库 schema 变更、业务模块重构、自动上传用户数据。

## 2. 现状与约束（已核对源码）

- 项目是 Vue 3 + Vite 的纯静态前端，构建产物为 `dist/`，`vite.config.ts` 已使用 `base: './'`，适合 GitHub Pages、Vercel、Cloudflare Pages 和 Netlify。
- 路由使用 `createWebHashHistory`，部署平台不需要服务端 fallback 重写；刷新 `#/tracker` 等地址不应返回 404。
- 当前 GitHub Pages 工作流执行 lint、单测和 build，但没有执行 Playwright E2E；本轮可补充 E2E 验证 job，但不改变部署 job 的职责。
- 所有用户资料保存在浏览器 IndexedDB，README 必须明确“部署平台不接收应用数据”；外部演示链接仍可能向其目标站点发起网络请求。
- 仓库当前没有根目录许可证文件，也没有完整的 `repository`、`homepage`、`license` 元数据；开源发布前应补齐。
- 页面截图必须使用虚构数据，不能把本地 IndexedDB、个人简历、投递记录或本机路径带入仓库。

## 3. 设计

### F-1 Vercel

新增根目录 `vercel.json`，声明静态构建所需的最小配置：

- `framework: "vite"`
- `buildCommand: "npm run build"`
- `outputDirectory: "dist"`
- `installCommand: "npm ci"`

不增加 rewrites。Hash 路由已经解决前端刷新问题，额外 rewrite 反而会掩盖真实资源错误。

README 提供 Vercel Deploy Button，目标指向当前 GitHub 仓库；按钮旁说明首次部署需要在 Vercel 授权 GitHub，后续推送自动重新部署。

### F-2 Cloudflare Pages

新增根目录 `wrangler.toml`，声明：

- `name = "job-console"`（允许用户在 Cloudflare 控制台覆盖）
- `compatibility_date` 使用本次实现日期
- `pages_build_output_dir = "./dist"`
- `[build].command = "npm run build"`

README 同时给出 Cloudflare Pages Git 集成参数：

```text
Framework preset: Vite
Build command: npm run build
Build output directory: dist
Node version: 24
```

Wrangler 配置用于命令行和 CI；Git 集成参数用于网页端一键部署，两条路径必须保持一致。

### F-3 Netlify

新增根目录 `netlify.toml`：

- `[build] command = "npm run build"`
- `[build] publish = "dist"`
- `NODE_VERSION = "24"`

不增加 SPA 重写规则，因为当前应用使用 Hash 路由。README 提供 Netlify 部署按钮和手动配置参数。

### F-4 开源发布元数据

- 新增 `LICENSE`，默认采用 MIT；许可证文本中的版权持有人使用仓库维护者明确提供的名称，不猜测个人信息。
- `package.json` 增加 `license`、`repository`、`homepage`、`bugs` 等公开项；保留 `private: true`，因为项目是可部署应用而不是 npm 库，但 README 需解释这一点。
- GitHub Actions 增加 pull request 触发的质量检查。现有 Pages 部署仍只在 `main` push 后运行，避免 PR 直接部署。
- 质量检查至少覆盖 lint、单元测试和 build；Playwright E2E 单独 job 运行，避免浏览器安装失败阻断静态构建诊断，并在结果中明确报告。

### F-5 README 信息结构

README 重写为面向首次使用者和贡献者的短文档，顺序固定如下：

1. 项目名称、定位、关键特性和在线演示入口。
2. 页面截图总览（五个核心页面各一张，图片带中文 alt 文本）。
3. 数据与隐私边界：IndexedDB、本机数据、导出/导入、外部演示链接说明。
4. 功能页面说明：工作台、投递管理、简历管理、材料库、项目演示。
5. 本地运行：Node.js 24、`npm ci`、`npm run dev`、`npm run build`、`npm run preview`。
6. 一键部署：GitHub Pages、Vercel、Cloudflare Pages、Netlify 四种方式的按钮或参数。
7. 使用教程：首次打开、建立简历版本、记录投递、导出备份、恢复数据、添加演示页。
8. 开发与验证：lint、单测、E2E、build，以及目录职责简述。
9. 隐私、安全和已知限制链接：`LICENSE`、`SECURITY.md`（如本轮补充）、`docs/tech-debt.md`。
10. 贡献方式与路线图入口。

语言保持简体中文，首次出现的专业词汇给出一句通俗解释；命令和代码标识符保留原文。

### F-6 页面截图

新增 `docs/screenshots/`，保存五张不进入生产 bundle 的文档图片：

```text
docs/screenshots/dashboard.webp
docs/screenshots/tracker.webp
docs/screenshots/resume.webp
docs/screenshots/library.webp
docs/screenshots/showcase.webp
```

截图要求：

- 使用 Playwright 在桌面视口生成，统一 1440×900；至少补一张移动端截图展示响应式布局。
- 使用虚构的“示例求职者”数据；截图生成前清空 IndexedDB 并写入固定 fixture，生成后再次检查仓库中不含个人信息。
- 图片控制在适合 GitHub README 的尺寸和体积，优先 WebP；每张图片在 README 中使用明确 alt 文本。
- 截图只展示稳定功能，不把弹窗错误、调试信息、测试报告或本机绝对路径带入文档。
- 截图生成应有可重复命令或 Playwright 脚本，避免以后只能手工更新。

如果现有 E2E fixture 无法直接复用，新增一个只读截图 fixture 流程，不把示例数据写入 `src/content/` 或生产初始化逻辑。

## 4. 兼容性与边界

- 保持 IndexedDB schema、备份 schema 和所有业务实体不变。
- 不改变 Hash 路由，不加入平台专属运行时代码。
- `vercel.json`、`wrangler.toml`、`netlify.toml` 必须使用 UTF-8 无 BOM。
- 部署失败时，README 必须能让用户区分依赖安装失败、构建失败和平台发布失败；配置文件不包含 token、账号 ID 或私密环境变量。
- README 的隐私表述不能承诺“完全没有网络请求”：应用本身不上传本地数据，但用户主动添加的外部演示链接会由浏览器访问第三方站点。

## 5. 文件清单

```text
新增
  vercel.json
  wrangler.toml
  netlify.toml
  LICENSE
  docs/screenshots/dashboard.webp
  docs/screenshots/tracker.webp
  docs/screenshots/resume.webp
  docs/screenshots/library.webp
  docs/screenshots/showcase.webp
  tests/e2e/readme-screenshots.spec.ts 或 scripts/readme-shots.mjs

修改
  package.json
  README.md
  .github/workflows/deploy-pages.yml
  .gitignore
  docs/tech-debt.md
```

## 6. Execution Checkpoints

- [x] Checkpoint 1：新增 Vercel、Cloudflare Pages、Netlify 配置，并分别完成本地构建配置校验
- [x] Checkpoint 2：补齐 MIT 许可证、package 元数据和 PR/部署质量检查边界
- [x] Checkpoint 3：生成五个核心页面及至少一个移动视口的无个人信息截图，并将截图纳入 README
- [x] Checkpoint 4：重写 README，覆盖定位、隐私、功能、运行、四种部署、使用教程、截图和贡献入口
- [x] Checkpoint 5：完成 lint、单测、build、E2E 或明确记录 E2E 环境阻断原因，并执行 `git diff --check`

## 7. 验证

1. 配置验证：确认三种平台配置的命令均为 `npm ci`/ `npm run build`，输出目录均为 `dist`；执行一次 `npm run build`。
2. 部署验证：本地完成三种配置静态检查和构建验证；真实 Vercel/Cloudflare/Netlify Preview 需要维护者在对应平台登录后执行，当前环境不包含这些账号或令牌，因此不把外部部署冒充为已验证项。
3. 路由验证：访问部署后的根地址、`#/tracker`、`#/resume`、`#/library`、`#/showcase`，确认页面能加载且刷新不返回 404。
4. README 验证：逐条执行本地启动和至少一种平台部署教程，检查截图链接、部署按钮、命令和文件链接有效。
5. 质量验证：`npm run lint`、`npm run test:run`、`npm run build` 全部退出码为 0；E2E 若因端口或浏览器环境失败，必须在交付说明中给出可复现命令和原因。
6. 隐私验证：`git diff` 与 `git ls-files` 检查截图、README、fixture 和提交内容不包含真实姓名、电话、邮箱、投递记录、本机路径或密钥。

本地验证记录（2026-09-27）：lint、307 个单元测试、build 和 `git diff --check` 通过；截图命令通过并生成 6 张 WebP。桌面 Chromium E2E 已运行 48 项，其中 47 项通过、1 项按既有视口条件跳过；Playwright 在本机输出测试结果后未正常退出，疑似残留浏览器/开发服务器进程，未将该次运行标记为完整 E2E 绿灯。CI 会在干净 Ubuntu runner 上重新执行完整 E2E。三种平台的真实预览部署未执行，因为当前环境没有平台账号或令牌。
