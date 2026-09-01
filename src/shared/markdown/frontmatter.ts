export interface FrontmatterDoc {
  attrs: Record<string, string | string[]>
  body: string
}

/** 解析 tags：[a, b] 或 a, b 两种写法 */
function parseTags(raw: string): string[] {
  const inner = raw.startsWith('[') && raw.endsWith(']') ? raw.slice(1, -1) : raw
  return inner
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
}

/**
 * 轻量 frontmatter 解析：key: value（tags 特殊处理数组）。
 * 首行必须是 `---` 且存在闭合 `---`，否则整篇视为正文。
 */
export function parseFrontmatter(source: string): FrontmatterDoc {
  const normalized = source.replace(/\r\n/g, '\n')
  if (!normalized.startsWith('---')) return { attrs: {}, body: normalized.trim() }
  const end = normalized.indexOf('\n---', 3)
  if (end < 0) return { attrs: {}, body: normalized.trim() }
  const headerBlock = normalized.slice(4, end)
  const bodyStart = normalized.indexOf('\n', end + 1)
  const body = bodyStart < 0 ? '' : normalized.slice(bodyStart + 1).trim()

  const attrs: Record<string, string | string[]> = {}
  for (const line of headerBlock.split('\n')) {
    const sep = line.indexOf(':')
    if (sep <= 0) continue
    const key = line.slice(0, sep).trim()
    const raw = line.slice(sep + 1).trim()
    if (raw === '') continue
    attrs[key] = key === 'tags' ? parseTags(raw) : raw
  }
  return { attrs, body }
}
