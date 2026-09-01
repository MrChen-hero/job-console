import { defineStore } from 'pinia'
import { db } from '../../storage/db'
import type { RuntimeDemo } from '../../storage/types'
import { newId } from '../../storage/types'
import { localDemos } from '../library/localContent'

export type MergedDemo =
  | ({ source: 'local' } & import('../../storage/types').LocalDemo)
  | ({ source: 'runtime' } & RuntimeDemo)

function nowIso(): string {
  return new Date().toISOString()
}

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** html → Blob URL（iframe src 用）；按内容缓存，避免泄漏 */
const blobUrlCache = new Map<string, string>()

export function demoUrl(html: string): string {
  const cached = blobUrlCache.get(html)
  if (cached) return cached
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  blobUrlCache.set(html, url)
  return url
}

export const useDemoStore = defineStore('demo', {
  state: () => ({
    runtimeDemos: [] as RuntimeDemo[],
    loaded: false,
  }),

  getters: {
    merged(state): MergedDemo[] {
      const local = localDemos().map((d) => ({ source: 'local' as const, ...d }))
      return [...local, ...state.runtimeDemos.map((d) => ({ source: 'runtime' as const, ...d }))]
    },

    /** 按 projectId 分组（Deck 组装纵向页用） */
    byProject(): (projectId: string) => MergedDemo[] {
      return (projectId: string) => this.merged.filter((d) => d.projectId === projectId)
    },
  },

  actions: {
    async load() {
      this.runtimeDemos = await db.runtimeDemos.toArray()
      this.loaded = true
    },

    async addDemo(input: { projectId: string; title: string; html: string }): Promise<RuntimeDemo> {
      const now = nowIso()
      const row: RuntimeDemo = { ...input, id: newId(), createdAt: now, updatedAt: now }
      await db.runtimeDemos.put(plain(row))
      await this.load()
      return row
    },

    async removeDemo(id: string) {
      const row = this.runtimeDemos.find((d) => d.id === id)
      if (row) {
        const url = blobUrlCache.get(row.html)
        if (url) {
          URL.revokeObjectURL(url)
          blobUrlCache.delete(row.html)
        }
      }
      await db.runtimeDemos.delete(id)
      await this.load()
    },
  },
})
