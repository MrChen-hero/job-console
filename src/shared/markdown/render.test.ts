import { describe, expect, it } from 'vitest'
import { renderMarkdown, sanitizeHtml } from './render'
import { isHttpUrl } from '../safeUrl'

describe('安全内容展示', () => {
  it('清理事件、脚本、危险链接与嵌入内容', () => {
    const html = renderMarkdown('<img src="x" onerror="alert(1)"><script>alert(1)</script><a href="javascript:alert(1)">链接</a><iframe src="https://example.com"></iframe><svg onload="alert(1)"></svg>')
    const root = document.createElement('div')
    root.innerHTML = html
    expect(root.querySelector('script, iframe, svg, [onerror], [onload]')).toBeNull()
    expect(root.querySelector('a')?.hasAttribute('href')).toBe(false)
  })
  it('保留 Markdown 排版与正常链接，演示要点共用清理规则', () => {
    const html = renderMarkdown('# 标题\n\n**重点** [官网](https://example.com)\n\n- 条目\n\n```js\nconst n = 1\n```')
    expect(html).toContain('<h1>标题</h1>')
    expect(html).toContain('<strong>重点</strong>')
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('<li>条目</li>')
    expect(html).toContain('<pre><code')
    expect(sanitizeHtml('<b onclick="alert(1)">要点</b>')).toBe('<b>要点</b>')
  })
  it('只接受完整 HTTP(S) 演示链接', () => {
    for (const value of ['https://example.com/demo', 'http://localhost:5173']) expect(isHttpUrl(value)).toBe(true)
    for (const value of ['javascript:alert(1)', 'data:text/html,test', '//example.com', '/demo', 'example.com', null]) expect(isHttpUrl(value)).toBe(false)
  })
})
