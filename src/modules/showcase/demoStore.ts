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

/** 回收某段 html 对应的 Blob URL（内容被替换或行被删除时） */
function revokeHtml(html: string): void {
  const url = blobUrlCache.get(html)
  if (!url) return
  URL.revokeObjectURL(url)
  blobUrlCache.delete(html)
}

export interface DemoInput {
  projectId: string
  title: string
  /** 上传式演示的 HTML；链接式传空串 */
  html: string
  /** 链接式演示地址；两者只填其一 */
  url?: string
  points?: string[]
}

export const useDemoStore = defineStore('demo', {
  state: () => ({
    runtimeDemos: [] as RuntimeDemo[],
    loaded: false,
  }),

  getters: {
    /**
     * 同 id 的 runtime 内容覆盖内置演示，隐藏标记同时屏蔽原内容。
     * 内置 demo 的删除与 library 内置文档同构：源文件是编译期产物删不掉，
     * 以 runtimeDemos 表中同 id 的 hidden:true 行（html 置空）作墓碑表达。
     */
    merged(state): MergedDemo[] {
      const runtimeIds = new Set(state.runtimeDemos.map((d) => d.id))
      const local = localDemos()
        .filter((d) => !runtimeIds.has(d.id))
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

    async addDemo(input: DemoInput): Promise<RuntimeDemo> {
      const now = nowIso()
      const row: RuntimeDemo = { ...input, id: newId(), createdAt: now, updatedAt: now }
      await db.runtimeDemos.put(plain(row))
      await this.load()
      return row
    },

    /**
     * 内置与自建演示统一编辑；内置首次编辑写同 id 覆盖行。
     */
    async updateDemo(id: string, input: DemoInput): Promise<void> {
      const existing = this.runtimeDemos.find((d) => d.id === id) ?? (await db.runtimeDemos.get(id))
      const builtin = localDemos().find((d) => d.id === id)
      if ((!existing && !builtin) || existing?.hidden) throw new Error('该演示页已不存在')
      // 换掉 html 时把旧内容的 Blob URL 回收，否则旧 URL 会一直挂在缓存里
      await db.runtimeDemos.put(plain({
        ...existing,
        ...input,
        id,
        createdAt: existing?.createdAt ?? nowIso(),
        updatedAt: nowIso(),
      }))
      const oldHtml = existing?.html ?? builtin?.html
      if (oldHtml && oldHtml !== input.html) revokeHtml(oldHtml)
      await this.load()
    },

    /**
     * 删除演示页：runtime 行直接删行（顺带 revoke Blob URL）；
     * 内置 demo 写 hidden 墓碑行——与 library 的 deletedDocs 同构，无「恢复内置」入口。
     */
    async removeDemo(id: string) {
      const row = this.runtimeDemos.find((d) => d.id === id)
      const source = localDemos().find((d) => d.id === id)
      if (source) {
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
      } else {
        await db.runtimeDemos.delete(id)
      }
      if (row?.html) revokeHtml(row.html)
      await this.load()
    },
  },
})
