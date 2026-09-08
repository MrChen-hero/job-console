import { defineStore } from 'pinia'
import { db } from '../../storage/db'
import type { LibraryCategory, LibraryCategoryRow, LibraryDoc } from '../../storage/types'
import { localDocIds } from './localContent'
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

function zh(a: string, b: string): number {
  return a.localeCompare(b, 'zh')
}

function isBuiltinName(name: string): boolean {
  return (LIBRARY_CATEGORIES as readonly string[]).includes(name)
}

/** 内置分类的覆盖行（name = 原始内置名） */
function builtinRows(rows: LibraryCategoryRow[]): Map<string, LibraryCategoryRow> {
  return new Map(rows.filter((r) => r.builtin).map((r) => [r.name, r]))
}

/** 原始分类名 → 生效名：仅内置分类有覆盖行；自定义与未覆盖的内置原名即生效名 */
function mapCategoryWith(rows: LibraryCategoryRow[], raw: string): string {
  const o = builtinRows(rows).get(raw)
  return o && !o.hidden ? (o.renamedTo ?? raw) : raw
}

export const useLibraryStore = defineStore('library', {
  state: () => ({
    runtimeDocs: [] as LibraryDoc[],
    categoryRows: [] as LibraryCategoryRow[],
    deletedDocIds: [] as string[],
    loaded: false,
  }),

  getters: {
    /**
     * 合并清单：本地内置（被 runtime 同 id 覆盖时标「已修改」）∪ runtime。
     * 文档 category 经内置改名映射后输出，视图与筛选只面对生效名。
     */
    docs(state): MergedDoc[] {
      const map = (c: string) => mapCategoryWith(state.categoryRows, c)
      const deleted = new Set(state.deletedDocIds)
      const runtimeById = new Map(state.runtimeDocs.map((d) => [d.id, d]))
      const local: MergedDoc[] = localDocs()
        .filter((doc) => !deleted.has(doc.id))
        .map((doc) => {
          const runtime = runtimeById.get(doc.id)
          if (runtime) {
            return { kind: 'runtime', overridden: true, ...runtime, category: map(runtime.category) }
          }
          return { kind: 'local', overridden: false, ...doc, category: map(doc.category) }
        })
      const localIds = new Set(localDocs().map((d) => d.id))
      const runtimeOnly = state.runtimeDocs
        .filter((d) => !localIds.has(d.id) && !deleted.has(d.id))
        .map((d): MergedDoc => ({ kind: 'runtime', overridden: false, ...d, category: map(d.category) }))
      return [...local, ...runtimeOnly].sort((a, b) => a.title.localeCompare(b.title, 'zh'))
    },

    /** 全部分类（生效名）：内置（经改名/隐藏覆盖）∪ 自定义（zh 排序） */
    categories(state): LibraryCategory[] {
      const overrides = builtinRows(state.categoryRows)
      const builtins = LIBRARY_CATEGORIES.flatMap((b) => {
        const o = overrides.get(b)
        return o?.hidden ? [] : [o?.renamedTo ?? b]
      })
      const customs = state.categoryRows.filter((r) => !r.builtin).map((r) => r.name).sort(zh)
      return [...builtins, ...customs]
    },

    /** 仅自定义分类行（不含内置覆盖行） */
    customCategories(state): LibraryCategory[] {
      return state.categoryRows.filter((r) => !r.builtin).map((r) => r.name).sort(zh)
    },

  },

  actions: {
    async load() {
      const [docs, categoryRows, deletedRows] = await Promise.all([
        db.libraryDocs.toArray(),
        db.libraryCategories.toArray(),
        db.deletedDocs.toArray(),
      ])
      this.runtimeDocs = docs
      this.categoryRows = categoryRows
      this.deletedDocIds = deletedRows.map((r) => r.id)
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

    /**
     * 删除文档：纯 runtime 文档删行；内置文档（或其 runtime 覆盖行）写 deletedDocs 墓碑，
     * 使内置 md 不再出现在合并清单（内置源文件删不掉，删除以墓碑表达）。
     */
    async removeDoc(id: string) {
      await db.libraryDocs.delete(id)
      if (localDocIds().includes(id)) {
        await db.deletedDocs.put({ id })
      }
      await this.load()
    },

    /* ---------- 分类管理（内置与自定义统一入口） ---------- */

    /** 新增分类；空名或与现有生效分类重名返回 false */
    async addCategory(name: string, icon = 'layers'): Promise<boolean> {
      const trimmed = name.trim()
      if (trimmed === '' || this.categories.includes(trimmed)) return false
      await db.libraryCategories.put({ name: trimmed, icon })
      await this.load()
      return true
    },

    /**
     * 编辑分类名称与图标（省略 icon 时保留原图标）：
     * - 内置分类（含已改名后的再次改名）：写覆盖行 renamedTo，文档不重写（读取时映射）；
     *   改回原名且无自定义图标时删除覆盖行，回到编译期默认。
     * - 自定义分类：换主键 + 事务内迁移该分类下文档的 category。
     */
    async renameCategory(from: string, to: string, icon?: string): Promise<boolean> {
      const target = to.trim()
      if (target === '' || !this.categories.includes(from) || (target !== from && this.categories.includes(target))) return false
      const row = this.categoryRows.find((r) => r.builtin && (r.renamedTo ?? r.name) === from)
      if (row || isBuiltinName(from)) {
        const selectedIcon = icon ?? row?.icon
        if (row && target === row.name && !selectedIcon) {
          await db.libraryCategories.delete(row.name)
        } else {
          await db.libraryCategories.put({ name: row?.name ?? from, builtin: true, renamedTo: target, icon: selectedIcon })
        }
      } else {
        await db.transaction('rw', [db.libraryCategories, db.libraryDocs], async () => {
          await db.libraryCategories.delete(from)
          const existing = this.categoryRows.find((r) => r.name === from)
          await db.libraryCategories.put({ ...existing, name: target, icon: icon ?? existing?.icon })
          await db.libraryDocs.where('category').equals(from).modify({ category: target })
        })
      }
      await this.load()
      return true
    },

    /** 删除分类：分类下仍有文档时拒绝（含内置文档）；内置分类写隐藏覆盖行 */
    async removeCategory(name: string): Promise<boolean> {
      if (!this.categories.includes(name)) return false
      if (this.docs.some((d) => d.category === name)) return false
      const row = this.categoryRows.find((r) => r.builtin && (r.renamedTo ?? r.name) === name)
      if (row || isBuiltinName(name)) {
        // 内置分类：写隐藏覆盖行（未曾改名的也要写，否则 const 默认清单仍会显示它）
        await db.libraryCategories.put({ name: row?.name ?? name, builtin: true, hidden: true })
      } else {
        await db.libraryCategories.delete(name)
      }
      await this.load()
      return true
    },


    /** 上传 .md 文本：frontmatter 解析，成功返回文档预览（不落库）。分类名经映射后仍未知则回落「高频问题」 */
    parseUploaded(raw: string, fallbackTitle: string): { title: string; category: LibraryCategory; tags: string[]; body: string } {
      const { attrs, body } = parseFrontmatter(raw)
      const mapped = mapCategoryWith(this.categoryRows, String(attrs.category))
      const category = this.categories.includes(mapped) ? mapped : '高频问题'
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
