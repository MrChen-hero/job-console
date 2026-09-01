import 'fake-indexeddb/auto'
import { config } from '@vue/test-utils'

// ElDialog/ElDrawer 在 jsdom 下依赖真实浏览器过渡钩子（相关交互走 Playwright E2E），
// 这里 stub 成透传容器，消除测试输出的 "Failed to resolve component" 噪音。
config.global.stubs = {
  ElDialog: {
    template: '<div class="stub-dialog"><slot /><slot name="footer" /></div>',
  },
  ElDrawer: {
    template: '<div class="stub-drawer"><slot /></div>',
  },
}

// v-loading 指令由 Element Plus 插件注册；单测常按需挂载组件，给空实现兜底。
config.global.directives = {
  loading: {},
}
