import type { LibraryCategory, LocalDemo } from '../../storage/types'
import { parseFrontmatter } from '../../shared/markdown/frontmatter'
import { LIBRARY_CATEGORIES } from '../../storage/types'
import { SHOWCASE_PROJECTS } from '../../config/showcase.config'

export interface LocalDoc {
  id: string
  category: LibraryCategory
  title: string
  body: string
  tags: string[]
}

/** 编译时收集内置材料：src/content/library/*.md（Vite 静态可分析的 glob） */
const mdModules = import.meta.glob('../../content/library/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** 编译时收集内置交互演示：src/content/demos/*.html（projectId 由文件名前缀 `projectId--` 声明） */
const htmlModules = import.meta.glob('../../content/demos/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function idFromPath(path: string): string {
  const base = path.split('/').pop() ?? path
  return base.replace(/\.(md|html)$/, '')
}

export function localDocs(): LocalDoc[] {
  return Object.entries(mdModules)
    .map(([path, raw]) => {
      const { attrs, body } = parseFrontmatter(raw)
      const category = (LIBRARY_CATEGORIES as readonly string[]).includes(String(attrs.category))
        ? (attrs.category as LibraryCategory)
        : '高频问题'
      return {
        id: idFromPath(path),
        category,
        title: String(attrs.title ?? idFromPath(path)),
        body,
        tags: Array.isArray(attrs.tags) ? attrs.tags : [],
      }
    })
    .sort((a, b) => a.id.localeCompare(b.id))
}

function projectIdOf(demoId: string): string {
  const sep = demoId.indexOf('--')
  const prefix = sep > 0 ? demoId.slice(0, sep) : ''
  return SHOWCASE_PROJECTS.some((p) => p.id === prefix) ? prefix : SHOWCASE_PROJECTS[0]!.id
}

function titleOf(html: string, fallback: string): string {
  const match = /<title>([^<]*)<\/title>/i.exec(html)
  return match?.[1]?.trim() || fallback
}

export function localDemos(): LocalDemo[] {
  return Object.entries(htmlModules)
    .map(([path, html]) => {
      const id = idFromPath(path)
      return {
        id,
        projectId: projectIdOf(id),
        title: titleOf(html, id),
        html,
      }
    })
    .sort((a, b) => a.id.localeCompare(b.id))
}
