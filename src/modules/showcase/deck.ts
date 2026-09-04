import type { LocalDemo, RuntimeDemo } from '../../storage/types'
import type { ShowcaseProject } from '../../config/showcase.config'

/**
 * Deck 纵向层：一个交互演示页一层——媒体位放该 demo 的 iframe（上传式取 html 的 Blob URL，
 * 链接式直接取 url），其下恒为项目基础信息（eyebrow / 标题 / 简介 / 技术栈）+ 要点。
 * 要点取该演示页自己的 points，没填时由 DeckOverlay 回落到项目的 demo.points。
 * 所以「点进项目的第一页」就是第一个演示页。项目没有任何演示页时只出一层封面（cover）：
 * 媒体位换成占位提示，信息区不变。
 */
export type DeckLayer =
  | { kind: 'demo'; title: string; html: string; url?: string; points: string[]; demoId: string }
  | { kind: 'cover' }

export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0
  return Math.min(Math.max(index, 0), length - 1)
}

/** 项目自己的演示页；顺序沿用传入清单（demoStore.merged 是内置在前、上传在后） */
function demosOf(
  project: ShowcaseProject,
  demos: Array<LocalDemo | RuntimeDemo>,
): Array<LocalDemo | RuntimeDemo> {
  return demos.filter((d) => d.projectId === project.id)
}

export function deckLayers(project: ShowcaseProject, demos: Array<LocalDemo | RuntimeDemo>): DeckLayer[] {
  const own = demosOf(project, demos)
  if (own.length === 0) return [{ kind: 'cover' }]
  return own.map((d) => ({
    kind: 'demo' as const,
    title: d.title,
    html: d.html,
    // 内置演示（LocalDemo）没有这两项，取值前先窄化
    url: 'url' in d ? d.url : undefined,
    points: ('points' in d ? d.points : undefined) ?? [],
    demoId: d.id,
  }))
}

/** 演示页所在的纵向层序号（0 起，首层即第一个演示页）；不属于该项目时落首层 */
export function verticalIndexOf(
  project: ShowcaseProject,
  demos: Array<LocalDemo | RuntimeDemo>,
  demoId: string,
): number {
  const idx = demosOf(project, demos).findIndex((d) => d.id === demoId)
  return idx < 0 ? 0 : idx
}

/** 横向拖拽意图：位移超过阈值且横向主导（|dx| > |dy| × 1.25，沿用原 React 控制器策略） */
export function swipeIntent(dx: number, dy: number, threshold = 56): -1 | 0 | 1 {
  if (Math.abs(dx) < threshold) return 0
  if (Math.abs(dx) <= Math.abs(dy) * 1.25) return 0
  return dx < 0 ? 1 : -1
}
