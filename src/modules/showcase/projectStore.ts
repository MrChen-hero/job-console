import { defineStore } from 'pinia'
import { db } from '../../storage/db'
import type { ProjectAccent, RuntimeProject } from '../../storage/types'
import { newId } from '../../storage/types'
import { SHOWCASE_PROJECTS, type ShowcaseProject } from '../../config/showcase.config'

/** 色板选项（顺序即选择器展示顺序）：红 橙 黄 绿 青 蓝 紫 黑 灰 */
export const ACCENT_OPTIONS: Array<{ id: ProjectAccent; label: string }> = [
  { id: 'red', label: '红' },
  { id: 'orange', label: '橙' },
  { id: 'yellow', label: '黄' },
  { id: 'green', label: '绿' },
  { id: 'teal', label: '青' },
  { id: 'blue', label: '蓝' },
  { id: 'violet', label: '紫' },
  { id: 'black', label: '黑' },
  { id: 'gray', label: '灰' },
]

export type MergedProject =
  | ({ source: 'local'; overridden: boolean; hidden?: false } & ShowcaseProject)
  | ({ source: 'runtime'; overridden: boolean; hidden?: boolean } & RuntimeProject)

export interface ProjectInput {
  title: string
  eyebrow: string
  accent: ProjectAccent
  summary: string
  stack: string[]
  defaultPoints?: string[]
}

const ACCENTS: ProjectAccent[] = ACCENT_OPTIONS.map((a) => a.id)

function nowIso(): string {
  return new Date().toISOString()
}

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** 输入校验：标题必填，accent 合法；失败返回原因（空串表示通过） */
export function validateProjectInput(input: ProjectInput): string {
  if (input.title.trim() === '') return '请填写项目名称'
  if (!ACCENTS.includes(input.accent)) return '主题色不合法'
  return ''
}

export const useProjectStore = defineStore('showcase-projects', {
  state: () => ({
    runtimeProjects: [] as RuntimeProject[],
    loaded: false,
  }),

  getters: {
    /**
     * 合并清单：内置项目（被 runtime 同 id 覆盖时标 overridden）∪ 自建 runtime 项目。
     * 覆盖行带 hidden:true 时由 visible 过滤。
     */
    merged(state): MergedProject[] {
      const rowById = new Map(state.runtimeProjects.map((p) => [p.id, p]))
      const local: MergedProject[] = SHOWCASE_PROJECTS.map((p) => {
        const row = rowById.get(p.id)
        if (!row) return { source: 'local', overridden: false, ...p }
        return { source: 'runtime', overridden: true, ...row }
      })
      const builtinIds = new Set(SHOWCASE_PROJECTS.map((p) => p.id))
      const own = state.runtimeProjects
        .filter((p) => !builtinIds.has(p.id))
        .map((p): MergedProject => ({ source: 'runtime', overridden: false, ...p }))
      return [...local, ...own]
    },

    /** 可见项目（滤掉隐藏墓碑）；Deck、卡片网格、上传对话框都以此为准 */
    visible(): MergedProject[] {
      return this.merged.filter((p) => !p.hidden)
    },

  },

  actions: {
    async load() {
      this.runtimeProjects = await db.runtimeProjects.toArray()
      this.loaded = true
    },

    find(id: string): MergedProject | undefined {
      return this.merged.find((p) => p.id === id)
    },

    /** 新建自建项目 */
    async addProject(input: ProjectInput): Promise<RuntimeProject> {
      const now = nowIso()
      const row: RuntimeProject = {
        id: newId(),
        title: input.title.trim(),
        eyebrow: input.eyebrow.trim(),
        accent: input.accent,
        summary: input.summary.trim(),
        stack: input.stack,
        // 每页自己的要点优先，未填写时使用项目默认要点。
        demo: { title: `${input.title.trim()} · 演示页`, points: input.defaultPoints ?? [] },
        createdAt: now,
        updatedAt: now,
      }
      await db.runtimeProjects.put(plain(row))
      await this.load()
      return row
    },

    /**
     * 编辑项目：自建项目改本行；内置项目写同 id 覆盖行。
     * hidden 状态在覆盖行上保留——编辑一个被隐藏的内置项目不应让它复活。
     * 表单可编辑或清空默认要点；未传该字段的旧调用保留原值。
     */
    async updateProject(id: string, input: ProjectInput): Promise<void> {
      const existing = this.runtimeProjects.find((p) => p.id === id)
      const builtin = SHOWCASE_PROJECTS.find((p) => p.id === id)
      const row: RuntimeProject = {
        id,
        title: input.title.trim(),
        eyebrow: input.eyebrow.trim(),
        accent: input.accent,
        summary: input.summary.trim(),
        stack: input.stack,
        demo: input.defaultPoints !== undefined
          ? { title: `${input.title.trim()} · 演示页`, points: input.defaultPoints }
          : existing?.demo ?? builtin?.demo ?? { title: `${input.title.trim()} · 演示页`, points: [] },
        hidden: existing?.hidden,
        createdAt: existing?.createdAt ?? nowIso(),
        updatedAt: nowIso(),
      }
      await db.runtimeProjects.put(plain(row))
      await this.load()
    },

    /**
     * 删除项目：自建项目删行；内置项目写 hidden 删除标记。
     * 关联演示页保留在库中，但不在页面展示。
     */
    async removeProject(id: string): Promise<void> {
      const isBuiltin = SHOWCASE_PROJECTS.some((p) => p.id === id)
      if (!isBuiltin) {
        await db.runtimeProjects.delete(id)
      } else {
        const source = SHOWCASE_PROJECTS.find((p) => p.id === id)!
        const now = nowIso()
        await db.runtimeProjects.put(plain({ ...source, hidden: true, createdAt: now, updatedAt: now }))
      }
      await this.load()
    },

  },
})
