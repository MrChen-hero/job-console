import { describe, expect, it } from 'vitest'
import { parseFrontmatter } from '../frontmatter'

describe('parseFrontmatter', () => {
  it('解析 title/category/tags 与正文', () => {
    const md = `---
title: 自我介绍 · AI 岗版
category: 自我介绍
tags: [面试, 一分钟]
---

正文第一段。

正文第二段。
`
    const doc = parseFrontmatter(md)
    expect(doc.attrs.title).toBe('自我介绍 · AI 岗版')
    expect(doc.attrs.category).toBe('自我介绍')
    expect(doc.attrs.tags).toEqual(['面试', '一分钟'])
    expect(doc.body).toBe('正文第一段。\n\n正文第二段。')
  })

  it('无 frontmatter 时整篇为正文', () => {
    const doc = parseFrontmatter('只有正文')
    expect(doc.body).toBe('只有正文')
    expect(doc.attrs.title).toBeUndefined()
  })

  it('容错：未闭合分隔线视为正文', () => {
    const md = '---\ntitle: 断的\n没有结束线'
    const doc = parseFrontmatter(md)
    expect(doc.body).toBe(md)
  })

  it('tags 支持不带括号的逗号写法', () => {
    const doc = parseFrontmatter('---\ntitle: T\ntags: a, b\n---\nB')
    expect(doc.attrs.tags).toEqual(['a', 'b'])
  })

  it('多余未知键保留在 attrs', () => {
    const doc = parseFrontmatter('---\ntitle: T\nweight: 3\n---\nB')
    expect(doc.attrs.weight).toBe('3')
  })

  it('闭合线为末行且无尾随换行时 body 为空（不回退整篇）', () => {
    const doc = parseFrontmatter('---\ntitle: A\n---')
    expect(doc.attrs.title).toBe('A')
    expect(doc.body).toBe('')
  })
})
