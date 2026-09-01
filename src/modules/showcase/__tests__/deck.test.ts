import { describe, expect, it } from 'vitest'
import { SHOWCASE_PROJECTS } from '../../../config/showcase.config'
import { attachDemoPages, clampIndex, pagesOf, swipeIntent } from '../deck'
import type { LocalDemo, RuntimeDemo } from '../../../storage/types'

describe('deck 导航纯逻辑', () => {
  it('clampIndex 边界', () => {
    expect(clampIndex(-1, 4)).toBe(0)
    expect(clampIndex(2, 4)).toBe(2)
    expect(clampIndex(4, 4)).toBe(3)
    expect(clampIndex(0, 0)).toBe(0)
  })

  it('pagesOf：每个项目首纵向页为配置要点页', () => {
    for (const p of SHOWCASE_PROJECTS) {
      const pages = pagesOf(p)
      expect(pages).toHaveLength(1)
      expect(pages[0]!.kind).toBe('points')
      expect(pages[0]!.title).toBe(p.demo.title)
    }
  })

  it('attachDemoPages：按 projectId 附加交互 demo 页', () => {
    const project = SHOWCASE_PROJECTS[0]!
    const local: LocalDemo = { id: 'organs-system--a', projectId: 'organs-system', title: '内置 demo', html: '<p>a</p>' }
    const runtime: RuntimeDemo = {
      id: 'rt-1', projectId: 'campus-market', title: '别项目的', html: '<p>b</p>',
      createdAt: '2026-08-31', updatedAt: '2026-08-31',
    }
    const pages = attachDemoPages(project, [local, runtime])
    expect(pages).toHaveLength(2)
    expect(pages[1]).toEqual({ kind: 'demo', title: '内置 demo', html: '<p>a</p>', demoId: 'organs-system--a' })
  })

  it('swipeIntent：阈值与横向主导判定', () => {
    expect(swipeIntent(30, 0)).toBe(0)
    expect(swipeIntent(-80, 10)).toBe(1) // 左滑 → 下一页
    expect(swipeIntent(80, 10)).toBe(-1) // 右滑 → 上一页
    expect(swipeIntent(-80, 100)).toBe(0) // 纵向主导拒绝
    expect(swipeIntent(-80, 60)).toBe(1) // 1.25 倍界内仍判横向
  })
})
