# 求职工作台重构 · Plan 1：工程骨架与存储层 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 清除旧 React 代码，搭建 Vue 3 + Element Plus + Dexie 工程骨架（五路由布局壳 + 设计令牌 + 亮暗主题），并交付通过全部测试的 IndexedDB 存储层（导入/导出/快照）。对应设计文档 §12 阶段 1+2。

**Architecture:** 单页应用，hash 路由（GitHub Pages 子路径安全）；存储层以纯函数操作注入的 Dexie 实例（生产用单例，测试用 fake-indexeddb 新实例），备份文件带 `schemaVersion`，导入支持 merge（按 id 整条以导入方为准）/ overwrite（先快照再清表重灌）。

**Tech Stack:** Vue 3.5（`<script setup lang="ts">`）、vue-router 4（hash）、Pinia、Element Plus、Dexie 4、vitest + @vue/test-utils + fake-indexeddb。

**Spec:** `docs/superpowers/specs/2026-08-30-vue-job-console-rebuild-design.md`

**Visual baseline:** `design-demo/index.html`（令牌从其 `:root` 区移植）

---

## 文件结构总览

```
index.html                          # 入口 HTML（重写）
package.json                        # 脚本与依赖（重写）
vite.config.ts                      # Vue 插件 + Vitest 配置（重写）
tsconfig.json / tsconfig.app.json / tsconfig.node.json   # 重写
eslint.config.js                    # Vue flat config（重写）
src/
  main.ts                           # 创建应用、装配 Pinia/Router/Element Plus/样式
  vite-env.d.ts
  app/
    router.ts                       # 5 路由 + AppLayout 父路由
    stores/theme.ts                 # 亮暗主题（localStorage 持久化）
    nav.ts                          # 导航项常量
  shared/
    layout/AppLayout.vue            # 侧边栏 + 顶栏 + RouterView
    layout/AppSidebar.vue
    layout/AppTopbar.vue
  modules/
    dashboard/views/DashboardView.vue    # 5 个占位视图（后续 Plan 填充）
    tracker/views/TrackerView.vue
    resume/views/ResumeView.vue
    library/views/LibraryView.vue
    showcase/views/ShowcaseView.vue
  styles/
    tokens.css                      # 设计令牌（亮/暗两套，移植自 design-demo）
    global.css                      # 全局基线
  storage/
    types.ts                        # 全部实体类型 + Stage 常量
    db.ts                           # Dexie schema v1 + createDb 工厂 + 单例
    backup.ts                       # exportBackup / validateBackup / importBackup
    snapshots.ts                    # createSnapshot（含保留 5 份轮转）
  test/
    setup.ts                        # fake-indexeddb/auto + jsdom 清理
  storage/__tests__/                # 与源码就近原则例外：存储测试集中放置
    db.test.ts
    backup.test.ts
    snapshots.test.ts
src/shared/layout/__tests__/layout.test.ts
src/app/stores/__tests__/theme.test.ts
```

**硬约束：**
- 用户工作区未提交的 `README.md` 修改必须全程保留，任何任务不得触碰该文件。
- `public/media/`、`scripts/generate-project-assets.mjs`、`.github/`、`playwright.config.ts` 本计划不修改。
- 所有新文件 UTF-8 无 BOM；每任务收尾 `git diff --check` 无输出。
- 测试用 `createDb(name)` 建独立命名库，不污染生产单例。

---

### Task 1: 清理旧 React 代码

**Files:**
- Delete: `src/`（全部）、`tests/`（全部）

- [ ] **Step 1: 确认工作区状态**

Run: `git status --short`
Expected: 仅 ` M README.md`、`?? .zcode/`、`?? design-demo/`。若出现其他修改，停止并询问。

- [ ] **Step 2: 删除旧源码与旧测试**

```bash
git rm -r src tests
```

- [ ] **Step 3: 提交**

```bash
git commit -m "chore: remove legacy react portfolio sources"
```

---

### Task 2: 重写工程配置并安装依赖

**Files:**
- Modify: `package.json`、`vite.config.ts`、`tsconfig.json`、`tsconfig.app.json`、`tsconfig.node.json`、`eslint.config.js`、`index.html`

- [ ] **Step 1: 安装运行时依赖**

```bash
npm i vue vue-router pinia element-plus dexie
```

- [ ] **Step 2: 安装开发依赖**

```bash
npm i -D @vitejs/plugin-vue vue-tsc @vue/test-utils eslint-plugin-vue typescript-eslint globals fake-indexeddb
```

（jsdom / vitest / typescript / eslint / playwright 已存在于 devDependencies，不动版本。）

- [ ] **Step 3: 移除遗留 React 依赖**

```bash
npm rm react react-dom motion lucide-react @fontsource/outfit @fontsource/plus-jakarta-sans @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/react @types/react-dom @vitejs/plugin-react eslint-plugin-react-hooks eslint-plugin-react-refresh
```

（以 `package.json` 实际存在的为准逐个移除；`sharp` 保留给 `generate:assets` 脚本。）

- [ ] **Step 4: 重写 `package.json` 的 scripts 为**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "test": "vitest",
    "test:run": "vitest run",
    "test:e2e": "playwright test",
    "generate:assets": "node scripts/generate-project-assets.mjs"
  }
}
```

（删除旧 `check-theme-css` lint 步骤——旧架构的 CSS 动效归属检查不再适用。）

- [ ] **Step 5: 重写 `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: './',
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    css: true,
  },
})
```

- [ ] **Step 6: 重写 tsconfig 三件套**

`tsconfig.json`：

```json
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }]
}
```

`tsconfig.app.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*.ts", "src/**/*.vue"]
}
```

`tsconfig.node.json`：

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "strict": true
  },
  "include": ["vite.config.ts", "playwright.config.ts"]
}
```

- [ ] **Step 7: 重写 `eslint.config.js`**

```js
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default [
  { ignores: ['dist', 'node_modules', 'playwright-report', 'test-results', 'design-demo'] },
  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
      globals: { ...globals.browser },
    },
  },
  {
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },
]
```

- [ ] **Step 8: 重写 `index.html`**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>求职工作台</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 9: 验证依赖安装**

Run: `npm run lint`
Expected: ESLint 运行并通过（此时仍有 eslint.config.js、playwright.config.ts、scripts/ 被检查，0 error 即可）。

- [ ] **Step 10: 提交**

```bash
git add -A && git commit -m "chore: scaffold vue toolchain configs"
```

---

### Task 3: 应用入口与五路由占位

**Files:**
- Create: `src/main.ts`、`src/vite-env.d.ts`、`src/app/router.ts`、`src/app/nav.ts`、`src/App.vue`、5 个占位视图

- [ ] **Step 1: `src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}
```

- [ ] **Step 2: `src/app/nav.ts`**

```ts
export interface NavItem {
  name: string
  path: string
  title: string
  crumb: string
}

export const NAV_ITEMS: NavItem[] = [
  { name: 'dashboard', path: '/', title: '工作台', crumb: '求职进度总览' },
  { name: 'tracker', path: '/tracker', title: '投递管理', crumb: '台账 · 看板 · 面试记录' },
  { name: 'resume', path: '/resume', title: '简历管理', crumb: '资料池 · 多版本 · A4 打印' },
  { name: 'library', path: '/library', title: '材料库', crumb: '自我介绍 · 高频问题 · 深挖答案' },
  { name: 'showcase', path: '/showcase', title: '项目演示', crumb: '对外展示的门户站点' },
]
```

- [ ] **Step 3: `src/app/router.ts`**

```ts
import { createRouter, createWebHashHistory } from 'vue-router'
import AppLayout from '../shared/layout/AppLayout.vue'

const views = {
  dashboard: () => import('../modules/dashboard/views/DashboardView.vue'),
  tracker: () => import('../modules/tracker/views/TrackerView.vue'),
  resume: () => import('../modules/resume/views/ResumeView.vue'),
  library: () => import('../modules/library/views/LibraryView.vue'),
  showcase: () => import('../modules/showcase/views/ShowcaseView.vue'),
} as const

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      component: AppLayout,
      children: [
        { path: '', name: 'dashboard', component: views.dashboard, meta: { title: '工作台', crumb: '求职进度总览' } },
        { path: 'tracker', name: 'tracker', component: views.tracker, meta: { title: '投递管理', crumb: '台账 · 看板 · 面试记录' } },
        { path: 'resume', name: 'resume', component: views.resume, meta: { title: '简历管理', crumb: '资料池 · 多版本 · A4 打印' } },
        { path: 'library', name: 'library', component: views.library, meta: { title: '材料库', crumb: '自我介绍 · 高频问题 · 深挖答案' } },
        { path: 'showcase', name: 'showcase', component: views.showcase, meta: { title: '项目演示', crumb: '对外展示的门户站点' } },
      ],
    },
  ],
})
```

- [ ] **Step 4: 5 个占位视图**（结构相同，标题不同）

`src/modules/dashboard/views/DashboardView.vue`：

```vue
<template>
  <section class="view-placeholder">
    <h2>工作台</h2>
    <p>此模块在 Plan 3（进度模块 + 工作台）中实现。</p>
  </section>
</template>

<style scoped>
.view-placeholder { padding: 40px; color: var(--text2); }
.view-placeholder h2 { color: var(--text); margin-bottom: 8px; }
</style>
```

其余四个（`TrackerView` / `ResumeView` / `LibraryView` / `ShowcaseView`）同构，替换标题与说明：
- tracker → 「投递管理」/「此模块在 Plan 3（进度模块 + 工作台）中实现。」
- resume → 「简历管理」/「此模块在 Plan 2（简历模块）中实现。」
- library → 「材料库」/「此模块在 Plan 4（材料库 + 演示站）中实现。」
- showcase → 「项目演示」/「此模块在 Plan 4（材料库 + 演示站）中实现。」

- [ ] **Step 5: `src/App.vue` 与 `src/main.ts`**

`src/App.vue`：

```vue
<template>
  <RouterView />
</template>
```

`src/main.ts`：

```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import App from './App.vue'
import { router } from './app/router'
import './styles/tokens.css'
import './styles/global.css'

createApp(App).use(createPinia()).use(router).use(ElementPlus).mount('#app')
```

- [ ] **Step 6: 临时创建最小 `AppLayout.vue`**（Task 5 完整实现，此处先保证路由可编译）

`src/shared/layout/AppLayout.vue`：

```vue
<template>
  <div class="app-shell">
    <RouterView />
  </div>
</template>
```

- [ ] **Step 7: 验证构建**

Run: `npm run build`
Expected: vue-tsc 与 vite build 均通过，产出 `dist/`。

- [ ] **Step 8: 提交**

```bash
git add -A && git commit -m "feat: vue app shell with five placeholder routes"
```

---

### Task 4: 设计令牌、全局样式与主题 store

**Files:**
- Create: `src/styles/tokens.css`、`src/styles/global.css`、`src/app/stores/theme.ts`
- Test: `src/app/stores/__tests__/theme.test.ts`
- Modify: `src/shared/layout/AppLayout.vue`（接主题按钮在 Task 5 做，本任务只建 store）

- [ ] **Step 1: 编写失败测试 `theme.test.ts`**

```ts
import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useThemeStore } from '../theme'

describe('theme store', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.className = ''
    delete document.documentElement.dataset.theme
    setActivePinia(createPinia())
  })

  it('默认亮色', () => {
    const store = useThemeStore()
    expect(store.dark).toBe(false)
  })

  it('toggle 后写入 data-theme、dark class 与 localStorage', () => {
    const store = useThemeStore()
    store.toggle()
    expect(store.dark).toBe(true)
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('jobconsole:theme:v1')).toBe('dark')
  })

  it('初始化时恢复已存偏好', () => {
    localStorage.setItem('jobconsole:theme:v1', 'dark')
    setActivePinia(createPinia())
    const store = useThemeStore()
    store.init()
    expect(store.dark).toBe(true)
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/app/stores/__tests__/theme.test.ts`
Expected: FAIL（模块不存在）。此时 `src/test/setup.ts` 尚未创建，先建最小内容再跑：

`src/test/setup.ts`：

```ts
import 'fake-indexeddb/auto'
```

- [ ] **Step 3: 实现 `src/app/stores/theme.ts`**

```ts
import { defineStore } from 'pinia'

const STORAGE_KEY = 'jobconsole:theme:v1'

function readInitial(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark'
  } catch {
    return false
  }
}

function apply(dark: boolean): void {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.documentElement.classList.toggle('dark', dark)
}

export const useThemeStore = defineStore('theme', {
  state: () => ({ dark: readInitial() }),
  actions: {
    init() {
      apply(this.dark)
    },
    toggle() {
      this.dark = !this.dark
      try {
        localStorage.setItem(STORAGE_KEY, this.dark ? 'dark' : 'light')
      } catch {
        /* 隐私模式等存储不可用时忽略 */
      }
      apply(this.dark)
    },
  },
})
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/app/stores/__tests__/theme.test.ts`
Expected: 3 passed。

- [ ] **Step 5: 编写 `src/styles/tokens.css`**

从 `design-demo/index.html` 的 `:root` 与 `[data-theme="dark"]` 两段整体移植（变量名保持一致：`--bg`、`--card`、`--text`、`--text2`、`--muted`、`--border`、`--border2`、`--primary` 等、`--r-sm/md/lg`、`--shadow-*`、`--font`、`--font-display`、`--ease`、全部语义色 `--success/--warn/--danger/--info/--violet/--teal/--amber/--rose` 及对应 `-soft`），并追加 Element Plus 桥接段：

```css
/* Element Plus 桥接：令牌 → EP 变量 */
:root {
  --el-color-primary: var(--primary);
  --el-color-success: var(--success);
  --el-color-warning: var(--warn);
  --el-color-danger: var(--danger);
  --el-color-info: var(--info);
  --el-border-radius-base: var(--r-sm);
  --el-border-color: var(--border);
  --el-bg-color: var(--card);
  --el-bg-color-page: var(--bg);
  --el-text-color-primary: var(--text);
  --el-text-color-regular: var(--text2);
  --el-font-family: var(--font);
}
```

- [ ] **Step 6: 编写 `src/styles/global.css`**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body, #app { height: 100%; }
body {
  font-family: var(--font);
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 7: 在 `main.ts` 接入主题初始化（改写为语句形式）**

```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import App from './App.vue'
import { router } from './app/router'
import { useThemeStore } from './app/stores/theme'
import './styles/tokens.css'
import './styles/global.css'

const app = createApp(App)
app.use(createPinia())
useThemeStore().init()
app.use(router)
app.use(ElementPlus)
app.mount('#app')
```

- [ ] **Step 8: 验证**

Run: `npm run test:run && npm run build`
Expected: 全部测试通过，构建通过。

- [ ] **Step 9: 提交**

```bash
git add -A && git commit -m "feat: design tokens, global styles and theme store"
```

---

### Task 5: 布局壳（侧边栏 + 顶栏）

**Files:**
- Modify: `src/shared/layout/AppLayout.vue`（完整实现）
- Create: `src/shared/layout/AppSidebar.vue`、`src/shared/layout/AppTopbar.vue`
- Test: `src/shared/layout/__tests__/layout.test.ts`

- [ ] **Step 1: 编写失败测试 `layout.test.ts`**

```ts
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { describe, expect, it, beforeEach } from 'vitest'
import AppLayout from '../AppLayout.vue'
import { useThemeStore } from '../../../app/stores/theme'
import { createPinia, setActivePinia } from 'pinia'

const stub = (title: string, crumb = '') => ({ component: { template: '<p>view</p>' }, meta: { title, crumb } })

const routes = [
  { path: '/', name: 'dashboard', ...stub('工作台', '总览') },
  { path: '/tracker', name: 'tracker', ...stub('投递管理') },
  { path: '/resume', name: 'resume', ...stub('简历管理') },
  { path: '/library', name: 'library', ...stub('材料库') },
  { path: '/showcase', name: 'showcase', ...stub('项目演示') },
]

let router: Router
beforeEach(async () => {
  setActivePinia(createPinia())
  router = createRouter({ history: createMemoryHistory(), routes })
  await router.push('/')
})

describe('AppLayout', () => {
  it('渲染五个导航项且当前路由高亮', async () => {
    const wrapper = mount(AppLayout, { global: { plugins: [router] } })
    await router.isReady()
    const links = wrapper.findAll('.nav-item')
    expect(links.length).toBe(5)
    expect(links[0]!.classes()).toContain('active')
  })

  it('点击主题按钮切换 store 并写入根属性', async () => {
    const wrapper = mount(AppLayout, { global: { plugins: [router] } })
    await router.isReady()
    await wrapper.find('.theme-toggle').trigger('click')
    const theme = useThemeStore()
    expect(theme.dark).toBe(true)
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('顶栏显示当前路由标题', async () => {
    const wrapper = mount(AppLayout, { global: { plugins: [router] } })
    await router.isReady()
    expect(wrapper.find('.page-title').text()).toBe('工作台')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/shared/layout/__tests__/layout.test.ts`
Expected: FAIL（AppSidebar/AppTopbar 不存在或断言不满足）。

- [ ] **Step 3: 实现 `AppSidebar.vue`**

```vue
<script setup lang="ts">
import { useRoute } from 'vue-router'
import { NAV_ITEMS } from '../../app/nav'
const route = useRoute()
</script>

<template>
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-mark">职</div>
      <div>
        <div class="brand-name">求职工作台</div>
        <div class="brand-sub">Job Quest Console</div>
      </div>
    </div>
    <nav>
      <RouterLink
        v-for="item in NAV_ITEMS"
        :key="item.name"
        :to="item.path"
        class="nav-item"
        :class="{ active: route.name === item.name }"
      >
        {{ item.title }}
      </RouterLink>
    </nav>
    <div class="sidebar-foot">
      <span class="foot-note">数据仅存本机浏览器</span>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 236px; position: fixed; top: 0; bottom: 0; left: 0; z-index: 40;
  background: var(--card); border-right: 1px solid var(--border);
  display: flex; flex-direction: column; padding: 20px 14px;
}
.brand { display: flex; align-items: center; gap: 10px; padding: 4px 10px 18px; border-bottom: 1px solid var(--border); margin-bottom: 14px; }
.brand-mark {
  width: 34px; height: 34px; border-radius: var(--r-sm);
  background: linear-gradient(135deg, var(--primary), #7c3aed);
  color: #fff; display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 15px; box-shadow: var(--shadow-sm);
}
.brand-name { font-weight: 700; font-size: 15px; }
.brand-sub { font-size: 11px; color: var(--muted); }
nav { display: grid; gap: 4px; }
.nav-item {
  padding: 9px 12px; border-radius: var(--r-sm); color: var(--text2);
  font-weight: 500; text-decoration: none;
  transition: background 0.18s var(--ease), color 0.18s var(--ease);
}
.nav-item:hover { background: var(--card2); color: var(--text); }
.nav-item.active { background: var(--primary-soft); color: var(--primary); font-weight: 600; }
.sidebar-foot { margin-top: auto; border-top: 1px solid var(--border); padding-top: 12px; }
.foot-note { font-size: 11px; color: var(--muted); padding: 0 12px; }
@media (max-width: 860px) { .sidebar { display: none; } }
</style>
```

（后续 Plan 为导航项补充图标——沿用 design-demo 的内联 SVG，届时加 `icon` 字段渲染 `<component>`。）

- [ ] **Step 4: 实现 `AppTopbar.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useThemeStore } from '../../app/stores/theme'
const route = useRoute()
const theme = useThemeStore()
const title = computed(() => (route.meta.title as string) ?? '')
const crumb = computed(() => (route.meta.crumb as string) ?? '')
</script>

<template>
  <header class="topbar">
    <div>
      <div class="page-title">{{ title }}</div>
      <div class="page-crumb">{{ crumb }}</div>
    </div>
    <div class="topbar-right">
      <button class="icon-btn theme-toggle" aria-label="切换亮暗主题" @click="theme.toggle()">
        {{ theme.dark ? '🌙' : '☀️' }}
      </button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  position: sticky; top: 0; z-index: 30; height: 60px;
  background: color-mix(in srgb, var(--bg) 82%, transparent);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: 16px; padding: 0 28px;
}
.page-title { font-size: 16px; font-weight: 700; }
.page-crumb { font-size: 12px; color: var(--muted); }
.topbar-right { margin-left: auto; display: flex; align-items: center; gap: 10px; }
.icon-btn {
  width: 36px; height: 36px; border-radius: var(--r-sm); border: 1px solid var(--border);
  background: var(--card); color: var(--text2); transition: all 0.18s var(--ease);
}
.icon-btn:hover { color: var(--text); box-shadow: var(--shadow-sm); }
</style>
```

- [ ] **Step 5: 完整实现 `AppLayout.vue`**

```vue
<script setup lang="ts">
import AppSidebar from './AppSidebar.vue'
import AppTopbar from './AppTopbar.vue'
</script>

<template>
  <div class="app-shell">
    <AppSidebar />
    <div class="main-column">
      <AppTopbar />
      <main class="content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.main-column { flex: 1; margin-left: 236px; display: flex; flex-direction: column; min-width: 0; min-height: 100vh; }
.content { flex: 1; padding: 26px 28px 60px; max-width: 1280px; width: 100%; margin: 0 auto; }
@media (max-width: 860px) { .main-column { margin-left: 0; } }
</style>
```

- [ ] **Step 6: 运行测试确认通过**

Run: `npx vitest run src/shared/layout/__tests__/layout.test.ts`
Expected: 3 passed。

- [ ] **Step 7: 手动冒烟**

Run: `npm run dev` 后浏览器打开 `http://localhost:5173/`，确认侧边栏五项可切换、主题按钮生效、与 design-demo 观感一致。
完成后停掉 dev server。

- [ ] **Step 8: 提交**

```bash
git add -A && git commit -m "feat: app layout shell with sidebar and topbar"
```

---

### Task 6: 存储领域类型

**Files:**
- Create: `src/storage/types.ts`

- [ ] **Step 1: 编写完整类型文件**

```ts
/* 资料池 */
export interface BasicInfo {
  name: string
  gender?: string
  degree?: string
  school?: string
  graduation?: string
  phone?: string
  email?: string
  summary?: string
}
export interface EducationEntry { id: string; school: string; degree: string; time: string; courses?: string }
export interface SkillGroup { id: string; group: string; detail: string }
export interface ExperienceEntry { id: string; org: string; role: string; time: string; stack?: string; bullets: string[] }
export interface ProjectEntry { id: string; name: string; role?: string; time: string; stack?: string; bullets: string[] }
export interface AwardEntry { id: string; text: string }
export interface Profile {
  id: 'main'
  basic: BasicInfo
  education: EducationEntry[]
  skills: SkillGroup[]
  experiences: ExperienceEntry[]
  projects: ProjectEntry[]
  awards: AwardEntry[]
  selfEvaluation: string[]
  updatedAt: string
}

/* 投递 */
export const STAGES = ['已投递', '笔试', '一面', '二面', 'HR面', 'Offer', '挂', '无消息'] as const
export type Stage = (typeof STAGES)[number]
export const BATCHES = ['提前批', '正式批', '补录', '实习'] as const
export type Batch = (typeof BATCHES)[number]
export const TRACKS = ['主投', '保底', '机会型'] as const
export type Track = (typeof TRACKS)[number]

export interface StageChange { stage: Stage; date: string; note?: string }
export interface InterviewRecord {
  id: string
  round: string
  date: string
  format?: string
  questions: string[]
  weak?: string
  followUp?: string
}
export interface Application {
  id: string
  company: string
  position: string
  batch: Batch
  channel: string
  appliedAt: string
  location?: string
  url?: string
  status: Stage
  stageHistory: StageChange[]
  nextStep?: string
  nextActionAt?: string
  notes?: string
  track?: Track
  interviews: InterviewRecord[]
  createdAt: string
  updatedAt: string
}

/* 简历版本：版本 = 资料池条目的选择与排序 */
export const RESUME_SECTION_TYPES = ['basic', 'education', 'skills', 'experiences', 'projects', 'awards', 'selfEvaluation'] as const
export type ResumeSectionType = (typeof RESUME_SECTION_TYPES)[number]
export interface ResumeSection {
  type: ResumeSectionType
  title: string
  excludedIds?: string[]
  order: number
}
export interface ResumeVersion {
  id: string
  name: string
  targetRole: string
  sections: ResumeSection[]
  createdAt: string
  updatedAt: string
}

/* 候选池 / 材料库 / 里程碑 */
export interface CompanyPoolEntry {
  id: string
  company: string
  city?: string
  category?: string
  track: Track
  priority?: number
  jdBrief?: string
  createdAt: string
}
export const LIBRARY_CATEGORIES = ['自我介绍', '高频问题', '项目深挖', '八股'] as const
export type LibraryCategory = (typeof LIBRARY_CATEGORIES)[number]
export interface LibraryDoc {
  id: string
  category: LibraryCategory
  title: string
  body: string
  tags: string[]
  updatedAt: string
}
export interface Milestone { id: string; date: string; label: string; done?: 0 | 1 }

export function newId(): string {
  return crypto.randomUUID()
}
```

注意：`crypto.randomUUID` 需要 jsdom ≥ 24.1（Node 24 环境满足）。若测试报 `crypto.randomUUID is not a function`，在 `src/test/setup.ts` 追加 polyfill：

```ts
import { randomUUID } from 'node:crypto'
if (!globalThis.crypto.randomUUID) {
  globalThis.crypto.randomUUID = randomUUID
}
```

- [ ] **Step 2: 验证编译**

Run: `npm run build`
Expected: 通过。

- [ ] **Step 3: 提交**

```bash
git add -A && git commit -m "feat: storage domain types"
```

---

### Task 7: Dexie 数据库

**Files:**
- Create: `src/storage/db.ts`
- Test: `src/storage/__tests__/db.test.ts`

- [ ] **Step 1: 编写失败测试 `db.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { createDb } from '../db'
import type { Application } from '../types'
import { newId } from '../types'

function makeApp(overrides: Partial<Application> = {}): Application {
  return {
    id: newId(),
    company: '南方电网',
    position: '数字化研发工程师',
    batch: '提前批',
    channel: '官网',
    appliedAt: '2026-08-30',
    status: '已投递',
    stageHistory: [{ stage: '已投递', date: '2026-08-30' }],
    interviews: [],
    createdAt: '2026-08-30',
    updatedAt: '2026-08-30',
    ...overrides,
  }
}

describe('db', () => {
  it('可写入并按状态索引查询 Application', async () => {
    const db = createDb(`test-${newId()}`)
    try {
      await db.applications.bulkAdd([makeApp(), makeApp({ status: '挂' })])
      const active = await db.applications.where('status').equals('已投递').toArray()
      expect(active.length).toBe(1)
      expect(active[0]!.company).toBe('南方电网')
    } finally {
      await db.delete()
    }
  })

  it('profile 表以固定 id 存放主数据', async () => {
    const db = createDb(`test-${newId()}`)
    try {
      await db.profile.put({ id: 'main', basic: { name: '王小明' }, education: [], skills: [], experiences: [], projects: [], awards: [], selfEvaluation: [], updatedAt: '2026-08-30' })
      const profile = await db.profile.get('main')
      expect(profile?.basic.name).toBe('王小明')
    } finally {
      await db.delete()
    }
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/storage/__tests__/db.test.ts`
Expected: FAIL（createDb 不存在）。

- [ ] **Step 3: 实现 `src/storage/db.ts`**

```ts
import Dexie, { type Table } from 'dexie'
import type {
  Application, CompanyPoolEntry, LibraryDoc, Milestone, Profile, ResumeVersion,
} from './types'

export interface SnapshotRow {
  id?: number
  createdAt: string
  label: string
  data: string // JSON 序列化的 BackupData
}

export class JobConsoleDb extends Dexie {
  profile!: Table<Profile, string>
  resumeVersions!: Table<ResumeVersion, string>
  applications!: Table<Application, string>
  companyPool!: Table<CompanyPoolEntry, string>
  libraryDocs!: Table<LibraryDoc, string>
  milestones!: Table<Milestone, string>
  snapshots!: Table<SnapshotRow, number>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      profile: 'id',
      resumeVersions: 'id, updatedAt',
      applications: 'id, status, appliedAt, nextActionAt',
      companyPool: 'id, track',
      libraryDocs: 'id, category, updatedAt',
      milestones: 'id, date',
      snapshots: '++id, createdAt',
    })
  }
}

/** 测试与多实例场景使用；生产代码使用下方单例。 */
export function createDb(name: string): JobConsoleDb {
  return new JobConsoleDb(name)
}

export const db = createDb('job-console')
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/storage/__tests__/db.test.ts`
Expected: 2 passed。

- [ ] **Step 5: 提交**

```bash
git add -A && git commit -m "feat: dexie database schema v1"
```

---

### Task 8: 备份导出

**Files:**
- Create: `src/storage/backup.ts`
- Test: `src/storage/__tests__/backup.test.ts`

- [ ] **Step 1: 编写失败测试**

在 `backup.test.ts` 中先写导出部分（导入测试在 Task 9 追加）：

```ts
import { describe, expect, it } from 'vitest'
import { createDb } from '../db'
import { exportBackup, BACKUP_SCHEMA_VERSION } from '../backup'
import type { Application } from '../types'
import { newId } from '../types'
import { makeApp } from './fixtures'

describe('exportBackup', () => {
  it('导出包含 schemaVersion 与各表数据', async () => {
    const db = createDb(`test-${newId()}`)
    try {
      const app = makeApp()
      await db.applications.add(app)
      const file = await exportBackup(db)
      expect(file.schemaVersion).toBe(BACKUP_SCHEMA_VERSION)
      expect(file.exportedAt).toBeTruthy()
      expect(file.data.applications).toHaveLength(1)
      expect(file.data.applications[0]).toEqual(app)
      expect(file.data.profile).toEqual([])
      expect(file.data.resumeVersions).toEqual([])
      expect(file.data.companyPool).toEqual([])
      expect(file.data.libraryDocs).toEqual([])
      expect(file.data.milestones).toEqual([])
    } finally {
      await db.delete()
    }
  })
})
```

同目录创建测试夹具 `src/storage/__tests__/fixtures.ts`：

```ts
import type { Application } from '../types'
import { newId } from '../types'

export function makeApp(overrides: Partial<Application> = {}): Application {
  return {
    id: newId(),
    company: '南方电网',
    position: '数字化研发工程师',
    batch: '提前批',
    channel: '官网',
    appliedAt: '2026-08-30',
    status: '已投递',
    stageHistory: [{ stage: '已投递', date: '2026-08-30' }],
    interviews: [],
    createdAt: '2026-08-30',
    updatedAt: '2026-08-30',
    ...overrides,
  }
}
```

（`db.test.ts` 中重复的 `makeApp` 移入 fixtures 并改为从此处导入。）

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/storage/__tests__/backup.test.ts`
Expected: FAIL（backup 模块不存在）。

- [ ] **Step 3: 实现 `src/storage/backup.ts`（导出 + 校验 + 导入一起给出，Task 9 只补测试）**

```ts
import type { JobConsoleDb } from './db'
import type {
  Application, CompanyPoolEntry, LibraryDoc, Milestone, Profile, ResumeVersion,
} from './types'

export const BACKUP_SCHEMA_VERSION = 1

export interface BackupData {
  profile: Profile[]
  resumeVersions: ResumeVersion[]
  applications: Application[]
  companyPool: CompanyPoolEntry[]
  libraryDocs: LibraryDoc[]
  milestones: Milestone[]
}

export interface BackupFile {
  schemaVersion: number
  exportedAt: string
  data: BackupData
}

export async function exportBackup(db: JobConsoleDb): Promise<BackupFile> {
  const [profile, resumeVersions, applications, companyPool, libraryDocs, milestones] =
    await Promise.all([
      db.profile.toArray(),
      db.resumeVersions.toArray(),
      db.applications.toArray(),
      db.companyPool.toArray(),
      db.libraryDocs.toArray(),
      db.milestones.toArray(),
    ])
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: { profile, resumeVersions, applications, companyPool, libraryDocs, milestones },
  }
}

/* ---------- 校验 ---------- */

export interface ConfigIssue {
  path: string
  message: string
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function requireString(rec: Record<string, unknown>, key: string, path: string, issues: ConfigIssue[]): void {
  if (typeof rec[key] !== 'string' || (rec[key] as string).trim() === '') {
    issues.push({ path: `${path}.${key}`, message: '缺少必填字符串' })
  }
}

function requireStringArray(rec: Record<string, unknown>, key: string, path: string, issues: ConfigIssue[]): void {
  const v = rec[key]
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) {
    issues.push({ path: `${path}.${key}`, message: '必须是字符串数组' })
  }
}

export function validateBackup(raw: unknown): { ok: true; file: BackupFile } | { ok: false; issues: ConfigIssue[] } {
  const issues: ConfigIssue[] = []
  if (!isRecord(raw)) return { ok: false, issues: [{ path: '$', message: '备份文件必须是 JSON 对象' }] }
  if (raw.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    issues.push({ path: '$.schemaVersion', message: `仅支持 schemaVersion ${BACKUP_SCHEMA_VERSION}` })
  }
  if (!isRecord(raw.data)) {
    issues.push({ path: '$.data', message: '缺少 data 对象' })
    return { ok: false, issues }
  }
  const data = raw.data as Record<string, unknown>
  const tableKeys = ['profile', 'resumeVersions', 'applications', 'companyPool', 'libraryDocs', 'milestones'] as const
  for (const key of tableKeys) {
    if (!Array.isArray(data[key])) issues.push({ path: `$.data.${key}`, message: '必须是数组' })
  }
  if (issues.length) return { ok: false, issues }

  const rows = data as unknown as BackupData
  rows.applications.forEach((app, i) => {
    const path = `$.data.applications[${i}]`
    if (!isRecord(app as unknown)) { issues.push({ path, message: '必须是对象' }); return }
    const rec = app as unknown as Record<string, unknown>
    requireString(rec, 'id', path, issues)
    requireString(rec, 'company', path, issues)
    requireString(rec, 'position', path, issues)
    requireString(rec, 'appliedAt', path, issues)
    if (!Array.isArray(rec.stageHistory)) issues.push({ path: `${path}.stageHistory`, message: '必须是数组' })
    if (!Array.isArray(rec.interviews)) issues.push({ path: `${path}.interviews`, message: '必须是数组' })
  })
  rows.libraryDocs.forEach((doc, i) => {
    const path = `$.data.libraryDocs[${i}]`
    if (!isRecord(doc as unknown)) { issues.push({ path, message: '必须是对象' }); return }
    const rec = doc as unknown as Record<string, unknown>
    requireString(rec, 'id', path, issues)
    requireString(rec, 'title', path, issues)
    requireString(rec, 'body', path, issues)
    requireStringArray(rec, 'tags', path, issues)
  })
  if (issues.length) return { ok: false, issues }
  return { ok: true, file: raw as unknown as BackupFile }
}

/* ---------- 导入 ---------- */

export type ImportMode = 'merge' | 'overwrite'

/**
 * merge：按 id 逐表 put（id 冲突时整条以导入方为准，不合并字段；已有但未出现在导入中的记录保留）。
 * overwrite：清空六张数据表后整体灌入（snapshots 表不受影响）。
 */
export async function importBackup(db: JobConsoleDb, file: BackupFile, mode: ImportMode): Promise<void> {
  const { data } = file
  const tables = [
    db.profile, db.resumeVersions, db.applications, db.companyPool, db.libraryDocs, db.milestones,
  ] as const
  const rows = [
    data.profile, data.resumeVersions, data.applications, data.companyPool, data.libraryDocs, data.milestones,
  ] as const

  if (mode === 'overwrite') {
    await db.transaction('rw', tables, async () => {
      for (const table of tables) await table.clear()
      for (const [table, list] of pairTables(tables, rows)) await table.bulkPut(list)
    })
    return
  }
  await db.transaction('rw', tables, async () => {
    for (const [table, list] of pairTables(tables, rows)) await table.bulkPut(list)
  })
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/storage/__tests__/backup.test.ts`
Expected: 1 passed。

- [ ] **Step 5: 提交**

```bash
git add -A && git commit -m "feat: backup export, validation and import"
```

---

### Task 9: 导入行为测试（merge / overwrite / 非法文件）

**Files:**
- Modify: `src/storage/__tests__/backup.test.ts`（追加用例）

- [ ] **Step 1: 追加失败测试**

```ts
describe('importBackup', () => {
  it('merge：导入记录按 id 覆盖，已有其他记录保留', async () => {
    const db = createDb(`test-${newId()}`)
    try {
      const kept = makeApp({ company: '保留的公司' })
      const replaced = makeApp({ company: '旧值' })
      await db.applications.bulkAdd([kept, replaced])
      const incoming = makeApp({ id: replaced.id, company: '导入的新值' })
      const file = await exportBackup(createDb(`empty-${newId()}`))
      file.data.applications = [incoming]
      await importBackup(db, file, 'merge')
      const all = await db.applications.toArray()
      expect(all).toHaveLength(2)
      expect(all.find((a) => a.id === replaced.id)?.company).toBe('导入的新值')
      expect(all.find((a) => a.id === kept.id)?.company).toBe('保留的公司')
    } finally {
      await db.delete()
    }
  })

  it('overwrite：清空后整表灌入', async () => {
    const db = createDb(`test-${newId()}`)
    try {
      await db.applications.bulkAdd([makeApp(), makeApp()])
      const file = await exportBackup(createDb(`seed-${newId()}`))
      file.data.applications = [makeApp({ company: '唯一记录' })]
      await importBackup(db, file, 'overwrite')
      const all = await db.applications.toArray()
      expect(all).toHaveLength(1)
      expect(all[0]!.company).toBe('唯一记录')
      // overwrite 创建快照的断言在 Task 10 补充（快照逻辑在 Task 10 实现）
    } finally {
      await db.delete()
    }
  })

  it('非法备份被拒绝并给出字段路径', () => {
    const result = validateBackup({
      schemaVersion: 99,
      data: {
        profile: [], resumeVersions: [], applications: [{ company: '' }],
        companyPool: [], libraryDocs: [], milestones: [],
      },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      const paths = result.issues.map((i) => i.path)
      expect(paths).toContain('$.schemaVersion')
      expect(paths.some((p) => p.startsWith('$.data.applications[0]'))).toBe(true)
    }
  })
})
```

（顶部 import 补充 `importBackup, validateBackup`。）

- [ ] **Step 2: 运行测试**

Run: `npx vitest run src/storage/__tests__/backup.test.ts`
Expected: 全部通过（Task 8 已实现导入逻辑）。

- [ ] **Step 3: 提交**

```bash
git add -A && git commit -m "test: backup import merge and overwrite semantics"
```

---

### Task 10: 快照轮转

**Files:**
- Create: `src/storage/snapshots.ts`
- Test: `src/storage/__tests__/snapshots.test.ts`
- Modify: `src/storage/backup.ts`（overwrite 分支调用 createSnapshot）

- [ ] **Step 1: 编写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { createDb } from '../db'
import { createSnapshot, listSnapshots, KEEP_SNAPSHOTS } from '../snapshots'
import { newId } from '../types'

describe('snapshots', () => {
  it('超过保留数时仅留最新 N 份', async () => {
    const db = createDb(`test-${newId()}`)
    try {
      for (let i = 0; i < KEEP_SNAPSHOTS + 2; i++) {
        await createSnapshot(db, `快照 ${i}`)
      }
      const snaps = await listSnapshots(db)
      expect(snaps).toHaveLength(KEEP_SNAPSHOTS)
      expect(snaps[0]!.label).toBe(`快照 ${KEEP_SNAPSHOTS + 1}`) // 最新在前
    } finally {
      await db.delete()
    }
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/storage/__tests__/snapshots.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 `src/storage/snapshots.ts`**

```ts
import { exportBackup } from './backup'
import type { BackupData } from './backup'
import type { JobConsoleDb } from './db'

export const KEEP_SNAPSHOTS = 5

export async function createSnapshot(db: JobConsoleDb, label: string): Promise<void> {
  const file = await exportBackup(db)
  await db.snapshots.add({ createdAt: file.exportedAt, label, data: JSON.stringify(file.data) })
  const all = await db.snapshots.orderBy('id').toArray()
  const excess = all.length - KEEP_SNAPSHOTS
  if (excess > 0) {
    await db.snapshots.bulkDelete(all.slice(0, excess).map((s) => s.id!))
  }
}

export async function listSnapshots(db: JobConsoleDb): Promise<Array<{ id: number; createdAt: string; label: string; data: BackupData }>> {
  const rows = await db.snapshots.orderBy('id').reverse().toArray()
  return rows.map((r) => ({ id: r.id!, createdAt: r.createdAt, label: r.label, data: JSON.parse(r.data) as BackupData }))
}
```

- [ ] **Step 4: 在 `backup.ts` 的 overwrite 分支接入快照**

在 `backup.ts` 顶部追加：

```ts
import { createSnapshot } from './snapshots'
```

overwrite 分支改为：

```ts
if (mode === 'overwrite') {
  await db.transaction('rw', [...tables, db.snapshots], async () => {
    await createSnapshot(db, '导入前自动快照')
    for (const table of tables) await table.clear()
    for (const [table, list] of pairTables(tables, rows)) await table.bulkPut(list)
  })
  return
}
```

模块依赖说明（最终结构，无其他变体）：`snapshots.ts → backup.ts`（用 `exportBackup`）；`backup.ts → snapshots.ts`（仅用 `createSnapshot`）。存在模块环，但双方都只在**函数运行期**引用对方导出的函数，不做顶层求值，ES Module 环境下安全；两个文件顶层不得出现对对方绑定取值的 `const` 初始化。

- [ ] **Step 5: 追加 overwrite 快照行为测试**

在 `snapshots.test.ts` 中追加（顶部补充 `import { importBackup, exportBackup } from '../backup'` 与 `import { makeApp } from './fixtures'`）：

```ts
it('importBackup overwrite 自动创建导入前快照', async () => {
  const db = createDb(`test-${newId()}`)
  try {
    await db.applications.add(makeApp({ company: '导入前数据' }))
    const file = await exportBackup(createDb(`seed-${newId()}`))
    file.data.applications = []
    await importBackup(db, file, 'overwrite')
    const snaps = await db.snapshots.toArray()
    expect(snaps).toHaveLength(1)
    const restored = JSON.parse(snaps[0]!.data) as { applications: Array<{ company: string }> }
    expect(restored.applications).toHaveLength(1)
    expect(restored.applications[0]!.company).toBe('导入前数据')
  } finally {
    await db.delete()
  }
})
```

- [ ] **Step 6: 全量跑存储测试**

Run: `npx vitest run src/storage`
Expected: db / backup / snapshots 全部通过。

- [ ] **Step 7: 提交**

```bash
git add -A && git commit -m "feat: pre-import snapshot with 5-copy rotation"
```

---

### Task 11: 全量验证与收尾

- [ ] **Step 1: 全量验证**

```bash
npm run lint
npm run test:run
npm run build
git diff --check
```

Expected: lint 0 error；全部单测通过；构建通过；`git diff --check` 无输出。

- [ ] **Step 2: UTF-8 检查**

```bash
for f in src/main.ts src/storage/backup.ts; do
  printf '%s: ' "$f"; head -c 3 "$f" | od -An -tx1
done
```

Expected: 首三字节均非 `ef bb bf`（即无 BOM）。

- [ ] **Step 3: 冒烟验证 dev 服务器**

`npm run dev` → 打开 `http://localhost:5173/`：五路由切换正常、主题切换且刷新后保持、控制台无报错。停掉服务器。

- [ ] **Step 4: 提交剩余改动（如有）并汇总**

```bash
git status --short   # 确认仅剩 README.md（用户自己的修改）、design-demo/、.zcode/
```

---

## Verification（Plan 1 完成标准）

- [ ] `npm run lint && npm run test:run && npm run build` 全绿
- [ ] 存储层测试覆盖：schema 读写、导出结构、导入 merge/overwrite、非法文件字段路径报错、快照 5 份轮转
- [ ] 五路由布局壳可用，亮暗主题持久化，观感与 design-demo 一致
- [ ] `git status` 中 README.md 用户修改原样保留

## 后续计划（另行编写，不在本计划内）

- Plan 2：简历模块（资料池 CRUD、版本编排、A4 打印）
- Plan 3：进度模块 + 工作台（台账、看板、状态机、面试记录、候选池、Bento 仪表盘）
- Plan 4：材料库 + 演示站（markdown 阅读、showcase.config、双轴 Deck）
- Plan 5：种子数据、CI 更新、AGENTS/README/DESIGN 重写、IndexedDB 不可用时的内存降级模式、端到端验证
