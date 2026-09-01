import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import AppLayout from '../AppLayout.vue'
import { useThemeStore } from '../../../app/stores/theme'

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
  localStorage.clear()
  document.documentElement.className = ''
  delete document.documentElement.dataset.theme
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

  /* 抽屉：jsdom 没有 window.matchMedia，AppLayout 在探测失败时按抽屉模式降级，
     因此以下断言都成立；桌面模式的行为靠 900/1536 视口截图核对。 */

  it('汉堡按钮打开抽屉并显示遮罩', async () => {
    const wrapper = mount(AppLayout, { global: { plugins: [router] } })
    await router.isReady()
    expect(wrapper.find('.sidebar').classes()).not.toContain('open')
    expect(wrapper.find('.scrim').exists()).toBe(false)
    await wrapper.find('.menu-btn').trigger('click')
    expect(wrapper.find('.sidebar').classes()).toContain('open')
    expect(wrapper.find('.scrim').exists()).toBe(true)
  })

  it('点击遮罩关闭抽屉', async () => {
    const wrapper = mount(AppLayout, { global: { plugins: [router] } })
    await router.isReady()
    await wrapper.find('.menu-btn').trigger('click')
    await wrapper.find('.scrim').trigger('click')
    expect(wrapper.find('.sidebar').classes()).not.toContain('open')
  })

  it('Esc 关闭抽屉', async () => {
    const wrapper = mount(AppLayout, { attachTo: document.body, global: { plugins: [router] } })
    await router.isReady()
    await wrapper.find('.menu-btn').trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.sidebar').classes()).not.toContain('open')
    wrapper.unmount()
  })

  it('路由切换自动收起抽屉', async () => {
    const wrapper = mount(AppLayout, { global: { plugins: [router] } })
    await router.isReady()
    await wrapper.find('.menu-btn').trigger('click')
    await router.push('/tracker')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.sidebar').classes()).not.toContain('open')
  })

  it('抽屉关闭时侧栏对键盘与读屏隐藏，打开时恢复', async () => {
    const wrapper = mount(AppLayout, { global: { plugins: [router] } })
    await router.isReady()
    expect(wrapper.find('.sidebar').attributes('aria-hidden')).toBe('true')
    expect(wrapper.find('.sidebar').attributes('inert')).toBeDefined()
    await wrapper.find('.menu-btn').trigger('click')
    expect(wrapper.find('.sidebar').attributes('aria-hidden')).toBeUndefined()
    expect(wrapper.find('.sidebar').attributes('inert')).toBeUndefined()
  })
})
