import { describe, expect, it } from 'vitest'
import { markdownPreview } from './preview'

describe('markdownPreview', () => {
  it('保留正文与链接文本，不暴露 Markdown 标记或 URL', () => {
    expect(markdownPreview('# 标题\n\n**重点**与[资料](https://example.com)\n\n- 第一项\n- `代码`')).toBe('标题 重点与资料 第一项 代码')
  })
  it('空文档与表格可以提取，HTML 块不作为摘要', () => {
    expect(markdownPreview('')).toBe('')
    expect(markdownPreview('| 名称 |\n| --- |\n| **内容** |')).toBe('名称 内容')
    expect(markdownPreview('<script>secret()</script>\n\n正文')).toBe('正文')
  })
})
