import 'fake-indexeddb/auto'
import { config } from '@vue/test-utils'

// ElDialog/ElDrawer 在 jsdom 下依赖真实浏览器过渡钩子（相关交互走 Playwright E2E），
// 这里 stub 成透传容器，消除测试输出的 "Failed to resolve component" 噪音。
// open 事件照实发：不少弹窗把「按 initial 回填表单」挂在 @open 上，不发这个事件等于测不到回填。
config.global.stubs = {
  ElDialog: {
    props: { modelValue: { type: Boolean, default: false } },
    emits: ['open'],
    mounted() {
      if (this.modelValue) this.$emit('open')
    },
    watch: {
      modelValue(next: boolean) {
        if (next) this.$emit('open')
      },
    },
    template: '<div class="stub-dialog"><slot /><slot name="footer" /></div>',
  },
  ElDrawer: {
    template: '<div class="stub-drawer"><slot /></div>',
  },
}

// v-loading 指令由入口单独注册；单测常按需挂载组件，给空实现兜底。
config.global.directives = {
  loading: {},
}
