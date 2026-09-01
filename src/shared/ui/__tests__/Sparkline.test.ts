import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Sparkline from '../Sparkline.vue'

const paths = (values: number[]) =>
  mount(Sparkline, { props: { values } }).findAll('path').map((p) => p.attributes('d') ?? '')

const ys = (d: string) => [...d.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((m) => Number(m[2]))

describe('Sparkline', () => {
  it('常量序列不产出 NaN，且所有点等高（落在中线）', () => {
    const [area, line] = paths([3, 3, 3, 3])
    expect(area + line).not.toMatch(/NaN/)
    expect(line).toMatch(/^M0\.0 /)
    expect(new Set(ys(line!))).toHaveProperty('size', 1)
    expect(ys(line!)[0]).toBe(16)
  })

  it('单点序列画成横线且不产出 NaN', () => {
    const [area, line] = paths([5])
    expect(area + line).not.toMatch(/NaN/)
    expect(line).toMatch(/^M0\.0 /)
    expect(line).toContain('L100.0 ')
  })

  it('空序列渲染 svg 但不产出路径', () => {
    const wrapper = mount(Sparkline, { props: { values: [] } })
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.findAll('path')).toHaveLength(0)
  })

  it('递增序列的末点比首点高（y 更小）', () => {
    const line = paths([1, 2, 3, 4])[1]!
    const values = ys(line)
    expect(values.at(-1)!).toBeLessThan(values[0]!)
  })

  it('区域路径闭合到底边，描边不随横向拉伸变形', () => {
    const wrapper = mount(Sparkline, { props: { values: [1, 5, 2] } })
    const [area, line] = wrapper.findAll('path')
    expect(area!.attributes('d')).toMatch(/L100 32 L0 32Z$/)
    expect(line!.attributes('vector-effect')).toBe('non-scaling-stroke')
  })

  it('对屏幕阅读器隐藏', () => {
    expect(mount(Sparkline, { props: { values: [1, 2] } }).find('svg').attributes('aria-hidden')).toBe('true')
  })
})
