import type { LocalDemo, RuntimeDemo } from '../../storage/types'
import { SHOWCASE_PROJECTS, type ShowcaseProject } from '../../config/showcase.config'

/** Deck 纵向页：项目主面之后依次是配置要点页与交互式 demo 页 */
export type DeckPage =
  | { kind: 'points'; title: string; points: string[] }
  | { kind: 'demo'; title: string; html: string; demoId: string }

export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0
  return Math.min(Math.max(index, 0), length - 1)
}

export function pagesOf(project: ShowcaseProject): DeckPage[] {
  const points = project.demo
  return [{ kind: 'points', title: points.title, points: points.points }]
}

export function attachDemoPages(project: ShowcaseProject, demos: Array<LocalDemo | RuntimeDemo>): DeckPage[] {
  const own = demos.filter((d) => d.projectId === project.id)
  return [...pagesOf(project), ...own.map((d) => ({ kind: 'demo' as const, title: d.title, html: d.html, demoId: d.id }))]
}

/** 横向拖拽意图：位移超过阈值且横向主导（|dx| > |dy| × 1.25，沿用原 React 控制器策略） */
export function swipeIntent(dx: number, dy: number, threshold = 56): -1 | 0 | 1 {
  if (Math.abs(dx) < threshold) return 0
  if (Math.abs(dx) <= Math.abs(dy) * 1.25) return 0
  return dx < 0 ? 1 : -1
}

export function projectAt(index: number): ShowcaseProject {
  return SHOWCASE_PROJECTS[clampIndex(index, SHOWCASE_PROJECTS.length)]!
}
