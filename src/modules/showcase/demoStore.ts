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
  // charset=utf-8 不能省：Blob 里是 UTF-8 字节，不声明的话没写 <meta charset> 的上传页
  // 会被 iframe 按浏览器默认编码（windows-1252）解码，中文全成乱码
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
  blobUrlCache.set(html, url)
  return url
}

export const useDemoStore = defineStore('demo', {
  state: () => ({
    runtimeDemos: [] as RuntimeDemo[],
    loaded: false,
  }),

  getters: {
    /**
     * 合并清单：内置 demo 过滤隐藏墓碑 ∪ runtime demo（过滤墓碑行）。
     * 内置 demo 的删除与 library 内置文档同构：源文件是编译期产物删不掉，
     * 以 runtimeDemos 表中同 id 的 hidden:true 行（html 置空）作墓碑表达。
     */
    merged(state): MergedDemo[] {
      const hiddenIds = new Set(state.runtimeDemos.filter((d) => d.hidden).map((d) => d.id))
      const local = localDemos()
        .filter((d) => !hiddenIds.has(d.id))
        .map((d) => ({ source: 'local' as const, ...d }))
      const runtime = state.runtimeDemos
        .filter((d) => !d.hidden)
        .map((d) => ({ source: 'runtime' as const, ...d }))
      return [...local, ...runtime]
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

    /**
     * 删除演示页：runtime 行直接删行（顺带 revoke Blob URL）；
     * 内置 demo 写 hidden 墓碑行——与 library 的 deletedDocs 同构，无「恢复内置」入口。
     */
    async removeDemo(id: string) {
      const row = this.runtimeDemos.find((d) => d.id === id)
      if (row) {
        const url = blobUrlCache.get(row.html)
        if (url) {
          URL.revokeObjectURL(url)
          blobUrlCache.delete(row.html)
        }
        await db.runtimeDemos.delete(id)
      } else {
        const source = localDemos().find((d) => d.id === id)
        if (!source) return
        await db.runtimeDemos.put(
          plain({
            id: source.id,
            projectId: source.projectId,
            title: source.title,
            html: '',
            createdAt: nowIso(),
            updatedAt: nowIso(),
            hidden: true,
          }),
        )
      }
      await this.load()
    },
  },
})
