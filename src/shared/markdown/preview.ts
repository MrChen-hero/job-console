import { marked, type Token } from 'marked'

/** 使用解析后的文本生成摘要，避免标题标记、链接地址和 HTML 混入列表。 */
export function markdownPreview(source: string): string {
  function textOf(token: Token): string {
    if (token.type === 'html') return ''
    if ('tokens' in token && Array.isArray(token.tokens)) return token.tokens.map(textOf).join('')
    if (token.type === 'list') return token.items.map(textOf).join(' ')
    if (token.type === 'table') return [...token.header, ...token.rows.flat()].map((cell) => cell.tokens.map(textOf).join('')).join(' ')
    return 'text' in token && typeof token.text === 'string' ? token.text : ' '
  }
  return marked.lexer(source).map(textOf).join(' ').replace(/\s+/g, ' ').trim()
}
