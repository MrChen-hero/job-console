import { keepsWithNext, type SheetBlock } from './blocks'

/**
 * 按可打印高度把块序列装进若干页。
 *
 * 实现约束（别改成 while 循环）：单趟 for，每轮消费一块。jsdom 没有布局，
 * 所有 offsetHeight 恒为 0、pageHeight 也是 0，while 版本会在这里死循环；
 * 单趟版本在这种情况下退化为「全部落在第 1 页」并正常返回。
 *
 * @param heights 块 id → 实测高度（含块间外边距），缺失按 0 计
 * @param pageHeight 单页可用内容高度；≤0 表示尚未测量，直接返回单页
 */
export function paginate(
  blocks: SheetBlock[],
  heights: Record<string, number>,
  pageHeight: number,
): SheetBlock[][] {
  if (!blocks.length) return []
  if (!(pageHeight > 0)) return [blocks]

  const pages: SheetBlock[][] = []
  let current: SheetBlock[] = []
  let used = 0

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]!
    const height = heights[block.id] ?? 0
    // 标题块按「自身 + 下一块」一起判断能否放下，避免标题独自留在页尾
    const next = blocks[i + 1]
    const needed = keepsWithNext(block) && next ? height + (heights[next.id] ?? 0) : height

    // current 为空时不换页：单块高过一整页也要有地方放，让它独占一页并允许溢出
    if (current.length && used + needed > pageHeight) {
      pages.push(current)
      current = []
      used = 0
    }
    current.push(block)
    used += height
  }
  if (current.length) pages.push(current)
  return pages
}
