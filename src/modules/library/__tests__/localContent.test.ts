import { expect, it, vi } from 'vitest'
import * as frontmatter from '../../../shared/markdown/frontmatter'
import { localDocIds, localDocs } from '../localContent'

it('内置材料首次解析后，重复读取和获取删除标记 ID 不再解析正文', () => {
  const parse = vi.spyOn(frontmatter, 'parseFrontmatter')
  const docs = localDocs()
  expect(docs.length).toBeGreaterThan(0)
  expect(parse).toHaveBeenCalledTimes(docs.length)
  expect(localDocs()).toEqual(docs)
  expect(localDocIds()).toEqual(docs.map((doc) => doc.id))
  expect(parse).toHaveBeenCalledTimes(docs.length)
  parse.mockRestore()
})
