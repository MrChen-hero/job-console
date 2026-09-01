import { defineStore } from 'pinia'
import { db } from '../../storage/db'
import type { LibraryCategory, LibraryCategoryRow, LibraryDoc } from '../../storage/types'
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
    categoryRows: [] as LibraryCategoryRow[],
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

    /** 全部分类：内置默认 ∪ 自定义（排序稳定：内置序在前，自定义按 zh 排序） */
    categories(state): LibraryCategory[] {
      const custom = state.categoryRows.map((r) => r.name).sort((a, b) => a.localeCompare(b, 'zh'))
      return [...LIBRARY_CATEGORIES, ...custom]
    },

    /** 仅自定义分类（内置固定，不可删改） */
    customCategories(state): LibraryCategory[] {
      return state.categoryRows.map((r) => r.name).sort((a, b) => a.localeCompare(b, 'zh'))
    },
  },

  actions: {
    async load() {
      const [docs, categoryRows] = await Promise.all([db.libraryDocs.toArray(), db.libraryCategories.toArray()])
      this.runtimeDocs = docs
      this.categoryRows = categoryRows
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

    /* ---------- 自定义分类 ---------- */

    /** 新增自定义分类；重名或撞内置名返回 false */
    async addCategory(name: string): Promise<boolean> {
      const trimmed = name.trim()
      if (trimmed === '' || this.categories.includes(trimmed)) return false
      await db.libraryCategories.put({ name: trimmed })
      await this.load()
      return true
    },

    /**
     * 重命名自定义分类：换主键 + 迁移该分类下 runtime 文档的 category。
     * 目标名已存在（内置或自定义）时返回 false。
     */
    async renameCategory(from: string, to: string): Promise<boolean> {
      const target = to.trim()
      if (target === '' || !this.customCategories.includes(from) || this.categories.includes(target)) return false
      await db.transaction('rw', [db.libraryCategories, db.libraryDocs], async () => {
        await db.libraryCategories.delete(from)
        await db.libraryCategories.put({ name: target })
        await db.libraryDocs.where('category').equals(from).modify({ category: target })
      })
      await this.load()
      return true
    },

    /** 删除自定义分类；分类下仍有 runtime 文档时拒绝（返回 false），避免文档变成「无分类可见」 */
    async removeCategory(name: string): Promise<boolean> {
      if (!this.customCategories.includes(name)) return false
      const used = await db.libraryDocs.where('category').equals(name).count()
      if (used > 0) return false
      await db.libraryCategories.delete(name)
      await this.load()
      return true
    },

    /** 上传 .md 文本：frontmatter 解析，成功返回文档预览（不落库）。未知分类回落「高频问题」 */
    parseUploaded(raw: string, fallbackTitle: string): { title: string; category: LibraryCategory; tags: string[]; body: string } {
      const { attrs, body } = parseFrontmatter(raw)
      const category = this.categories.includes(String(attrs.category))
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
