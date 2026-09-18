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
  let group: SheetBlock[] = []
  let groupHeight = 0

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]!
    group.push(block)
    groupHeight += heights[block.id] ?? 0
    // 延迟放置标题，直到首条内容到齐；连续标题也不会在下一轮被重新拆开。
    if (keepsWithNext(block) && i + 1 < blocks.length) continue

    // 超高组合与超高条目一样独占一页并允许溢出，不额外制造标题页。
    if (current.length && used + groupHeight > pageHeight) {
      pages.push(current)
      current = []
      used = 0
    }
    current.push(...group)
    used += groupHeight
    group = []
    groupHeight = 0
  }
  if (current.length) pages.push(current)
  return pages
}
