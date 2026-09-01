import type { Stage } from '../../storage/types'

/** 看板列：挂/无消息合并为「终止列」 */
export const BOARD_COLUMNS = ['已投递', '笔试', '一面', '二面', 'HR面', 'Offer', '挂 / 无消息'] as const
export type BoardColumn = (typeof BOARD_COLUMNS)[number]

/** 状态 → 徽章色调 class */
export const STAGE_BADGE: Record<Stage, string> = {
  已投递: 'badge-blue',
  笔试: 'badge-violet',
  一面: 'badge-amber',
  二面: 'badge-amber',
  HR面: 'badge-amber',
  Offer: 'badge-green',
  挂: 'badge-red',
  无消息: 'badge-gray',
}

/** 主流程（可推进序列） */
export const STAGE_DONE: Stage[] = ['已投递', '笔试', '一面', '二面', 'HR面', 'Offer']

export function columnOf(stage: Stage): BoardColumn {
  return stage === '挂' || stage === '无消息' ? '挂 / 无消息' : (stage as BoardColumn)
}

export function stagesOfColumn(column: BoardColumn): Stage[] {
  return column === '挂 / 无消息' ? ['挂', '无消息'] : [column]
}

/** 无消息超 1 个月视为挂（展示启发式，不改写状态） */
export function isStale(status: Stage, lastChangeDate: string, now = new Date()): boolean {
  if (status !== '无消息') return false
  const last = new Date(lastChangeDate)
  if (Number.isNaN(last.getTime())) return false
  return now.getTime() - last.getTime() > 30 * 24 * 3600 * 1000
}
