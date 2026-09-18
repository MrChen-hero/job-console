import { describe, expect, it } from 'vitest'
import { paginate } from '../paginate'
import type { SheetBlock } from '../blocks'

const line = (id: string): SheetBlock => ({ id, kind: 'line', text: id })
const title = (id: string): SheetBlock => ({ id, kind: 'title', title: id, subtitle: '' })
const ids = (pages: SheetBlock[][]): string[][] => pages.map((page) => page.map((b) => b.id))

describe('paginate', () => {
  it('空块序列返回空页数组', () => {
    expect(paginate([], {}, 100)).toEqual([])
  })

  it('按可用高度装箱，装不下就换页', () => {
    const blocks = [line('a'), line('b'), line('c')]
    const heights = { a: 40, b: 40, c: 40 }
    expect(ids(paginate(blocks, heights, 100))).toEqual([['a', 'b'], ['c']])
  })

  it('标题与其后第一块同页：标题自己放得下也要一起换页', () => {
    const blocks = [line('a'), line('b'), title('t'), line('c')]
    const heights = { a: 40, b: 40, t: 20, c: 30 }
    // 不做 keepWithNext 的话 t 会独自留在第 1 页（80 + 20 = 100 正好放下）
    expect(ids(paginate(blocks, heights, 100))).toEqual([['a', 'b'], ['t', 'c']])
  })

  it('单块高过一整页时独占一页，不吞掉前后内容', () => {
    const blocks = [line('a'), line('big'), line('b')]
    const heights = { a: 40, big: 300, b: 40 }
    expect(ids(paginate(blocks, heights, 100))).toEqual([['a'], ['big'], ['b']])
  })

  it('尚未测量（pageHeight 为 0）时退化为单页', () => {
    const blocks = [line('a'), line('b')]
    expect(ids(paginate(blocks, { a: 40, b: 40 }, 0))).toEqual([['a', 'b']])
  })

  it('高度全为 0（jsdom 无布局）时全部落在第 1 页并正常返回', () => {
    const blocks = [line('a'), title('t'), line('b'), line('c')]
    expect(ids(paginate(blocks, {}, 986))).toEqual([['a', 't', 'b', 'c']])
  })

  it('缺失高度按 0 计，不影响其他块的装箱', () => {
    const blocks = [line('a'), line('b'), line('c')]
    expect(ids(paginate(blocks, { a: 60, c: 60 }, 100))).toEqual([['a', 'b'], ['c']])
  })
})
