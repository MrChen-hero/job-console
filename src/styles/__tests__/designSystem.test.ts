import { describe, expect, it } from 'vitest'
import tokensCss from '../tokens.css?raw'
import globalCss from '../global.css?raw'

/**
 * 设计系统的源码级不变量。
 * 这两条都曾经真实失效过，且都是「看得见、测不到」的 CSS 缺陷：
 * jsdom 不套用 UA 样式表，也不解析未定义的自定义属性，
 * 因此用计算样式断言不出来，只能在源码层设卡。
 */
describe('design tokens', () => {
  it('定义了 --r：8 处既有 var(--r) 调用依赖它，缺失会退化成直角', () => {
    expect(tokensCss).toMatch(/--r:\s*[^;]+;/)
  })

  it('每个 -vivid 色都成对定义了亮/暗两套', () => {
    for (const name of ['info', 'success', 'warn', 'danger', 'violet']) {
      const hits = tokensCss.match(new RegExp(`--${name}-vivid:`, 'g')) ?? []
      expect(hits.length, `--${name}-vivid`).toBe(2)
    }
  })
})

describe('global reset', () => {
  it('重置了原生 button 底色：否则未声明 background 的按钮会透出 UA 的 ButtonFace 灰', () => {
    const rule = globalCss.match(/(^|\n)button\s*\{[^}]*\}/)?.[0] ?? ''
    expect(rule).toMatch(/background:\s*none/)
  })

  it('button/input/select/textarea 继承字体与前景色', () => {
    expect(globalCss).toMatch(/button,\s*\n?\s*input,\s*\n?\s*select,\s*\n?\s*textarea\s*\{/)
  })
})
