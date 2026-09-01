import { defineStore } from 'pinia'
import { db } from '../../storage/db'
import type { LibraryCategory, LibraryDoc } from '../../storage/types'
import { LIBRARY_CATEGORIES, newId } from '../../storage/types'
import { parseFrontmatter } from '../../shared/markdown/frontmatter'
import { localDocs, type LocalDoc } from './localContent'

export type MergedDoc =
  | ({ kind: 'local'; overridden: false } & LocalDoc)
  | ({ kind: 'runtime'; overridden: boolean } & LibraryDoc)

function nowIso(): string {
  return new Date().toISOString()
}

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export const useLibraryStore = defineStore('library', {
  state: () => ({
    runtimeDocs: [] as LibraryDoc[],
    loaded: false,
  }),

  getters: {
    /** 合并清单：本地内置（被 runtime 同 id 覆盖时标「已修改」）∪ runtime */
    docs(state): MergedDoc[] {
      const runtimeById = new Map(state.runtimeDocs.map((d) => [d.id, d]))
      const local: MergedDoc[] = localDocs().map((doc) => {
        const overridden = runtimeById.has(doc.id)
        return overridden
          ? { kind: 'runtime', overridden: true, ...runtimeById.get(doc.id)! }
          : { kind: 'local', overridden: false, ...doc }
      })
      const localIds = new Set(local.map((d) => d.id))
      const runtimeOnly = state.runtimeDocs
        .filter((d) => !localIds.has(d.id))
        .map((d): MergedDoc => ({ kind: 'runtime', overridden: false, ...d }))
      return [...local, ...runtimeOnly].sort((a, b) => a.title.localeCompare(b.title, 'zh'))
    },
  },

  actions: {
    async load() {
      this.runtimeDocs = await db.libraryDocs.toArray()
      this.loaded = true
    },

    async upsertDoc(input: { id?: string; category: LibraryCategory; title: string; body: string; tags: string[] }) {
      const doc: LibraryDoc = {
        id: input.id ?? newId(),
        category: input.category,
        title: input.title,
        body: input.body,
        tags: input.tags,
        updatedAt: nowIso(),
        source: 'runtime',
      }
      await db.libraryDocs.put(plain(doc))
      await this.load()
    },

    /** 删除 runtime 文档；若 id 对应内置文档则等于「重置为内置」 */
    async removeDoc(id: string) {
      await db.libraryDocs.delete(id)
      await this.load()
    },

    /** 上传 .md 文本：frontmatter 解析，成功返回文档预览（不落库） */
    parseUploaded(raw: string, fallbackTitle: string): { title: string; category: LibraryCategory; tags: string[]; body: string } {
      const { attrs, body } = parseFrontmatter(raw)
      const category = (LIBRARY_CATEGORIES as readonly string[]).includes(String(attrs.category))
        ? (attrs.category as LibraryCategory)
        : '高频问题'
      return {
        title: String(attrs.title ?? fallbackTitle),
        category,
        tags: Array.isArray(attrs.tags) ? attrs.tags : [],
        body,
      }
    },
  },
})

/** 分类筛选的纯函数（供视图与测试复用） */
export function filterByCategory(docs: MergedDoc[], category: LibraryCategory | '全部'): MergedDoc[] {
  return category === '全部' ? docs : docs.filter((d) => d.category === category)
}

export const CATEGORY_TABS: Array<LibraryCategory | '全部'> = ['全部', ...LIBRARY_CATEGORIES]
