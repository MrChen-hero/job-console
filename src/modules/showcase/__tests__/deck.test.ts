import { describe, expect, it } from 'vitest'
import { SHOWCASE_PROJECTS } from '../../../config/showcase.config'
import { clampIndex, deckLayers, swipeIntent, verticalIndexOf } from '../deck'
import type { LocalDemo, RuntimeDemo } from '../../../storage/types'

const project = SHOWCASE_PROJECTS[0]! // organs-system
const demos = [
  { id: 'd-1', projectId: 'organs-system', title: '一', html: '<p>1</p>' },
  { id: 'd-2', projectId: 'organs-system', title: '二', html: '<p>2</p>' },
  { id: 'd-3', projectId: 'campus-market', title: '别项目的', html: '<p>3</p>' },
] as Array<LocalDemo | RuntimeDemo>

describe('deck 导航纯逻辑', () => {
  it('clampIndex 边界', () => {
    expect(clampIndex(-1, 4)).toBe(0)
    expect(clampIndex(2, 4)).toBe(2)
    expect(clampIndex(4, 4)).toBe(3)
    expect(clampIndex(0, 0)).toBe(0)
  })

  it('deckLayers：一个演示页一层，只收本项目的', () => {
    const layers = deckLayers(project, demos)
    expect(layers).toHaveLength(2)
    expect(layers[0]).toEqual({ kind: 'demo', title: '一', html: '<p>1</p>', url: undefined, points: [], demoId: 'd-1' })
    expect(layers[1]).toEqual({ kind: 'demo', title: '二', html: '<p>2</p>', url: undefined, points: [], demoId: 'd-2' })
  })

  it('deckLayers：链接式演示带上 url，自带要点原样透出', () => {
    const linked: RuntimeDemo = {
      id: 'd-4',
      projectId: 'organs-system',
      title: '自部署演示',
      html: '',
      url: 'https://demo.example.com',
      points: ['要点一', '要点二'],
      createdAt: '2026-09-04',
      updatedAt: '2026-09-04',
    }
    const layers = deckLayers(project, [linked])
    expect(layers).toEqual([{
      kind: 'demo',
      title: '自部署演示',
      html: '',
      url: 'https://demo.example.com',
      points: ['要点一', '要点二'],
      demoId: 'd-4',
    }])
  })

  it('deckLayers：没有演示页时只出一层封面（要点不再单独成页）', () => {
    expect(deckLayers(project, [])).toEqual([{ kind: 'cover' }])
    expect(deckLayers(project, [demos[2]!])).toEqual([{ kind: 'cover' }])
    // 内置项目都配了要点，但要点渲染在每层的信息区，不占纵向层
    expect(project.demo.points.length).toBeGreaterThan(0)
  })

  it('verticalIndexOf：演示页序号从 0 起（首层就是第一个演示页）', () => {
    expect(verticalIndexOf(project, demos, 'd-1')).toBe(0)
    expect(verticalIndexOf(project, demos, 'd-2')).toBe(1)
    // 不属于该项目 / 查不到时落首层
    expect(verticalIndexOf(project, demos, 'd-3')).toBe(0)
    expect(verticalIndexOf(project, demos, 'missing')).toBe(0)
  })

  it('swipeIntent：阈值与横向主导判定', () => {
    expect(swipeIntent(30, 0)).toBe(0)
    expect(swipeIntent(-80, 10)).toBe(1) // 左滑 → 下一页
    expect(swipeIntent(80, 10)).toBe(-1) // 右滑 → 上一页
    expect(swipeIntent(-80, 100)).toBe(0) // 纵向主导拒绝
    expect(swipeIntent(-80, 60)).toBe(1) // 1.25 倍界内仍判横向
  })
})
