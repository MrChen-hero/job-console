import { defineStore } from 'pinia'
import { db } from '../../storage/db'
import type { RuntimeProject } from '../../storage/types'
import { newId } from '../../storage/types'
import { SHOWCASE_PROJECTS, type ShowcaseProject } from '../../config/showcase.config'

export type MergedProject =
  | ({ source: 'local'; overridden: boolean; hidden?: false } & ShowcaseProject)
  | ({ source: 'runtime'; overridden: boolean; hidden?: boolean } & RuntimeProject)

export interface ProjectInput {
  title: string
  eyebrow: string
  accent: RuntimeProject['accent']
  summary: string
  stack: string[]
  demoTitle: string
  demoPoints: string[]
}

const ACCENTS: RuntimeProject['accent'][] = ['violet', 'teal', 'amber', 'rose']

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
     * 覆盖行带 hidden:true 时项目仍在清单中（visible 会滤掉），供「恢复示例」判断。
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

    /** 内置项目是否存在被编辑或被隐藏的行（决定是否显示「恢复示例项目」） */
    hasBuiltinChanges(): boolean {
      const rowById = new Map(this.runtimeProjects.map((p) => [p.id, p]))
      return SHOWCASE_PROJECTS.some((p) => rowById.has(p.id))
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
        demo: { title: input.demoTitle.trim() || `${input.title.trim()} · 演示页`, points: input.demoPoints },
        createdAt: now,
        updatedAt: now,
      }
      await db.runtimeProjects.put(plain(row))
      await this.load()
      return row
    },

    /**
     * 编辑项目：自建项目改本行；内置项目写同 id 覆盖行（可经 resetBuiltins 恢复）。
     * hidden 状态在覆盖行上保留——编辑一个被隐藏的内置项目不应让它复活。
     */
    async updateProject(id: string, input: ProjectInput): Promise<void> {
      const existing = this.runtimeProjects.find((p) => p.id === id)
      const row: RuntimeProject = {
        id,
        title: input.title.trim(),
        eyebrow: input.eyebrow.trim(),
        accent: input.accent,
        summary: input.summary.trim(),
        stack: input.stack,
        demo: { title: input.demoTitle.trim() || `${input.title.trim()} · 演示页`, points: input.demoPoints },
        hidden: existing?.hidden,
        createdAt: existing?.createdAt ?? nowIso(),
        updatedAt: nowIso(),
      }
      await db.runtimeProjects.put(plain(row))
      await this.load()
    },

    /**
     * 删除项目：自建项目删行；内置项目写 hidden 墓碑（示例数据可删可恢复）。
     * 挂在项目上的演示页不动——项目恢复时演示页随之回来。
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

    /** 恢复全部内置示例项目：删除所有与内置 id 同名的行（覆盖与墓碑一并清除） */
    async resetBuiltins(): Promise<void> {
      const builtinIds = SHOWCASE_PROJECTS.map((p) => p.id)
      await db.runtimeProjects.bulkDelete(builtinIds)
      await this.load()
    },
  },
})
