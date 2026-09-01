import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppIcon from '../AppIcon.vue'
import { ICON_NAMES } from '../icons'

describe('AppIcon', () => {
  it('渲染 svg 且对屏幕阅读器隐藏', () => {
    const wrapper = mount(AppIcon, { props: { name: 'grid' } })
    const svg = wrapper.find('svg')
    expect(svg.exists()).toBe(true)
    expect(svg.attributes('viewBox')).toBe('0 0 24 24')
    expect(svg.attributes('aria-hidden')).toBe('true')
  })

  it('尺寸可覆盖，默认 18', () => {
    expect(mount(AppIcon, { props: { name: 'grid' } }).find('svg').attributes('width')).toBe('18')
    expect(mount(AppIcon, { props: { name: 'grid', size: 26 } }).find('svg').attributes('width')).toBe('26')
  })

  it('未知图标名不抛错、渲染空 svg', () => {
    const wrapper = mount(AppIcon, { props: { name: 'not-exist' } })
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.find('path,circle,rect').exists()).toBe(false)
  })

  it('图元落在 SVG 命名空间（动态组件不能退化成 HTML 元素）', () => {
    const wrapper = mount(AppIcon, { props: { name: 'grid' } })
    const rects = wrapper.element.querySelectorAll('rect')
    expect(rects).toHaveLength(4)
    for (const rect of rects) {
      expect(rect.namespaceURI).toBe('http://www.w3.org/2000/svg')
    }
  })

  it('导航与交互所需图标齐备', () => {
    for (const name of [
      'grid', 'case', 'file', 'layers', 'play', 'menu', 'sun', 'moon', 'search',
      'plus', 'star', 'edit', 'trash', 'grip', 'chev', 'left', 'right', 'first', 'last',
      'download', 'printer', 'user', 'help', 'target', 'book', 'mark',
    ]) {
      expect(ICON_NAMES).toContain(name)
    }
  })
})
